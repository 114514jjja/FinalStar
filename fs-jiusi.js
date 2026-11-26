/* fs-jiusi.js — 玖肆好感：改成从原版好感派生，并让「失望」可以挽回
 *
 * 为什么重做（问题记录「玖肆好感度会重置」，查证后确认是真 bug）：
 *   · 旧实现是 V.fsData.jiusiLike 这个独立数值，但 framework.js 的默认 fsData 里根本没这个字段，
 *     ensureData() 也不补它 → 它天生是 undefined；读取端一律 `typeof ... === 'number' ? ... : 0` → 永远显示 0。
 *   · 而全仓只有三处写它：控制台 ±、作弊面板 +100、以及每周 −5%。
 *     → 正常游玩永远不会让它变成正数，只会被周惩罚推成负数。
 *   · 旧代码 `cur = (typeof undefined === 'number') ? undefined : 0` → `0 - 5 = -5`，
 *     两周到 -10 → jiusiDisappointed = 1；而没有任何地方能把它清回去 → 玖肆永久隐身。
 *   玩家看到的就是「好感被重置 / 她突然不见了」。
 *
 * 新模型（单一真源 + 可恢复）：
 *   真源  base = 原版 V.NPCName[i].love（0~100，fs-legacy 发子弹本来就是用它的）
 *   惩罚  penalty = 玩家留奴隶的代价（每周 +5，上限 40）
 *   好感  love = clamp(base - penalty, 0, 100)
 *   失望  love <= 10 且至少罚过 2 周
 *   恢复  penalty 每周自然回退 1；love 回到 > 20 时自动解除失望
 *   → 高好感能扛更多周，低好感更快失去她；而且改变行为就能挠回来。
 */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	function num(v, d) { var n = Number(v); return isNaN(n) ? (d || 0) : n; }
	function V_() { return (typeof V !== 'undefined' && V) ? V : null; }
	function fd(v) { v.fsData = v.fsData || {}; return v.fsData; }

	var PENALTY_PER_WEEK = 5;       /* 留奴隶的每周代价 */
	var PENALTY_MAX = 40;
	var DECAY_PER_WEEK = 1;         /* 不再留奴隶时每周恢复 */
	var DISAPPOINT_AT = 10;         /* 好感低到这个数以下才算失望 */
	var RECOVER_ABOVE = 20;         /* 好感回到这个数以上就解除失望 */

	fs.jiusiPenaltyPerWeek = PENALTY_PER_WEEK;
	fs.jiusiDisappointAt = DISAPPOINT_AT;

	/* 原版里玖肆这个具名 NPC 的下标与记录 */
	fs.jiusiIndex = function () {
		try { var v = V_(); if (!v) return -1; return (v.NPCNameList || []).indexOf('玖肆'); }
		catch (e) { return -1; }
	};
	fs.jiusiNpc = function () {
		try {
			var v = V_(); if (!v) return null;
			var i = fs.jiusiIndex();
			if (i === -1 || !v.NPCName || !v.NPCName[i]) return null;
			return v.NPCName[i];
		} catch (e) { return null; }
	};
	/* 真源：原版好感 0~100；还没认识她则返回 null（区别于"0 好感"） */
	fs.jiusiBase = function () {
		var n = fs.jiusiNpc();
		if (!n) return null;
		return Math.max(0, Math.min(100, num(n.love)));
	};
	fs.jiusiPenalty = function () {
		try { var v = V_(); return Math.max(0, num(v && v.fsData && v.fsData.jiusiPenalty)); }
		catch (e) { return 0; }
	};
	/* 对外显示用的「好感」：真源 − 惩罚 */
	fs.jiusiLove = function () {
		var base = fs.jiusiBase();
		if (base === null) return 0;                    /* 不认识她 → 0（但不会因此判失望） */
		return Math.max(0, Math.min(100, base - fs.jiusiPenalty()));
	};
	/* 兼容旧字段：把旧的 jiusiLike（可能是负数/undefined）迁移成惩罚 */
	fs.jiusiMigrate = function () {
		try {
			var v = V_(); if (!v) return false;
			var d = fd(v);
			if (d.jiusiPenalty === undefined) {
				var legacy = num(d.jiusiLike, 0);
				/* 旧值是"越低越差"，新模型是"惩罚越高越差" → 取反 */
				d.jiusiPenalty = legacy < 0 ? Math.min(PENALTY_MAX, -legacy) : 0;
				if (legacy !== 0) fs.log('玖肆好感：旧值 ' + legacy + ' → 迁移为惩罚 ' + d.jiusiPenalty);
			}
			if (d.jiusiLike !== undefined) delete d.jiusiLike;   /* 旧字段不再使用 */
			return true;
		} catch (e) { return false; }
	};

	/* 每周代价（留奴隶）/ 每周恢复（不留） */
	fs.jiusiAddPenalty = function (n) {
		try {
			var v = V_(); if (!v) return 0;
			var d = fd(v);
			d.jiusiPenalty = Math.max(0, Math.min(PENALTY_MAX, num(d.jiusiPenalty) + num(n, PENALTY_PER_WEEK)));
			d.jiusiPenaltyWeeks = num(d.jiusiPenaltyWeeks) + 1;
			fs.log('玖肆：惩罚 ' + d.jiusiPenalty + '（好感 ' + fs.jiusiLove() + '）');
			return d.jiusiPenalty;
		} catch (e) { return 0; }
	};
	fs.jiusiDecayPenalty = function (n) {
		try {
			var v = V_(); if (!v) return 0;
			var d = fd(v);
			var before = num(d.jiusiPenalty);
			d.jiusiPenalty = Math.max(0, before - num(n, DECAY_PER_WEEK));
			if (d.jiusiPenalty !== before) fs.log('玖肆：惩罚回退 ' + before + ' → ' + d.jiusiPenalty);
			return d.jiusiPenalty;
		} catch (e) { return 0; }
	};

	/* 失望状态：每次调用都按当前好感重算，所以能自动恢复。
	   仍然写回 V.fsData.jiusiDisappointed，因为社交栏/女巫小屋等好几处 twee 直接读它。 */
	fs.jiusiRefreshDisappointed = function () {
		try {
			var v = V_(); if (!v) return false;
			var d = fd(v);
			var base = fs.jiusiBase();
			if (base === null) { d.jiusiDisappointed = 0; return false; }   /* 还没认识她，谈不上失望 */
			var love = fs.jiusiLove();
			var weeks = num(d.jiusiPenaltyWeeks);
			var wasDis = num(d.jiusiDisappointed) === 1;
			/* 失望：好感很低 + 至少罚过 2 周（避免刚认识就被判失望） */
			var nowDis = (love <= DISAPPOINT_AT && weeks >= 2);
			if (wasDis && love > RECOVER_ABOVE) nowDis = false;             /* 挽回到 >20 → 解除 */
			d.jiusiDisappointed = nowDis ? 1 : 0;
			if (wasDis && !nowDis) {
				d.jiusiRecovered = 1;                                       /* 给剧情一个"她回来了"的提示位 */
				fs.log('玖肆：失望已解除（好感 ' + love + '）');
			}
			return nowDis;
		} catch (e) { return false; }
	};
	fs.jiusiIsDisappointed = function () { return fs.jiusiRefreshDisappointed(); };

	/* ================= 清理存档异常数据 =================
	   （游玩须知里一直写着"可前往孤儿院大厅点击『清理存档异常数据』"，但这个功能压根不存在。
	     这里真的把它做出来：把 fsData 里缺的补上、坏值修好、旧字段迁移。） */
	fs.cleanSaveData = function () {
		var fixed = [];
		try {
			var v = V_(); if (!v) return { ok: false, msg: '读不到存档' };
			var d = fd(v);

			/* ① 旧字段迁移 */
			fs.jiusiMigrate();
			if (d.jiusiPenalty === undefined) { d.jiusiPenalty = 0; fixed.push('jiusiPenalty'); }

			/* ② 数值字段：NaN / 负数 / 越界 一律修 */
			var NUMFIX = { jiusiPenalty: [0, 40], jiusiPenaltyWeeks: [0, 9999], jiusiLike: null };
			for (var k in NUMFIX) {
				if (!Object.prototype.hasOwnProperty.call(NUMFIX, k)) continue;
				if (d[k] === undefined) continue;
				var r = NUMFIX[k];
				var n = num(d[k], 0);
				if (!isFinite(Number(d[k])) || (r && (n < r[0] || n > r[1]))) {
					d[k] = r ? Math.max(r[0], Math.min(r[1], n)) : n;
					fixed.push(k);
				}
			}

			/* ③ fsData 结构完整性 */
			if (!Array.isArray(d.seals)) { d.seals = []; fixed.push('seals'); }
			if (!d.bullets || typeof d.bullets !== 'object') { d.bullets = {}; fixed.push('bullets'); }
			if (!d.currentBullet) { d.currentBullet = 'normal'; fixed.push('currentBullet'); }
			if (d.sealEquipped === undefined) { d.sealEquipped = 'none'; fixed.push('sealEquipped'); }
			if (!d.cave || typeof d.cave !== 'object') { d.cave = {}; fixed.push('cave'); }
			if (d.consoleItems !== undefined && (typeof d.consoleItems !== 'object' || d.consoleItems === null)) {
				d.consoleItems = {}; fixed.push('consoleItems');
			}

			/* ④ 玖肆三项状态按新模型重算 */
			var before = num(d.jiusiDisappointed);
			fs.jiusiRefreshDisappointed();
			if (before !== num(d.jiusiDisappointed)) fixed.push('jiusiDisappointed');
			if (num(d.jiusiDisappointed) === 1 && num(d.jiusiPenaltyWeeks) < 2) { d.jiusiDisappointed = 0; fixed.push('jiusiDisappointed(误判)'); }

			/* ⑤ 每日计数 / 布尔开关的坏值 */
			if (!v.daily || typeof v.daily !== 'object') { v.daily = {}; fixed.push('daily'); }
			var BOOLS = ['fs_noCorpseDrag', 'fs_freeCasino', 'fs_freeEncounter', 'fs_casinoMaster', 'fs_undying', 'fs_sidebarIcon', 'fs_combatPanel', 'fs_jiusiStoryGuard', 'fs_duelOff'];
			for (var b = 0; b < BOOLS.length; b++) {
				if (v[BOOLS[b]] !== undefined && typeof v[BOOLS[b]] !== 'boolean') { v[BOOLS[b]] = !!v[BOOLS[b]]; fixed.push(BOOLS[b]); }
			}

			fs.log('清理存档异常数据：修了 ' + (fixed.length ? fixed.join(' / ') : '（没有发现异常）'));
			return {
				ok: true, fixed: fixed,
				msg: fixed.length ? ('修好了 ' + fixed.length + ' 处：' + fixed.join('、')) : '没有发现异常数据——这个存档是干净的。',
				love: fs.jiusiLove(), base: fs.jiusiBase(),
			};
		} catch (e) { return { ok: false, msg: '出错：' + e.message, fixed: fixed }; }
	};

	/* 每天/每周维护：惩罚回退 + 失望状态重算（挂在 fs-legacy 的每日钩子上调用） */
	fs.jiusiWeekly = function (hasSlaves) {
		try {
			fs.jiusiMigrate();
			if (hasSlaves) fs.jiusiAddPenalty(PENALTY_PER_WEEK);
			else fs.jiusiDecayPenalty(DECAY_PER_WEEK);
			fs.jiusiRefreshDisappointed();
			return true;
		} catch (e) { return false; }
	};

	/* 启动即自愈：旧存档的 jiusiLike 负数 / 被误判的 jiusiDisappointed 会在第一次进段落时就修好，
	   不需要玩家去点什么。之后每天再按当前好感重算一次失望状态。 */
	if (fs.onInit) {
		fs.onInit(function () {
			try {
				fs.jiusiMigrate();
				fs.jiusiRefreshDisappointed();
			} catch (e) { }
		});
	}

	fs.log('玖肆好感模型：已改为从原版 NPCName.love 派生（惩罚 ' + PENALTY_PER_WEEK + '/周，失望线 ' + DISAPPOINT_AT + '，可恢复）');
})();
