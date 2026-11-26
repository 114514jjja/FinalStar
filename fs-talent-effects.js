/* fs-talent-effects.js —— 天赋被动：原版疼痛/压力/诱惑、魅魔收集物、睡眠 */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	function has(id) {
		try { return !!(fs.talentHas && fs.talentHas(id)); } catch (e) { return false; }
	}
	function inFight() {
		try { return !!(fs.inFight && fs.inFight()); } catch (e) { return false; }
	}
	/* 被压制：头/四肢处于 bound 或 grappled。原版没有单一的 $restrained，
	   战斗里就是这几个槽位；判据保守一点，避免平时也触发。 */
	function restrained() {
		try {
			var parts = ['head', 'leftarm', 'rightarm', 'leftleg', 'rightleg'];
			for (var i = 0; i < parts.length; i++) {
				var v = String(V[parts[i]] || '');
				if (v === 'bound' || v === 'grappled') return true;
			}
		} catch (e) { }
		return false;
	}

	/* 原版疼痛入口：fs-links.js 的 statChange.pain 包装会调用这里。
	   只压「战斗中、且是正向疼痛」；平时受伤/事件扣血不动。 */
	fs.talentPain = function (amount) {
		try {
			var n = Number(amount) || 0;
			if (n <= 0 || !inFight()) return n;
			/* 本能：15% 概率闪避这次伤害 */
			if (has('c8') && Math.random() < 0.15) {
				fs.log('天赋「本能」：你及时侧身，攻击落空');
				return 0;
			}
			if (has('n1')) n = n * 0.95;   /* 共鸣：两套战斗都吃到减伤 */
			if (has('n3')) n = n * 1.10;   /* 深渊契约：强力但带代价 */
			if (has('c1')) n = Math.max(0, n - 1);      /* 好战：每次受到的伤害 -1 */
			if (has('c2')) n = n * 0.9;                 /* 坚韧：疼痛增长 -10% */
			if (has('c3') && !V.fsData.talentCounterUsed) {
				V.fsData.talentCounterUsed = 1;         /* 反击：每场第一次受击反伤 2 */
				var eh = Number(V.enemyhealth) || 0;
				if (eh > 0) {
					V.enemyhealth = Math.max(0, eh - 2);
					fs.log('天赋「反击」：反弹 2 点伤害（敌血 ' + V.enemyhealth + '）');
				}
			}
			return n;
		} catch (e) { return amount; }
	};

	/* 顺从之美：被压制时压力增长减半（正向压力） */
	fs.talentStress = function (amount) {
		try {
			var n = Number(amount) || 0;
			if (n > 0 && has('h6') && inFight() && restrained()) return n * 0.5;
			return n;
		} catch (e) { return amount; }
	};

	/* 每次显示：清理战斗标记、h8 降低敌方高潮阈值、睡眠恢复 */
	fs.talentCombatWatch = function () {
		try {
			V.fsData = V.fsData || {};
			if (!inFight()) {
				V.fsData.talentCounterUsed = 0;
				V.fsData.talentAphroDone = 0;
				return;
			}
			var max = Number(V.enemyarousalmax) || 0;
			/* h8 每场只压一次：用 done 标记，否则每次显示都会再 ×0.9 */
			if (has('h8') && max > 0 && !V.fsData.talentAphroDone) {
				V.fsData.talentAphroDone = 1;
				V.enemyarousalmax = Math.max(1, Math.round(max * 0.9));
			}
		} catch (e) { }
	};

	/* 睡眠恢复：d4 好眠（当天压力 ×0.9）、d5 早睡早起（再 -10）。
	   用 $sleepHoursTotal > 0 判“刚睡过”，每天只结算一次。 */
	function sleepBonus() {
		try {
			V.fsData = V.fsData || {};
			if (Number(V.sleepHoursTotal) <= 0) { V.fsData.talentSleepSeen = 0; return; }
			/* 只在这次睡眠的小时数第一次出现时结算；避免第二天没睡也触发 */
			if (V.fsData.talentSleepSeen === Number(V.sleepHoursTotal)) return;
			V.fsData.talentSleepSeen = Number(V.sleepHoursTotal);
			var day = String(Time.days);
			if (V.fsData.talentSleepDay === day) return;
			V.fsData.talentSleepDay = day;
			if (has('d4')) {
				V.stress = Math.max(0, Math.round((Number(V.stress) || 0) * 0.9));
				fs.log('天赋「好眠」：睡醒后压力 -10%');
			}
			if (has('d5')) {
				V.stress = Math.max(0, (Number(V.stress) || 0) - 10);
				fs.log('天赋「早睡早起」：睡醒后压力 -10');
			}
		} catch (e) { }
	}

	/* 讲价：包装原版服装价格函数，商店显示与扣款同源 */
	fs.talentShopHook = function () {
		try {
			['getClothingCost', 'tailorClothingCost'].forEach(function (name) {
				var orig = window[name];
				if (typeof orig !== 'function' || orig.__fsTalentWrapped) return;
				var wrapped = function () {
					var v = orig.apply(this, arguments);
					try { if (typeof v === 'number' && has('d2')) v = Math.round(v * 0.95); } catch (e) { }
					return v;
				};
				wrapped.__fsTalentWrapped = true;
				window[name] = wrapped;
			});
		} catch (e) { }
	};

	/* 一次性包装原版入口：压力与诱惑检定。用 __fsTalentWrapped 防重入。 */
	fs.talentHookOnce = function () {
		fs.talentShopHook();
		try {
			if (typeof statChange !== 'undefined' && statChange && typeof statChange.stress === 'function'
				&& !statChange.stress.__fsTalentWrapped) {
				var origStress = statChange.stress;
				var wrappedStress = function (amount, modifier) {
					try { amount = fs.talentStress(amount); } catch (e) { }
					return origStress.call(this, amount, modifier);
				};
				wrappedStress.__fsTalentWrapped = true;
				statChange.stress = wrappedStress;
				fs.log('天赋：已挂接原版 statChange.stress（顺从之美）');
			}
		} catch (e) { }
		try {
			if (typeof currentSkillValue === 'function' && !currentSkillValue.__fsTalentWrapped) {
				var origSkill = currentSkillValue;
				var wrappedSkill = function (skill, disableModifiers) {
					var v = origSkill.apply(this, arguments);
					try {
						if (skill === 'seductionskill' && has('h4')) {
							v = v * 1.05;
							if (has('h5') && Number(V.exposed) > 0) v = v * 1.10;
						}
					} catch (e) { }
					return v;
				};
				wrappedSkill.__fsTalentWrapped = true;
				window.currentSkillValue = wrappedSkill;
				fs.log('天赋：已挂接 currentSkillValue（甜言/曲线）');
			}
		} catch (e) { }
	};

	fs.talentSleepBonus = sleepBonus;
	if (typeof fs.onInit === 'function') fs.onInit(fs.talentHookOnce);
	else setTimeout(fs.talentHookOnce, 1200);
	fs.onDisplay(function () { setTimeout(function () { fs.talentShopHook(); fs.talentCombatWatch(); sleepBonus(); }, 80); });
})();
