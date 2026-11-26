/* ============================================================
   终星 FinalStar —— 魔女小屋：商店数据（刻印 / 祝福卷轴 / 魔法小道具）
   商店 UI 与剧情在 twee/FinalStarWitch.twee 中实现。
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* ---------- 祝福卷轴：增加类 / 减少类 ---------- */
	/* stat 为存档变量前缀；value 为上限变化量；temp 为临时（30 天） */
	fs.scrolls = {
		painUp: { key: 'painUp', name: '祝福卷轴·痛觉耐受', stat: 'pain', value: 200, up: true, price: 800, icon: 'finalstar/scroll-bless.png', desc: '把疼痛的阈值向上推开一截。你能承受的疼痛翻倍（相当于疼痛上限 +200）。' },
		stressUp: { key: 'stressUp', name: '祝福卷轴·压力耐受', stat: 'stress', value: 200, up: true, price: 800, icon: 'finalstar/scroll-bless.png', desc: '让心里那根弦松一些。压力上限 +200。' },
		arousalDown: { key: 'arousalDown', name: '祝福卷轴·清心', stat: 'arousal', value: 200, up: false, price: 1000, icon: 'finalstar/scroll-curse.png', desc: '把身体的火压下去。性奋上限 -200。' },
		stressDown: { key: 'stressDown', name: '祝福卷轴·宽心', stat: 'stress', value: 200, up: false, price: 1000, icon: 'finalstar/scroll-curse.png', desc: '让压力的上限低一些，也更容易被安抚。压力上限 -200。' },
		traumaDown: { key: 'traumaDown', name: '祝福卷轴·安魂', stat: 'trauma', value: 200, up: false, price: 1000, icon: 'finalstar/scroll-curse.png', desc: '那些记忆会淡一点。创伤上限 -200。' }
	};
	fs.scrollList = Object.keys(fs.scrolls);

	/* 上限的合法下限（防止减上限类卷轴把数值压到荒唐区间）。
	   ⚠️ 原来 useScroll 与到期还原都写死 `Math.max(1000, …)`，而 trauma/arousal 的**初始上限正好是 1000**
	     —— 于是「清心 / 安魂」这两卷**当场什么也没减**（0 效果），
	     到期却按 value 反向加了一次 → 净赚 200 上限。现在按属性给下限，并且到期只抵消「实际变化量」。 */
	fs.maxFloor = function (stat) {
		if (stat === 'stress') return 1000;
		if (stat === 'trauma' || stat === 'arousal') return 400;
		return 100;
	};

	/* ---------- 购买与使用 ---------- */
	fs.buyScroll = function (key, permanent) {
		var s = fs.scrolls[key];
		if (!s) return false;
		fs.ensureData();
		var price = permanent ? s.price * 2 : s.price;
		if (V.money < price * 100) return false;   /* DoL 金钱单位为「分」 */
		V.money -= price * 100;
		if (!Array.isArray(V.fsData.scrolls)) V.fsData.scrolls = [];
		V.fsData.scrolls.push({ key: key, permanent: !!permanent, days: permanent ? -1 : 30 });
		return true;
	};

	/* 使用卷轴：立刻改上限；临时卷轴记入 blessings 由每日事件递减 */
	fs.useScroll = function (index) {
		fs.ensureData();
		if (!Array.isArray(V.fsData.scrolls)) return false;
		var item = V.fsData.scrolls[index];
		if (!item) return false;
		var s = fs.scrolls[item.key];
		if (!s) return false;
		var maxKey = s.stat + 'max';
		if (s.stat === 'pain') {
			/* 疼痛上限的**真正落点**不在存档变量里，而在于「玩家能承受多少原始疼痛」。
			   原版把上限写死在 stat-changes.js 的 painClamp()（`Math.clamp(V.pain, minPain(), 200)`），
			   想用 ReplacePatcher 改那个字面量接上本变量 —— **验证那条补丁不起作用**，
			   所以改成：在疼痛的唯一入口（fs-links.js 的 statChange.pain 包装）按
			   200/(200+bonus) 的比例压缩收入伤害。bonus=200 时要攒到 400 点原始疼痛才触到上限，
			   效果等同于「上限翻倍」，且不依赖任何补丁。
			   同时同步镜像值 painmax，让模组自己的判据（战败 −5 理智）与作弊面板滑块范围一致。 */
			var bonus = (Number(V.fs_painCapBonus) || 0) + (s.up ? s.value : -s.value);
			V.fs_painCapBonus = bonus;
			V.painmax = Math.max(1, 200 + bonus);
			if (typeof V.pain === 'number' && V.pain > V.painmax) V.pain = V.painmax;
		} else if (typeof V[maxKey] === 'number') {
			var before = V[maxKey];
			if (s.up) V[maxKey] += s.value;
			else V[maxKey] = Math.max(fs.maxFloor(s.stat), V[maxKey] - s.value);
			if (typeof V[s.stat] === 'number' && V[s.stat] > V[maxKey]) V[s.stat] = V[maxKey];
			/* 记下**实际**变化量：减上限类卷轴可能被下限挡住（实际为 0），
			   到期时按这个数反向抵消，才不会凭 value 硬算出一个凭空多出来的上限。 */
			item._applied = V[maxKey] - before;
		}
		if (!item.permanent) {
			if (!Array.isArray(V.fsData.blessings)) V.fsData.blessings = [];
			V.fsData.blessings.push({
				stat: s.stat, value: s.value, up: s.up, days: 30, source: item.key,
				applied: (typeof item._applied === 'number') ? item._applied : null
			});
		}
		V.fsData.scrolls.splice(index, 1);
		return true;
	};

	/* 洞穴里捡到的免费卷轴（临时 30 天） */
	fs.buyScrollFree = function (key) {
		var s = fs.scrolls[key];
		if (!s) return false;
		fs.ensureData();
		if (!Array.isArray(V.fsData.scrolls)) V.fsData.scrolls = [];
		V.fsData.scrolls.push({ key: key, permanent: false, days: 30 });
		return true;
	};

	/* ---------- 魔法小道具（手枪与子弹） ---------- */
	fs.gunUnlocked = function () {
		try { return V.fsData && V.fsData.gunUnlocked === true; }
		catch (e) { return false; }
	};
	fs.unlockGun = function () {
		fs.ensureData();
		V.fsData.gunUnlocked = true;
	};

	fs.initWitch = function () {
		fs.ensureData();
		if (!V.fsData.witch) {
			V.fsData.witch = { met: false, asked: [] };
		}
		fs.log('魔女小屋模块已加载（' + fs.scrollList.length + ' 种卷轴）');
	};

	fs.register('witch', function () { fs.initWitch(); });

})();
