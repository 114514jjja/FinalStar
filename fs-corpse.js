/* ============================================================
   终星 FinalStar —— 埋尸扩展（规划书 112 ~ 118）
   112 杀死遭遇战敌人进入埋尸环节；花园满三具后改埋森林；
       两名以上敌人时杀死其中一个无需埋尸（其他人逃跑）
   114 诡术 → 被人发现时欺骗的概率（最高 100%）
   115 运动 → 需要几轮才能埋好（最低 20 次 → 最高 10 次）
   116 护理 → 现场伪装，越高尸体越晚被发现、线索越少
   118 概率用原版概括措辞（不可能 <10% / 易如反掌 >95%）
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	fs.corpseConfig = {
		gardenLimit: 3,          /* 花园埋满三具后改埋森林 */
		dragMinutes: 3,          /* 每轮拖行 3 分钟 */
		discoverChance: 20,      /* 每轮被发现的概率（%） */
		dragStepsMin: 10,        /* 运动满值时最少轮数 */
		dragStepsMax: 20         /* 运动为零时最多轮数 */
	};

	/* ---------- 概率措辞（与原版概括一致） ---------- */
	fs.chanceWord = function (pct) {
		pct = Math.max(0, Math.min(100, Math.round(pct)));
		if (pct <= 9) return { word: '不可能', cls: 'red', pct: pct, alwaysFail: true };
		if (pct <= 19) return { word: '非常困难', cls: 'pink', pct: pct };
		if (pct <= 39) return { word: '困难', cls: 'purple', pct: pct };
		if (pct <= 59) return { word: '有挑战', cls: 'blue', pct: pct };
		if (pct <= 79) return { word: '中等', cls: 'lblue', pct: pct };
		if (pct <= 94) return { word: '简单', cls: 'teal', pct: pct };
		return { word: '易如反掌', cls: 'green', pct: pct, alwaysWin: true };
	};
	/* ⚠️ 理智惩罚必须**真的算进去**：fs.sanityPenalty()（0~30）早就写好了，
	   却**没有任何地方调用** —— 于是低理智时只有渲染出来的难度字样被改差、
	   真实成功率一点没变：玩家读到「几乎不可能 · 95%」，照样稳稳成功。典型误导性 UI。
	   现在把惩罚接进来，并且让**显示与判定共用同一个换算**，
	   保证「你看到的百分比」就是「实际掷骰用的百分比」。 */
	fs.finalPct = function (pct) {
		var base = Number(pct) || 0;
		var pen = (typeof fs.sanityPenalty === 'function') ? (Number(fs.sanityPenalty()) || 0) : 0;
		return Math.max(0, Math.min(100, base - pen));
	};
	fs.chanceText = function (pct) {
		var c = fs.chanceWord(fs.finalPct(pct));
		return '<span class="' + c.cls + '">（' + c.word + ' · ' + c.pct + '%）</span>';
	};
	/* 实际判定：<10% 必定失败；>95% 必定成功 */
	fs.chanceRoll = function (pct) {
		var c = fs.chanceWord(fs.finalPct(pct));
		if (c.alwaysFail) return false;
		if (c.alwaysWin) return true;
		return Math.random() * 100 < c.pct;
	};

	/* ---------- 技能换算 ---------- */
	fs.dragSteps = function () {
		var ath = Math.min(1000, Math.max(0, Number(V.athletics) || 0));
		/* 运动越高，轮数越少：0 → 20 轮，1000 → 10 轮 */
		return Math.max(fs.corpseConfig.dragStepsMin,
			Math.round(fs.corpseConfig.dragStepsMax - (ath / 1000) * (fs.corpseConfig.dragStepsMax - fs.corpseConfig.dragStepsMin)));
	};
	fs.deceitPct = function () {
		var sk = Math.min(1000, Math.max(0, Number(V.skulduggery) || 0));
		return Math.min(100, Math.floor(sk / 10));
	};
	fs.disguisePct = function () {
		/* ⚠️ 原版里没有 `V.nursing` 这个变量（全仓 28 处 "nursing" 全是散文里的
		   "nursing drinks / nursing injuries"）。0.5.12.13 的技能变量叫 **V.tending**。
		   原来读 V.nursing 恒为 undefined → 伪装率恒 0%：埋尸永远显示「不可能 · 0%」、
		   永远走最差评语、discoverDays 恒 2 天、cluePct 恒 100%。
		   两者取有值的那个，兼容旧档。 */
		var raw = Number(V.tending);
		if (!isFinite(raw) || raw <= 0) raw = Number(V.nursing) || 0;
		var nu = Math.min(1000, Math.max(0, raw));
		return Math.min(100, Math.floor(nu / 10));
	};
	/* 伪装越好，尸体越晚被发现（天数） */
	fs.discoverDays = function () {
		return 2 + Math.round(fs.disguisePct() / 100 * 12);
	};
	/* 线索指向玩家的可能（越低越好） */
	fs.cluePct = function () {
		return Math.max(0, 100 - fs.disguisePct());
	};

	/* ---------- 尸体账本 ---------- */
	fs.corpseState = function () {
		fs.ensureData();
		var c = V.fsData.corpses;
		if (!c || typeof c !== 'object') c = V.fsData.corpses = {};
		if (typeof c.garden !== 'number') c.garden = 0;
		if (typeof c.forest !== 'number') c.forest = 0;
		if (!Array.isArray(c.list)) c.list = [];
		return c;
	};
	fs.gardenLush = function () {
		try { return fs.corpseState().garden >= fs.corpseConfig.gardenLimit; }
		catch (e) { return false; }
	};
	fs.burialPlace = function () {
		return fs.gardenLush() ? 'forest' : 'garden';
	};
	fs.recordBury = function (place) {
		var c = fs.corpseState();
		if (place === 'forest') c.forest += 1; else {
			c.garden += 1;
			if (c.garden === fs.corpseConfig.gardenLimit) V.fs_gardenLushNotice = 1;
		}
		c.list.push({ place: place, day: (typeof Time !== 'undefined' && typeof Time.days === 'number') ? Time.days : 0, discover: fs.discoverDays() });
		return c;
	};

	/* ---------- 遭遇战收尾：是否需要埋尸 ---------- */
	/* 规则：
	   - 开关「杀人不埋尸」打开 → 一律跳过
	   - **必须真的杀了人**（见下），否则一律不进埋尸
	   - 敌人总数 ≥2 且仍有活口 → 其他人逃跑，不进入埋尸
	*/
	/* ⚠️ 重要修正（问题记录「每次打完架都让我去埋尸」）：
	   旧判据是 `if (!(V.enemyhealth <= 0)) return {needed:false, reason:'alive'}` ——
	   把「敌人血量 ≤ 0」当成了「你杀死了敌人」。**这是错的**：
	     · 原版 0.5.12.13 **根本没有「NPC 死亡」这个概念**
	       （全仓 `enemydead` / `isDead` / `state to "dead"` 零命中）；
	     · `$enemyhealth ≤ 0` 只代表**这场遭遇战结束**。原版自己就在
	       `effects.twee:4094/4102` 用 `<<set $enemyhealth to -100>> / -1000>>`
	       表示**软模式下说服袭击者「听话走开」** —— 玩家读到的是「他走开了」，
	       却被本模组拖进「你杀了人」的拖尸小游戏。
	     · 这个判定挂在 `<<widget "fs_on_combat_end">>` 里，**每场战斗结束都会跑**，
	       于是打赢、被玖肆救下、数学课脚本战斗……全部会误触发。
	   现在的判据只认**真正的击杀标记**：`V.fsKilled`（由手枪的致命一击置 1）、
	   `V.corpsePending`（同上，历史字段）或 `V.pistolKillName`（击杀子弹命中具名 NPC）。 */
	fs.corpseNeeded = function () {
		try {
			if (fs.opt('noCorpseDrag')) return { needed: false, reason: 'option' };
			var killed = (Number(V.fsKilled) === 1) || (Number(V.corpsePending) === 1) || !!V.pistolKillName;
			if (!killed) return { needed: false, reason: 'notKill' };
			var total = Number(V.enemynomax) || 1;
			var left = Number(V.enemyno);
			if (total >= 2 && left >= 1) return { needed: false, reason: 'flee', total: total, left: left };
			return { needed: true, total: total };
		} catch (e) {
			return { needed: false, reason: 'error' };
		}
	};
	fs.corpseKillName = function () {
		try {
			var n = V.pistolKillName;
			if (n) return n;
			if (V.NPCList && V.NPCList.length) {
				var first = V.NPCList[0];
				if (first && first.fullDescription) return first.fullDescription;
			}
			return '那个人';
		} catch (e) { return '那个人'; }
	};
	/* 开始一次埋尸流程 */
	fs.beginCorpse = function (reason) {
		fs.ensureData();
		var info = fs.corpseNeeded();
		V.fsCorpse = {
			name: fs.corpseKillName(),
			place: fs.burialPlace(),
			steps: fs.dragSteps(),
			total: fs.dragSteps(),
			reason: reason || info.reason || 'kill',
			fled: info.reason === 'flee'
		};
		fs.log('埋尸流程开始：目标 ' + V.fsCorpse.place + ' / 需要 ' + V.fsCorpse.steps + ' 轮');
		return V.fsCorpse;
	};
	fs.corpse = function () {
		try { return V.fsCorpse || null; } catch (e) { return null; }
	};
	fs.corpseStep = function () {
		var c = fs.corpse();
		if (!c) return 0;
		c.steps -= 1;
		if (c.steps < 0) c.steps = 0;
		return c.steps;
	};
	fs.endCorpse = function () {
		V.fsCorpse = null;
		/* 击杀标记必须跟着流程一起清掉，否则会漏到**下一场**战斗再触发一次埋尸 */
		try { V.fsKilled = 0; } catch (e) { }
		try { V.corpsePending = 0; } catch (e) { }
		try { V.fsCorpsePending = 0; } catch (e) { }
		try { if (V.pistolKillName) delete V.pistolKillName; } catch (e) { }
	};

	/* ---------- 掩埋（运动决定轮数） ---------- */
	fs.buryStart = function () {
		var c = fs.corpse();
		if (!c) { fs.beginCorpse(); c = fs.corpse(); }
		if (!c) return 0;
		if (typeof c.buryLeft !== 'number' || c.buryLeft <= 0) {
			c.buryLeft = fs.dragSteps();
			c.buryTotal = c.buryLeft;
		}
		return c.buryLeft;
	};
	/* ---------- 挖掘进度：加固 + 保底 ----------
	   ⚠️ 问题记录「挖掘进度一直显示 0%」。我在干净存档里复现不出来（验证 buryStep 三次 = 5%/10%/15%，
	   实机走段落也是 20% → 25% 正常推进），所以下面对根因不作断言，只把这条链改成不可能卡住：
	   旧代码有三个 NaN/缺失值下的失效判断，任何一个成立都会让进度永久停在 0% 且永远挖不完：
	     · `if (!c || !c.buryTotal) return 0;`  → buryTotal 缺失/NaN 时直接返回 0（`!NaN === true`）
	     · `if (typeof c.buryLeft !== 'number')` → `typeof NaN === 'number'` 为真 → 不会重新初始化
	     · `if (c.buryLeft <= 0)`              → `NaN <= 0` 为假 → 同样不会重新初始化
	   现在统一用 isFinite 判定，并且 buryTotal 缺失时从 steps/total/dragSteps 反推补上。
	   另外按设计上加保底：连挖 4 次还没挖完就强制挖通（BURY_PITY）。 */
	fs.BURY_PITY = 4;
	function numOr(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
	/* 把一份尸体记录补成"可计算进度"的完整状态；返回补齐后的 buryTotal（0 表示补不了） */
	function ensureBury(c) {
		if (!c) return 0;
		var total = numOr(c.buryTotal, 0);
		if (total <= 0) total = numOr(c.steps, 0) || numOr(c.total, 0) || numOr(fs.dragSteps(), 10);
		c.buryTotal = total;
		var left = numOr(c.buryLeft, NaN);
		if (!isFinite(left)) left = total;          /* 还没开始挖 → 剩满程 */
		c.buryLeft = Math.max(0, Math.min(total, left));
		if (!isFinite(numOr(c.buryTries, NaN))) c.buryTries = 0;
		return total;
	}
	fs.buryTotal = function () {
		var c = fs.corpse();
		if (!c) return 0;
		return ensureBury(c);
	};
	fs.buryProgress = function () {
		var c = fs.corpse();
		if (!c) return 0;
		var total = ensureBury(c);
		if (total <= 0) return 0;
		return Math.max(0, Math.min(1, (total - c.buryLeft) / total));
	};
	fs.buryStep = function () {
		var c = fs.corpse();
		if (!c) return 0;
		var total = ensureBury(c);
		if (total <= 0) return 0;
		c.buryLeft -= 1;
		if (c.buryLeft < 0) c.buryLeft = 0;
		c.buryTries = numOr(c.buryTries, 0) + 1;
		/* 保底：连挖 4 次还没通 → 直接挖到底（设计上「每四次挖掘失败必定成功」） */
		if (c.buryLeft > 0 && c.buryTries >= fs.BURY_PITY) {
			fs.log('挖掘保底触发：连挖 ' + c.buryTries + ' 次仍未完成 → 直接挖通');
			c.buryLeft = 0;
		}
		return fs.buryProgress();
	};
	fs.finishBury = function () {
		var c = fs.corpse();
		var place = (c && c.place) || fs.burialPlace();
		var st = fs.recordBury(place);
		fs.log('埋尸完成：' + place + '（花园 ' + st.garden + ' 具 / 森林 ' + st.forest + ' 具）');
		fs.endCorpse();
		return st;
	};
	fs.finishBuryDump = function () {
		/* 草草丢弃：记为已发现 */
		var st = fs.corpseState();
		st.dumped = (st.dumped || 0) + 1;
		fs.endCorpse();
		return st;
	};

	/* ---------- 战斗结束钩子（被 fs_on_combat_end 调用） ---------- */
	fs.corpseOnCombatEnd = function () {
		try {
			var info = fs.corpseNeeded();
			if (!info.needed) {
				if (V.fsCorpsePending) {
					V.fsCorpsePending = 0;
					fs.log('埋尸跳过：' + info.reason);
				}
				if (info.reason === 'flee') {
					V.fsCorpseFleeNotice = 1;
					V.fsCorpseFleeTotal = info.total;
				}
				return false;
			}
			fs.beginCorpse(info.reason);
			V.fsCorpsePending = 1;
			return true;
		} catch (e) {
			fs.warn('埋尸判定失败: ' + e.message);
			return false;
		}
	};

	fs.log('埋尸模块已加载（花园上限 ' + fs.corpseConfig.gardenLimit + ' 具）');
	fs.register('corpse', function () { fs.corpseState(); });

})();
