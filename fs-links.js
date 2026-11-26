/* ============================================================
   终星 FinalStar —— 地点入口（无框架）
   把「魔女小屋 / 地下洞穴 / 询问教堂 / 贝利回归提示」等入口
   统一挂在段落正文下方（正常链接位置），不再顶在文本最上方。
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* 玖肆失望后：她不再出现在玩家的视野里（孤儿院 / 学校 / 湖边跟随都不再出现） */
	fs.jiusiHidden = function () {
		try { return !!(V.fsData && V.fsData.jiusiDisappointed === 1); } catch (e) { return false; }
	};


	/* ================= 理智（Sanity）与感染（Infection）================= */
	fs.sanity = function () { try { var v = V.fsData.sanity; return (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(100, v)) : 100; } catch (e) { return 100; } };
	fs.sanityAdd = function (d) {
		try {
			fs.ensureData();
			var v = Math.max(0, Math.min(100, fs.sanity() + Number(d || 0)));
			V.fsData.sanity = v;
			fs.log('理智 ' + (d >= 0 ? '+' : '') + d + ' → ' + v);
			return v;
		} catch (e) { return fs.sanity(); }
	};
	/* 每日自然恢复一次（一天只加一次） */
	fs.sanityTick = function () {
		try {
			fs.ensureData();
			var day = (typeof Time !== 'undefined') ? (Time.year + '-' + Time.month + '-' + Time.monthDay) : null;
			if (!day || V.fsData.sanityDay === day) return;
			V.fsData.sanityDay = day;
			/* ⚠️ 必须**先**判断归零，再执行 sanityAdd(2)。
			   原写法是「先 +2、再判 sanity() <= 0」—— +2 已经把 0 变成 2，
			   于是那一支**永远为假**，说明书里承诺的「理智归零 → 混乱，压力 +200」从未生效过。 */
			var _wasZero = (fs.sanity() <= 0);
			if (fs.sanity() < 100) fs.sanityAdd(2);                       /* 一天 +2，缓慢恢复 */
			if (_wasZero) {                                               /* 混乱：压力暴增 */
				V.stress = (Number(V.stress) || 0) + 200;
				fs.log('理智归零 → 混乱状态，压力 +200');
			}
		} catch (e) { }
	};
	/* 颜色与文案（绿色为「你的头脑十分清醒」，其余由我拟） */
	fs.sanityLabel = function () {
		var v = fs.sanity();
		if (v >= 85) return ['green', '你的头脑十分清醒。'];
		if (v >= 65) return ['teal', '你的思路还算清楚，只是偶尔会走神。'];
		if (v >= 45) return ['gold', '你觉得有点恍惚，需要集中精神才能想清事情。'];
		if (v >= 25) return ['orange', '你的念头开始散开，判断变得不太可靠。'];
		if (v > 0) return ['red', '你几乎抓不住自己的想法，眼前的事一件件滑走。'];
		return ['red', '你陷入了混乱——连要去哪里都变得说不准。'];
	};
	fs.infect = function () { try { var v = V.fsData.infect; return (typeof v === 'number' && isFinite(v)) ? Math.max(0, v) : 0; } catch (e) { return 0; } };
	/* 感染原本**只有 getter、没有 setter** —— 魔女小屋那瓶"缓解感染"的药没有它就没法生效。
	   这里补上写入，并且**自己保证 0~100 夹紧**（跟 fs.sanityAdd 同一套写法）；返回夹紧后的新值。 */
	fs.infectAdd = function (d) {
		try {
			if (typeof V === 'undefined' || !V) return 0;
			V.fsData = V.fsData || {};
			var cur = fs.infect();
			var next = Math.max(0, Math.min(100, cur + Number(d || 0)));
			V.fsData.infect = next;
			fs.log('感染 ' + cur + ' → ' + next);
			return next;
		} catch (e) { return 0; }
	};
	/* ================= 感染检定（感染这条线的地基）=================
	   用户定的规则：**携带 = 只要拥有就算**，不看拿在哪只手（与 existing $magicBook / $pistolOwned 判定一致）。
	     · 带「魔法」特质的魔法书 → **每小时**检定 → 感染 −1
	       （世界观依据：小说里「魔法」是上帝用来帮助御神者**对抗奇迹感染**的力量）
	     · 制式手枪（带「奇迹」特质）→ **每天**检定 → 当天仍携带 → 感染 +5
	       （世界观依据：残次的奇迹会加速感染，最终变成迷失生物）
	   ⚠️ **在此之前感染只能靠净化剂和调试滑块变动 —— 正常游玩根本到不了 100，
	      所以「感染满值」那条剧情永远触发不了**。这一层就是补这个缺口。 */
	fs.infectTickHour = function (info) {
		try {
			var v = (typeof V !== 'undefined' && V) ? V : null;
			if (!v) return false;
			/* framework.timeTick 是把「这次推进了几小时」当 info.hours 传进来的（上限 24）。
			   ⚠️ 原先这里不接参数、每次只结算 1 点 —— 睡 8 小时也只 −1，
			   与「每小时 −1」的说法对不上。见证者（fs-events.js）一直是按 ticks 循环的，照它做。 */
			var n = (info && Number(info.hours)) ? Number(info.hours) : 1;
			if (!isFinite(n) || n < 1) n = 1;
			if (n > 24) n = 24;
			for (var i = 0; i < n; i++) {
				/* ---- 感染 ≥75% 的附加效果（用户确认过：这是**感染本身**的效果，不挂任何特质）----
				   ① 饥饿掉得越慢：原版饥饿是按时间自然下降的，这里每小时**补回 1 点**抵掉一部分，
				      净效果就是"掉得慢"。数值是可调的，用户觉得不够慢/太慢我再改。 */
				if (fs.infect() >= 75 && typeof fs.hungerAdd === 'function') {
					fs.hungerAdd(1);
				}
				if (Number(v.magicBook) !== 1) continue;      /* 拥有即可，不必拿在手里 */
				if (fs.infect() <= 0) continue;               /* 已经 0 了就别刷日志 */
				fs.infectAdd(-1);
			}
			return true;
		} catch (e) { return false; }
	};
	fs.infectTickDay = function () {
		try {
			var v = (typeof V !== 'undefined' && V) ? V : null;
			if (!v) return false;
			/* 每日钩子不用像每时那样自己乘天数 —— framework.timeTick 已经按
			   「跨了几天」循环调用过 runHooks(finalStar._dayHooks, {index:i}) 了。 */
			/* ---- 感染 ≥75% 的附加效果 ② 理智缓慢回升 ----
			   理智本身已经每天 +2（fs.sanityTick），这里再补 1 点，让"缓慢回升"看得出来。 */
			if (fs.infect() >= 75 && typeof fs.sanityAdd === 'function') {
				fs.sanityAdd(1);
			}
			if (Number(v.pistolOwned) !== 1) return false;    /* 拥有即可 */
			fs.infectAdd(5);
			return true;
		} catch (e) { return false; }
	};
	/* 挂到已有的每时 / 每日钩子上（fs-events.js 提供） */
	if (typeof fs.onHour === 'function') {
		fs.onHour(function (info) { fs.infectTickHour(info); });
	}
	if (typeof fs.onDay === 'function') {
		fs.onDay(function () { fs.infectTickDay(); });
	}

	/* ================= 感染满值：触发与收尾 =================
	   规格来自用户口述（剧情文本写在 twee/FinalStarInf.twee）：
	   感染满 100 → 跳 7 天 + 神秘存在剧情 → 二选一 → 解锁响尾蛇 + 给「窥视真相」。
	   ⚠️ 触发点放在 onInit（每次进段落查一次），而不是只挂在每日检定上 ——
	   因为感染也可能被药瓶、控制台滑块、或者以后别的手段顶到 100，
	   挂在检定上的话那些路径就都不会触发。 */
	fs.infectFullSeen = function () { try { return Number(V.fs_infectFullSeen) === 1; } catch (e) { return false; } };
	fs.infectFullCheck = function () {
		try {
			var v = (typeof V !== 'undefined' && V) ? V : null;
			if (!v) return false;
			if (fs.infect() < 100) return false;
			if (fs.infectFullSeen()) return false;                 /* 只触发一次 */
			var cur = (typeof fs.currentPassage === 'function') ? fs.currentPassage() : '';
			if (/^FS /.test(cur)) return false;                    /* 别在自己的段落里再触发 */
			/* 战斗 / NPC 事件进行中不跳：这条挂在 onInit（**每次过段都跑**）上，
			   正打着架或正推进剧情时被拉去看「响尾蛇档案」（剧情里要跳 7 天）会非常怪。
			   注意这里**没写任何戳**，所以出来之后照常触发，不会漏。 */
			if (typeof fs.inFight === 'function' ? fs.inFight() : (V.combat === 1)) return false;
			if (V.event && (!V.event.buffer || V.event.buffer.length > 0)) return false;
			fs.log('感染已满 —— 进入响尾蛇档案剧情');
			if (typeof fs.goPassage === 'function') fs.goPassage('FS Infect Full', true);
			return true;
		} catch (e) { return false; }
	};
	/* 二选一之后记录玩家选了什么（剧情文本在 twee 里，这里只落状态） */
	fs.infectFullFinish = function (branch) {
		try {
			V.fsData = V.fsData || {};
			V.fsData.infectBranch = branch || '';
			fs.log('感染满值：玩家选了 ' + (branch === 'fall' ? '「与堕落共沉沦」' : '「为了别的而努力」'));
			return true;
		} catch (e) { return false; }
	};
	/* 收尾：解锁响尾蛇 + 发「窥视真相」人物特质 */
	fs.infectFullUnlock = function () {
		try {
			V.fsData = V.fsData || {};
			V.fsData.peekTruth = 1;      /* 「窥视真相」——**人物特质**（物品特质是 magic / miracle） */
			V.fs_rsBooted = 1;           /* 解锁响尾蛇（不再走开屏门） */
			fs.peekTruthGrant();         /* 真的塞进原版 $backgroundTraits，玩家在特质页看得见 */
			fs.log('解锁响尾蛇系统；获得人物特质「窥视真相」');
			return true;
		} catch (e) { return false; }
	};

	/* ---------- 「窥视真相」：真的进原版人物特质表 ----------
	   「旗标 ≠ 特质」。之前只写了 V.fsData.peekTruth，玩家在特质页什么也看不到 ——
	   那不叫拿到人物特质。这里照本模组「见证者」（fs-settings.js 第 74 行）的成例，
	   直接写进原版 $backgroundTraits；setup 里没有特质白名单，自由命名即可（探针已核实
	   setup 只有 clothingTraits / hairTraits 两个键，没有 backgroundTraits）。 */
	fs.peekTruthGrant = function () {
		try {
			if (typeof V === 'undefined' || !V) return false;
			if (!Array.isArray(V.backgroundTraits)) V.backgroundTraits = [];
			if (V.backgroundTraits.indexOf('窥视真相') === -1) V.backgroundTraits.push('窥视真相');
			return true;
		} catch (e) { return false; }
	};
	/* 两个来源任意一个成立就算有 —— 存档里旗标和特质表可能因为旧档/调试而不同步，
	   这里做自愈，不让玩家出现「特质页有、效果没生效」或反过来的裂缝。 */
	fs.peekTruthOn = function () {
		try {
			if (Number(V.fsData && V.fsData.peekTruth) === 1) return true;
			return Array.isArray(V.backgroundTraits) && V.backgroundTraits.indexOf('窥视真相') !== -1;
		} catch (e) { return false; }
	};
	/* 收益：遭遇战中受到的疼痛减少（×0.75，即减 25%）。保留这个纯函数接口给段落用，
	   实机生效走下面的 statChange.pain 挂接。 */
	fs.peekTruthSoften = function (amount) {
		try { if (!fs.peekTruthOn()) return amount; return Math.max(0, Math.round(Number(amount || 0) * 0.75)); }
		catch (e) { return amount; }
	};
	/* 疼痛的唯一入口是原版 statChange.pain(amount, modifier=4)（探针已核实它是
	   own + writable 的普通方法，且原版自己就用同样的方式做减痛：
	   `pain *= 1 - V.sciencetrait / 10`）。所以在入口处过一手即可覆盖全部来源。
	   闸门是 fs.inFight()：规格写的是「**遭遇战**受到的疼痛减少」，所以只压战斗中的疼痛，
	   平时自伤/事件扣的血不动。压的是 amount，原版后续的科学/醉酒/受虐减免照常叠加。
	   用 __fsPeekWrapped 标记做幂等，防止热重载时套两层变成 0.5625。 */
	fs.peekTruthHookPain = function () {
		try {
			if (typeof statChange === 'undefined' || !statChange || typeof statChange.pain !== 'function') return false;
			if (statChange.pain.__fsPeekWrapped) return true;
			var orig = statChange.pain;
			var wrapped = function (amount, modifier) {
				try {
					/* 祝福卷轴·痛觉耐受：把「疼痛上限 +200」做成**实际承受量翻倍**。
					   原版把上限写死在 painClamp() 里的字面量 200，我一开始想用一条 ReplacePatcher
					   去改那个字面量接上 V.fs_painCapBonus —— 但**验证那条补丁在本环境不起作用**
					   （把加成设成 200、疼痛设成 380，仍然被夹回 200），所以那条路不可靠。
					   改为在疼痛的**唯一入口**按比例压缩：bonus=200 时 amount × 200/400 = 0.5，
					   即要攒到 400 点原始疼痛才触到上限 —— 效果等同于「上限翻倍」，
					   而且完全不依赖任何补丁（与下面窥视真相那层是相乘关系，互不干扰）。 */
					var _bonus = Number(V.fs_painCapBonus) || 0;
					if (_bonus > 0 && Number(amount) > 0) {
						amount = amount * (200 / (200 + _bonus));
					}
					/* 天赋：好战/坚韧/反击（只压战斗中的正向疼痛） */
					try { if (typeof fs.talentPain === 'function') amount = fs.talentPain(amount); } catch (e) { }
					if (Number(amount) > 0 && fs.peekTruthOn() && fs.inFight()) {
						amount = amount * 0.75;
						V.fsData = V.fsData || {};
						V.fsData.peekSoften = (Number(V.fsData.peekSoften) || 0) + 1;
					}
				} catch (e) { }
				var _r = orig.call(this, amount, modifier);
				try {
					/* 反击刻印：描述写的是「遭遇战中受到伤害时固定反击 50 点」，
					   但 fs.onPlayerHurt 定义了却**从没被调用过** —— 刻印等于没有效果。
					   这里接在疼痛的唯一入口上：真的挨了打（amount > 0）且在战斗中才反伤。 */
					if (Number(amount) > 0 && fs.inFight && fs.inFight() && typeof fs.onPlayerHurt === 'function') fs.onPlayerHurt();
				} catch (e) { }
				return _r;
			};
			wrapped.__fsPeekWrapped = true;
			statChange.pain = wrapped;
			fs.log('「窥视真相」减痛已挂接原版 statChange.pain（遭遇战内 ×0.75）');
			return true;
		} catch (e) { return false; }
	};
	/* 代价：每晚 23:00 被偷窥（文本 + 压力）。用日期去重，保证一天只触发一次。
	   判定不能只看「此刻是不是 23 点」—— 原版 sleep/一觉到天亮那种大步推进会让
	   23 点整个被跨过去，于是那一晚静悄悄地漏掉。规格写的是「每晚 23:00」，
	   所以这里看的是「这次时间推进经过的区间里有没有 23 点」。
	   info.hours 由 framework.timeTick 传进来（它按小时戳变化触发，上限 24）。 */
	fs.peekTruthNight = function (info) {
		try {
			var v = (typeof V !== 'undefined' && V) ? V : null;
			if (!v || !fs.peekTruthOn()) return false;
			if (typeof Time === 'undefined') return false;
			var h = Number(Time.hour);
			if (!isFinite(h)) return false;
			var n = (info && Number(info.hours)) ? Number(info.hours) : 1;
			if (!isFinite(n) || n < 1) n = 1;
			if (n > 24) n = 24;
			var crossed = false;
			for (var i = 0; i < n; i++) {
				var hh = ((h - i) % 24 + 24) % 24;
				if (hh === 23) { crossed = true; break; }
			}
			if (!crossed) return false;
			var d = (typeof fs.todayStr === 'function') ? fs.todayStr() : '';
			if (!d) return false;
			V.fsData = V.fsData || {};
			if (V.fsData.peekNight === d) return false;
			V.fsData.peekNight = d;
			var max = Number(v.stressmax) || 1000;
			v.stress = Math.min(max, (Number(v.stress) || 0) + 40);
			V.fs_castHtml = '<span class="red">23:00。</span><span class="fs-sub">有一道视线落在你后颈上，轻得像是不存在。你没有回头——你知道回头也看不见什么。</span>';
			fs.log('窥视真相：夜里 23 点被偷窥（压力 +40）');
			return true;
		} catch (e) { return false; }
	};
	if (typeof fs.onHour === 'function') {
		/* 把 info 透传进去（里面有本次推进了几小时），否则跨过 23 点的那一晚会被漏掉 */
		fs.onHour(function (info) { fs.peekTruthNight(info); });
	}
	if (typeof fs.onInit === 'function') {
		fs.onInit(function () { fs.infectFullCheck(); });
	}
	/* 挂接疼痛减免。放在 onInit 里而不是模块顶层 —— statChange 是游戏脚本里的对象，
	   要等它确实存在了再包，否则包装会静默失败（这正是「改一半」的老毛病）。 */
	if (typeof fs.onInit === 'function') {
		fs.onInit(function () { fs.peekTruthHookPain(); });
	} else {
		fs.peekTruthHookPain();
	}

	/* 侧栏注入：贴在「诱惑」那一行的下方（颜色与压力对齐） */
	/* 颜色完全对齐原版：优先调用游戏自己的函数，失败时用同款本地副本（名单与方向都照抄原版） */
	fs.vitalColor = function (pct, stat) {
		try {
			if (typeof window.getColourClassFromPercentage === 'function') return window.getColourClassFromPercentage(pct, stat);
		} catch (e) { }
		/* 原版判定：名单里的属性（疼痛 / 意识 / 创伤 / 压力…）是「低=绿、高=红」；
		   不在名单里的（自控、理智、饥饿）是「低=红、高=绿」。以前这里写反了。 */
		var inverted = ['pain', 'arousal', 'tiredness', 'stress', 'trauma', 'drugged', 'hallucinogen', 'drunk', 'awareness',
			'sex', 'prostitution', 'rape', 'bestiality', 'pregnancy', 'impreg', 'promiscuity', 'exhibitionism',
			'delinquency', 'deviancy', 'corruption', 'crime', 'aggro', 'rage'].indexOf(stat) < 0;
		if (pct <= 0) return inverted ? 'red' : 'green';
		if (pct < 20) return inverted ? 'pink' : 'teal';
		if (pct < 40) return inverted ? 'purple' : 'lblue';
		if (pct < 60) return 'blue';
		if (pct < 80) return inverted ? 'lblue' : 'purple';
		if (pct < 100) return inverted ? 'teal' : 'pink';
		return inverted ? 'green' : 'red';
	};
	/* 照抄原版一行；颜色由上面的函数决定（描述与条同色，与原版一致） */
	fs.vitalRowHtml = function (id, name, value, max, desc, stat) {
		var pct = Math.max(0, Math.min(100, Math.round(value / max * 100)));
		var col = fs.vitalColor(pct, stat);
		return '<div id="' + id + '" title="' + name + '：' + value.toFixed(2) + '">' +
			'<div class=""> ' + name + '： <span class="' + col + '">' + desc + '</span> </div>' +
			'<div class="meter"><div class="' + col + 'bar" style="width:' + pct + '%"></div></div>' +
			'</div>';
	};
	/* 自定义属性的**定性**描述（原版从不显示数值：疼痛就是「你感觉良好」，不会写 20/200）。
	   侧栏与正文共用这一份文案，别再各写一套数字。 */
	fs.hungerWord = function () {
		try {
			var h = fs.hunger();
			return h >= 80 ? '你并不觉得饿。' : (h >= 50 ? '肚子有点空了。' : (h >= 20 ? '你饿得有些发慌。' : '你饿得几乎站不稳。'));
		} catch (e) { return ''; }
	};
	fs.infectWord = function () {
		try { return fs.infect() > 0 ? '身体里有东西在动。' : '你身上没有感染的迹象。'; } catch (e) { return ''; }
	};
	fs.sanityWord = function () {
		try { return fs.sanityLabel()[1]; } catch (e) { return ''; }
	};

	/* 原版格式的属性提示：` | + 疼痛` / ` | + + 饥饿`（加号个数与数值无关，只是原版 amount 的写法）。
	   正文里要提示属性变化时用这个，不要手写「疼痛 +20」——原版没有这种文本。 */
	fs.statHint = function (label, n, cls) {
		try {
			var amt = Number(n) || 1;
			if (window.statDisplay && typeof statDisplay.statChange === 'function') {
				var frag = statDisplay.statChange(label, amt, cls || (amt < 0 ? 'green' : 'red'));
				if (frag) { var d = document.createElement('div'); d.appendChild(frag); return d.innerHTML; }
			}
		} catch (e) { }
		return ' | <span class="' + (cls || 'red') + '">' + (Number(n) < 0 ? '- ' : '+ ') + label + '</span>';
	};

	fs.injectSanityRows = function () {
		try {
			var host = document.getElementById('statmeters');
			if (!host) return;
			var wrong = document.getElementById('fs-vitals');
			if (wrong) { try { wrong.remove(); } catch (e) { } }
			var lab = fs.sanityLabel();
			var h = fs.hunger(), inf = fs.infect();
			/* 理智与饥饿都是「越高越好」→ 传 'control'（就是侧栏的「自控」，不在原版倒转名单里，满值绿）；
			   感染是「越低越好」→ 传 'trauma'（在名单里，满值红）。
			   以前两者都传了 'awareness'（意识，在名单里）→ 理智 100 被画成红的，正好反了。 */
			var rows = fs.vitalRowHtml('fssanitycaption', '理智', fs.sanity(), 100, fs.sanityWord(), 'control') +
				fs.vitalRowHtml('fshungercaption', '饥饿', h, 100, fs.hungerWord(), 'control') +
				fs.vitalRowHtml('fsinfectcaption', '感染', inf, 100, fs.infectWord(), 'trauma');
			var ids = ['fssanitycaption', 'fshungercaption', 'fsinfectcaption'];
			var tmp = document.createElement('div');
			tmp.innerHTML = rows;
			for (var i = 0; i < ids.length; i++) {
				var fresh = tmp.children[i];
				var exist = document.getElementById(ids[i]);
				if (exist && exist.parentNode === host) exist.outerHTML = fresh.outerHTML;
				else host.appendChild(fresh.cloneNode(true));
			}
		} catch (e) { }
	};


	/* ---------- 理智的行为层 ---------- */
	fs.sanityPenalty = function () {                    /* 0~30 的检定惩罚 */
		var v = fs.sanity();
		if (v >= 85) return 0;
		if (v >= 65) return 3;
		if (v >= 45) return 8;
		if (v >= 25) return 15;
		if (v > 0) return 22;
		return 30;
	};
	/* 检定文本降级：把渲染出来的难度字样改差（DOM 层，不动原版代码） */
	fs.sanityDowngradeText = function () {
		try {
			if (fs.sanity() >= 65) return;
			var map = { '轻而易举': '勉强可行', '很简单': '有点难', '简单': '困难', '普通': '困难', '有点难': '非常困难', '困难': '几乎不可能', '非常困难': '不可能', '几乎不可能': '不可能' };
			var root = document.getElementById('passages');
			if (!root) return;
			var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
			/* ⚠️ 必须**一次性**替换。原写法逐键对「已经被改过的字符串」再匹配，映射会级联：
			   '简单'→'困难'→'几乎不可能'→'不可能'，本来"简单"的检定被一路改写成"不可能"，
			   难度提示与实际判定完全不符。改成单个正则 + 回调：每个位置只改一次。
			   键按长度倒序，保证 '几乎不可能' 这种长键优先于短键命中。 */
			var _keys = Object.keys(map).sort(function (a, b) { return b.length - a.length; });
			var _re = new RegExp(_keys.join('|'), 'g');
			var node, changed = 0;
			while ((node = walker.nextNode())) {
				var txt = node.nodeValue || '';
				var nv = txt.replace(_re, function (m) { return map[m]; });
				if (nv !== txt) { node.nodeValue = nv; changed++; }
			}
			if (changed) fs.log('理智偏低：已降级 ' + changed + ' 处难度字样（惩罚 ' + fs.sanityPenalty() + '）');
		} catch (e) { }
	};
	/* 低于 50%：每天小概率有人寄来水和药（+30 理智） */
	fs.sanityGiftTick = function () {
		try {
			fs.ensureData();
			var day = (typeof Time !== 'undefined') ? (Time.year + '-' + Time.month + '-' + Time.monthDay) : null;
			if (!day || V.fsData.sanityGiftDay === day) return;
			/* ⚠️ 先判「今天有没有资格」，**再**打戳。
			   原写法先打戳后判断：当天第一次渲染就把这一天的配额用掉了，
			   于是「早上理智正常、晚上掉到 50 以下」的那一晚永远收不到东西
			   —— 与「走路不掉饥饿」是同一形态的 bug（戳推进了、动作被跳过）。 */
			if (fs.sanity() >= 50) return;
			V.fsData.sanityGiftDay = day;
			if (Math.random() < 0.25) {
				V.fsData.sanityGift = 1;
				fs.log('理智低于 50%：收到陌生人的水瓶与药片（可在卧室服用）');
			}
		} catch (e) { }
	};
	fs.sanityTakeGift = function () {
		try { if (V.fsData.sanityGift) { V.fsData.sanityGift = 0; fs.sanityAdd(30); return true; } } catch (e) { }
		return false;
	};
	/* 混乱：理智为 0 时把入口文字遮成「？」，目标不变（安全）。
	   ⚠️ 这里原来还有一个更强的 `fs.confusionMaybe()`（40% 概率把你实际送到别的地点），
	   但它**全仓零调用**，是个从没接上的假功能。我没有把它接上，理由有两个：
	     ① 它会在玩家点「魔女小屋」时把人丢到孤儿院 —— 正是本项目反复出问题的那类"非预期跳转"
	        （星辉刻印走路触发、饿晕中途拽走都属同一类，用户已两次表示反感）；
	     ② 现在真正生效的 confusionMask 本身是个完整说得通的机制（你不知道哪个按钮是哪里），
	        接上它会变成"看到 ？？？ 却去了第三个地方"，反而讲不通。
	   所以删掉假功能、把说明写准（见 FinalStarSettings 的理智一条），而不是偷偷加新惊喜。 */
	fs.confusionActive = function () { return fs.sanity() <= 0; };
	/* 把 [[文字|目标]] 的文字换成？，只动文字、不动目标 */
	fs.confusionMask = function (html) {
		try {
			if (!fs.confusionActive || !fs.confusionActive()) return html;
			return String(html).replace(/\[\[([^\]|]+)\|([^\]|]+)\]\]/g, function (m, label, target) {
				if (/^\$|^<</.test(target)) return m;
				return '[[' + '？？？' + '|' + target + ']]';
			});
		} catch (e) { return html; }
	};
	/* 遭遇战/事件扣减：供各模块调用 */
	fs.sanityOnNonConsensual = function () { return fs.sanityAdd(-5); };
	/* 战败监视：战斗结束且我方疼痛接近上限 → 视为非自愿落败，理智 -5 */
	fs.sanityCombatWatch = function () {
		try {
			/* ⚠️ 这里**不再自己造第二套战斗判据**（fs-star.js 的注释里明令禁止过）。
			   旧写法 `Number(V.combat) === 1 || …` 会把「被跟踪」的开场（fs-core.js:381 就置了
			   V.combat = 1）当成战斗中，于是玩家走完一段根本没打起来的遭遇也会被记为落败；
			   而且跨场标记 fs._wasFighting 是**不存盘**的运行时变量，一读档就失真。
			   现在统一走 fs.inFight()，标记存进 V.fsData。 */
			var fighting = (typeof fs.inFight === 'function')
				? fs.inFight()
				: (Number(V.combat) === 1 && Number(V.enemyhealth) > 0);
			var pain = Number(V.pain) || 0, pmax = Number(V.painmax) || 200;   /* 疼痛真实上限 = 原版 painClamp() 里的 200 */
			V.fsData = V.fsData || {};
			if (V.fsData.wasFighting === true && fighting === false) {
				if (pain >= pmax * 0.85) { fs.sanityOnNonConsensual(); fs.log('非自愿落败：理智 -5（当前 ' + fs.sanity() + '）'); }
			}
			V.fsData.wasFighting = fighting;
		} catch (e) { }
	};
	fs.sanityOnEldritch = function () { return fs.sanityAdd(-10); };
	fs.sanityOnFaint = function () { return fs.sanityAdd(50 - fs.sanity() > 0 ? 50 : 0); };
	/* 昏倒 → 理智补回。原先 fs.sanityOnFaint 是**零调用**的死函数 ——
	   「昏倒可恢复理智」只写在说明里、从来没生效过。这里做成可重复调用也只会生效一次
	   （按当天 + 来源打标记），这样挂在「判定点」上也不会因为被调用多次而反复加分。 */
	fs.sanityOnFaintOnce = function (tag) {
		try {
			if (typeof fs.sanityOnFaint !== 'function') return false;
			V.fsData = V.fsData || {};
			var key = 'faintSanity_' + (tag || 'x') + '_' + ((typeof fs.todayStr === 'function') ? fs.todayStr() : '');
			if (V.fsData[key]) return false;
			V.fsData[key] = 1;
			var before = fs.sanity();
			fs.sanityOnFaint();
			fs.log('昏倒（' + (tag || '?') + '）：理智 ' + before + ' → ' + fs.sanity());
			return true;
		} catch (e) { return false; }
	};


	/* ================= 饥饿（Hunger）================= */
	fs.hunger = function () { try { var v = V.fsData.hunger; return (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(100, v)) : 100; } catch (e) { return 100; } };
	fs.hungerAdd = function (d) {
		try {
			fs.ensureData();
			var delta = Number(d || 0);
			/* 天赋「省吃」：饥饿下降速度 -10%（只作用于时间造成的下降，吃东西回复不变） */
			if (delta < 0 && fs.talentHas && fs.talentHas('d3')) {
				delta = -Math.max(1, Math.round(Math.abs(delta) * 0.9));
			}
			var v = Math.max(0, Math.min(100, fs.hunger() + delta));
			V.fsData.hunger = v;
			fs.log('饥饿 ' + (delta >= 0 ? '+' : '') + delta + ' → ' + v + (delta !== Number(d || 0) ? '（省吃已生效）' : ''));
			return v;
		} catch (e) { return fs.hunger(); }
	};
	/* 每 2 小时 -10（按真实游戏小时累计） */
	fs.hungerTick = function () {
		try {
			fs.ensureData();
			var abs = (typeof Time !== 'undefined') ? ((Time.year * 12 + Time.month) * 30 + Time.monthDay) * 24 + Time.hour : null;
			if (abs === null) return;
			if (V.fsData.hungerAbs === undefined) { V.fsData.hungerAbs = abs; return; }
			var d = abs - V.fsData.hungerAbs;
			if (d <= 0) return;
			V.fsData.hungerAbs = abs;
			/* ⚠️ 这里原来是 `if (d >= 2) fs.hungerAdd(-10 * Math.floor(d / 2))`。
			   上面刚把时间戳推到了 abs，所以**不足 2 小时的零头会被直接丢掉**；
			   而玩家一直在走动时每次只推进 0~1 小时，d 永远是 1 → 饥饿永远不掉
			   （验证结果：「走在路上一天也不掉饥饿，只有触发事件才掉」）。
			   改成把零头攒进 hungerPending，够 2 小时就扣 10 —— 规则不变，但走路也累计。 */
			V.fsData.hungerPending = (Number(V.fsData.hungerPending) || 0) + d;
			var _hticks = Math.floor(V.fsData.hungerPending / 2);
			if (_hticks > 0) {
				V.fsData.hungerPending -= _hticks * 2;
				fs.hungerAdd(-10 * _hticks);
			}
			/* 用户规格：饿得越久（饥饿值越低）→ 压力涨得越快。按**流逝的小时数**结算，
			   越饿每一小时涨得越多。原来那套「饥饿拖慢行动」已按设计上撤掉。 */
			var _h = fs.hunger();
			if (_h < 50) {
				var _per = _h < 10 ? 4 : (_h < 25 ? 2 : 1);
				var _smax = Number(V.stressmax) || 1000;
				V.stress = Math.min(_smax, (Number(V.stress) || 0) + _per * Math.floor(d));
				fs.log('饥饿施压：饥饿 ' + _h + ' → 压力 +' + (_per * Math.floor(d)) + '（每小时 +' + _per + '）');
			}
			if (fs.hungerFaintCheck) fs.hungerFaintCheck();
		} catch (e) { }
	};
	/* 饥饿归零 → 饿晕。每天最多一次。
	   不触发的情形：① 模组自己的段落里（否则会自己踩自己）；
	   ② **战斗中**；③ **NPC 事件进行中**。
	   后两条是同一类毛刺：玩家正打着架、或正推进某段剧情时被强行拽走会非常怪
	   （和「星辉刻印走在路上触发」是同一种病）。所以这几条守卫**放在打戳之前**，
	   玩家从战斗/事件里出来后会照常晕。 */
	fs.hungerFaintCheck = function () {
		try {
			if (fs.hunger() > 0) return false;
			var d = (typeof fs.todayStr === 'function') ? fs.todayStr() : '';
			if (!d) return false;
			V.fsData = V.fsData || {};
			if (V.fsData.hungerFaintDay === d) return false;
			var cur = (typeof fs.currentPassage === 'function') ? fs.currentPassage() : '';
			if (/^FS /.test(cur)) return false;
			if (typeof fs.inFight === 'function' ? fs.inFight() : (V.combat === 1)) return false;
			if (V.event && (!V.event.buffer || V.event.buffer.length > 0)) return false;
			V.fsData.hungerFaintDay = d;
			fs.log('饥饿归零 —— 进入饿晕剧情');
			if (typeof fs.goPassage === 'function') fs.goPassage('FS Hunger Faint', true);
			return true;
		} catch (e) { return false; }
	};
	/* 醒来时给三个面包（存在 $bread —— 背包就是直接扫 V[key] 的） */
	fs.hungerFaintBread = function () {
		try {
			V.bread = (Number(V.bread) || 0) + 3;
			fs.log('饿晕醒来：背包里多了 3 个面包（现在 ' + V.bread + ' 个）');
			return 3;
		} catch (e) { return 0; }
	};
	/* 「饥饿拖慢行动」（hungerDelay / hungerNotice）已废弃：
	   用户定稿的饥饿后果改为「越低压力涨得越快 + 归零饿晕后背包多 3 个面包」，
	   见 fs.hungerTick 与 fs.hungerFaintCheck / fs.hungerFaintBread。 */
	/* 食用食物 */
	fs.foodTable = { '土豆': 15, '蜂蜜': 10, '面包': 20, '苹果': 12, '奶酪': 18, '熟肉': 25, '罐装食物': 22, '巧克力': 15, '水': 3 };
	/* 背包：列出玩家持有的全部农作物与食物（按字段名扫描，不写死名字） */
	fs.foodNames = ['土豆', '蜂蜜', '面包', '苹果', '梨', '胡萝卜', '玉米', '番茄', '南瓜', '洋葱', '卷心菜', '蘑菇', '浆果', '奶酪', '熟肉', '罐装食物', '巧克力', '水', '牛奶', '鸡蛋', '果酱', '腌菜'];
	fs.foodKeys = ['potato', 'honey', 'bread', 'apple', 'pear', 'carrot', 'corn', 'tomato', 'pumpkin', 'onion', 'cabbage', 'mushroom', 'berries', 'cheese', 'cookedmeat', 'cannedfood', 'chocolate', 'water', 'milk', 'egg', 'jam', 'pickles'];
	fs.bagList = function () {
		try {
			var out = [];
			var seen = {};
			fs.foodKeys.forEach(function (k) {
				var v = Number(V[k]);
				if (isFinite(v) && v > 0) { out.push({ key: k, name: fs.foodNames[fs.foodKeys.indexOf(k)] || k, label: fs.foodNames[fs.foodKeys.indexOf(k)] || k, qty: v }); seen[k] = 1; }
			});
			/* 玩家自己种/收的作物（$crops 一类的对象） */
			['crops', 'storedCrops', 'preserves', 'harvest'].forEach(function (bag) {
				var o = V[bag];
				if (!o || typeof o !== 'object') return;
				Object.keys(o).forEach(function (k) {
					var v = Number(o[k]);
					if (isFinite(v) && v > 0 && !seen[bag + '.' + k]) out.push({ key: bag + '.' + k, name: k, label: k, qty: v });
				});
			});
			/* 控制台给的东西 */
			var ci = (V.fsData && V.fsData.consoleItems) || {};
			Object.keys(ci).forEach(function (k) { var v = Number(ci[k]); if (v > 0 && !seen[k]) out.push({ key: 'fsData.consoleItems.' + k, name: k, label: k, qty: v }); });
			/* 天赋「精液爱好者」的收集物（h2 收集、h3 可食用、h9 可出售） */
			var ch = (V.fsData && V.fsData.charmItems) || {};
			Object.keys(ch).forEach(function (k) { var v = Number(ch[k]); if (v > 0) out.push({ key: 'fsData.charmItems.' + k, name: k, label: k, qty: v, charm: true }); });
			return out;
		} catch (e) { return []; }
	};
	fs.bagTake = function (key) {
		try {
			var parts = String(key).split('.');
			var obj = V, i;
			for (i = 0; i < parts.length - 1; i++) { obj = obj[parts[i]]; if (!obj) return false; }
			var last = parts[parts.length - 1];
			if (!(Number(obj[last]) > 0)) return false;
			obj[last] = Number(obj[last]) - 1;
			return true;
		} catch (e) { return false; }
	};
	fs.bagEat = function (key, name) {
		try {
			if (name === '精液') {
				if (!(fs.talentHas && fs.talentHas('h3'))) return 'none';
				if (!fs.bagTake(key)) return 'none';
				fs.hungerAdd(20);
				fs.log('吃掉精液（魅魔觉醒：饥饿 +20）');
				return 20;
			}
			if (!fs.bagTake(key)) return 'none';
			var gain = fs.foodTable[name] || 12;
			fs.hungerAdd(gain);
			fs.log('吃掉 ' + name + '（饥饿 +' + gain + '）');
			return gain;
		} catch (e) { return 'error'; }
	};
	/* 天赋「收集癖」：收集物可以卖成钱 */
	fs.bagSell = function (key, name) {
		try {
			if (!(fs.talentHas && fs.talentHas('h9'))) return 'no';
			if (!fs.bagTake(key)) return 'none';
			V.money = (Number(V.money) || 0) + 500;
			fs.log('卖掉 ' + name + '：£5');
			return 5;
		} catch (e) { return 'error'; }
	};
	/* 背包列表的 HTML：整段由 JS 生成。不用 SugarCube 的 <<for>>/<<capture>>，
	   因为链接文本/点击期临时变量的求值时机很容易出错（曾出现整列重复同一项）。 */
	fs.bagHtml = function () {
		try {
			var list = fs.bagList();
			if (!list.length) return '<div class="fs-bag-empty grey">里面没有能吃的东西。你可以去学校食堂、咖啡馆，或者商店补充一些。</div>';
			var html = '<div class="fs-bag-list">';
			list.forEach(function (it) {
				var canEat = !it.charm || (fs.talentHas && fs.talentHas('h3'));
				var canSell = it.charm && fs.talentHas && fs.talentHas('h9');
				html += '<div class="fs-bag-row"><span class="fs-bag-name">' + it.name + ' ×' + it.qty + '</span>'
					+ (canEat ? '<a class="fs-bag-eat" data-k="' + it.key + '" data-n="' + it.name + '">吃一份</a>' : '')
					+ (canSell ? '<a class="fs-bag-sell" data-k="' + it.key + '" data-n="' + it.name + '">卖 £5</a>' : '')
					+ '</div>';
			});
			html += '</div>';
			return html;
		} catch (e) { return '<div class="grey">背包读取失败。</div>'; }
	};
	/* 点「吃一份」：文档级委派，吃完整页刷新背包 */
	fs.bindBagClicks = function () {
		if (fs._bagClickBound) return;
		fs._bagClickBound = true;
		try {
			document.addEventListener('click', function (ev) {
				var el = ev.target, sell = false;
				while (el && el.nodeType === 1 && el !== document.body) {
					var cn = '' + el.className;
					if (cn.indexOf('fs-bag-eat') >= 0) break;
					if (cn.indexOf('fs-bag-sell') >= 0) { sell = true; break; }
					el = el.parentNode;
				}
				if (!el || el.nodeType !== 1 || el === document.body) return;
				ev.preventDefault();
				var key = el.getAttribute('data-k'), name = el.getAttribute('data-n');
				var got = sell ? fs.bagSell(key, name) : fs.bagEat(key, name);
				if (got === 'none' && fs.notice) { try { fs.notice('已经没有' + name + '了。'); } catch (e) { } }
				setTimeout(function () { try { SugarCube.Engine.play('FS Bag'); } catch (e) { } }, 0);
			}, true);
		} catch (e) { }
	};

	fs.eatItem = function (name) {
		try {
			fs.ensureData();
			V.fsData.consoleItems = V.fsData.consoleItems || {};
			if (!V.fsData.consoleItems[name] || V.fsData.consoleItems[name] <= 0) return 'none';
			V.fsData.consoleItems[name] -= 1;
			var gain = fs.foodTable[name] || 10;
			fs.hungerAdd(gain);
			fs.log('吃掉 ' + name + '（饥饿 +' + gain + '）');
			return gain;
		} catch (e) { return 'error'; }
	};
	/* 侧栏「背包」按钮：贴在侧栏里【视觉上最靠下】的那一行（或人物立绘）下面。
	   以前写死贴在「模组设置」那一行后面 —— 各整合包的侧栏布局不同（人物立绘可能画在侧栏底部），
	   结果背包按钮会压在人物身上。现在改为按实际位置算，谁最低就贴谁下面。 */
	/* 【已删除】以前这里有一份 fs.sidebarLowestAnchor()：每次注入都算一遍侧栏里
	   「看得见的一行/块/大立绘」的底部，把背包贴到最低那个下面，免得压住人物立绘。
	   设计上背包回到原版按钮形态（跟「统计成就 / 作弊」一样），
	   于是整套自适应定位都不需要了 —— 直接放进 #overlayButtons 即可。
	   下面保留一个空实现，避免有旧调用报错。 */
	fs.sidebarLowestAnchor = function () { return null; };
	fs.injectBagButton = function () {
		try {
			var box = document.getElementById('fs-bag-row');
			if (!box) {
				/* 做成原版按钮：<<button>> 宏生成的就是 <button class="link-internal macro-button">，
				   原版把它放在 #overlayButtons 里，用 .sidebarButtonSplit 两两成行。
				   这里照抄同一套类，所以它长得跟「统计成就 / 作弊」完全一样。 */
				box = document.createElement('div');
				box.className = 'sidebarButtonSplit';
				box.id = 'fs-bag-row';
				var btn = document.createElement('button');
				btn.type = 'button'; btn.id = 'fs-bag-btn';
				btn.className = 'link-internal macro-button';
				btn.innerHTML = '背包';
				btn.title = '查看并食用你身上的农作物与食物';
				btn.setAttribute('onclick', 'finalStar.openBag()');
				box.appendChild(btn);
			}
			/* 放进原版按钮行 —— 和原版的 属性 / 社交 / 特质 / 统计成就 / 作弊 排在一起。
			   （以前是"自适应贴到侧栏最低的元素下面"，那是为了躲开人物立绘；
			     现在按设计上回到原版按钮形态，不再靠位置计算。） */
			var host = document.getElementById('overlayButtons');
			if (!host) return;                       /* 没有原版按钮行就不显示，不硬塞到别处 */
			if (box.parentNode !== host) host.appendChild(box);
		} catch (e) { }
	};
	/* 在能吃到东西的地方回复饥饿（学校午餐 / 咖啡馆等） */
	fs.hungerEatHere = function (amount, label) {
		try { fs.hungerAdd(amount || 40); fs.log('在' + (label || '这里') + '吃了一顿（饥饿 +' + (amount || 40) + '）'); return true; } catch (e) { return false; }
	};
	/* 背包入口统一走 fs-core.js 的 fs.openBag()（它会记住进背包前在哪，
	   这样"关上背包"才能精确回到原处）。这里保留旧名字做兼容转发。 */
	if (typeof fs.openBag !== 'function') {
		fs.openBag = function () { setTimeout(function () { try { if (window.SugarCube && SugarCube.Engine) { SugarCube.Engine.play('FS Bag'); return; } } catch (e) { } try { if (window.Engine) Engine.play('FS Bag'); } catch (e) { } }, 0); return true; };
	}

	fs.locationLinkHtml = function (passage) {
		try {
			switch (passage) {
				case 'Elk Street':
					return '<<icon "finalstar/shop-witch-house.png">><<link [[魔女小屋|Witch Hut]]>><</link>>';
				case 'Danube Street': {
					/* 长线剧情「莫伦斯」的入口（用户  规格）：
					   选了「一起 / 自己去」之后**十天**，宅邸街出现「走进灰色迷雾」；该选项持续存在。
					   倒计时期间只显示一句灰字（还剩几天），不占额外入口。 */
					return (typeof fs.morStreetHtml === 'function') ? fs.morStreetHtml() : '';
				}
				case 'Lake Shore':
					if (V.fsData && V.fsData.cave && V.fsData.cave.known === true) {
						return '<<icon "finalstar/cave-entrance.png">><<link [[走向那道裂口|Cave Entrance]]>><</link>>';
					}
					if (Number(V.jiusiProtect) === 1 && !fs.jiusiHidden()) {
						return '<span class="blue">你注意到玖肆正沿着湖岸往一个方向走——那不是任何一条路。</span><br>[[悄悄跟上去|Cave Discover]]';
					}
					return '';
				case "Bailey's Office":
					if (Number(V.baileyCasinoIntro) === 1 && V.fsData && (!V.fsData.cave || V.fsData.cave.known !== true)) {
						return '[[询问教堂的意义|Cave Discover]]';
					}
					return '';
				case 'Orphanage': {
					var out2 = [];
					if (V.fs_baileyReturnNotice === 1 || (V.fs_baileyWarned === 1 && V.fs_baileyWarnShown !== 1)) {
						out2.push('<span class="gold">大厅里有些不对劲……</span><br><<link [[走过去看看|Bailey Return Notice]]>><</link>>');
					}
					/* 人格洗脑丸：有奴隶时在大厅可以找到 ta 并下命令 */
					if (typeof fs.slaveCount === 'function' && fs.slaveCount() > 0) {
						out2.push('<<icon "finalstar/ui-notice.png">><span class="gold">大厅的角落里，有一道视线一直跟着你。</span><br><<link [[叫 ta 过来|FS Slaves]]>><</link>>');
					}
					/* 长桌上的面包：每天最多拿 3 个；以及「清理存档异常数据」。
					   ⚠️ 这两条原先挂在**下面另一个** `case 'Orphanage':` 上 —— 而 switch 里
					   第一个 case 已经无条件 return 了，所以那个分支是**不可达的死代码**，
					   两个入口从来没有显示过（游玩须知却明确让玩家来这里点「清理存档异常数据」）。
					   是把奴隶入口写成块级 case 时把旧的那个挤成了死代码。现已并回这里。
					   同类坑：一个 switch 里同一个 case 标签出现两次，后者永远不执行。 */
					out2.push('<<icon "finalstar/ui-notice.png">><<link [[看一眼大厅角落的长桌|FS Bread Table]]>><</link>>'
						+ '　<<link [[清理存档异常数据|FS Clean Save]]>><</link>>');
					return out2.join('<br>');
				}
				case 'Museum':
					if (typeof fs.hasMedal === 'function' && fs.hasMedal() && fs.medalGiven() !== true) {
						return '<<icon "finalstar/medal-witness.png">><<link [[给温特看那枚勋章|Museum Witness Medal]]>><</link>>';
					}
					return '';
				case 'Orphanage Mysterious Note':
					/* 布告板：终星模组设置入口（按玩家要求塞进布告板内容里）。
					   设置面板不是"跳段落"，而是本模组自己填 DoL 的覆盖层
					   （#customOverlayTitle / #customOverlayContent，见 fs-core.js
					   的 fs.openOverlayPanel()）。

					   踩坑记录（三种写法都试过，前两种错、第三种对）：
					     · [[…|$passage]]  —— $passage 不存在，跳无效段落，点了没反应
					     · [[…]]（空目标） —— link 宏把标签文字本身当段落名，
					                          渲染成 link-broken，点了报"段落不存在"
					     · 目标指向 passage() 后同步开覆盖层 —— 面板确实建好了
					                          （验证正文 3157 字符），但链接点击后的
					                          段落导航紧接着把覆盖层又关掉了，
					                          所以看起来"点了没反应"。
					   最终写法：目标指向 passage()（原地重绘，无害），
					   但把开面板的动作延后到导航结束之后执行。 */
					return '<<icon "finalstar/ui-settings.png">><<link [[' + '翻到背面——「终星 · 模组设置」' + '|passage()]]>><<run setTimeout(function(){ finalStar.openSettings(); }, 0)>><</link>>';
				/* 吃饭回饥饿 —— 不再往这些地点塞我们自己的入口。
				   用户的要求：希望在原版世界里的吃饭动作上直接生效，
				   而不是"在卧室/食堂多点一个我们做的按钮"。
				   真正的挂钩在 fs-food.js 里，按段落名匹配原版的吃饭段落
				   （Canteen Lunch / Canteen Lunch Robin / Cafe Coffee / Danube Meal …），
				   与语言无关，整合包换译文也不会失效。 */
				/* 住宅区排水系统：实验室入口**已不在这里**。
				   用户在  明确改了规格：入口改成「下水道」菜单（原版 Storm Drain Entrance）
				   里的第三个选项「？？？」，由 boot.json 的 TweeReplacer + LabSewerOption.txt 实现。
				   原因是他要的形态是"点下水道 → 看到钥匙孔描述 → 多出一个选项"，
				   而不是"进到排水系统段落里再看墙上"。
				   所以这里的 case 被**删除**（不是注释掉），避免同一功能留两个入口、两处描述。 */
				case 'Canteen':
				case 'Cafeteria':
				case 'Cafe':
				case 'Coffee Shop':
				case '咖啡馆':
				case '咖啡店':
				case '餐厅':
				case '食堂':
				case '厨房':
				case '学校食堂':
				case '孤儿院厨房':
				case 'Kitchen': {
					/* 「坐下来吃点什么」—— 这是 FS Eat Here / FS Eat Dish 的**唯一入口**。
					   ⚠️ 这两个段落原先没有任何入口（只互相链接，而 $fs_eatAt 全仓也没有写入点），
					   于是说明里承诺的「学校套餐 +45」与咖啡馆的付费项玩家永远看不到 —— 死岛。
					   这里按当前段落决定 $fs_eatAt：咖啡馆那几个 → cafe，其余 → canteen。
					   $fs_eatAt 在点击时写入、段落渲染时读取，时序正确。 */
					var _eatAt = /^(Cafe|Coffee Shop|咖啡馆|咖啡店|餐厅)$/.test(passage) ? 'cafe' : 'canteen';
					return '<<link [[坐下来吃点什么|FS Eat Here]]>><<set $fs_eatAt to "' + _eatAt + '">><</link>>';
				}
				/* 孤儿院大厅的「长桌面包」与「清理存档异常数据」已并进上面第一个
				   `case 'Orphanage'` 里 —— 那个重复的 case 是不可达死代码，别再写回来。
				   同类坑：switch 里同一个 case 标签出现两次，后者永远不执行。 */
				case 'Bedroom': {
					var extra = [];
					if (V.fsData && V.fsData.sanityGift) extra.push('<span class="teal">门缝下塞着一个没有署名的信封。</span><br><<link [[打开它|FS Sanity Gift]]>><</link>>');
					var out = [];
					if (typeof fs.canWatchStar === 'function' && fs.canWatchStar()) {
						out.push('<<link [[爬到屋顶上看一会儿星星|Rooftop Last Star]]>><<pass 1>><</link>>');
					}
					/* 人格洗脑丸：两条线的当面警告（优先显示） */
					if (V.fsData && V.fsData.pillBaileyWarn === 1 && !V.fsData.pillBaileyWarnShown) {
						out.push('<span class="gold">门口站着一个人。</span><br><<link [[去门口看看|FS Bailey Slave Warn]]>><</link>>');
					}
					if (V.fsData && V.fsData.pillJiusiWarn === 1 && !V.fsData.pillJiusiWarnShown) {
						out.push('<span class="gold">床边坐着一个人。</span><br><<link [[看清是谁|FS Jiusi Slave Warn]]>><</link>>');
					}
					if (V.fsData && V.fsData.jiusiDisappointed === 1) {
						out.push('<span class="red">玖肆已经很久没有出现在你能看到的地方了。</span><br>'
							+ '<span class="fs-sub">（她在社交栏里写着「对你感到失望」。）</span><br>'
							+ '<<link [[出去走走|FS Jiusi Disappointed]]>><</link>>');
					}
					/* 人格洗脑丸：做面包 / 把面包给出去 */
					if (typeof fs.pillOwned === 'function' && fs.pillOwned() > 0 && !V.fsData.pillBread) {
						out.push('<<icon "finalstar/ui-notice.png">><<link [[做一个偷偷放入洗脑丸的面包|FS Pill Bread]]>><</link>>');
					} else if (V.fsData && V.fsData.pillBread) {
						out.push('<<icon "finalstar/ui-notice.png">><<link [[把面包交给身边的人|FS Pill Bread Give]]>><</link>>');
					}
					return out.concat(extra).join('<br>');
				}
			}
		} catch (e) { }
		return '';
	};

	/* 社交面板：失望时插入红字；面板可能延迟渲染，故做几次重试 */
	fs.injectSocialWarnRetry = function (tries) {
		try {
			fs.injectSocialWarn();
			if (document.getElementById('fs-social-warn')) return;
			if (typeof State !== 'undefined' && State.passage !== 'Social') return;
			if ((tries || 0) >= 5) return;
			setTimeout(function () { fs.injectSocialWarnRetry((tries || 0) + 1); }, 250);
		} catch (e) { }
	};

	/* 社交面板：失望时插入红字（DOM 注入，不依赖补丁管线） */
	fs.injectSocialWarn = function () {
		try {
			if (typeof State === 'undefined' || State.passage !== 'Social') {
				var old = document.getElementById('fs-social-warn');
				if (old) old.remove();
				return;
			}
			var disappointed = !!(V.fsData && V.fsData.jiusiDisappointed === 1);
			var exist = document.getElementById('fs-social-warn');
			if (!disappointed) { if (exist) exist.remove(); return; }
			if (exist) return;
			var host = document.getElementById('faction-reputations') || document.getElementById('relation-display');
			if (!host || !host.parentNode) return;
			var box = document.createElement('div');
			box.id = 'fs-social-warn';
			box.className = 'fs-social-warn';
			box.innerHTML = '<span class="red">玖肆对你感到失望。</span>'
				+ '<br><span class="fs-sub">她已经很久没有出现在你能看到的地方了。</span>';
			host.parentNode.insertBefore(box, host);
			fs.log('社交面板已插入玖肆失望提示');
		} catch (e) { }
	};

	fs.injectLocationLinks = function () {
		try {
			var passage = (typeof State !== 'undefined' && State.passage) ? State.passage : null;
			if (!passage) return;
			var text = fs.locationLinkHtml(passage);
			/* 混乱：理智为 0 时把入口文字遮成「？」，目标不变（安全） */
			try { if (fs.confusionMask) text = fs.confusionMask(text); } catch (e) { }
			var old = document.getElementById('fs-loc-links');
			if (!text) { if (old) old.remove(); return; }
			if (old) old.remove();
			var pc = fs.passageHost ? fs.passageHost() : document.getElementById('passage-content');
			if (!pc) return;
			var wrap = document.createElement('div');
			wrap.id = 'fs-loc-links';
			wrap.className = 'fs-loc-links';
			new Wikifier(wrap, text);
			pc.appendChild(wrap);
		} catch (e) {
			fs.warn('地点入口注入失败: ' + e.message);
		}
	};

	fs.log('地点入口模块已加载（入口挂在正文下方）');
	try { fs.bindBagClicks(); } catch (e) { }
	/* 定时重注入：其它模组会重绘侧栏，被覆盖就补回来 */
	fs.keepInjecting = function () {
		try {
			/* ⚠️ 判据原来写的是 `#fs-vitals`，可那个 id **从来没被创建过**
			   （三条行的真实 id 是 fssanitycaption / fshungercaption / fsinfectcaption，
			   见 injectSanityRows）。于是这个条件恒为真 → 每 700ms 都会无条件重建三条侧栏行。
			   改成查真实存在的行：只在行确实缺失时才重建，既省开销又保留自愈能力。 */
			if (!document.getElementById('fssanitycaption') || !document.getElementById('fshungercaption') || !document.getElementById('fsinfectcaption')) fs.injectSanityRows();
			if (!document.getElementById('fs-bag-btn')) fs.injectBagButton();
		} catch (e) { }
	};
	if (!fs._injectTimer) { try { fs._injectTimer = setInterval(fs.keepInjecting, 700); } catch (e) { } }

	/* ---------- 数值增减标签（借原版译名与配色，**去掉竖线**） ----------
	   ⚠️  问题记录：「我们添加的竖线变成了两个」（截图里 `|| - 压力 || - 创伤`）。
	   根因：原版显示宏 <<gXXX>> / <<lXXX>> 的输出形如 `| <span class="green">+ 声望</span> |`
	   —— **前后各带一个竖线**；正文里连着写两个（`<<lstress>>　<<ltrauma>>`）就拼成了 `||`。
	   原版那样没错（那个样式是给"选项旁边"用的）；但**正文里不该出现竖线**。
	   所以正文一律走本工具：借原版宏拿到游戏自己的译名与配色，再把裸竖线剥掉。
	   选项旁边仍然直接用原版宏（保留竖线，那是原版样式）。
	   `arg` 用于 <<glove "玖肆">> 这种带参数的宏。 */
	var _fsStatTagCache = {};
	fs.statTag = function (stat, gain, arg) {
		var key = (gain ? 'g' : 'l') + String(stat || '');
		var ck = key + '|' + (arg == null ? '' : String(arg));
		if (_fsStatTagCache[ck]) return _fsStatTagCache[ck];
		var html = '';
		try {
			var call = '<<' + key + (arg == null ? '' : ' ' + JSON.stringify(String(arg))) + '>>';
			var frag = SugarCube.Wikifier.wikifyEval(call);
			var d = document.createElement('div');
			d.appendChild(frag);
			html = d.innerHTML || '';
		} catch (e) { html = ''; }
		/* 去掉裸竖线（连同两侧空白），保留 span —— 这就是"正文不要竖线" */
		html = html.replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
		if (!/^<span/.test(html)) {
			html = '<span class="' + (gain ? 'green' : 'red') + '">' + (gain ? '+' : '-') + ' ' + key.slice(1) + '</span>';
		}
		_fsStatTagCache[ck] = html;
		return html;
	};

	fs.register('links', function () {
	fs.onDisplay(function () { setTimeout(fs.injectLocationLinks, 25); setTimeout(function () { fs.injectSocialWarnRetry(0); }, 40); setTimeout(function () { fs.injectSanityRows(); }, 60); if (fs.sanityTick) fs.sanityTick(); if (fs.hungerTick) fs.hungerTick(); if (fs.sanityCombatWatch) fs.sanityCombatWatch(); setTimeout(function () { fs.injectBagButton(); }, 110); if (fs.foodApply) fs.foodApply(); if (fs.sanityGiftTick) fs.sanityGiftTick(); setTimeout(function () { fs.sanityDowngradeText(); }, 90); });
	});

})();
