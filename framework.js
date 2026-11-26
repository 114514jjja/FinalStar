/* ============================================================
   终星 FinalStar —— 入口（不依赖任何框架：只用 SugarCube / DoL 原生机制）
   依赖：MyFirstMod（提供魔书、手枪、玖肆线与贝利线、赌场、银行大厅）
   挂钩方式：
     - jQuery 原生事件 :passageinit / :passagedisplay（SugarCube 自带）
     - 段落文本替换（TweeReplacer）与脚本替换（ReplacePatcher）
   ============================================================ */
(function () {
	'use strict';

	window.finalStar = window.finalStar || {};
	finalStar.version = 'v0.28';
	finalStar.modName = 'FinalStar';
	finalStar.ready = false;
	finalStar._pending = finalStar._pending || [];

	function fsConsoleLog() {
		var args = Array.prototype.slice.call(arguments);
		try { console.log.apply(console, ['[终星]'].concat(args)); } catch (e) { }
	}

	finalStar.log = function () {
		var args = Array.prototype.slice.call(arguments);
		if (window.maplebirch && maplebirch.log) {
			try { maplebirch.log('[终星] ' + args.join(' ')); return; } catch (e) { }
		}
		fsConsoleLog.apply(null, args);
	};
	finalStar.warn = function () {
		var args = Array.prototype.slice.call(arguments);
		if (window.maplebirch && maplebirch.log) {
			try { maplebirch.log('[终星] ' + args.join(' '), 'WARN'); return; } catch (e) { }
		}
		fsConsoleLog.apply(null, args);
	};

	/* 无框架工具函数 */
	finalStar.clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };
	finalStar.clone = function (o) {
		try {
			if (typeof window.clone === 'function') return window.clone(o);
			return JSON.parse(JSON.stringify(o));
		} catch (e) { return o; }
	};
	/* 把 wikitext 渲染成 HTML 字符串（用于自绘按钮/面板） */
	finalStar.wikiText = function (text) {
		try {
			var d = document.createElement('div');
			new Wikifier(d, text);
			return d.innerHTML;
		} catch (e) { return ''; }
	};

	/* 轻提示：贴在正文顶上一行，下次换段自然消失。
	   历史上 `fs.notice()` 被调用过（背包里点已经吃完的那一份）却从未定义 ——
	   调用点有 `fs.notice` 的真假判断，所以不会报错，只是**什么也不显示**。这里补上实现。 */
	finalStar.notice = function (msg) {
		try {
			var text = String(msg === null || msg === undefined ? '' : msg).trim();
			if (!text) return false;
			var host = finalStar.passageHost ? finalStar.passageHost() : null;
			if (!host) return false;
			var d = document.createElement('div');
			d.className = 'fs-notice fs-sub';
			d.textContent = text;
			if (host.firstChild) host.insertBefore(d, host.firstChild);
			else host.appendChild(d);
			return true;
		} catch (e) { return false; }
	};

	/* 模块注册入口：模块文件调用它排队初始化任务（不再等待框架） */
	finalStar.register = function (name, fn) {
		finalStar._pending.push({ name: name, fn: fn });
	};

	/* 存档数据初始化 */
	finalStar.ensureData = function () {
		if (typeof V === 'undefined' || !V) return;
		if (V.fs_noCorpseDrag === undefined) V.fs_noCorpseDrag = false;
		if (V.fs_freeCasino === undefined) V.fs_freeCasino = false;
		if (V.fs_freeEncounter === undefined) V.fs_freeEncounter = false;
		if (V.fs_casinoMaster === undefined) V.fs_casinoMaster = false;
		if (V.fs_undying === undefined) V.fs_undying = false;
		if (V.fs_duelOff === undefined) V.fs_duelOff = false;
		if (V.fs_sidebarIcon === undefined) V.fs_sidebarIcon = true;
		if (V.fs_combatPanel === undefined) V.fs_combatPanel = true;
		/* 玖肆「剧情战斗不救场」：默认开启（名单见 fs-storybattles.js） */
		if (V.fs_jiusiStoryGuard === undefined) V.fs_jiusiStoryGuard = true;
		/* 数学课「偷偷拆信」线（见 twee/FinalStarSchool.twee :: FS Maths Note Peek）
		   fs_headPunishTaken：玖肆替你扛下了这一次课后留堂（已顶罪）
		   fs_headOfficeLocked：那一趟之后，当天下午校长办公室锁门 / 敲门没反应 / 保安站在门口 → 进不去 */
		if (V.fs_headPunishTaken === undefined) V.fs_headPunishTaken = 0;
		/* ⚠️ 把我们自己的物品特质标签补进 setup.clothingTraits。
		   原版是在 clothing_data 宏里**算一次**的：
		     setup.clothingTraits = [...new Set(Object.values(setup.clothes.all).flatMap(x => x.type))].sort();
		   而我们的物品（魔法书 magic / 制式手枪 miracle）注册得比那还晚，标签压根没进去 ——
		   结果就是"标签写对了、衣柜里什么都不显示"（验证确认）。
		   放 ensureData() 里是因为它每次进段落都跑，最迟在开衣柜前一定补上；重复调用幂等。 */
		try {
			if (window.setup && Array.isArray(setup.clothingTraits)) {
				['magic', 'miracle'].forEach(function (t) {
					if (setup.clothingTraits.indexOf(t) === -1) setup.clothingTraits.push(t);
				});
			}
			/* ★ 中文显示名就挂在这里 —— **原版自己的机制**，不用改 DOM：
			   原版 <<widget "shoptraits">> 是这么渲染特质的：
			     <<for _trait range setup.clothingTraits>>
			       <<if _temp_choice.type.includes(_trait)>>
			         <<set _traitObj to setup.shopDetails[_trait]>>
			         ... <<print _traitObj.name>> ...
			   所以**标签（type）用英文给系统、显示名（shopDetails.name）用中文给玩家** ——
			   这正是用户要的「英文给系统看，中文给玩家看，相当于自带一份特化汉化」。
			   desc 会被 <<clothingtrait>> 用来显示悬浮说明。 */
			if (window.setup) {
				setup.shopDetails = setup.shopDetails || {};
				if (!setup.shopDetails.magic) {
					setup.shopDetails.magic = {
						name: '魔法',
						details: 'none',
						desc: '这本书里记着的东西不完全属于这个世界。拿着它，你能念出不该念的字句——代价是那道门一旦打开，就不再只朝你开着。'
					};
				}
				if (!setup.shopDetails.miracle) {
					setup.shopDetails.miracle = {
						name: '奇迹',
						details: 'none',
						desc: '残次的奇迹会顺着伤口爬进人身体里。它让你更能扛，也让你离「还是人」这件事更远一点。'
					};
				}
			}
		} catch (e) { }
		if (V.fs_headOfficeLocked === undefined) V.fs_headOfficeLocked = 0;

		if (!V.fsData || typeof V.fsData !== 'object') {
			V.fsData = { seals: [], sealEquipped: 'none', bullets: {}, currentBullet: 'normal', cave: {} };
		}
		if (!Array.isArray(V.fsData.seals)) V.fsData.seals = [];
		if (!V.fsData.bullets || typeof V.fsData.bullets !== 'object') V.fsData.bullets = {};
		if (!V.fsData.currentBullet) V.fsData.currentBullet = 'normal';
		if (!V.fsData.cave || typeof V.fsData.cave !== 'object') V.fsData.cave = {};
		if (V.fsData.sealEquipped === undefined) V.fsData.sealEquipped = 'none';
		if (!V.daily) V.daily = {};
		if (V.daily.fsCasts === undefined) V.daily.fsCasts = 0;
	};

	/* 打开设置面板。
	   实现在 fs-core.js 的 fs.openOverlayPanel()（本文件比 fs-core.js 先加载，
	   这里只做占位转发，避免出现两份实现互相覆盖、日后改错那一份）。
	   历史坑：这里原来写 $.wiki('<<overlayReplace "finalStarPanel">>')，
	   但本体的 overlayReplace 是 switch 固定分支表，没有 finalStarPanel 这一支，
	   结果面板弹出来是空的。详见 fs-core.js 里的说明。 */
	if (typeof finalStar.openSettings !== 'function') {
		finalStar.openSettings = function () {
			try {
				if (typeof finalStar.openOverlayPanel === 'function') return finalStar.openOverlayPanel();
			} catch (e) { finalStar.warn('打开设置面板失败: ' + e.message); }
			return false;
		};
	}

	/* ---------- 时间推进检测（替代框架的 regTimeEvent） ---------- */
	finalStar._hourHooks = [];
	finalStar._dayHooks = [];
	finalStar._weekHooks = [];
	finalStar.onHour = function (fn) { finalStar._hourHooks.push(fn); };
	finalStar.onDay = function (fn) { finalStar._dayHooks.push(fn); };

	function stampOf() {
		try {
			var day = (typeof Time !== 'undefined' && Time.days) ? Time.days : 0;
			var hour = (typeof Time !== 'undefined' && typeof Time.hour === 'number') ? Time.hour : 0;
			var week = (typeof Time !== 'undefined' && typeof Time.weekDay === 'number') ? Time.weekDay : 0;
			return { day: day, hour: hour, week: week };
		} catch (e) { return null; }
	}

	function runHooks(list, data) {
		list.forEach(function (fn) {
			try { fn(data); } catch (e) { finalStar.warn('时间事件失败: ' + e.message); }
		});
	}

	finalStar.timeTick = function () {
		try {
			var now = stampOf();
			if (!now) return;
			if (V.fs_hourStamp === undefined) { V.fs_hourStamp = now.day * 24 + now.hour; V.fs_dayStamp = now.day; V.fs_weekStamp = now.week; return; }
			var hourStamp = now.day * 24 + now.hour;
			if (hourStamp !== V.fs_hourStamp) {
				var diff = hourStamp - V.fs_hourStamp;
				if (diff < 0) diff = 1;                 /* 时间回退（读档）时只补一次 */
				if (diff > 24) diff = 24;
				V.fs_hourStamp = hourStamp;
				runHooks(finalStar._hourHooks, { hours: diff });
			}
			if (now.day !== V.fs_dayStamp) {
				var ddiff = now.day - V.fs_dayStamp;
				if (ddiff < 0) ddiff = 1;
				if (ddiff > 7) ddiff = 7;
				V.fs_dayStamp = now.day;
				for (var i = 0; i < ddiff; i++) runHooks(finalStar._dayHooks, { index: i });
			}
		} catch (e) { finalStar.warn('时间推进检测失败: ' + e.message); }
	};

	/* ---------- 段落渲染钩子（SugarCube 原生事件） ---------- */
	finalStar._displayHooks = [];
	finalStar._initHooks = [];
	finalStar.onDisplay = function (fn) { finalStar._displayHooks.push(fn); };
	finalStar.onInit = function (fn) { finalStar._initHooks.push(fn); };

	/* 正文容器：各版本 DoL 的结构不一样（本版没有 #passage-content，
	   段落就是 #passage-<名字>）。以前写死取 #passage-content，取不到就静默返回，
	   结果战斗入口 / 地点入口整块消失，且不报错、很难查。统一在这里取。 */
	finalStar.passageHost = function () {
		try {
			var pc = document.getElementById('passage-content');
			if (pc) return pc;
			var ps = document.querySelectorAll('#passages .passage');
			if (ps.length) return ps[ps.length - 1];
			return document.getElementById('passages') || null;
		} catch (e) { return null; }
	};

	function wireHooks() {
		try {
			$(document).on(':passageinit.finalstar', function () {
				try { finalStar.ensureData(); } catch (e) { }
				try { finalStar.timeTick(); } catch (e) { }
				finalStar._initHooks.forEach(function (fn) {
					try { fn(); } catch (e) { finalStar.warn('段落初始化钩子失败: ' + e.message); }
				});
			});
			$(document).on(':passagedisplay.finalstar', function () {
				finalStar._displayHooks.forEach(function (fn) {
					try { fn(); } catch (e) { finalStar.warn('渲染钩子失败: ' + e.message); }
				});
			});
			return true;
		} catch (e) {
			finalStar.warn('安装段落钩子失败: ' + e.message);
			return false;
		}
	}

	/* ---------- 启动 ---------- */
	var booted = false;
	function tryBoot() {
		if (booted) return true;
		try {
			if (typeof V === 'undefined' || !V) return false;
			if (typeof setup === 'undefined' || !setup) return false;
			if (typeof $ === 'undefined') return false;
		} catch (e) { return false; }
		booted = true;
		finalStar.ready = true;
		try {
			finalStar.ensureData();
			wireHooks();
		} catch (e) { finalStar.warn('钩子安装异常: ' + e.message); }
		finalStar._pending.forEach(function (item) {
			try { item.fn(); }
			catch (e) { finalStar.warn('模块 [' + item.name + '] 初始化失败: ' + e.message); }
		});
		finalStar.log('初始化完成 v' + finalStar.version + '（模块 ' + finalStar._pending.length + ' 个，无框架依赖）');
		return true;
	}

	finalStar.boot = tryBoot;

	var tries = 0;
	var timer = setInterval(function () {
		tries++;
		if (tryBoot() || tries > 600) clearInterval(timer);
	}, 200);

	/* SugarCube 就绪后立刻再试一次 */
	try {
		if (typeof $(document).one === 'function') {
			$(document).one(':storyready', function () { tryBoot(); });
			$(document).one(':passagestart', function () { tryBoot(); });
		}
	} catch (e) { }

	fsConsoleLog('入口已加载（无框架依赖），等待 SugarCube 就绪…');
})();
