/* ============================================================
   终星 FinalStar —— 赌场（规划书 119 / 120）
   119 赌场内可以高潮（一群人耻笑、扔筹码、要求再表演）与昏倒（被绑在机子上）
   120 媚药改为降低性奋上限，且吃药事件最多触发两次
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* ---------- 119 赌场判定 ---------- */
	fs.casinoConfig = {
		orgasmAt: 1.0,     /* 性奋达到上限 → 当众高潮 */
		faintAt: 1.75      /* 性奋超过上限 1.75 倍（或疲劳/压力见底）→ 昏倒 */
	};
	/* ---------- E 批：人格洗脑丸（赌场三楼）---------- */
	/* 玩家走的哪条线：'bailey'（赌场打工满 7 天）/ 'jiusi'（兔子小姐保举） */
	fs.pillLine = function () {
		try {
			if (V.fsData && V.fsData.pillReferral) return 'jiusi';
			if (fs.pillWorkDays() >= 7) return 'bailey';
		} catch (e) { }
		return null;
	};
	fs.pillWorkDays = function () { try { return Number(V.fsData && V.fsData.pillWorkDays) || 0; } catch (e) { return 0; } };
	/* 赌场打工：一天最多记一次 */
	fs.pillWorkDay = function () {
		try {
			fs.ensureData();
			var today = (typeof Time !== 'undefined') ? (Time.year + '-' + Time.month + '-' + Time.monthDay) : null;
			if (!today) return false;
			if (V.fsData.pillWorkDay === today) return false;
			V.fsData.pillWorkDay = today;
			V.fsData.pillWorkDays = fs.pillWorkDays() + 1;
			fs.log('赌场工作日 +1（' + V.fsData.pillWorkDays + ' / 7）');
			return true;
		} catch (e) { return false; }
	};
	fs.pillFloorOpen = function () { return fs.pillLine() !== null; };
	/* ---------- 奴隶管理 ---------- */
	fs.slaveCount = function () { try { return fs.pillSlaves().length; } catch (e) { return 0; } };
	fs.todayStr = function () { try { return Time.year + '-' + Time.month + '-' + Time.monthDay; } catch (e) { return ''; } };
	/* 星期六判定。
	   ⚠️ 这里曾经是 `return d === 5 || d === 6`，注释还写着「DoL: Time.weekDay 0=周一…6=周日」——
	   **这个假设是错的**，所以奴隶上缴实际上只在**周四/周五**能领，真正的周六永远领不到
	   （玩家周六去大厅会被回一句「要等到星期六」）。
	   DoL 0.5.12.13 的原版定义（已在打包后的 HTML 里逐字确认，也由本项目探针验证「周三是 4」佐证）：
	     daysOfWeek = ["Sunday","Monday",…,"Saturday"]
	     get weekDay() { … return (totalDays % 7) + 1 }   → 1=周日 … 7=周六
	     weekDayName = daysOfWeek[weekDay - 1]
	   所以**周六是 7**。而且旧写法在数字分支就 return 了，后面两段按星期名兜底的代码**永远跑不到**。
	   现在改成：**优先认原版的星期名**（语种无关、也不会数错），拿不到名字才退回数字。 */
	fs.isSaturday = function () {
		try {
			if (typeof Time !== 'undefined') {
				var w = Time.weekDayName;
				if (typeof w === 'function') w = w.call(Time);
				if (typeof w === 'string' && w) {
					if (/sat/i.test(w) || /六/.test(w)) return true;
					/* 明确认出是别的日子就直接否掉，别再去猜数字 */
					if (/sun|mon|tue|wed|thu|fri/i.test(w) || /[日一二三四五]/.test(w)) return false;
				}
			}
		} catch (e) { }
		try {
			var d = Time.weekDay;
			if (typeof d === 'function') d = d.call(Time);
			if (typeof d === 'string' && /sat|六/i.test(d)) return true;
			d = Number(d);
			if (!isNaN(d) && d >= 1 && d <= 7) return d === 7;      /* 1=周日 … 7=周六 */
		} catch (e) { }
		return false;
	};
	/* 诊断用：把当前日期相关字段摊出来，便于确认 API 形态 */
	fs.dayDebug = function () {
		try {
			return {
				weekDay: String(Time.weekDay),
				typeofWeekDay: typeof Time.weekDay,
				dayName: (typeof Time.dayName === 'function') ? String(Time.dayName()) : '(no dayName)',
				monthDay: String(Time.monthDay), isSat: fs.isSaturday()
			};
		} catch (e) { return 'err:' + e.message; }
	};
	/* 奴隶上缴：每周六一次，100~500 */
	fs.slavePay = function () {
		try {
			fs.ensureData();
			if (fs.slaveCount() <= 0) return 'none';
			if (!fs.isSaturday()) return 'notday';
			/* ⚠️ `Time.week` **在原版里不存在**（全仓 0 处；存在的是 Time.days / weekDay / weekDayName）。
			   原来写成 `Time.year + '-' + Time.week`，恒等于 "1-undefined" ——
			   去重键永远相同，于是「每星期六只能拿一次」变成**一生只能拿一次**。
			   改用原版确实存在的 Time.days（累计天数）换算周号，并保留 todayStr 兜底。 */
			var _wdays = Number(Time.days);
			var wk = (typeof Time !== 'undefined' && isFinite(_wdays))
				? (Time.year + '-W' + Math.floor(_wdays / 7))
				: fs.todayStr();
			if (V.fsData.slavePaidWeek === wk) return 'paid';
			V.fsData.slavePaidWeek = wk;
			var amount = 100 + Math.floor(Math.random() * 401);       /* 100~500 */
			V.money = (Number(V.money) || 0) + amount * 100;
			fs.log('奴隶上缴：£' + amount);
			return amount;
		} catch (e) { return 'error'; }
	};
	fs.slaveSuicide = function (idx) {
		try {
			var list = fs.pillSlaves();
			if (idx === undefined || idx === null) idx = 0;
			if (!list[idx]) return 'none';
			var nm = list[idx].name;
			V.fsData.slaves = list.filter(function (x, i) { return i !== idx; });
			V.fsData.slaveGone = (Number(V.fsData.slaveGone) || 0) + 1;
			fs.log('奴隶已自行了断：' + nm);
			return nm;
		} catch (e) { return 'error'; }
	};
	/* ---------- 每周结算（周日起）：贝利线欠款 +300/奴隶（永久） / 玖肆线好感惩罚 ----------
	   修 bug：这里以前是每天结算的（只用日期去重），注释却写"每周"。
	   后果：留奴隶第 2 天就 -5、第 3 天到 -10 → jiusiDisappointed = 1，而且此后每天继续往下扣、
	   没有下限、也没有任何恢复途径 —— 玩家看到的就是"玖肆好感被扣光、她永久失望"。
	   现在：① 只在每周第一天结算一次（Time.weekDay === 1，DoL 里周日是一周之首，与 weeklyTick 一致）；
	        ② 好感改走 fs-jiusi.js 的派生模型（真源 = 原版 NPCName.love，惩罚上限 40，不留奴隶每周回退 1）。 */
	fs.pillTick = function () {
		try {
			fs.ensureData();
			var today = fs.todayStr();
			if (!today || V.fsData.pillTickDay === today) return;
			var isWeekStart = false;
			try { isWeekStart = (typeof Time !== 'undefined' && Number(Time.weekDay) === 1); } catch (e) { }
			if (!isWeekStart) return;            /* 不是本周第一天 → 跳过（且不消耗今天的配额） */
			V.fsData.pillTickDay = today;
			var n = fs.slaveCount();
			/* 贝利线 */
			if (n > 0) {
				if (!V.fsData.pillBaileyWarn) {
					V.fsData.pillBaileyWarn = 1;                       /* 次周会在卧室门口警告 */
					fs.log('贝利将在次周警告玩家（奴隶 ' + n + ' 名）');
				} else if (!V.fsData.pillBaileyPaid) {
					var add = 300 * n;
					V.rentmoney = (Number(V.rentmoney) || 0) + add * 100;   /* 永久增加每周欠款 */
					V.fsData.pillRentAdded = (Number(V.fsData.pillRentAdded) || 0) + add;
					V.fsData.pillBaileyPaid = 1;
					fs.log('贝利线：每周欠款永久 +£' + add);
				}
			} else if (V.fsData.pillBaileyWarn) {
				V.fsData.pillBaileyWarn = 0;
				V.fsData.pillBaileyPaid = 0;
				V.fsData.pillBaileyPraise = 1;                          /* 解决掉了 → 他会夸你 */
			}
			/* 玖肆线：好感不再自己算，统一交给 fs-jiusi.js 的派生模型 */
			if (typeof fs.jiusiWeekly === 'function') {
				if (n > 0 && !V.fsData.pillJiusiWarn) { V.fsData.pillJiusiWarn = 1; fs.log('玖肆将在当晚警告玩家'); }
				fs.jiusiWeekly(n > 0);               /* 有奴隶 → 惩罚 +5（上限 40）；没有 → 每周回退 1 */
				if (n === 0) V.fsData.pillJiusiWarn = 0;
			} else if (V.fsData.pillJiusiWarn && n === 0) {
				V.fsData.pillJiusiWarn = 0;
			}
		} catch (e) { }
	};

	/* 统一战斗判据：原版遭遇战 或 我们自己的洞穴遭遇战（后者不设 V.combat） */
	fs.inFight = function () {
		try {
			if (Number(V.combat) === 1 && Number(V.enemyhealth) > 0) return true;          /* 原版战斗 */
			/* 洞穴分支必须**同时**在洞穴段落里：$fsCaveActive 是残留高发字段，
			   只看它会把普通遭遇战（甚至剧情里的过场）也判成自家战斗 → 「射击」按钮乱冒。 */
			var cur = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || '';
			var inCave = /(^Cave |^FS Cave|^FS Morans Cave)/.test(cur);
			if (inCave && Number(V.fsCaveActive) === 1 && Number(V.fsMobHp) > 0) return true;
		} catch (e) { }
		return false;
	};

	/* ---------- 射击 ----------
	   真正生效的 fs.shootOnce() 在 fs-item.js（用 fs.inFight() 判定，伤害按选中子弹、一次一发）。
	   这里原先还有一份 fs.shootOnceLegacy()，从未被任何地方调用，属于早期实现残留 —— 已于 v0.27 清理。
	   若以后要改射击，改 fs-item.js 那份，不要在本文件再写第二份。 */

	/* ---------- 人格洗脑丸：使用与奴隶 ---------- */
	/* 诡术等级：DoL 技能 0~1000，A 级 ≈ 700 以上 */
	fs.pillSkillRank = function () {
		try {
			var v = Number(V.skulduggery) || 0;
			if (v >= 900) return 'S';
			if (v >= 700) return 'A';
			if (v >= 500) return 'B';
			if (v >= 300) return 'C';
			if (v >= 100) return 'D';
			return 'F';
		} catch (e) { return 'F'; }
	};
	/* 拥有「异常力量」的对象：天使 / 恶魔 / 身上缠着别的东西的家伙 → 药丸几乎无效。
	   洞穴里的那些东西同样算异常（够不着人的心智）。 */
	fs.pillIsImmune = function () {
		try {
			if (Number(V.enemyIsImmune) === 1) return true;
			var t = String(V.enemytype || '') + ' ' + String(V.enemyName || '') + ' ' + String(V.fsMobName || '');
			if (/angel|demon|divine|eldritch|tentacle|corrupt/i.test(t)) return true;
			if (/天使|恶魔|神|触手|缠尸|蠕|异形/.test(t)) return true;
			if (V.fsMobHp !== undefined && V.fsMobHp !== null && V.fsCaveActive) return true;   /* 洞穴遭遇战一律异常 */
		} catch (e) { }
		return false;
	};
	fs.pillSlaves = function () { try { return Array.isArray(V.fsData.slaves) ? V.fsData.slaves : []; } catch (e) { return []; } };
	fs.pillAddSlave = function (name) {
		try {
			fs.ensureData();
			if (!Array.isArray(V.fsData.slaves)) V.fsData.slaves = [];
			var nm = String(name || '那个人');
			V.fsData.slaves.push({ name: nm, since: (typeof Time !== 'undefined') ? (Time.year + '-' + Time.month + '-' + Time.monthDay) : '', paid: '' });
			fs.log('新增奴隶：' + nm + '（共 ' + V.fsData.slaves.length + '）');
			return nm;
		} catch (e) { return null; }
	};
	/* 遭遇战：骗 ta 吃下药丸 → 'ok' / 'fail'（诡术不够，对方不吃）/ 'immune' / 'none'（没有药丸）/ 'nofight' */
	fs.pillUseInCombat = function () {
		try {
			if (fs.pillOwned() <= 0) return 'none';
			var inFight = fs.inFight();
			if (!inFight) return 'nofight';
			if (fs.pillIsImmune()) return 'immune';
			if (fs.pillSkillRank() !== 'A' && fs.pillSkillRank() !== 'S') return 'fail';
			V.fsData.pills = fs.pillOwned() - 1;
			var name = String(V.enemyName || V.fsMobName || '那个人');
			fs.pillAddSlave(name);
			/* 立刻结束遭遇战 */
			V.enemyhealth = 0;
			V.fsMobHp = 0;
			V.combat = 0;
			V.enemyanger = 0;
			fs.log('洗脑丸生效：' + name + ' 成为奴隶，遭遇战结束');
			return 'ok';
		} catch (e) { fs.warn('使用洗脑丸失败: ' + e.message); return 'error'; }
	};
	/* 面包：在卧室用一颗药丸做一份混了药的面包 */
	fs.pillBreadMake = function () {
		try {
			fs.ensureData();
			if (fs.pillOwned() <= 0) return 'none';
			if (V.fsData.pillBread) return 'have';
			V.fsData.pills = fs.pillOwned() - 1;
			V.fsData.pillBread = 1;
			fs.log('做了一份混了洗脑丸的面包（剩余药丸 ' + V.fsData.pills + '）');
			return 'ok';
		} catch (e) { return 'error'; }
	};
	/* 面包交给谁：取当前在场的 NPC 名字；周围没人就返回空串（不许凭空造人） */
	fs.breadTargetName = function () {
		try {
			var list = V.NPCList || [];
			for (var i = 0; i < list.length; i++) {
				var n = list[i];
				if (!n) continue;
				if (n.fullname) return String(n.fullname);
				if (n.name) return String(n.name);
			}
		} catch (e) { }
		return '';
	};
	/* 把面包给出去 → 对方成为奴隶 */
	fs.pillBreadUse = function (target) {
		try {
			fs.ensureData();
			if (!V.fsData.pillBread) return 'none';
			V.fsData.pillBread = 0;
			var nm = fs.pillAddSlave(target || '那个人');
			fs.log('面包下毒成功：' + nm);
			return nm;
		} catch (e) { return 'error'; }
	};

	/* ---------- 人格洗脑丸：持有 / 购买 ---------- */
	fs.pillPrice = function () { return 5000; };                        /* £5000 */
	fs.pillOwned = function () { try { return Number(V.fsData && V.fsData.pills) || 0; } catch (e) { return 0; } };
	fs.pillBought = function () { try { return Number(V.fsData && V.fsData.pillsBought) || 0; } catch (e) { return 0; } };
	fs.pillLeft = function () { return Math.max(0, 2 - fs.pillBought()); };   /* 一生最多两颗 */
	/* 返回 'ok' / 'limit' / 'poor' / 'error' */
	fs.pillBuy = function () {
		try {
			fs.ensureData();
			if (fs.pillBought() >= 2) return 'limit';
			var price = fs.pillPrice() * 100;
			if ((Number(V.money) || 0) < price) return 'poor';
			V.money = Number(V.money) - price;
			V.fsData.pills = fs.pillOwned() + 1;
			V.fsData.pillsBought = fs.pillBought() + 1;
			fs.log('购入人格洗脑丸（持有 ' + V.fsData.pills + '，累计 ' + V.fsData.pillsBought + ' / 2）');
			return 'ok';
		} catch (e) { fs.warn('购买洗脑丸失败: ' + e.message); return 'error'; }
	};
	/* 兔子小姐：请求保举名额（需要 £2000 = 200000） */
	fs.pillAskReferral = function () {
		try {
			fs.ensureData();
			if (V.fsData.pillReferral) return 'already';
			if ((Number(V.money) || 0) < 200000) return 'poor';
			/* ⚠️ 原来只验资、**不扣款**，而段落里写的是「你数了两千块放在她掌心」——
			   人格洗脑丸的这条路线等于零成本。补上真正的扣款。 */
			V.money = Number(V.money) - 200000;
			V.fsData.pillReferral = 1;
			fs.log('兔子小姐已同意保举（已扣 £2000，余额 ' + V.money + '）');
			return 'ok';
		} catch (e) { return 'error'; }
	};

	fs.casinoOrgasmCheck = function () {
		try {
			var max = Number(V.arousalmax) || 0;
			var cur = Number(V.arousal) || 0;
			if (!max) return false;
			return cur >= max * fs.casinoConfig.orgasmAt;
		} catch (e) { return false; }
	};
	fs.casinoFaintCheck = function () {
		try {
			var amax = Number(V.arousalmax) || 0;
			var cur = Number(V.arousal) || 0;
			if (amax && cur >= amax * fs.casinoConfig.faintAt) return true;
			if (Number(V.tiredness) >= Number(V.tirednessmax) && Number(V.tirednessmax) > 0) return true;
			if (Number(V.stress) >= Number(V.stressmax) && Number(V.stressmax) > 0) return true;
			return false;
		} catch (e) { return false; }
	};
	/* 当众高潮的结果：围观、耻笑、扔筹码、要求再来一次 */
	fs.casinoOrgasmResult = function () {
		var chips = (1 + Math.floor(Math.random() * 5)) * 100;
		try {
			V.casinoChips = (Number(V.casinoChips) || 0) + chips;
			V.arousal = Math.floor((Number(V.arousalmax) || 0) * 0.25);
			V.stress = Math.min((Number(V.stress) || 0) + 60, Number(V.stressmax) || 9999);
			V.trauma = Math.min((Number(V.trauma) || 0) + 40, Number(V.traumamax) || 9999);
			V.fame = V.fame || {};
			V.fame.exhibitionism = Math.min((Number(V.fame.exhibitionism) || 0) + 5, 1000);
			V.fs_casinoEncoreCount = (Number(V.fs_casinoEncoreCount) || 0) + 1;
		} catch (e) { }
		return chips;
	};
	/* 昏倒的结果：被绑在老虎机上。
	   昏倒同时把理智补回来（原先 fs.sanityOnFaint 零调用）。用 Once 保证一天只加一次。
	   ⚠️ ：**必须同时把压力与疲劳压下去**。因为大厅顶部现在是一进就判定的硬门
	   （`casinoFaintCheck` 包含「压力见底 / 疲劳见底 / 性奋 1.75 倍」三种），
	   只压性奋的话，压力满的玩家会在「大厅 → 昏倒 → 大厅」之间无限打转。 */
	fs.casinoFaintResult = function () {
		try {
			V.arousal = Math.floor((Number(V.arousalmax) || 0) * 0.4);
			var smax = Number(V.stressmax) || 0;
			if (smax > 0) V.stress = Math.floor(smax * 0.55);
			var tmax = Number(V.tirednessmax) || 0;
			if (tmax > 0) V.tiredness = Math.floor(tmax * 0.55);
			V.fs_casinoFaintCount = (Number(V.fs_casinoFaintCount) || 0) + 1;
			if (fs.sanityOnFaintOnce) fs.sanityOnFaintOnce('casino');
		} catch (e) { }
		return true;
	};

	/* ---------- 120 媚药 ---------- */
	fs.aphrodisiacConfig = {
		maxUses: 2,        /* 吃药事件最多触发两次 */
		arousalMaxScale: 0.8 /* 每次性奋上限 × 0.8（降低） */
	};
	fs.aphrodisiacCount = function () {
		try { return Number(V.fs_aphrodisiacCount) || 0; } catch (e) { return 0; }
	};
	fs.canTakeAphrodisiac = function () {
		return fs.aphrodisiacCount() < fs.aphrodisiacConfig.maxUses;
	};
	fs.takeAphrodisiac = function () {
		try {
			var before = Number(V.arousalmax) || 0;
			var after = Math.max(100, Math.floor(before * fs.aphrodisiacConfig.arousalMaxScale));
			V.arousalmax = after;
			V.fs_aphrodisiacCount = fs.aphrodisiacCount() + 1;
			if (V.arousal > V.arousalmax) V.arousal = Math.floor(V.arousalmax * 0.8);
			fs.log('媚药生效：性奋上限 ' + before + ' → ' + after + '（第 ' + V.fs_aphrodisiacCount + ' 次）');
			return { before: before, after: after, count: V.fs_aphrodisiacCount };
		} catch (e) { return null; }
	};

	fs.log('赌场模块已加载（高潮 / 昏倒 / 媚药上限 ×' + fs.aphrodisiacConfig.maxUses + '）');
	fs.register('casino', function () { });

})();
