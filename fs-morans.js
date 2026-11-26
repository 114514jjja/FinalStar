/* fs-morans.js —— 长线剧情「莫伦斯」（用户  规格）
 *
 * 剧情骨架：
 *   ① 实验室开启后第 3 天进实验室 → 意外遇到玖肆（在修一枚银镶蓝宝石的戒指）
 *      → 她解释「x计划」与「十天后幻界的怪物会影响现实」→ 玩家二选一：
 *         · 同意一起（coop，双人通关：玖肆后续会给便利支持）
 *         · 自己前去（solo，单人通关：玖肆之后**不再出现在长线文本里**）
 *   ② 十天之后，宅邸街出现「走进灰色迷雾」的选项（会警告文本很长、请先存档，且持续存在）
 *   ③ 进迷雾 → 城市「莫伦斯」，独立剧情日计数（**不影响现实时间**）
 *
 * ⚠️ 时间隔离：城市里一律不用 <<pass>>/<<dayPassed>>，只用本模块的剧情日 day；
 *    进入时把现实时间记在 realMark 里，退出时原样还原（双保险）。
 * ⚠️ 日期取值：DoL 的「第几天」在不同整合包里可能挂在 Time.day / V.day 上，
 *    所以统一走 fs.morToday()，两种都试，取到哪个用哪个（探针里会核对）。
 * ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* ---------- 状态 ---------- */
	fs.morDefaults = function () {
		return {
			labDay: 0,        /* 实验室开启那天 */
			met: 0,           /* 已经历过「第三天相遇」 */
			mode: '',         /* 'solo' 单人 / 'coop' 双人 */
			choiceDay: 0,     /* 做出选择那天 */
			inCity: 0,        /* 是否身处莫伦斯 */
			day: 0,           /* 剧情日（1 起，独立计数） */
			stage: '',        /* wake / home / city / school / anomaly / final / done */
			aff: null,        /* { smt: 苏梦棠, sby: 笙不瑜 } */
			coin: 0,          /* 苏梦棠的纪念币（好感 70% 才给） */
			doll: 0,          /* 巫毒娃娃（C 结局条件） */
			ending: '',       /* 'a' / 'b' / 'c' */
			unlocked: 0,      /* 控制台已提前解锁全部结局预览 */
			jiusiGone: '',    /* '' / 'missing'（A 路线回头后 12 天）/ 'dead'（C 结局） */
			goneUntil: 0,     /* 失踪截止日 */
			realMark: null,   /* 进城市时的现实时间快照 */
			parkRests: 0,     /* 公园休息次数（超过 3 次保安来盘问） */
			workDay: 0,       /* 哪一天在大厦干过活（一天一次） */
			clock: 480,       /* 城市里的钟点（分钟，08:00 起；城市时间独立于现实） */
			classDay: 0,      /* 哪一天上过课（含已上几节） */
			classes: 0,       /* 当天已上的课节数 */
			homeRoom: 'living', /* 住宅里当前房间（仅用于文案） */
			chatDay: 0,       /* 哪一天跟苏梦棠聊过（一天一次） */
			fight: null,      /* 当前战斗状态 */
		};
	};
	fs.mor = function () {
		try {
			fs.ensureData();
			var d = V.fsData.mor;
			if (!d || typeof d !== 'object') d = V.fsData.mor = fs.morDefaults();
			var def = fs.morDefaults();
			for (var k in def) { if (def.hasOwnProperty(k) && !(k in d)) d[k] = def[k]; }
			if (!d.aff || typeof d.aff !== 'object') d.aff = { smt: 0, sby: 0 };
			if (typeof d.aff.smt !== 'number' || !isFinite(d.aff.smt)) d.aff.smt = 0;
			if (typeof d.aff.sby !== 'number' || !isFinite(d.aff.sby)) d.aff.sby = 0;
			return d;
		} catch (e) { return fs.morDefaults(); }
	};

	/* DoL 的「第几天」：
	   ⚠️  验证（`开发检查脚本`）：这个版本里 **`Time.day` 是 undefined**，
	      `Object.keys(Time)` 也是空的（属性挂在原型上）。真正的日计数是 **`Time.days`**
	      （新开一局时是负数，例如 -25，随天数 +1）。所以以 Time.days 为主，
	      再退回 V.day，都没有就返回 0（调用方会退化成"永远不触发"，但不会崩）。 */
	fs.morToday = function () {
		try {
			if (typeof Time !== 'undefined') {
				var v = Time.days;
				if (typeof v === 'number' && isFinite(v)) return v;
			}
		} catch (e) { }
		try { var d = Number(V.day); if (isFinite(d) && d !== 0) return d; } catch (e) { }
		return 0;
	};

	/* ---------- 好感 ---------- */
	fs.morAff = function (who, delta) {
		try {
			var d = fs.mor();
			var k = (who === 'sby') ? 'sby' : 'smt';
			var cur = Number(d.aff[k]) || 0;
			var _dl = Number(delta) || 0;
			if (_dl > 0 && window.finalStar && finalStar.talentHas && finalStar.talentHas('d9')) _dl *= 2;
			cur = Math.max(0, Math.min(100, cur + _dl));
			d.aff[k] = cur;
			/* 同步到对应命名 NPC 的 love，社交栏的心形和关系描述才会跟着变 */
			try {
				var nm = (k === 'sby') ? '笙不瑜' : '苏梦棠';
				var i = (V.NPCNameList || []).indexOf(nm);
				if (i !== -1 && V.NPCName[i]) { V.NPCName[i].love = cur; V.NPCName[i].lust = 0; }
			} catch (e2) { }
			return cur;
		} catch (e) { return 0; }
	};
	/* 好感评语：随数值变化，给社交面板用 */
	fs.morAffWord = function (who) {
		try {
			var v = fs.morAffGet(who);
			if (v >= 90) return '离不开你';
			if (v >= 75) return '很依赖你';
			if (v >= 60) return '把你当自己人';
			if (v >= 45) return '愿意多跟你说几句';
			if (v >= 25) return '对你有了一点印象';
			if (v >= 10) return '开始记住你了';
			return '对你没什么看法';
		} catch (e) { return ''; }
	};

	fs.morAffGet = function (who) {
		try { var d = fs.mor(); return (who === 'sby') ? (Number(d.aff.sby) || 0) : (Number(d.aff.smt) || 0); }
		catch (e) { return 0; }
	};
	fs.morCoinReady = function () { return fs.morAffGet('smt') >= 70; };

	/* ---------- ① 实验室第三天 ---------- */
	fs.morMarkLab = function () {
		try {
			var d = fs.mor();
			if (d.labDay === 0 || d.labDay == null) {
				var t = fs.morToday();
				d.labDay = (typeof t === 'number' && isFinite(t)) ? t : 1;
			}
			return d.labDay;
		} catch (e) { return 0; }
	};
	/* 「发实验室的第三天」：开启当天算第一天 */
	fs.morThirdDayReady = function () {
		try {
			var d = fs.mor();
			if (d.met || !d.labDay) return false;
			var today = fs.morToday();
			return today >= d.labDay + 2;
		} catch (e) { return false; }
	};
	fs.morPick = function (mode) {
		try {
			var d = fs.mor();
			d.met = 1;
			d.mode = (mode === 'solo') ? 'solo' : 'coop';
			d.choiceDay = fs.morToday() || 1;
			fs.log('长线剧情：选择了「' + (d.mode === 'solo' ? '自己前去（单人）' : '一起（双人）') + '」，十天倒计时开始');
			return d.mode;
		} catch (e) { return ''; }
	};
	fs.morIsCoop = function () { try { return fs.mor().mode === 'coop'; } catch (e) { return false; } };
	fs.morIsSolo = function () { try { return fs.mor().mode === 'solo'; } catch (e) { return false; } };

	/* ---------- ② 十天倒计时 / 宅邸街迷雾入口 ---------- */
	fs.morFogReady = function () {
		try {
			var d = fs.mor();
			if (!d.mode || d.inCity || d.ending) return false;
			var today = fs.morToday();
			return today >= (Number(d.choiceDay) || 0) + 10;
		} catch (e) { return false; }
	};
	fs.morFogDaysLeft = function () {
		try {
			var d = fs.mor();
			if (!d.mode) return null;
			var today = fs.morToday();
			return Math.max(0, (Number(d.choiceDay) || 0) + 10 - today);
		} catch (e) { return null; }
	};
	/* 挂在宅邸街（Danube Street）正文下方的那一行。倒计时期间也显示剩余天数，
	   这样玩家知道还要等几天；到日子之后变成可点的「走进灰色迷雾」。 */
	fs.morStreetHtml = function () {
		try {
			var d = fs.mor();
			if (!d.mode || d.inCity || d.ending) return '';
			if (!fs.morFogReady()) {
				var left = fs.morFogDaysLeft();
				return '<span class="grey">街尾的雾又浓了一点。' +
					(left !== null ? ('（还有 <span class="gold">' + left + '</span> 天）') : '') + '</span>';
			}
			var out = [];
			out.push('<<icon "finalstar/morans-fog.png">><span class="red">街尾那片雾今天浓得反常——它不散，也不动，像有人在那里等着。</span>');
			out.push('<span class="fs-sub">（长线剧情「莫伦斯」：文本很长，建议先存档再进去。进去之后现实时间不会流动。）</span>');
			out.push('<<link [[走进灰色迷雾|FS Morans Fog]]>><</link>>');
			return out.join('<br>');
		} catch (e) { return ''; }
	};

	/* ---------- ③ 进入 / 退出城市（时间隔离） ---------- */
	fs.morEnter = function () {
		try {
			var d = fs.mor();
			d.realMark = {
				day: fs.morToday(),
				hour: (typeof Time !== 'undefined' ? Number(Time.hour) || 0 : 0),
			};
			d.inCity = 1;
			d.day = 1;
			d.stage = 'wake';
			fs.log('进入莫伦斯：剧情第 1 天（现实时间已快照，退出时还原）');
			return true;
		} catch (e) { return false; }
	};
	fs.morExit = function () {
		try {
			var d = fs.mor();
			d.inCity = 0;
			/* 还原现实时间。
			   ⚠️ 这里原来写的是 `V.hour = …` / `V.day = …` —— **两个字段原版都没有**：
			      `Time.hour` 读的是 currentDate（`get hour(){return currentDate.hour}`），
			      `Time.days` 由时间戳算，写 V.hour/V.day 既不生效、又往存档里塞垃圾字段。
			   城市里全程不调 <<pass>>，现实时间本不该动，所以这里改成"核对+只在同一天内纠小时"：
			      天数变了 → 只警告不回拨（回拨日期会连带触发一天的事件）；
			      同一天内小时对不上 → 用原版公开的 Time.setTime(h, 0) 拨回去。 */
			if (d.realMark && typeof d.realMark === 'object') {
				try {
					if (typeof Time !== 'undefined' && typeof Time.setTime === 'function') {
						var _nowD = fs.morToday();
						var _snapD = Number(d.realMark.day);
						var _nowH = Number(Time.hour) || 0;
						var _snapH = Number(d.realMark.hour) || 0;
						if (isFinite(_snapD) && _nowD !== _snapD) {
							fs.warn('莫伦斯退出：现实天数变了（快照 ' + _snapD + ' → 现在 ' + _nowD + '），不回拨日期');
						} else if (Math.abs(_nowH - _snapH) >= 1) {
							Time.setTime(_snapH, 0);
							fs.log('莫伦斯退出：现实小时已拨回 ' + _snapH + ':00');
						}
					}
				} catch (e) { }
				d.realMark = null;
			}
			return true;
		} catch (e) { return false; }
	};
	/* 剧情日推进（不用 <<pass>>，纯计数） */
	fs.morNextDay = function () {
		try {
			var d = fs.mor();
			d.day = (Number(d.day) || 0) + 1;
			d.clock = 7 * 60;
			d.classes = 0;
			/* 设计说明：第七天如果玩家什么也没做（没推进任何结局线），直接进 D 结局 */
			if (d.day >= 10 && d.stage !== 'done') d.pendingEnd = 'e';
			fs.log('莫伦斯：剧情第 ' + d.day + ' 天（07:00）');
			return d.day;
		} catch (e) { return 0; }
	};
	/* ---------- 城市里的钟点（不是现实时间） ----------
	   用户的意见：跑步、上课这些动作应该「消耗时间」。城市本来就与现实时间隔离，
	   于是给它自己的钟：mor.clock（分钟），进城市 08:00，过一天回到 07:00。
	   所有动作用 fs.morPass(分钟) 推进；23:00 之后提示该去睡了。 */
	fs.morClock = function () {
		try {
			var d = fs.mor();
			var c = Number(d.clock);
			if (!isFinite(c) || c < 0) { c = 8 * 60; }
			if (c > 23 * 60 + 59) c = 23 * 60 + 59;
			return Math.round(c);
		} catch (e) { return 8 * 60; }
	};
	fs.morClockText = function () {
		try {
			var c = fs.morClock();
			var h = Math.floor(c / 60), m = c % 60;
			var word = h < 5 ? '凌晨' : (h < 9 ? '早上' : (h < 12 ? '上午' : (h < 14 ? '中午' : (h < 18 ? '下午' : (h < 22 ? '晚上' : '深夜')))));
			var mm = (m < 10 ? '0' + m : '' + m);
			return word + ' ' + h + ':' + mm;
		} catch (e) { return '上午 8:00'; }
	};
	fs.morPass = function (mins) {
		try {
			var d = fs.mor();
			d.clock = Math.min(23 * 60 + 59, fs.morClock() + (Number(mins) || 0));
			return d.clock;
		} catch (e) { return 0; }
	};
	fs.morLate = function () { try { return fs.morClock() >= 21 * 60; } catch (e) { return false; } };
	fs.morSchoolOpen = function () { try { var c = fs.morClock(); return c >= 8 * 60 && c < 15 * 60 + 30; } catch (e) { return false; } };
	fs.morClassLeft = function () {
		try {
			var d = fs.mor();
			if (Number(d.classDay) !== fs.morDay()) return 3;
			return Math.max(0, 3 - (Number(d.classes) || 0));
		} catch (e) { return 0; }
	};
	fs.morTakeClass = function () {
		try {
			var d = fs.mor();
			if (Number(d.classDay) !== fs.morDay()) { d.classDay = fs.morDay(); d.classes = 0; }
			if ((Number(d.classes) || 0) >= 3) return 'done';
			d.classes = (Number(d.classes) || 0) + 1;
			fs.morPass(45);
			return 'ok';
		} catch (e) { return 'error'; }
	};

	fs.morDay = function () { try { return Number(fs.mor().day) || 0; } catch (e) { return 0; } };
	fs.morAnomaly = function () { try { return fs.morDay() >= 5; } catch (e) { return false; } };  /* 第五天之后世界开始异常 */

	/* ---------- 结局 ---------- */
	fs.morEndName = function (k) {
		return ({ a: '兵将疾行', b: '爱', c: '崩坏', d: '留影', e: '无声的第十天' })[k] || '未知';
	};
	fs.morEnd = function (key) {
		try {
			var d = fs.mor();
			/* 同一场戏里会连续调两次 morEnd（例如 A→留影）：第二次不再重置，
			   只把最后记录的那一条改成真正的结局，避免一本童话书解锁两页。 */
			if (d.stage === 'done') {
				var _last = (Array.isArray(d.endings) && d.endings.length) ? d.endings[d.endings.length - 1] : '';
				d.ending = (['a', 'b', 'c', 'd', 'e'].indexOf(key) !== -1) ? key : 'a';
				if (Array.isArray(d.endings) && d.endings.length) {
					if (_last !== d.ending) d.endings[d.endings.length - 1] = d.ending;
				} else {
					d.endings = [d.ending];
				}
				return d.ending;
			}
			var _ending = (['a', 'b', 'c', 'd', 'e'].indexOf(key) !== -1) ? key : 'a';
			var _endings = Array.isArray(d.endings) ? d.endings.slice() : [];
			if (_endings.indexOf(_ending) === -1) _endings.push(_ending);
			/* 反速通：结局后把本周目进度（好感/纪念币/娃娃/天数/选择）全部清空，
			   只保留「已解锁结局」与「通关标记」，下一遍从头开始。 */
			var fresh = fs.morDefaults();
			Object.keys(d).forEach(function (k) { delete d[k]; });
			Object.keys(fresh).forEach(function (k) { d[k] = fresh[k]; });
			d.ending = _ending;
			d.endings = _endings;
			d.stage = 'done';
			d.cleared = 1;
			if (d.ending === 'c') {
				/* C 结局：玖肆彻底死亡 —— 清空好感与数值，社交栏仍显示红色「死亡」 */
				fs.morKillJiusi();
			}
			fs.log('长线剧情结局：' + fs.morEndName(d.ending) + '（' + d.ending + '）');
			return d.ending;
		} catch (e) { return ''; }
	};
	fs.morEnded = function () { try { return fs.mor().stage === 'done'; } catch (e) { return false; } };
	fs.morDayLimitDue = function () {
		try {
			var d = fs.mor();
			if (d.stage === 'done') return false;
			return Number(d.day) >= 10;      /* 十天一到还没结局 → E「无声的第十天」 */
		} catch (e) { return false; }
	};
	fs.morDay7Due = fs.morDayLimitDue;      /* 旧名兼容 */
	/* 老存档：以前的 D 是「留影」，把它迁到 E，D 让给第七天结局 */
	fs.morEndingMigrate = function () {
		try {
			var d = fs.mor();
			if (d.ending === 'd' && d.jiusiGone === 'missing' && !d.migratedE) {
				d.ending = 'e';
				d.migratedE = 1;
				fs.log('结局迁移：旧「留影」D → E');
			}
		} catch (e) { }
	};

	fs.morEndingOf = function (k) { try { return fs.mor().ending === k; } catch (e) { return false; } };

	/* A 路线「回头」之后：玖肆失踪 12 天 */
	fs.morJiusiMissingNow = function () {
		try {
			var d = fs.mor();
			if (d.jiusiGone !== 'missing') return false;
			if (!d.goneUntil) return false;
			return fs.morToday() < Number(d.goneUntil);
		} catch (e) { return false; }
	};
	fs.morSetJiusiMissing = function (days) {
		try {
			var d = fs.mor();
			d.jiusiGone = 'missing';
			d.goneUntil = (fs.morToday() || 0) + (Number(days) || 12);
			fs.log('玖肆失踪 ' + (days || 12) + ' 天（到第 ' + d.goneUntil + ' 天）');
			return true;
		} catch (e) { return false; }
	};
	/* C 结局：玖肆彻底死亡。
	   ⚠️ 用户  明确：**死亡依然显示**，但「清空所有好感和数值，只显示红色的死亡二字」。
	   所以这里把她的 love/lust/… 全部清零，但**不动 state** ——
	   动了 state 会被模组自己的社交过滤（SocialDeadFilter）当成"死"而把整行移掉，
	   那就变成"看不到她"了，和设计上相反。显示「死亡」由 SocialJiusiDisappointed.txt 里的红字负责。 */
	fs.morKillJiusi = function () {
		try {
			var d = fs.mor();
			d.jiusiGone = 'dead';
			d.goneUntil = 0;
			try {
				var i = V.NPCNameList.indexOf('玖肆');
				if (i !== -1 && V.NPCName[i]) {
					var n = V.NPCName[i];
					n.love = 0; n.lust = 0; n.dom = 0; n.trauma = 0; n.rage = 0;
					n.purity = 0; n.corruption = 0; n.harmony = 0; n.ferocity = 0;
				}
			} catch (e2) { }
			fs.log('玖肆被标记为「死亡」（好感与数值已清零，社交栏仍显示）');
			return true;
		} catch (e) { return false; }
	};
	fs.morJiusiDead = function () { try { return fs.mor().jiusiGone === 'dead'; } catch (e) { return false; } };
	/* 控制台作弊：玖肆回归（C 结局玩家不至于永久失去这个角色） */
	fs.morReviveJiusi = function () {
		try {
			var d = fs.mor();
			d.jiusiGone = '';
			d.goneUntil = 0;
			d.ending = d.ending === 'c' ? 'a' : d.ending;
			try {
				var i = V.NPCNameList.indexOf('玖肆');
				if (i !== -1 && V.NPCName[i] && !(Number(V.NPCName[i].love) > 0)) V.NPCName[i].love = 50;
			} catch (e2) { }
			fs.log('作弊：玖肆已回归（清除死亡/失踪状态，好感回到 50）');
			return true;
		} catch (e) { return false; }
	};
	/* 控制台：提前解锁全部结局预览 */
	fs.morUnlockAll = function () {
		try { fs.mor().unlocked = 1; fs.log('作弊：已解锁全部结局预览'); return true; }
		catch (e) { return false; }
	};

	/* ---------- 剧情进度一行字（控制台/提示用） ---------- */
	fs.morStatusLine = function () {
		try {
			var d = fs.mor();
			var L = [];
			L.push('阶段 ' + (d.stage || '未开始'));
			L.push('模式 ' + (d.mode === 'coop' ? '双人' : d.mode === 'solo' ? '单人' : '未选'));
			if (d.inCity) L.push('剧情第 ' + d.day + ' 天');
			else if (d.mode) { var left = fs.morFogDaysLeft(); if (left !== null) L.push('距迷雾开启 ' + left + ' 天'); }
			L.push('苏梦棠好感 ' + fs.morAffGet('smt') + ' / 笙不瑜 ' + fs.morAffGet('sby'));
			if (d.coin) L.push('有纪念币');
			if (d.doll) L.push('有巫毒娃娃');
			if (d.ending) L.push('结局 ' + fs.morEndName(d.ending));
			return L.join('　|　');
		} catch (e) { return ''; }
	};

	/* ================= 城市内容（ 第二轮） =================
	   设计说明：原先的性行为遭遇一律换成**原创事件**；反抗进的是「纯粹的战斗」，
	   不会发生性行为；敌人有上班族 / 乞丐的文本差分；公园休息超过三次会被保安盘问，
	   有身份证（$id is 1）就道歉离开，没有就罚 50，没钱就打一场。 */

	/* ---------- 基础数值 ---------- */
	fs.morPainMax = function () { try { return Number(V.painmax) || 200;   /* 原版 painClamp 的硬上限是 200，这里别再用 100 */ } catch (e) { return 100; } };
	fs.morHasId = function () {
		/* DoL 的身份证就是 $id（我们银行那条补丁也用它：<<if $id isnot 1>> 表示没证） */
		try { return Number(V.id) === 1; } catch (e) { return false; }
	};
	fs.morMoney = function (n) {
		try {
			var m = Number(V.money) || 0;
			m = Math.max(0, m + (Number(n) || 0));
			V.money = m;
			return m;
		} catch (e) { return 0; }
	};
	fs.morAddStress = function (n) {
		try {
			var mx = Number(V.stressmax) || 100;
			V.stress = Math.min(mx, Math.max(0, (Number(V.stress) || 0) + (Number(n) || 0)));
			return V.stress;
		} catch (e) { return 0; }
	};
	fs.morAddTrauma = function (n) {
		try {
			var mx = Number(V.traumamax) || 100;
			V.trauma = Math.min(mx, Math.max(0, (Number(V.trauma) || 0) + (Number(n) || 0)));
			return V.trauma;
		} catch (e) { return 0; }
	};

	/* ---------- 转化（给路人嘲讽用） ---------- */
	fs.morTrans = function () {
		try {
			/* ⚠️ 原来读的是 `V.transformations` —— **原版没有这个字段**（0.5.12.13 里
			   `setup.transformations` 只是定义表；玩家自己的等级存在 `$wolfgirl` / `$cat` /
			   `$harpy` … 每个变身同名变量里，数字 ≥ 1 表示"有"）。
			   所以原来 `morTrans()` 恒返回空数组，路人嘲讽的转化差分**从来没出现过**。
			   现在按原版口径：遍历定义表，读 `V[tf.name]` 的等级。 */
			var defs = (window.setup && setup.transformations) || [];
			var out = [];
			for (var i = 0; i < defs.length; i++) {
				var nm = defs[i] && defs[i].name;
				if (!nm) continue;
				var lv = Number(V[nm]);
				if (isFinite(lv) && lv >= 1) out.push(nm);
			}
			return out;
		} catch (e) { return []; }
	};
	/* 每类转化对应一句嘲讽（路人骂玩家的台词差分） */
	fs.morTransTaunt = function (key) {
		var M = {
			cat: '顶着对猫耳朵就敢上街蹭人，真是个婊子。',
			wolf: '野狗一样的东西，身上一股味道，谁教你这么贴人的？',
			fox: '狐狸精长狐狸尾巴，怪不得手这么欠。',
			bird: '长着翅膀了不起啊？翅膀收一收，别在这掉毛。',
			cow: '带着牛耳朵牛尾巴还敢出来乱撞，奶都晃出来了。',
			demon: '恶魔也学会偷东西了？你这种货色最该被赶出去。',
			angel: '装什么天使，天使会在街上摸别人的口袋？',
			plant: '你身上那股草腥味熏到我了，滚远点。',
			slime: '黏糊糊的玩意儿也配进城？离我远点。',
			fallenangel: '堕落的东西，翅膀黑成这样还敢抬头看人。',
		};
		return M[key] || '';
	};

	/* ---------- 公园：休息计数 + 保安事件 ---------- */
	fs.morParkRests = function () { try { return Number(fs.mor().parkRests) || 0; } catch (e) { return 0; } };
	fs.morParkRest = function () {
		try {
			var d = fs.mor();
			d.parkRests = (Number(d.parkRests) || 0) + 1;
			return d.parkRests;
		} catch (e) { return 0; }
	};
	/* 超过三次就触发保安盘问；查过一次之后重置计数，避免每次都弹 */
	fs.morParkGuardReady = function () { return fs.morParkRests() > 3; };
	fs.morParkGuardDone = function () { try { fs.mor().parkRests = 0; return true; } catch (e) { return false; } };

	/* ---------- 战斗（纯粹的战斗：不涉性） ----------
	   规则（用户规格）：
	     · 玩家打中 → 敌人 hp 下降；敌人反击 → 玩家 pain 上升
	     · 玩家 pain 到上限 → 输（被打晕，敌人离开）
	     · 敌人 hp 归零 → 赢：敌人扔下一点小费，求玩家放自己走（上班族说还有工作，乞丐说不想再进监狱）
	     · 到第 10 回合仍没分出 → 敌人抽身逃走（玩家 pain 未到上限）
	     · 中途「行动随机次数后 pain 没到上限」也会逃跑（fleeAt 随机 4~8） */
	fs.morFightDefs = {
		guard: { name: '保安', hp: 130, atk: [8, 15], tip: 0, flee: '保安后退一步，把对讲机别回腰上，转身走了。' },
		office: { name: '上班族', hp: 100, atk: [6, 13], tip: 250, flee: '他看了眼手表，骂了一句，抽身往地铁口跑了。' },
		beggar: { name: '乞丐', hp: 80, atk: [4, 11], tip: 120, flee: '他一缩,钻进巷子里不见了。' },
	};
	fs.morFightBegin = function (kind) {
		try {
			var d = fs.mor();
			var def = fs.morFightDefs[kind] || fs.morFightDefs.office;
			d.fight = {
				kind: kind, name: def.name, ehp: def.hp, emax: def.hp,
				php: Number(V.pain) || 0, round: 0,
				fleeAt: 4 + Math.floor(Math.random() * 5),
				over: 0, result: '', tip: def.tip || 0,
			};
			return d.fight;
		} catch (e) { return null; }
	};
	fs.morFight = function () { try { return fs.mor().fight || null; } catch (e) { return null; } };
	fs.morFightAct = function (act) {
		try {
			var d = fs.mor();
			var f = d.fight;
			if (!f || f.over) return f;
			var def = fs.morFightDefs[f.kind] || fs.morFightDefs.office;
			f.round = (Number(f.round) || 0) + 1;
			var dmg = act === 'kick' ? 20 : act === 'hit' ? 15 : act === 'push' ? 9 : 0;
			f.ehp = Math.max(0, (Number(f.ehp) || 0) - dmg);
			if (f.ehp <= 0) {
				f.over = 1; f.result = 'win';
				if (f.tip) fs.morMoney(f.tip);
				fs.log('莫伦斯战斗：赢了（' + f.name + '），小费 £' + f.tip);
				return f;
			}
			var lo = def.atk[0], hi = def.atk[1];
			var a = lo + Math.floor(Math.random() * (hi - lo + 1));
			if (act === 'guard') a = Math.round(a * 0.4);
			var pm = fs.morPainMax();
			f.php = Math.min(pm, (Number(f.php) || 0) + a);
			try { V.pain = f.php; } catch (e) { }
			if (f.php >= pm) {
				f.over = 1; f.result = 'lose';
				fs.morAddStress(20); fs.morAddTrauma(10);
				fs.log('莫伦斯战斗：被打倒（' + f.name + '）');
				return f;
			}
			if (f.round >= 10) { f.over = 1; f.result = 'timeout'; return f; }
			if (f.round >= f.fleeAt) { f.over = 1; f.result = 'flee'; return f; }
			return f;
		} catch (e) { return null; }
	};
	fs.morFightEnd = function () { try { fs.mor().fight = null; return true; } catch (e) { return false; } };

	/* ---------- 街头随机事件 ---------- */
	/* 街头遭遇的敌人：上班族 / 乞丐（两者文本差分；用户规格） */
	fs.morRollFoe = function () {
		return Math.random() < 0.55 ? 'office' : 'beggar';
	};
	fs.morRollStreet = function () {
		/* 返回 null（什么也没发生）或一个事件描述对象 */
		var roll = Math.random();
		if (roll < 0.35) return null;
		var trans = fs.morTrans();
		var taunt = '';
		for (var i = 0; i < trans.length; i++) {
			var t = fs.morTransTaunt(trans[i]);
			if (t) { taunt = t; break; }
		}
		return { kind: 'bump', taunt: taunt };
	};

	/* ---------- 商店 / 工作 ----------
	   ⚠️ DoL 的 $money 单位是**分**（£1 = 100）。第一版我按「元」写，
	      结果买汉堡只扣了 40 分（£0.4）、打工只给 £0.8 —— 探针抓到的真 bug。
	      这里所有价格一律用「分」，注释里写对应的英镑。 */
	fs.morBuy = function (what) {
		try {
			var M = { burger: 400, sweet: 600, clothes: 3000 };   /* £4 / £6 / £30 */
			var price = M[what] || 0;
			if ((Number(V.money) || 0) < price) return 'poor';
			fs.morMoney(-price);
			if (what === 'burger' || what === 'sweet') {
				try {
					var hm = Number(V.hungermax) || 100;
					V.hunger = Math.min(hm, (Number(V.hunger) || 0) + 25);
				} catch (e) { }
			}
			fs.log('莫伦斯购物：' + what + '（£' + (price / 100) + '）');
			return 'ok';
		} catch (e) { return 'error'; }
	};
	fs.morWorkedToday = function () { try { return Number(fs.mor().workDay) === fs.morDay(); } catch (e) { return false; } };
	fs.morWork = function () {
		try {
			var d = fs.mor();
			if (Number(d.workDay) === fs.morDay()) return 'done';
			d.workDay = fs.morDay();
			fs.morMoney(8000);   /* £80（分） */
			try { V.tiredness = Math.min(Number(V.tirednessmax) || 100, (Number(V.tiredness) || 0) + 15); } catch (e) { }
			fs.log('在大厦做了一晚巡检（+£80）');
			return 'ok';
		} catch (e) { return 'error'; }
	};

	/* ---------- 与苏梦棠聊天（好感） ---------- */
	fs.morChatToday = function () { try { return Number(fs.mor().chatDay) === fs.morDay(); } catch (e) { return false; } };
	fs.morChat = function () {
		try {
			var d = fs.mor();
			if (Number(d.chatDay) === fs.morDay()) return 'done';
			d.chatDay = fs.morDay();
			fs.morAff('smt', 8);
			return 'ok';
		} catch (e) { return 'error'; }
	};

	/* ---------- 学校（旁听，和笙不瑜一个班） ----------
	   设计上「完整课程循环」：一天一节，三种上法（认真听 / 走神 / 看笙不瑜），
	   会影响成绩（0~100）与笙不瑜好感；和笙不瑜每天还能单独聊一次。 */
	fs.morSchool = function () {
		try {
			var d = fs.mor();
			if (!d.school || typeof d.school !== 'object') d.school = { grade: 0, dayDone: 0, sbyChatDay: 0 };
			if (typeof d.school.grade !== 'number') d.school.grade = 0;
			return d.school;
		} catch (e) { return { grade: 0, dayDone: 0, sbyChatDay: 0 }; }
	};
	fs.morGrade = function () { try { return Number(fs.morSchool().grade) || 0; } catch (e) { return 0; } };
	fs.morClassDone = function () { try { return Number(fs.morSchool().dayDone) === fs.morDay(); } catch (e) { return false; } };
	/* focus: 'listen' 认真听（成绩 +12）/ 'doze' 走神（+2）/ 'sby' 偷偷看笙不瑜（+4 且她好感 +6） */
	fs.morAttend = function (focus) {
		try {
			var s = fs.morSchool();
			if (Number(s.dayDone) === fs.morDay()) return 'done';
			s.dayDone = fs.morDay();
			var g = 6, aff = 0;
			if (focus === 'listen') g = 12;
			else if (focus === 'doze') g = 2;
			else if (focus === 'sby') { g = 4; aff = 6; }
			s.grade = Math.min(100, (Number(s.grade) || 0) + g);
			if (aff) fs.morAff('sby', aff);
			fs.log('莫伦斯·上课（' + focus + '）：成绩 +' + g + ' → ' + s.grade);
			return { grade: s.grade, gain: g, aff: aff };
		} catch (e) { return 'error'; }
	};
	fs.morSbyChatDay = function () { try { return Number(fs.morSchool().sbyChatDay) === fs.morDay(); } catch (e) { return false; } };
	fs.morChatSby = function () {
		try {
			var s = fs.morSchool();
			if (Number(s.sbyChatDay) === fs.morDay()) return 'done';
			s.sbyChatDay = fs.morDay();
			fs.morAff('sby', 10);
			return 'ok';
		} catch (e) { return 'error'; }
	};

	/* ---------- 第 5 天后的异常 ---------- */
	fs.morAnomalyStarted = function () { try { return !!fs.mor().anomaly; } catch (e) { return false; } };
	fs.morStartAnomaly = function () {
		try {
			var d = fs.mor();
			if (d.anomaly) return false;
			d.anomaly = 1;
			d.stage = 'anomaly';
			fs.log('莫伦斯：第 ' + fs.morDay() + ' 天，世界开始异常（红月 / 乌鸦 / 迷失生物）');
			return true;
		} catch (e) { return false; }
	};

	/* ---------- 时间遥变：四个方向都显示「？」，要走对 4 次才能回住宅区 ----------
	   正确顺序：下 → 下 → 下 → 左（住宅区在中间的**下面三步**，再进楼）。
	   单人只能自己试；双人每错两次玖肆会给一次正确提示。 */
	fs.morLostSeq = ['down', 'down', 'down', 'left'];
	fs.morDirName = function (d) { return ({ up: '上', down: '下', left: '左', right: '右' })[d] || d; };
	fs.morLost = function () {
		try {
			var d = fs.mor();
			if (!d.lost || typeof d.lost !== 'object') d.lost = { prog: 0, errors: 0, hint: '' };
			if (typeof d.lost.prog !== 'number') d.lost.prog = 0;
			if (typeof d.lost.errors !== 'number') d.lost.errors = 0;
			return d.lost;
		} catch (e) { return { prog: 0, errors: 0, hint: '' }; }
	};
	fs.morLostDone = function () { try { return fs.morLost().prog >= fs.morLostSeq.length; } catch (e) { return false; } };
	fs.morLostStep = function (dir) {
		try {
			var L = fs.morLost();
			var need = fs.morLostSeq[L.prog];
			if (dir === need) {
				L.prog = (Number(L.prog) || 0) + 1;
				L.hint = '';
				return { ok: true, prog: L.prog, done: L.prog >= fs.morLostSeq.length };
			}
			L.errors = (Number(L.errors) || 0) + 1;
			L.hint = (fs.morIsCoop() && L.errors % 2 === 0) ? need : '';
			return { ok: false, prog: L.prog, errors: L.errors, hint: L.hint };
		} catch (e) { return { ok: false }; }
	};

	/* ================= 第五轮：纪念币 / 巫毒娃娃 / B·C 结局 / 演出特效 ================= */

	/* ---------- 苏梦棠的纪念币（好感 70% 才给） ---------- */
	fs.morHasCoin = function () { try { return !!fs.mor().coin; } catch (e) { return false; } };
	fs.morGiveCoin = function () {
		try {
			var d = fs.mor();
			if (d.coin) return 'have';
			d.coin = 1;
			fs.log('拿到苏梦棠的纪念币（好感 ' + fs.morAffGet('smt') + '%）');
			return 'ok';
		} catch (e) { return 'error'; }
	};
	/* 聊天时判定：好感 ≥70 且还没给过 → 给币 */
	fs.morTryCoin = function () {
		try {
			if (fs.mor().coin) return 'have';
			if (fs.morAffGet('smt') < 70) return 'no';
			fs.mor().coin = 1;
			return 'ok';
		} catch (e) { return 'error'; }
	};

	/* ---------- 巫毒娃娃（商店买） ---------- */
	fs.morHasDoll = function () { try { return !!fs.mor().doll; } catch (e) { return false; } };
	fs.morGiveDoll = function () {
		try {
			var d = fs.mor();
			if (d.doll) return 'have';
			d.doll = 1;
			fs.log('买到那个长相怪异的巫毒娃娃');
			return 'ok';
		} catch (e) { return 'error'; }
	};

	/* ---------- B / C 结局 ---------- */
	fs.morEndB = function () {
		try {
			var d = fs.mor();
			fs.morEnd('b');
			d.stage = 'done';
			fs.log('结局 B · 爱');
			return true;
		} catch (e) { return false; }
	};
	fs.morEndC = function () {
		try {
			var d = fs.mor();
			fs.morEnd('c');
			d.stage = 'done';
			fs.log('结局 C · 崩坏（玖肆死亡）');
			return true;
		} catch (e) { return false; }
	};

	/* ---------- 演出：满屏 +疼痛 / 屏幕抖动 / 白字斜插入 ---------- */
	fs.morPainStorm = function (n) {
		try {
			var old = document.getElementById('fs-mor-storm');
			if (old) old.remove();
			var box = document.createElement('div');
			box.id = 'fs-mor-storm';
			box.className = 'fs-mor-storm';
			document.body.appendChild(box);
			document.body.classList.add('fs-mor-shake');
			var count = Number(n) || 26;
			for (var i = 0; i < count; i++) {
				var s = document.createElement('span');
				s.className = 'fs-mor-pain';
				s.textContent = '+疼痛';
				s.style.left = (Math.random() * 90) + '%';
				s.style.top = (Math.random() * 90) + '%';
				s.style.fontSize = (0.7 + Math.random() * 2.2).toFixed(2) + 'em';
				s.style.opacity = (0.35 + Math.random() * 0.65).toFixed(2);
				s.style.transform = 'rotate(' + ((Math.random() * 30) - 15).toFixed(1) + 'deg)';
				box.appendChild(s);
			}
			return count;
		} catch (e) { return 0; }
	};
	fs.morStormClear = function () {
		try {
			var b = document.getElementById('fs-mor-storm'); if (b) b.remove();
			var s = document.getElementById('fs-mor-slip'); if (s) s.remove();
			document.body.classList.remove('fs-mor-shake');
			return true;
		} catch (e) { return false; }
	};
	/* 单人版：白色的字斜着插进画面 */
	fs.morWhiteSlip = function (txt) {
		try {
			var old = document.getElementById('fs-mor-slip');
			if (old) old.remove();
			var d = document.createElement('div');
			d.id = 'fs-mor-slip';
			d.className = 'fs-mor-slip';
			d.textContent = txt || '玖肆：请坚持住——别答应她';
			document.body.appendChild(d);
			return true;
		} catch (e) { return false; }
	};

	/* ---------- 商店里那个「长相怪异的巫毒娃娃」 ---------- */
	fs.morBuyDoll = function () {
		try {
			var price = 2000;   /* £20 */
			if ((Number(V.money) || 0) < price) return 'poor';
			if (fs.mor().doll) return 'have';
			fs.morMoney(-price);
			fs.morGiveDoll();
			return 'ok';
		} catch (e) { return 'error'; }
	};

	/* ---------- 控制台作弊（第 12 个分区「莫伦斯」用） ----------
	   全部走一个入口，执行完把当前分区重渲染一次，这样按钮不用做页面跳转。 */
	fs.morMsg = '';
	fs.morCheat = function (act) {
		var msg = '';
		try {
			var d = fs.mor();
			if (act === 'unlock') { fs.morUnlockAll(); msg = '已提前解锁全部结局预览'; }
			else if (act === 'revive') { fs.morReviveJiusi(); msg = '玖肆已回归（好感回到 50）'; }
			else if (act === 'coin') { msg = (fs.morGiveCoin() === 'have') ? '她已经给过纪念币了' : '已发放纪念币'; }
			else if (act === 'doll') { msg = (fs.morGiveDoll() === 'have') ? '背包里已经有那个娃娃了' : '已发放巫毒娃娃'; }
			else if (act === 'aff_smt') { msg = '苏梦棠好感 → ' + fs.morAff('smt', 20) + '%'; }
			else if (act === 'aff_sby') { msg = '笙不瑜好感 → ' + fs.morAff('sby', 20) + '%'; }
			else if (act === 'skip5') {
				d.day = 5;
				/* ⚠️ 原来自作聪明直接调 morStartAnomaly()，把「已演过」的标记置上了，
				   于是玩家进城市时 `not morAnomalyStarted()` 为假 —— 异变场景永远不会播。
				   现在只把日子推过去，让城市页自己触发那一段。 */
				d.anomaly = 0;
				d.stage = 'city';
				msg = '已跳到第 5 天（进城市后触发异变）';
			}
			else if (act === 'click') {
				/* 一键把「实验室第三天」那条线走完：直接给出选择状态 */
				d.labDay = fs.morToday();
				d.met = 1;
				d.mode = 'coop';
				d.choiceDay = fs.morToday();
				d.charm = 1;
				msg = '已直接标记为「双人路线」（十天倒计时从今天开始）';
			}
			else if (act === 'night') { d.clock = 20 * 60; msg = '城市时间已跳到 20:00（夜行事件与提示生效）'; }
			else if (act === 'morning') { d.clock = 7 * 60; msg = '城市时间已跳到 07:00'; }
			else if (act === 'reset') {
				V.fsData.mor = fs.morDefaults();
				try { if (window.fsEnsureExtraNpcs) window.fsEnsureExtraNpcs(); } catch (e3) { }
				try { setTimeout(function () { if (window.fsEnsureExtraNpcs) window.fsEnsureExtraNpcs(); }, 120); } catch (e4) { }
				msg = '长线剧情状态已重置';
			}
			else msg = '未知操作';
		} catch (e) { msg = '出错: ' + e.message; }
		fs.morMsg = msg;
		/* 重渲染当前分区 */
		try {
			var t = document.querySelector('button.fs-tab[data-fs-sec="11"]');
			if (t && fs.consoleTabPick) fs.consoleTabPick(t);
		} catch (e2) { }
		return msg;
	};

	/* ================= 新城：田字地图 / 马路事件 / 新设施 =================
	   用户  规格：把「莫伦斯」做成第二个原版小镇——
	     · 三步一景的「田」字结构：3×3 九格，中间那一格是莫伦大厦（地图正中一个圆点），
	     · 选项在上、地图在下，地图本身可以点着走，
	     · 部分路段是马路：站上去（点它）**必定**触发一个街头事件。
	   这一块只管数据与结算；地图的渲染在 twee 的 fs_city_map 部件里。 */
	fs.cityPlaces = {
		tower:      { label: '莫伦科技大厦', district: '钟楼广场', passage: 'FS Morans Tower',    icon: 'morans-tower.png' },
		street:     { label: '商业步行街',   district: '市场街',   passage: 'FS Morans Street',   icon: 'morans-street.png' },
		park:       { label: '公园',         district: '橡树街',   passage: 'FS Morans Park',     icon: 'morans-park.png' },
		estate:     { label: '高档小区',     district: '松林坡',   passage: 'FS Morans Estate',   icon: 'morans-estate.png' },
		government: { label: '政府大厦',     district: '王冠街',   passage: 'FS Morans Government', icon: 'morans-government.png' },
		school:     { label: '学校',         district: '圣安妮街',   passage: 'FS Morans School',   icon: 'morans-school.png' },
		store:      { label: '便利商店',     district: '灰桥街',     passage: 'FS Morans Store',    icon: 'morans-store.png' },
		home:       { label: '住宅区',       district: '织工巷',   passage: 'FS Morans Home Base', icon: 'morans-home.png' },
		clinic:     { label: '诊所',         district: '圣玛丽街',   passage: 'FS Morans Clinic',   icon: 'morans-clinic.png' },
		road:       { label: '马路',         district: '马路',     passage: 'FS Morans Road',     icon: 'morans-road.png' }
	};
	/* ================= 街区（大地点）→ 建筑（中地点）→ 房间（小地点） =================
	   设计说明：每个地图点都要有「大中小」三层，照着原版「牛津街 → 博物馆 → 展厅」那种走法。
	   大地点＝地图上的九格街区；中地点＝街区里的建筑；小地点＝建筑里的房间。 */
	fs.morDistricts = {
		park: {
			name: '橡树街', desc: '橡树街只有公园和几栋矮楼。树比人多，晚上路灯亮得很晚。',
			places: [{ label: '公园', passage: 'FS Morans Park', icon: 'morans-park.png' }]
		},
		school: {
			name: '圣安妮街', desc: '学校占了半条街，剩下的门面都是给学生开的：文具、复印、小吃。',
			places: [{ label: '学校', passage: 'FS Morans School', icon: 'morans-school.png' }]
		},
		estate: {
			name: '松林坡', desc: '坡上的路修得比别处平，树也修得比别处齐。铁栅栏里面是另一座城。',
			places: [{ label: '高档小区', passage: 'FS Morans Estate', icon: 'morans-estate.png' }]
		},
		street: {
			name: '市场街', desc: '一条街从早响到晚，招牌换得比天气快。',
			places: [
				{ label: '商业步行街', passage: 'FS Morans Street', icon: 'morans-street.png' },
				{ label: '街尾旅店', passage: 'FS Morans Inn', icon: 'morans-home.png' }
			]
		},
		tower: {
			name: '钟楼广场', desc: '城市正中。四面都是路，中间那栋楼比周围高出一截。',
			places: [{ label: '莫伦大厦', passage: 'FS Morans Tower', icon: 'morans-tower.png' }]
		},
		government: {
			name: '王冠街', desc: '台阶擦得很干净，门口没有排队的人，也没有人进出。',
			places: [{ label: '政府大厦', passage: 'FS Morans Government', icon: 'morans-government.png' }]
		},
		store: {
			name: '灰桥街', desc: '住宅和店铺混在一起，晚上只有便利店亮着。',
			places: [{ label: '便利商店', passage: 'FS Morans Store', icon: 'morans-store.png' }]
		},
		home: {
			name: '织工巷', desc: '楼挨着楼，晾衣杆横在两户之间。楼道里的灯坏了两盏。',
			places: [{ label: '苏梦棠家', passage: 'FS Morans Home Base', icon: 'morans-home.png' }]
		},
		clinic: {
			name: '圣玛丽街', desc: '诊所、药房、一家关着门的牙科。走廊里总有消毒水的味道。',
			places: [{ label: '诊所', passage: 'FS Morans Clinic', icon: 'morans-clinic.png' }]
		}
	};
	/* ================= 服装店：真卖原版衣服 =================
	   用户：原来的服装店只是扣钱摆设。现在读 setup.clothes 的真实条目，
	   买下后直接进 $wardrobe[slot]，和原版衣柜同一套数据。 */
	fs.morShopSlots = [
		{ key: 'upper', label: '上装' },
		{ key: 'lower', label: '下装' },
		{ key: 'feet', label: '鞋子' },
		{ key: 'under_upper', label: '内衣（上）' },
		{ key: 'under_lower', label: '内衣（下）' },
		{ key: 'head', label: '帽子' },
		{ key: 'face', label: '面部' },
		{ key: 'neck', label: '颈部' },
		{ key: 'hand', label: '手部' },
		{ key: 'legs', label: '袜子' },
		{ key: 'handheld', label: '手持' }
	];
	/* 服装中文名：原版汉化包不会翻我们自建商店里的英文名，这里带一份对照表。
	   先查整名，再按词拆译；查不到的词保留英文，至少不会串味。 */
	fs.morClothCn = function (name) {
		try {
			var raw = String(name || '').toLowerCase().trim();
			if (!raw) return '';
			var FULL = {
				'sundress': '吊带连衣裙', 'pyjama shirt': '睡衣上衣', 'pyjama bottoms': '睡裤',
				't-shirt': 'T恤衫', 'school shirt': '校服衬衫', 'school skirt': '校服裙', 'school shorts': '校服短裤',
				'school trousers': '校服长裤', 'plant top': '植物上衣', 'plant skirt': '植物裙',
				'evening gown': '晚礼服', 'ballgown': '舞会礼服', 'kimono': '和服', 'mini kimono': '迷你和服',
				'maid dress': '女仆装', 'maid skirt': '女仆裙', 'nun\'s habit': '修女服', 'monk\'s habit': '修士服',
				'tuxedo jacket': '燕尾服上衣', 'tuxedo trousers': '燕尾服长裤', 'tuxedo shoes': '燕尾服皮鞋',
				'blouse': '罩衫', 'crop top': '短上衣', 'tube top': '抹胸', 'turtleneck': '高领衫',
				'sweater': '毛衣', 'oversized sweater': '宽松毛衣', 'witch dress': '魔女裙', 'witch skirt': '魔女裙摆',
				'vampire jacket': '吸血鬼外套', 'christmas shirt': '圣诞衬衫', 'christmas dress': '圣诞裙',
				'christmas trousers': '圣诞长裤', 'christmas skirt': '圣诞裙摆', 'checkered shirt': '格子衬衫',
				'argyle sweater vest': '菱格毛衣背心', 'dress shirt': '衬衫', 'patterned dress': '花样连衣裙',
				'patterned skirt': '花样裙', 'overalls': '背带裤', 'overall bottoms': '背带裤下装',
				'punk leather jacket': '朋克皮夹克', 'leather jacket': '皮夹克', 'beatnik shirt': '文艺衬衫',
				'cable knit turtleneck': '麻花高领毛衣', 'v neck': 'V领衫', 'turtleneck jumper': '高领毛衣',
				'cheongsam': '旗袍', 'short cheongsam': '短旗袍', 'cheongsam skirt': '旗袍裙', 'short cheongsam skirt': '短旗袍裙',
				'tie-front top': '系带上衣', 'peacoat': '海军呢大衣', 'gothic gown': '哥特长裙', 'gothic jacket': '哥特外套',
				'gothic skirt': '哥特长裙', 'gothic trousers': '哥特长裤', 'waiter\'s shirt': '侍应衬衫',
				'waiter\'s trousers': '侍应长裤', 'lederhosen': '皮短裤', 'lederhosen bottoms': '皮短裤下装',
				'karate jacket': '空手道服上衣', 'karate trousers': '空手道裤', 'sailor shirt': '水手服上衣',
				'short sailor shirt': '短水手服', 'sailor trousers': '水手裤', 'sailor skirt': '水手裙',
				'classic serafuku': '经典水手服', 'jeans': '牛仔裤', 'trousers': '长裤', 'long skirt': '长裙',
				'miniskirt': '迷你裙', 'long school skirt': '长校服裙', 'short school skirt': '短校服裙',
				'denim shorts': '牛仔短裤', 'cycle shorts': '骑行短裤', 'board shorts': '沙滩裤', 'breeches': '马裤',
				'long cut skirt': '长开衩裙', 'short cut skirt': '短开衩裙', 'waist apron': '围裙',
				'khakis': '卡其裤', 'chinos': '休闲裤', 'cowboy chaps': '牛仔护腿',
				'towel top': '浴巾上衣', 'towel skirt': '浴巾裙', 'large towel': '大浴巾',
				'straightjacket': '束身衣', 'straightjacket bottom': '束身衣下装',
				'school shoes': '校鞋', 'ankle cuffs': '脚踝环', 'sandals': '凉鞋', 'dress sandals': '礼鞋',
				'trainers': '运动鞋', 'witch shoes': '魔女鞋', 'wellies': '雨靴', 'platform heels': '厚底高跟鞋',
				'kitten heels': '小猫跟', 'wedge sandals': '坡跟凉鞋', 'court heels': '高跟鞋', 'heeled boots': '高跟靴',
				'stripper heels': '艳舞高跟鞋', 'horsebit loafers': '马衔扣乐福鞋', 'cordovan loafers': '马臀皮乐福鞋',
				'animal slippers': '动物拖鞋', 'combat boots': '作战靴', 'field boots': '长靴', 'paddock boots': '马靴',
				'work boots': '工装靴', 'flippers': '脚蹼', 'ice skates': '冰鞋', 'long boots': '长靴',
				'light-up trainers': '发光运动鞋', 'cowboy boots': '牛仔靴', 'high top trainers': '高帮运动鞋',
				'belly dancer\'s shoes': '舞娘鞋', 'canvas loafers': '帆布鞋', 'fur boots': '毛靴',
				'mary janes': '玛丽珍鞋', 'platform mary janes': '厚底玛丽珍鞋', 'geta': '木屐', 'zori': '草履',
				'ribbon platform heels': '缎带厚底高跟', 'penny loafers': '便士乐福鞋', 'wingtips': '翼纹皮鞋',
				'laced-up heeled boots': '系带高跟靴', 'belted boots': '带扣长靴', 'basketball sneakers': '篮球鞋',
				'chain boots': '链条靴', 'reindeer slippers': '驯鹿拖鞋', 'ballet shoes': '芭蕾鞋',
				'ballet pumps': '芭蕾平底鞋', 'butterfly heels': '蝴蝶高跟', 'clogs': '木鞋',
				'ankle strap sandals': '脚踝系带凉鞋', 'ankle strap sneakers': '脚踝系带运动鞋',
				'ankle trainers': '短帮运动鞋', 'christmas boots': '圣诞靴', 'gift wrap footwrap': '礼物绑带',
				'plain bra': '素色胸罩', 'lace bra': '蕾丝胸罩', 'sports bra': '运动内衣', 'strapless bra': '无肩带胸罩',
				'striped bra': '条纹胸罩', 'bikini top': '比基尼上衣', 'bikini bottoms': '比基尼下装',
				'plain panties': '素色内裤', 'lace panties': '蕾丝内裤', 'briefs': '三角裤', 'boyshorts': '平角裤',
				'striped panties': '条纹内裤', 'classic plain panties': '经典素色内裤',
				'classic lace panties': '经典蕾丝内裤', 'classic briefs': '经典三角裤',
				'swimsuit': '泳装', 'school swimsuit': '校泳装', 'swimsuit bottom': '泳装下装',
				'leotard': '紧身衣', 'leotard bottom': '紧身衣下装', 'unitard': '连体衣', 'unitard bottom': '连体衣下装',
				'full body leotard': '全身紧身衣', 'full body leotard bottom': '全身紧身衣下装',
				'chest wrap': '裹胸', 'chest binder': '束胸', 'undershirt': '内衬', 'vest': '背心'
			};
			if (FULL[raw]) return FULL[raw];
			var TOK = {
				'classic': '经典', 'plain': '素色', 'lace': '蕾丝', 'striped': '条纹', 'long': '长', 'short': '短',
				'mini': '迷你', 'oversized': '宽松', 'large': '大', 'small': '小', 'school': '校', 'foreign': '外国',
				'christmas': '圣诞', 'evening': '晚', 'sports': '运动', 'black': '黑', 'white': '白', 'red': '红',
				'blue': '蓝', 'green': '绿', 'pink': '粉', 'purple': '紫', 'gold': '金', 'silver': '银', 'dark': '深',
				'light': '浅', 'old': '旧', 'new': '新', 'summer': '夏日', 'winter': '冬日', 'pyjama': '睡衣',
				'shirt': '衬衫', 't-shirt': 'T恤衫', 'top': '上衣', 'crop': '短', 'tank': '背心', 'sweater': '毛衣',
				'jumper': '毛衣', 'jacket': '外套', 'coat': '大衣', 'trousers': '长裤', 'pants': '长裤',
				'skirt': '裙', 'shorts': '短裤', 'jeans': '牛仔裤', 'dress': '连衣裙', 'gown': '礼服',
				'blouse': '罩衫', 'vest': '背心', 'bra': '胸罩', 'panties': '内裤', 'briefs': '内裤',
				'socks': '袜子', 'stockings': '长袜', 'shoes': '鞋', 'boots': '靴', 'sandals': '凉鞋',
				'heels': '高跟鞋', 'loafers': '乐福鞋', 'slippers': '拖鞋', 'trainers': '运动鞋',
				'sneakers': '运动鞋', 'pumps': '平底鞋', 'flats': '平底鞋', 'swimsuit': '泳装', 'bikini': '比基尼',
				'swim': '泳', 'shirt': '衬衫', 'scarf': '围巾', 'gloves': '手套', 'hat': '帽子', 'cap': '帽',
				'apron': '围裙', 'belt': '腰带', 'tie': '领带', 'vest': '背心', 'overalls': '背带裤', 'dress': '连衣裙'
			};
			var parts = raw.replace(/'s\b/g, '').split(/[\s\-]+/);
			var out = [];
			for (var i = 0; i < parts.length; i++) {
				var w = parts[i];
				if (!w) continue;
				out.push(TOK[w] || w);
			}
			return out.join('');
		} catch (e) { return ''; }
	};

	/* ================= 原版服装店复用 =================
	   设计说明：直接复制原版商店、只卖我们指定的清单。
	   做法：给允许上架的衣服打一个专属店标 `finalstar_city`（原版每件衣服自带 shop 数组，
	   森林小店/情趣店就是靠这个区分货架的），然后用原版的 clothingShopv2 渲染。
	   这样 UI 和原版完全一致（卡片/吊牌/雷达/清空/每页数量），库存却只有我们挑的。 */
	/* 城市店临时解锁全部「特殊服装」：只在店内生效，出去立刻还原，外面商店的锁不变 */
	fs.morDistrictPos = function (key) {
		try {
			var g = fs.morGrid[key] || fs.morGrid.tower;
			return { left: (17.1 + g[0] * 32.9).toFixed(1), top: (17.1 + g[1] * 32.9).toFixed(1) };
		} catch (e) { return { left: '50.0', top: '50.0' }; }
	};

	fs.morShopUnlockAll = function () {
		try {
			if (V.fsData.shopLocksSaved) return true;
			var list = V.specialClothes || [];
			var saved = [];
			for (var i = 0; i < list.length; i++) {
				var it = list[i];
				if (!it) continue;
				saved.push({ name: it.name, unlocked: it.unlocked });
				it.unlocked = 3;                       /* 3 = 已解锁（原版标签） */
			}
			V.fsData.shopLocksSaved = saved;
			return true;
		} catch (e) { return false; }
	};
	fs.morShopRestoreLocks = function () {
		try {
			var saved = V.fsData.shopLocksSaved;
			if (!saved) return false;
			var list = V.specialClothes || [];
			for (var i = 0; i < list.length; i++) {
				for (var j = 0; j < saved.length; j++) {
					if (list[i] && list[i].name === saved[j].name) list[i].unlocked = saved[j].unlocked;
				}
			}
			V.fsData.shopLocksSaved = null;
			return true;
		} catch (e) { return false; }
	};

	fs.morShopVanillaInit = function () {
		try {
			/* ⚠️ 不要用存档标记跳过：setup.clothes 每次启动都会重建，旧标记会让货架空掉 */
			var BLOCK = ['babydoll', 'lingerie', 'slut', 'micro', 'stripper', 'succubus', 'belly dancer',
				'bunny', 'catgirl', 'g-string', 'crotchless', 'thong', 'chastity', 'jockstrap', 'corset',
				'mesh', 'skimpy', 'pasties', 'nipple', 'strap-on', 'harness', 'collar', 'leash', 'gag',
				'blindfold', 'latex', 'chaps', 'towel top', 'towel skirt', 'large towel'];
			var re = new RegExp('(' + BLOCK.join('|') + ')', 'i');
			/* 全部槽位都上架：帽子/袜子/手套/围巾/手持物……不然那些分类是空的 */
			var slots = Object.keys(setup.clothes || {});
			for (var s = 0; s < slots.length; s++) {
				if (!Array.isArray(setup.clothes[slots[s]])) continue;
				var list = (setup.clothes && setup.clothes[slots[s]]) ? setup.clothes[slots[s]] : [];
				for (var i = 0; i < list.length; i++) {
					var it = list[i];
					if (!it || !it.name || it.name === 'naked') continue;
					var nm = String(it.name_cap || it.name);
					if (re.test(nm)) continue;
					if (Number(it.exposed) >= 2) continue;
					/* 不把模组自己的手持物摆上货架（魔书、手枪） */
					if (it.name === '魔法书' || it.name === '制式手枪' || it.variable === '魔法书' || it.variable === '制式手枪') continue;
					if (!Array.isArray(it.shop)) it.shop = [];
					if (it.shop.indexOf('finalstar_city') === -1) it.shop.push('finalstar_city');
				}
			}
			fs.log('莫伦斯服装店：已按专属店标 finalstar_city 上架');
			return true;
		} catch (e) { return false; }
	};

	fs.morShopStock = function (slot, page) {
		try {
			var list = (window.setup && setup.clothes && setup.clothes[slot]) ? setup.clothes[slot] : [];
			var out = [];
			/* 设计说明：手动下架和色情有关的服装；隐藏款/条件解锁款这里通通卖。
			   过滤规则：名字命中黑名单，或暴露度 ≥2 的不卖；其余不管有没有标价都上架（没标价按 £10 算）。 */
			var BLOCK = ['babydoll', 'lingerie', 'slut', 'micro', 'stripper', 'succubus', 'belly dancer',
				'bunny', 'catgirl', 'g-string', 'crotchless', 'thong', 'chastity', 'jockstrap', 'corset',
				'mesh', 'skimpy', 'pasties', 'nipple', 'strap-on', 'harness', 'collar', 'leash', 'gag',
				'blindfold', 'latex', 'chaps', 'towel top', 'towel skirt', 'large towel'];
			if (!fs.morShopBlockRe) fs.morShopBlockRe = new RegExp('(' + BLOCK.join('|') + ')', 'i');
			for (var i = 0; i < list.length; i++) {
				var it = list[i];
				if (!it || !it.name || it.name === 'naked' || it.name === 'naked bottom') continue;
				var nm = String(it.name_cap || it.name);
				if (fs.morShopBlockRe.test(nm)) continue;
				if (Number(it.exposed) >= 2) continue;
				var cost = Number(it.cost) || 0;
				if (cost <= 0) cost = 1000;                 /* 隐藏/免费款：给个价照样卖 */
				var owned = 0;
				try {
					var wl = (V.wardrobe && V.wardrobe[slot]) ? V.wardrobe[slot] : [];
					for (var wi = 0; wi < wl.length; wi++) {
						var w = wl[wi];
						if (w && ((w.variable && w.variable === it.variable) || (!w.variable && w.name === it.name))) owned++;
					}
				} catch (e) { }
				var cn = it.cn_name_cap || it.cn_name || fs.morClothCn(it.name) || nm;
				out.push({ idx: i, name: cn, cost: cost, raw: it.name, owned: owned });
			}
			var per = Number(V.fs_morShopPer) || 12, from = (Number(page) || 0) * per;
			return { list: out.slice(from, from + per), total: out.length, from: from, per: per };
		} catch (e) { return { list: [], total: 0, from: 0, per: 8 }; }
	};
	fs.morShopSearchClear = function () {
		try {
			var inp = document.querySelector('.fs-shop-search');
			if (inp) { inp.value = ''; fs.morShopSearch(inp); }
		} catch (e) { }
	};

	fs.morShopCat = function (slot) {
		try {
			V.fs_morShopSlot = (slot === 'under_upper' || slot === 'under_lower') ? slot : slot;
			V.fs_morShopPage = 0;
			if (fs.goPassage) fs.goPassage('FS Morans Street Clothes', true);
		} catch (e) { }
	};
	fs.morShopPer = function () {
		try { return Number(V.fs_morShopPer) || 12; } catch (e) { return 12; }
	};

	fs.morShopPerSet = function (n) {
		try {
			V.fs_morShopPer = Number(n) || 12;
			V.fs_morShopPage = 0;
			if (fs.goPassage) fs.goPassage('FS Morans Street Clothes', true);
		} catch (e) { }
	};
	fs.morShopCatIcon = function (key) {
		var map = {
			upper: 'upper', lower: 'lower', feet: 'feet', head: 'head', face: 'face', neck: 'neck',
			hand: 'hand', legs: 'legs', handheld: 'handheld',
			under_upper: 'under-upper', under_lower: 'under-lower'
		};
		return map[key] || 'all';
	};

	fs.morShopSearch = function (input) {
		try {
			var q = String(input && input.value || '').toLowerCase().trim();
			var rows = document.querySelectorAll('.clothing-item[data-name]');
			for (var i = 0; i < rows.length; i++) {
				var n = String(rows[i].getAttribute('data-name') || '').toLowerCase();
				rows[i].style.display = (!q || n.indexOf(q) !== -1) ? '' : 'none';
			}
		} catch (e) { }
	};

	fs.morShopBuy = function (slot, idx) {
		try {
			var it = (window.setup && setup.clothes && setup.clothes[slot]) ? setup.clothes[slot][idx] : null;
			if (!it) return 'none';
			var cost = Number(it.cost) || 0;
			if (cost <= 0) return 'none';
			if ((Number(V.money) || 0) < cost) return 'poor';
			fs.morMoney(-cost);
			V.wardrobe = V.wardrobe || {};
			if (!Array.isArray(V.wardrobe[slot])) V.wardrobe[slot] = [];
			V.wardrobe[slot].push(window.clone ? window.clone(it) : it);
			fs.log('莫伦斯服装店：买了 ' + (it.name_cap || it.name) + '（' + slot + '）');
			return 'ok';
		} catch (e) { return 'error'; }
	};

	/* ================= 只能走到相邻街区 =================
	   用户：地图上右上角一下能到左下角不合理。田字九格，只能沿马路走到**共边**的街区，
	   要去远的地方就必须一格一格走，每一格都可能撞上街区事件。 */
	fs.morGrid = {
		park: [0, 0], school: [1, 0], estate: [2, 0],
		street: [0, 1], tower: [1, 1], government: [2, 1],
		store: [0, 2], home: [1, 2], clinic: [2, 2]
	};
	fs.morPath = function (from, to) {
		try {
			if (!to || !fs.morGrid[to]) return [];
			if (!from || !fs.morGrid[from]) from = 'tower';
			if (from === to) return [];
			var a = fs.morGrid[from], b = fs.morGrid[to];
			var keys = Object.keys(fs.morGrid);
			var path = [], cur = [a[0], a[1]];
			var guard = 0;
			while ((cur[0] !== b[0] || cur[1] !== b[1]) && guard++ < 12) {
				if (cur[0] !== b[0]) cur[0] += (b[0] > cur[0] ? 1 : -1);
				else cur[1] += (b[1] > cur[1] ? 1 : -1);
				for (var i = 0; i < keys.length; i++) {
					var g = fs.morGrid[keys[i]];
					if (g[0] === cur[0] && g[1] === cur[1]) { path.push(keys[i]); break; }
				}
			}
			return path;
		} catch (e) { return []; }
	};
	fs.morHere = function () { try { return V.fs_morDistrict || 'tower'; } catch (e) { return 'tower'; } };
	fs.morStepText = function (path) {
		try {
			var names = [];
			for (var i = 0; i < path.length; i++) {
				var d = fs.morDistrict(path[i]);
				names.push(d ? d.name : path[i]);
			}
			return names.join(' → ');
		} catch (e) { return ''; }
	};

	/* 当前该做什么：只给一句话，不打断叙事（用户同意加目标引导） */
	/* 第五天之后：城市本身要变样（用户：剧情推到第五天完全没变化） */
	fs.morAnomalyPool = [
		{ key: 'redmoon', w: 3, run: function () { return '抬头的时候红月还在。它比昨天近了一点，边缘有细小的裂纹。'; } },
		{ key: 'quiet', w: 2, run: function () { return '街上几乎没有人。店铺开着，灯亮着，收银台后面却没有人。'; } },
		{ key: 'wrong', w: 2, run: function () { return '一个路牌上的字正在慢慢变，笔画歪了一下，又停住。你盯着它看了很久，它没有再动。'; } },
		{ key: 'dog', w: 1, run: function () { return '一条狗站在马路中间，不动，也不叫。它看着你走过去，眼睛一直跟着。'; } }
	];
	/* 夜里街头（用户：晚上要小心乞丐这类提示没有） */
	fs.morIsNight = function () { try { return fs.morClock() >= 20 * 60; } catch (e) { return false; } };
	fs.morNightLine = function () {
		try {
			if (!fs.morIsNight()) return '';
			return '天黑了。街上的店一家家拉下卷帘门，路灯只亮一半。这个点在街上走的人，最好别多看别人。'
				+ '<br><span class="red">尤其是乞丐。夜里他们会从巷子里出来。</span>';
		} catch (e) { return ''; }
	};
	fs.morNightPool = [
		{ key: 'beggar_night', w: 4, run: function () {
			fs.morAddStress(8);
			return '巷口蹲着一个人，面前放着纸杯。你走过去的时候他抬起头，声音很平："给点吧。"'
				+ '你没有停，他就一直看着你，看到你拐过街角。';
		} },
		{ key: 'follow_night', w: 3, run: function () {
			var loss = 1000;
			if ((Number(V.money) || 0) >= loss) {
				fs.morMoney(-loss);
				return '身后有脚步声跟了半条街。你猛地回头，只看见一件灰外套拐进巷子。'
					+ '再摸口袋，<span class="red">£' + (loss / 100) + '</span> 没了。';
			}
			return '身后有脚步声跟了半条街。你回头，那件灰外套停了一下，转身走了。';
		} },
		{ key: 'street_dark', w: 3, run: function () {
			return '路灯闪了两下，灭了。你在暗里站着，听见不远的地方有人翻垃圾桶。';
		} }
	];

	fs.morAnomalyOn = function () { try { return fs.morAnomaly() && Number(fs.mor().inCity) === 1; } catch (e) { return false; } };
	fs.morAnomalyTick = function () {
		try {
			var b = document.body;
			if (!b) return;
			if (fs.morAnomalyOn()) b.classList.add('fs-mor-red');
			else b.classList.remove('fs-mor-red');
		} catch (e) { }
	};

	/* 成绩用等级显示（原版学校也是 A/B/C…，不写数字） */
	fs.morGradeText = function () {
		try {
			var g = Number(fs.morGrade()) || 0;
			if (g >= 90) return 'A';
			if (g >= 80) return 'B';
			if (g >= 70) return 'C';
			if (g >= 60) return 'D';
			if (g >= 40) return 'E';
			return 'F';
		} catch (e) { return '-'; }
	};

	fs.morGoal = function () {
		try {
			var d = fs.mor();
			if (d.stage === 'done') return '你已经离开那座城了。';
			if (d.stage === 'anomaly') return '回住宅区。';
			var day = Number(d.day) || 0;
			if (day < 3) return '先熟悉这座城市。跟苏梦棠聊聊，去学校看看。';
			if (day < 5) return '照常过日子。第五天之前不会有别的变化。';
			return '第五天了。回住宅区。';
		} catch (e) { return ''; }
	};
	/* 结局后的余波：回到现实后的第一段 */
	fs.morAftermath = function () {
		try {
			var d = fs.mor();
			if (d.ending === 'b') {
				return '莫伦斯的事像一场很长的梦。你记得两个人的背影，记得一枚硬币的温度，记得一座城在窗外的红月底下慢慢褪色。'
					+ '<br><br>孤儿院的其他人说你睡了整整两天。没有人问你去了哪里。';
			}
			if (d.ending === 'c') {
				return '你回来后，街上那个杂货店的位置空了。卷帘门拉到底，门口堆着纸箱。'
					+ '<br><br>你没有再见过玖肆。这个名字从此没有人再提起。';
			}
			if (d.ending === 'd') {
				return '你回来了，但有些东西没回来。偶尔半夜醒来，你会听见楼下的街上有很轻的脚步声，停在你窗下，又走开。'
					+ '<br><br>再睡过去的时候，你梦见一条很长的、横平竖直的路。';
			}
			return '你回来后，玖肆还是没有任何消息。'
				+ '<br><br>第一天，第二天，第三天。没有人报警，也没有人提起她。'
				+ '<br><br>你把那件外套挂在门后，没有洗。';
		} catch (e) { return ''; }
	};

	fs.morDistrict = function (key) { try { return fs.morDistricts[key] || null; } catch (e) { return null; } };

	fs.cityGo = function (key) {
		try {
			var p = fs.cityPlaces[key];
			if (!p) return false;
			/* 用户：地图右上角不能一步到左下角。田字九格只能走到**共边**的街区，
			   走远了自己先走几步；这里只做判定，不再有「自动走路」段落
			   （实机上那段跳转会被静默吞掉，验证不可靠）。 */
			var here = fs.morHere();
			var a = fs.morGrid[here] || fs.morGrid.tower;
			var b = fs.morGrid[key];
			if (b && (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])) > 1) {
				V.fs_morBlockMsg = '太远了。从' + (fs.morDistrict(here) ? fs.morDistrict(here).name : '这里')
					+ '出发，一次只能走到隔壁的街区。';
				V.fs_morDest = key;
				V.fs_morDestPass = 'FS Morans District';
				try { SugarCube.Engine.play('FS Morans City'); } catch (e) { }
				return false;
			}
			V.fs_morBlockMsg = '';
			V.fs_morDest = key;
			V.fs_morDestPass = 'FS Morans District';
			try { SugarCube.Engine.play('FS Morans Arrive'); return true; }
			catch (e) { fs.warn('城市移动失败: ' + e.message); return false; }
		} catch (e) { fs.warn('城市移动失败: ' + e.message); return false; }
	};

	/* ================= 城市随机事件（大地点 / 小地点两级） =================
	   用户的意见：原版是「牛津街（大地点）→ 博物馆/学校（中地点）→ 前操场（小地点）」，
	   大地点和小地点**都能**触发随机事件；我们的地图点了直接跳过去，什么都不发生。
	   现在：地图点击先走 FS Morans Arrive（大地点事件，按目标街区取池），
	   建筑/房间段落进入时再按各自的小地点池掷一次。事件不挡路，只插在正文与选项之间。 */
	fs.morRandomPools = {
		/* 大地点：按地图上九个街区分别取池 */
		block_park: [
			{ key: 'pigeon', run: function () { return '一群鸽子从脚边炸开，翅膀拍在你小腿上。你被吓了一下，随即笑起来。' + fs.statHint('压力', -1, 'green'); } },
			{ key: 'kite', run: function () { return '天上飘着一只断了线的风筝，挂到了树梢上。有人仰着头看了很久，最后走了。'; } },
			{ key: 'kid', run: function () { return '一个小孩追着球跑过来，球滚到你脚边。你踢回去，他抱着球跑开了。' + fs.statHint('压力', -1, 'green'); } }
		],
		block_school: [
			{ key: 'crowd', run: function () { return '校门口正赶上放学的人潮，你被人流推着走了半条街，肩膀挨了好几下。' + fs.statHint('压力', 1, 'red'); } },
			{ key: 'flyer2', run: function () { return '一个女生把传单塞进你怀里："补习班，今晚试听。"你看了一眼地址，就在附近。'; } },
			{ key: 'parent', run: function () { return '一个家长在校门口等孩子，看见你从里面出来，上下打量了一眼，什么也没说。'; } }
		],
		block_street: [
			{ key: 'sale', run: function () { return '一家店把喇叭架在门口，循环放着促销的话。你走过去的时候，店员往你手里塞了一张折扣券。'; } },
			{ key: 'thief', run: function () { var loss = 1500; if ((Number(V.money) || 0) >= loss) { fs.morMoney(-loss); return '人群里有人撞了你一下。等你想起来摸口袋，钱少了。<span class="red">£' + (loss / 100) + '</span>。'; } return '人群里有人撞了你一下，摸了两下口袋，发现你身上没什么可拿的，悻悻地挤走了。'; } },
			{ key: 'interview', run: function () { return '有人举着手机拦下你："能问一句吗——你觉得这座城怎么样？"你张了张嘴，最后只说了句"还行"。'; } }
		],
		block_center: [
			{ key: 'white', run: function () { return '几个穿西装的人站在写字楼底下抽烟，看见你经过，把烟掐了，谁也没说话。'; } },
			{ key: 'guard', run: function () { return '大厅的保安从玻璃门里看了你一眼。你和他对视了一秒，他先移开了视线。'; } },
			{ key: 'sell', run: function () { return '有人凑上来推销一张健身卡，说得很急。你摇头，他立刻转向了下一个路人。'; } }
		],
		block_government: [
			{ key: 'press', run: function () { return '台阶上有个记者模样的人蹲着记东西，笔尖划得很快。你看了一会儿，他抬头，你也把视线移开了。'; } },
			{ key: 'protest', run: function () { return '马路对面站着一小群人，举着纸板，没有人喊。警察在更远的地方站着，手插在口袋里。' + fs.statHint('压力', 1, 'red'); } }
		],
		block_home: [
			{ key: 'cat', run: function () { return '一只瘦猫蹲在楼梯口，看见你就站起来，尾巴绕了一下你的脚踝，又蹲回去了。' + fs.statHint('压力', -1, 'green'); } },
			{ key: 'cloth', run: function () { return '楼上的晾衣杆滑了一下，一件衬衫掉到地上。你捡起来，搭回了一楼的栏杆上。'; } },
			{ key: 'neighbor', run: function () { return '邻居开门倒垃圾，看见你，点了点头。你们在楼道里错身而过，谁也没说话。'; } }
		],
		block_store: [
			{ key: 'deliver', run: function () { return '送货的车堵在便利店门口，两个人在往下搬箱子。你从边上侧身挤过去。'; } },
			{ key: 'queue', run: function () { return '便利店里排着队，收银台前有人在找零钱，找得很久。'; } }
		],
		block_clinic: [
			{ key: 'ambulance', run: function () { return '一辆救护车停在诊所门口，没有开灯。两个人推着担架进去，门在身后关上。' + fs.statHint('创伤', 1, 'red'); } },
			{ key: 'smoker', run: function () { return '诊所门口有人在抽烟，咳嗽得很厉害。他看见你，把烟掐了。'; } }
		],
		block_estate: [
			{ key: 'car', run: function () { return '一辆黑色的车从小区里开出来，玻璃贴得很暗，看不清里面。'; } },
			{ key: 'dog', run: function () { return '铁栅栏后面有条狗，隔着栏杆对你叫了两声，然后不叫了。'; } }
		],
		/* 小地点：建筑里的具体房间 */
		school_yard: [
			{ key: 'ball', run: function () { return '一颗球从篮球架那边飞过来，砸在离你一步的地方，弹到墙根。有人喊了声"抱歉"。'; } },
			{ key: 'fight', run: function () { return '操场角落围了几个人。你走近的时候，他们已经散了，只剩一个人蹲在地上捡书。' + fs.statHint('创伤', 1, 'red'); } }
		],
		school_hall: [
			{ key: 'teacher', run: function () { return '一个老师抱着卷子从你身边过去，走了两步又回头看了你一眼——大概是在想你是哪个班的。'; } },
			{ key: 'poster', run: function () { return '公告栏上贴着一张新的通知，边角还有没干透的胶水。你看了一遍，是下周的考试安排。' + fs.statHint('压力', 1, 'red'); } }
		],
		school_class: [
			{ key: 'call', run: function () { return '老师点名点到一半停下了，看了看名单，又看了看你，最后跳了过去。'; } },
			{ key: 'pen', run: function () { return '同桌把一支笔推过来，指了指点名册。你接过来，在纸上写下自己的名字。'; } },
			{ key: 'bird', run: function () { return '一只鸟落在窗台上，歪着头看了一会儿教室里的动静，又飞走了。' + fs.statHint('压力', -1, 'green'); } }
		],
		school_library: [
			{ key: 'shush', run: function () { return '管理员把一摞书放回架上，声音很轻。你听见书脊擦过木板的响动，忽然觉得很安静。' + fs.statHint('压力', -1, 'green'); } },
			{ key: 'sleeper', run: function () { return '角落里有个人趴在桌上睡着了，书还摊着。管理员走过去，没有叫醒他，只是把灯调暗了一点。'; } }
		],
		school_canteen: [
			{ key: 'tray', run: function () { return '前面的人端着托盘转身，差点撞到你。汤晃出来一点，落在盘沿上。'; } },
			{ key: 'cut', run: function () { return '打饭的窗口排起队，有人从侧面插了进去，后面的人只是叹了口气，没人说话。'; } }
		],
		school_roof: [
			{ key: 'smoker2', run: function () { return '天台另一头有人在抽烟，背对着你。听见门响，他把烟按在栏杆上，没回头。'; } },
			{ key: 'faraway', run: function () { return '你往城市的边缘看，雾比刚才近了一点。说不清是不是错觉。' + fs.statHint('创伤', 1, 'red'); } }
		],
		park: [
			{ key: 'chess', run: function () { return '两个老人在长椅上下棋，其中一个输了一步，把棋子重重放下。另一个笑了。' + fs.statHint('压力', -1, 'green'); } },
			{ key: 'feed', run: function () { return '有人在湖边喂鸟，面包屑落进水里，鸟群一阵一阵地扑下来。'; } }
		],
		home_living: [
			{ key: 'tv', run: function () { return '电视信号闪了两下，画面里重复着一句广告词。笙不瑜伸手拍了一下机器，画面稳了。'; } },
			{ key: 'ask', run: function () { return '笙不瑜把练习册转过来，指着一道题："这个，你会吗？"你看了半天，摇了摇头。她没有笑你。'; } }
		],
		home_kitchen: [
			{ key: 'steam', run: function () { return '锅盖被蒸汽顶得动了一下，苏梦棠伸手把它按住，没回头："马上好。"'; } },
			{ key: 'dish', run: function () { return '水槽里堆着几只碗。你顺手冲了一只，她看见了，说了声"放着吧，我来"。'; } }
		],
		home_bath: [
			{ key: 'mirror', run: function () { return '镜子上有一道旧裂纹，从角落斜着下来。你看着里面的自己，看了很久。'; } }
		],
		store: [
			{ key: 'restock', run: function () { return '店员在货架前补货，纸箱堆在过道上。你绕过时他侧了侧身，说了句"不好意思"。'; } }
		],
		clinic: [
			{ key: 'child', run: function () { return '候诊的椅子上坐着一个小孩，腿上包着纱布，一直盯着门口。' + fs.statHint('创伤', 1, 'red'); } }
		],
		tower: [
			{ key: 'elevator', run: function () { return '电梯停在十四层很久没有下来。你按了两下，指示灯才慢悠悠地往下降。'; } }
		]
	};
	/* ---------- 第二轮事件：主 = 偷钱 / 骂人 / 挡路 / 嫌乞丐；辅 = 很轻的色情 ----------
	   用户定的基调：这座城的人对色情基本没兴趣，被主角影响过的人也不敢当街乱来，
	   摸一下就算顶格；不是道德高，而是互相提防、冷血、克制，尤其看不起乞丐。
	   权重：w 越大越常见（主事件 3~4，软色情 1，路人冷眼 2）。 */
	(function () {
		function E(key, w, fn) { return { key: key, w: w, run: fn }; }
		var add = {
			/* ===== 商业街 ===== */
			block_street: [
				E('pick1', 4, function () {
					var loss = 800 + Math.floor(Math.random() * 2200);
					if ((Number(V.money) || 0) < loss) return '人群里有人贴着你挤过去。你摸口袋，里面本来就是空的。';
					fs.morMoney(-loss);
					return '人群里有人贴着你挤过去，动作很轻。等你摸口袋，钱少了。<span class="red">£' + (loss / 100) + '</span>。';
				}),
				E('curse1', 4, function () {
					fs.morAddStress(8);
					return '你被人从后面撞了一下，还没站稳，对方先骂起来："走路不长眼？"他骂完就走了，根本没给你回话的工夫。';
				}),
				E('block1', 3, function () {
					return '三个年轻人横着走，把整条人行道占满。你往边上让，他们也跟着往边上挪，最后你停住，他们才笑着走过去。';
				}),
				E('beggar1', 3, function () {
					fs.morAddTrauma(4);
					return '店门口的台阶上蹲着一个乞丐。店员拎着扫帚出来，把地上的纸盒踢开："走走走，别在这儿。"扫帚挥的时候，店员看了你一眼。';
				}),
				E('watch1', 2, function () { return '一个店员站在门口，一直看着你的手。你什么都没拿，也什么都没说。'; }),
				E('touch1', 1, function () {
					return '人群挤过来的时候，有人把手贴在你腰上停了半秒，随即收回去。你回头，只看到一片后脑勺。';
				}),
			],
			/* ===== 中央广场 ===== */
			block_center: [
				E('guard2', 4, function () { return '保安的目光从你的鞋扫到脸，停了两秒，又移开。他没有走过来，但也没有转回去。'; }),
				E('pick2', 4, function () {
					var loss = 1200;
					if ((Number(V.money) || 0) < loss) return '等电梯的时候有人撞了你一下。你摸了摸口袋，那里本来也没有多少钱。';
					fs.morMoney(-loss);
					return '等电梯的时候有人撞了你一下，说了声"抱歉"。电梯门开的时候你才发觉钱少了。<span class="red">£' + (loss / 100) + '</span>。';
				}),
				E('curse2', 3, function () {
					fs.morAddStress(6);
					return '一个夹着公文包的人从你身边挤过去，回头丢下一句："让一下，谢谢。"那个"谢谢"说得很轻，像是给空气的。';
				}),
				E('beggar2', 2, function () {
					return '一个乞丐坐在花坛边上，帽子里有几枚硬币。路过的人都绕着他走，没有人低头。';
				}),
				E('touch2', 1, function () {
					return '自动门打开的时候，一个女人擦着你过去，肩膀和手臂贴了一下。她没有停，也没有回头。';
				}),
			],
			/* ===== 学院街 ===== */
			block_school: [
				E('block2', 4, function () { return '校门口两个学生并排站着，把通道堵了一半。你从旁边挤过去，他们谁也没动。'; }),
				E('curse3', 3, function () {
					fs.morAddStress(6);
					return '一个男生从你身边过，肩膀故意撞了一下，头也不回地丢下一句："挡道。"';
				}),
				E('pick3', 3, function () {
					var loss = 600;
					if ((Number(V.money) || 0) < loss) return '书包的拉链被拉开了半截。里面除了课本什么都没有，那人也没再拉回去。';
					fs.morMoney(-loss);
					return '书包的拉链被拉开过。你把包转到身前翻了翻，零钱没了。<span class="red">£' + (loss / 100) + '</span>。';
				}),
				E('watch2', 2, function () { return '几个学生靠在栏杆上说话，看见你，声音低了一点。你走过去以后，他们又继续说。'; }),
				E('touch3', 1, function () {
					return '放学的人潮把你往前推，有人从后面扶了一下你的腰，很快就松开了，像只是怕你摔倒。';
				}),
			],
			/* ===== 公园街 ===== */
			block_park: [
				E('curse4', 3, function () { return '遛狗的人把绳子往回一收，丢下一句："别碰它。"其实你离那条狗还有两三步。'; }),
				E('beggar3', 4, function () {
					return '长椅上一个老人伸手到你面前，手掌朝上，一动不动。你站了一会儿，他才慢慢把手收回去，眼睛看向湖面。';
				}),
				E('watch3', 2, function () { return '几个坐在石桌边下棋的人抬起头看了你一眼，又低下去。没有谁说话。'; }),
				E('touch4', 1, function () { return '有人从你身后跑过，手臂擦过你的背。跑出几步，那人回头看了一眼，又继续跑。'; }),
			],
			/* ===== 住宅区 ===== */
			block_home: [
				E('watch4', 4, function () { return '楼道里的门开了一条缝，又轻轻合上了。你没有看见里面的脸。'; }),
				E('curse5', 3, function () {
					fs.morAddStress(5);
					return '有人提着垃圾袋下楼，看见你，把你的存在当成了挡路："借过。"语气很平，像在说一件很旧的事。';
				}),
				E('pick4', 3, function () {
					var loss = 500;
					if ((Number(V.money) || 0) < loss) return '楼梯拐角有人靠得很近地过去，你下意识摸了摸口袋——里面没什么可丢的。';
					fs.morMoney(-loss);
					return '楼梯拐角有人靠得很近地过去。回到门口你才发现，口袋里少了一点钱。<span class="red">£' + (loss / 100) + '</span>。';
				}),
				E('beggar4', 2, function () { return '楼下有人翻垃圾桶，动作很熟练。他看见你，把塑料瓶攥紧了一点。'; }),
			],
			/* ===== 南区（便利店一带） ===== */
			block_store: [
				E('suspect', 4, function () {
					return '店员一直看着你在货架之间走，最后跟过来问了一句："需要帮忙吗。"这句话的意思你听得出来。';
				}),
				E('block3', 3, function () { return '排队的人堵在门口，你侧身想进去，前面的人纹丝不动，像是没看见你。'; }),
				E('beggar5', 3, function () {
					return '门口蹲着一个乞丐，面前放着一个纸杯。进出的人都跨过去，没有人往里面放东西。你弯腰的时候，旁边有人轻轻"啧"了一声。';
				}),
				E('touch5', 1, function () { return '你伸手去够货架最上层，另一只手也伸了过来，指尖碰了一下你的手背。那人拿了东西就走。'; }),
			],
			/* ===== 医疗街 ===== */
			block_clinic: [
				E('curse6', 3, function () {
					return '排队的人从你身边挤过去，丢下一句："看病去别处，别堵这儿。"其实你只是站在门口。';
				}),
				E('beggar6', 3, function () {
					fs.morAddTrauma(5);
					return '诊所门口坐着一个人，手里的单子被风吹得直抖。他问你能不能借点钱挂号。走廊里的人都目不斜视地走过去。';
				}),
				E('watch5', 2, function () { return '护士从窗口探出头，看了你一眼，确认你还在等，又缩回去了。'; }),
			],
			/* ===== 别墅区 ===== */
			block_estate: [
				E('guard3', 4, function () { return '保安从亭子里出来，站在你面前，什么也没说，只是站着，等你走。'; }),
				E('curse7', 3, function () {
					fs.morAddStress(6);
					return '一辆车在你旁边放慢速度，车窗降下一条缝，里面的人说了句什么，听不清，然后车窗升上去，车开走了。';
				}),
				E('watch6', 2, function () { return '铁栅栏里的狗隔着栏杆对你叫了两声，被里面的人喝住了。那人拉着狗，一直看着你走远。'; }),
			],
			/* ===== 行政区 ===== */
			block_government: [
				E('official', 4, function () { return '台阶上有人在打电话，见你上来，侧了侧身，用手遮住了嘴，好像你会听见什么。'; }),
				E('curse8', 3, function () { return '有人在你前面停下拍照，你只好绕开。他拍完才回头看你一眼，什么也没说。'; }),
				E('beggar7', 2, function () { return '广场边上坐着一个裹着毯子的人，旁边立着一块纸板。路过的人连目光都不肯给。'; }),
			],
			/* ===== 小地点：学校 ===== */
			school_yard: [
				E('ball2', 3, function () { return '球滚到脚边，一个学生跑过来捡，捡起来就走，连眼神都没给。'; }),
				E('push1', 3, function () {
					fs.morAddStress(6);
					return '有人从你背后挤过去，肩膀顶了你一下，回头说了句"哦"。就一个字。';
				}),
			],
			school_hall: [
				E('shove1', 3, function () { return '走廊上有人迎面走来，没有让路，你侧身让了。他走过去的时候脚步没慢。'; }),
				E('glance1', 2, function () { return '一个老师看了你一眼，大概在想你是哪班的，最后什么也没问。'; }),
			],
			school_class: [
				E('cold1', 3, function () { return '同桌把书往自己那边挪了挪。你说不上这是不是故意的。'; }),
				E('glance2', 2, function () { return '前排的人回头看了你一眼，又转回去，和别人低声说了句什么。'; }),
			],
			school_library: [
				E('stare1', 3, function () { return '管理员站到你旁边，假装整理书架，眼睛却落在你翻的那本书上。'; }),
			],
			school_canteen: [
				E('cut2', 3, function () { return '打饭的窗口前有人插队，后面的人只是叹气，没人说话。你也一样。'; }),
			],
			school_roof: [
				E('chase', 2, function () { return '天台上另一个人在抽烟。他看见你，把烟按在栏杆上，走了。'; }),
			],
			/* ===== 小地点：公园 / 家 / 店 / 诊所 / 大厦 ===== */
			park: [
				E('chess2', 3, function () { return '两个老人下棋，其中一个抬头看你，又低头继续走棋。棋盘边上放着半个没吃完的面包。'; }),
				E('guard4', 2, function () { return '保安远远地看了你一会儿，最后朝你这边走了两步，又停住了。'; }),
			],
			home_living: [
				E('ask2', 2, function () { return '笙不瑜把练习册往旁边挪了挪，给你让出一点桌面。她没有抬头。'; }),
			],
			home_kitchen: [
				E('pot', 2, function () { return '锅里的水开了，盖子轻轻跳。苏梦棠背对着你说："碗在下面。"'; }),
			],
			home_bath: [
				E('mirror2', 2, function () { return '镜子上那道裂纹从角落斜下来，把镜子里的脸分成两半。'; }),
			],
			store: [
				E('watch7', 3, function () { return '收银台后面的人一直看着你，直到你走出门。'; }),
			],
			clinic: [
				E('cold2', 2, function () { return '候诊的人往旁边挪了挪，不是一个位置，是半个。'; }),
			],
			tower: [
				E('guard5', 3, function () { return '前台的人抬头说："登记。"你写下名字，他把本子转过去看了一眼，又转回来。'; }),
			],
		};
		Object.keys(add).forEach(function (k) {
			fs.morRandomPools[k] = (fs.morRandomPools[k] || []).concat(add[k]);
		});
	})();

	/* 掷一次：chance 缺省 0.4；返回 { text, key } 或 null */
	fs.morRandom = function (pool, chance) {
		try {
			var p = (chance == null) ? 0.4 : Number(chance);
			if (!isFinite(p) || p <= 0) return null;
			if (Math.random() > p) return null;
			var arr = fs.morRandomPools[pool];
			if (!arr || !arr.length) return null;
			/* 第五天之后，每条池子里都混进「城市不对劲」的条目 */
			if (fs.morAnomalyOn && fs.morAnomalyOn() && fs.morAnomalyPool) arr = arr.concat(fs.morAnomalyPool);
			if (fs.morIsNight && fs.morIsNight() && fs.morNightPool) arr = arr.concat(fs.morNightPool);
			/* 带权重抽取：主事件（偷钱/骂人/挡路）权重大，软色情权重 1 */
			var total = 0, i;
			for (i = 0; i < arr.length; i++) total += (Number(arr[i].w) || 2);
			var r = Math.random() * total, pick = arr[0];
			for (i = 0; i < arr.length; i++) {
				r -= (Number(arr[i].w) || 2);
				if (r <= 0) { pick = arr[i]; break; }
			}
			return { text: pick.run(), key: pick.key };
		} catch (e) { return null; }
	};
	/* 地图上点某个街区时，用这个把「大地点」和「目标建筑」对上 */
	fs.morBlockPool = function (key) {
		return 'block_' + key;
	};

	/* ---------- 马路事件：每次站上马路都必定触发一个 ---------- */
	fs.morRoadEvents = [
		{ key: 'mug', run: function () {
			var loss = 1000 + Math.floor(Math.random() * 2000);      /* £10~£30 */
			var has = (Number(V.money) || 0) >= loss;
			if (has) fs.morMoney(-loss);
			fs.morAddStress(has ? 10 : 5);
			return has
				? '一个从巷子里窜出来的人撞了你一下，等你回过神，口袋已经轻了一截。<span class="red">£' + (loss / 100) + '</span> 没了。'
				: '一个从巷子里窜出来的人撞了你一下，摸了两下口袋，发现你身上根本没钱，骂了一句跑了。';
		} },
		{ key: 'flyer', run: function () {
			fs.morAddStress(-5);
			return '有人往你手里塞了一张传单，上面印着一家开在二楼的理发店。你捏着它走了半条街，忽然觉得心里松了一点。';
		} },
		{ key: 'busker', run: function () {
			fs.morAddStress(-3);
			return '路边有人在拉一只旧手风琴，琴盒里散着几枚硬币。你站了一会儿，听完那段不成调的东西。';
		} },
		{ key: 'crash', run: function () {
			fs.morAddTrauma(10);
			return '前面路口围了一圈人。一辆车停在斑马线中间，车头凹了一块，地上有碎玻璃。你没敢多看，绕了过去。';
		} },
		{ key: 'police', run: function () {
			if (fs.morHasId()) {
				return '巡警把你拦下来，看了一眼你的证件，又看了一眼你，把证件还回来："走吧，别在路上站着。"';
			}
			var fined = (Number(V.money) || 0) >= 5000;
			if (fined) fs.morMoney(-5000);
			fs.morAddStress(10);
			return fined
				? '巡警把你拦下来："身份证。"你拿不出来。他开了张罚单——<span class="red">£50</span>。'
				: '巡警把你拦下来："身份证。"你拿不出来。他上下打量你一遍，最后摆了摆手："别让我再看见你在路上晃。"';
		} },
		{ key: 'drunk', run: function () {
			fs.morAddStress(10);
			return '一个醉汉从侧面撞上来，酒气几乎糊在你脸上。他含糊地骂了一句，扶着墙继续走。';
		} },
		{ key: 'parade', run: function () {
			fs.morAddStress(5); fs.morAddTrauma(5);
			return '一队人举着牌子从街那头过来，喊着听不清的口号。人群把你挤到路边，有人踩了你的鞋。';
		} },
		{ key: 'oldlady', run: function () {
			fs.morAddStress(-10);
			return '一位老太太站在路中间，攥着一张纸条，反复看上面的门牌号。你陪她走了两个路口，找到了那扇门。她一直说谢谢。';
		} },
		{ key: 'debris', run: function () {
			try { V.pain = Math.min(200, (Number(V.pain) || 0) + 20); } catch (e) { }
			return '头顶的脚手架响了一声，一截木条擦着你的肩膀落下来，砸在脚边，疼得你眼前发黑。' + fs.statHint('疼痛', 1, 'red');
		} },
		{ key: 'preacher', run: function () {
			return '街角有人站在箱子上讲话，说这座城撑不了多久。路过的人都低着头快走，只有你听完了那句"你们知道的比我说得多"。';
		} }
	];
	fs.morRoadPick = function () {
		try {
			var pool = fs.morRoadEvents;
			var e = pool[Math.floor(Math.random() * pool.length)];
			return { text: e.run(), key: e.key };
		} catch (e) { return { text: '路上什么也没发生。', key: 'none' }; }
	};

	/* ---------- 便利商店 ---------- */
	fs.morStoreGoods = {
		bread:  { label: '面包', price: 300,  hunger: 20 },
		water:  { label: '瓶装水', price: 100, hunger: 3, stress: -3 },
		bandage:{ label: '绷带', price: 500,  pain: -60 },
		sweet:  { label: '水果糖', price: 150, stress: -5, hunger: 4 }
	};
	fs.morStoreBuy = function (key) {
		try {
			var g = fs.morStoreGoods[key];
			if (!g) return 'none';
			if ((Number(V.money) || 0) < g.price) return 'poor';
			fs.morMoney(-g.price);
			if (g.hunger) { try { V.hunger = Math.min(Number(V.hungermax) || 100, (Number(V.hunger) || 0) + g.hunger); } catch (e) { } }
			if (g.stress) fs.morAddStress(g.stress);
			if (g.pain) { try { V.pain = Math.max(0, (Number(V.pain) || 0) + g.pain); } catch (e) { } }
			fs.log('莫伦斯便利店：买了 ' + g.label);
			return 'ok';
		} catch (e) { return 'error'; }
	};

	/* ---------- 诊所 ---------- */
	fs.morClinicTreat = function (kind) {
		try {
			var price = kind === 'infect' ? 8000 : (kind === 'mind' ? 5000 : 3000);   /* £80 / £50 / £30 */
			if ((Number(V.money) || 0) < price) return 'poor';
			if (kind === 'pain') {
				fs.morMoney(-price);
				V.pain = 0;
				return 'ok';
			}
			if (kind === 'infect') {
				fs.morMoney(-price);
				try { V.fsData.infect = Math.max(0, (Number(V.fsData.infect) || 0) - 30); } catch (e) { }
				return 'ok';
			}
			if (kind === 'mind') {
				fs.morMoney(-price);
				fs.morAddStress(-300);
				fs.morAddTrauma(-150);
				return 'ok';
			}
			return 'none';
		} catch (e) { return 'error'; }
	};

	/* ---------- 旅店：住一晚，推进一个剧情日 ---------- */
	/* 学校食堂买饭（£5 → 饥饿 +35，花 20 分钟） */
	fs.morCanteenBuy = function () {
		try {
			var price = 500;
			if ((Number(V.money) || 0) < price) return 'poor';
			fs.morMoney(-price);
			try { V.hunger = Math.min(Number(V.hungermax) || 100, (Number(V.hunger) || 0) + 35); } catch (e) { }
			fs.morPass((window.finalStar && finalStar.talentHas && finalStar.talentHas('d6')) ? 15 : 20);
			fs.log('莫伦斯学校食堂：买了一份饭');
			return 'ok';
		} catch (e) { return 'error'; }
	};

	/* 住宅里的三个动作（睡 / 吃 / 洗澡） */
	fs.morSleepRestore = function () {
		try {
			try { V.tiredness = Math.max(0, (Number(V.tiredness) || 0) - 1000); } catch (e) { }
			fs.morAddStress(-200);
			return true;
		} catch (e) { return false; }
	};
	fs.morHomeEat = function () {
		try {
			var max = Number(V.hungermax) || 100;
			V.hunger = Math.min(max, (Number(V.hunger) || 0) + 40);
			return true;
		} catch (e) { return false; }
	};
	fs.morShower = function () {
		try { fs.morAddTrauma(-40); return true; } catch (e) { return false; }
	};

	fs.morInnSleep = function () {
		try {
			var price = 2500;                                        /* £25 */
			if ((Number(V.money) || 0) < price) return 'poor';
			fs.morMoney(-price);
			try { V.tiredness = Math.max(0, (Number(V.tiredness) || 0) - 800); } catch (e) { }
			fs.morAddStress(-200);
			fs.morNextDay();
			fs.log('莫伦斯旅店：住了一晚，剧情日 +1');
			return 'ok';
		} catch (e) { return 'error'; }
	};

	if (fs.register) fs.register('morans', function () {
		/* 每段渲染后确认红月样式：只在「莫伦斯 + 第五天之后」挂 body.fs-mor-red */
		fs.onInit(function () {
			try { fs.morAnomalyTick(); } catch (e) { }
			try { fs.morEndingMigrate(); } catch (e) { }
			try { fs.morAff('smt', 0); fs.morAff('sby', 0); } catch (e) { }
			try {
				var cur = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || '';
				if (V.fsData && V.fsData.shopLocksSaved && cur !== 'FS Morans Street Clothes') fs.morShopRestoreLocks();
				/* 保险：如果存档里还留着我们的店标（上次报错没来得及还原），进任意段落时改回原版店名，
				   否则原版商店会读错店名 */
				if (V.shopName === 'finalstar_city') V.shopName = 'clothing';
			} catch (e) { }
		});
		fs.onDisplay(function () { setTimeout(function () { try { fs.morAnomalyTick(); } catch (e) { } }, 40); });
	});

	fs.log('莫伦斯长线剧情模块已加载（实验室第三天触发 / 十天倒计时 / 独立剧情日 / 三结局）');
})();
