/* ============================================================
   终星 FinalStar —— 银行扩展 & 贝利回归线
   规划书：102 贝利回归 / 103 租金叠加 / 104 代理缴费 /
           105 银行扣款 / 106 每周利息 / 107 假身份证限制
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* ---------- 假身份证（DoL 原版：妓院布莱尔处办理，$id is 1 表示持有） ---------- */
	fs.hasFakeId = function () {
		try { return V.id === 1; } catch (e) { return false; }
	};

	/* ---------- 106. 银行每周利息 5% ---------- */
	fs.bankInterest = function () {
		try {
			if (V.bankCard !== 1) return 0;
			var bal = V.bankBalance || 0;
			if (bal <= 0) return 0;
			var gain = Math.floor(bal * 0.05);
			V.bankBalance = bal + gain;
			return gain;
		} catch (e) { return 0; }
	};

	/* ---------- 104/105. 代理缴费 ---------- */
	fs.autopayEnabled = function () {
		try { return V.fs_autopay === true; }
		catch (e) { return false; }
	};
	fs.enableAutopay = function () {
		fs.ensureData();
		V.fs_autopay = true;
		return true;
	};
	fs.disableAutopay = function () {
		fs.ensureData();
		V.fs_autopay = false;
		return true;
	};

	/* 本周应付租金（$rentmoney 由原版 <<rentmod>> 算好；没算出来时按阶段表补一份，
	   否则「还没上门就先自动扣款」会因为 $rentmoney 是 0 而永远不扣 —— 这正是之前代缴失效的原因） */
	fs.rentDueAmount = function () {
		try {
			var due = Number(V.rentmoney) || 0;
			if (due <= 0) {
				var stage = Math.clamp ? Math.clamp(Number(V.rentstage) || 1, 1, 6) : Math.min(6, Math.max(1, Number(V.rentstage) || 1));
				due = [10000, 30000, 50000, 70000, 100000, 150000, 200000][stage];
				var mod = (V.settings && Number(V.settings.rentCostModifier)) || 1;
				due = Math.floor(due * mod);
			}
			/* 贝利回归后租金翻倍：倍率由 fs.rentMultiplier() 提供（没回归时是 1）。
			   ⚠️ 这个函数自从写出来就**没有任何地方调用过** —— 于是说明页与
			   「Bailey Return Notice」里承诺的「下个礼拜的租金——翻倍」是一句空头支票。
			   这里只做**读取时相乘、不回写 $rentmoney**，所以反复调用不会累乘。 */
			due = Math.floor(due * fs.rentMultiplier());
			due += Number(V.babyRent) || 0;
			return due;
		} catch (e) { return 0; }
	};

	/* 贝利上门收租时调用：开通了代理缴费、有卡、卡里钱够 → 当场划扣，本周免收（贝利根本不用开口） */
	fs.autopayTry = function () {
		try {
			if (!fs.autopayEnabled()) return false;
			if (Number(V.bankCard) !== 1) return false;
			/* ⚠️ 本周已经划扣过就不要再扣一次。周一 fs-events.weeklyTick 会走 autopayRent()，
			   而贝利上门时 rentdue 补丁又走本函数 —— 原来这里没有闸门，同一周**扣两次钱**。
			   作者本来就写好了 fs.rentAlreadyPaid()，只是一直没人调用。 */
			if (fs.rentAlreadyPaid()) return false;
			var due = fs.rentDueAmount();
			if (due <= 0) return false;
			var bal = Number(V.bankBalance) || 0;
			if (bal < due) {
				/* 钱不够：留下失败记录，贝利照常上门（玩家可以用「信封」那条路当面掀给他看） */
				V.fs_autopayFailNotice = 1;
				fs.log('代理缴费失败：卡内 ' + bal + ' < 应付 ' + due);
				return false;
			}
			V.bankBalance = bal - due;
			V.fs_autopayPaidWeek = 1;
			V.fs_autopayLastPaid = due;
			V.fs_autopayNotice = due;
			V.fs_rentPaidByCard = 1;
			V.fs_rentPaidUntil = (Number(Time.days) || 0) + 7;
			fs.advanceRentStage();
			fs.log('代理缴费划扣成功：' + due + '（余额 ' + V.bankBalance + '）');
			return true;
		} catch (e) { fs.warn('代理缴费判定失败: ' + e.message); return false; }
	};

	/* 每周：从银行余额自动转租金给贝利（银行的钱贝利本来看不到，但代理缴费会让他知道） */
	fs.autopayRent = function () {
		try {
			if (!fs.autopayEnabled()) return null;
			if (V.bankCard !== 1) return null;
			if (fs.rentAlreadyPaid()) return { paid: false, reason: 'alreadyPaid' };
			var due = fs.rentDueAmount();
			if (due <= 0) return null;
			var bal = V.bankBalance || 0;
			if (bal < due) {
				return { paid: false, reason: 'insufficient', due: due, balance: bal };
			}
			V.bankBalance = bal - due;
			V.fs_autopayPaidWeek = 1;
			V.fs_autopayLastPaid = due;
			V.fs_rentPaidUntil = (Number(Time.days) || 0) + 7;
			return { paid: true, amount: due, balance: V.bankBalance };
		} catch (e) { return null; }
	};
	/* 结清一周后：像原版 <<rentpay>> 一样把下周的租金提高一档并重算 */
	fs.advanceRentStage = function () {
		try {
			var stage = Number(V.rentstage) || 1;
			var base = [10000, 30000, 50000, 70000, 100000, 150000, 200000][Math.min(6, Math.max(1, stage))];
			var mod = (V.settings && Number(V.settings.rentCostModifier)) || 1;
			V.rentmoney = Math.floor(base * mod);
			V.rentstage = stage + 1;
			return V.rentmoney;
		} catch (e) { return 0; }
	};
	/* 当面用信封结清（银行存折）：卡里够就直接划扣并结算这一周，返回结算明细 */
	fs.rentPayByCard = function (due) {
		try {
			if (fs.rentAlreadyPaid()) return { ok: false, reason: 'alreadyPaid', due: Number(due) || fs.rentDueAmount(), balance: Number(V.bankBalance) || 0 };
			due = Number(due) || fs.rentDueAmount();
			var bal = Number(V.bankBalance) || 0;
			if (due <= 0 || bal < due) return { ok: false, reason: 'insufficient', due: due, balance: bal };
			V.bankBalance = bal - due;
			V.fs_autopayPaidWeek = 1;
			V.fs_autopayLastPaid = due;
			V.fs_autopayNotice = due;
			V.fs_rentPaidByCard = 1;
			V.fs_rentPaidUntil = (Number(Time.days) || 0) + 7;
			fs.advanceRentStage();
			return { ok: true, due: due, balance: V.bankBalance };
		} catch (e) { return { ok: false, reason: 'error' }; }
	};
	/* 手交租后 7 天内不再让银行代缴（原版 rentpay 会调 markRentPaidByHand） */
	fs.markRentPaidByHand = function () {
		try { V.fs_rentPaidUntil = (Number(Time.days) || 0) + 7; return V.fs_rentPaidUntil; }
		catch (e) { return 0; }
	};
	fs.rentPaidUntil = function () {
		try { return Number(V.fs_rentPaidUntil) || 0; } catch (e) { return 0; }
	};
	/* 贝利收租时：本周已自动缴费 / 手交过 7 天内，都免收 */
	fs.rentAlreadyPaid = function () {
		try {
			if (V.fs_autopayPaidWeek === 1) return true;
			return (Number(Time.days) || 0) < fs.rentPaidUntil();
		} catch (e) { return false; }
	};

	/* 租金附加费：0.5.11.9 没有原版锚点 → 由本模块每周检查一次（欠租则 ×1.5 并置标记） */
	fs.rentSurchargeTick = function () {
		try {
			/* ⚠️ `Time.week` 原版不存在（全仓 0 处）→ 原来恒为 "1-undefined"，
			   「每周 ×1.5」退化成一整个游戏年只加一次。改用 Time.days 换算周号。 */
			var _wdays = Number(Time.days);
			var wk = (typeof Time !== 'undefined' && isFinite(_wdays)) ? (Time.year + '-W' + Math.floor(_wdays / 7)) : null;
			if (!wk) return;
			if (V.fsData.rentSurchargeWeek === wk) return;
			/* 只有真正到期/逾期（$renttime <= 0）才加收；旧条件 rentstage>=1 恒真、
			   renttime>=1 又是"还没到期"，结果每周都 ×1.5，玩家一交完钱下周就涨。 */
			var overdue = (Number(V.renttime) || 0) <= 0;
			if (!overdue) return;
			V.fsData.rentSurchargeWeek = wk;
			V.rentmoney = Math.floor((Number(V.rentmoney) || 0) * 1.5);
			V.baileySurcharge = 1;
			fs.log('贝利附加费：本周欠款 ×1.5 → £' + Math.floor((Number(V.rentmoney) || 0) / 100));
		} catch (e) { }
	};

	/* 银行：压力过大 → 晕倒事件（每天一次；由 Bank Hall 段落调用）
	   昏倒同时把理智补回来（原先 fs.sanityOnFaint 零调用，说明里承诺过但从没生效）。
	   用 sanityOnFaintOnce 而不是直接调 —— 这个判定点一天内可能被查多次，
	   Once 会按「当天 + bank」打标记，多查也只加一次。 */
	fs.bankFaintCheck = function () {
		try {
			if (V.daily && V.daily.fsBankFaint) return false;
			var max = Number(V.stressmax) || 0;
			var cur = Number(V.stress) || 0;
			if (max && cur >= max * 0.92) { if (fs.sanityOnFaintOnce) fs.sanityOnFaintOnce('bank'); return true; }
			/* ⚠️ `V.tirednessmax` 在 0.5.12.13 已被原版 <<unset>>（见 variables-versionUpdate.twee：
			   v0.3.11.4 起改用 C.tiredness.max），读它恒为 undefined → 疲劳 100% 永远不会晕倒。
			   改成读原版真正在用的上限。 */
			var tmax = Number((window.C && C.tiredness && C.tiredness.max) || V.tirednessmax) || 0;
			var tcur = Number(V.tiredness) || 0;
			if (tmax && tcur >= tmax * 0.97) { if (fs.sanityOnFaintOnce) fs.sanityOnFaintOnce('bank'); return true; }
			return false;
		} catch (e) { return false; }
	};
	/* ---------- 103. 租金叠加（每次被发现都累加，永久保留） ---------- */
	fs.rentSurchargeCount = function () {
		try { return V.fs_rentSurcharges || 0; }
		catch (e) { return 0; }
	};
	/* 应用一次加收：base × (1 + 0.5 × 次数) */
	fs.applyRentSurcharge = function (base, count) {
		return Math.floor((base || 0) * (1 + 0.5 * (count || 0)));
	};

	/* ---------- 102. 贝利死亡与回归 ---------- */
	var BAILEY_RETURN_DAYS = 14;
	fs.baileyShot = function () {
		try { return V.baileyShot === 1; } catch (e) { return false; }
	};
	/* 每日：记录枪杀后的天数，14 天后回归 */
	fs.baileyDailyTick = function (data) {
		try {
			fs.ensureData();
			var ticks = (data && data.triggeredByAccumulator && data.triggeredByAccumulator.count) || 1;
			if (fs.baileyShot()) {
				if (V.fs_baileyShotDay === undefined) V.fs_baileyShotDay = 0;
				V.fs_baileyShotDay += ticks;
				if (V.fs_baileyShotDay >= BAILEY_RETURN_DAYS && V.fs_baileyReturned !== 1) {
					/* 回归：恢复贝利 */
					V.baileyShot = 0;
					V.fs_baileyReturned = 1;
					V.fs_baileyReturnNotice = 1;
					try {
						C.npc.Bailey.state = 'active';
						C.npc.Bailey.init = 1;
					} catch (e) { }
					fs.log('贝利在 ' + BAILEY_RETURN_DAYS + ' 天后回归');
				}
			}
			/* 回归次日：警告 + 下周租金翻倍 + 手枪被偷 */
			if (V.fs_baileyReturned === 1 && V.fs_baileyWarned !== 1) {
				V.fs_baileyWarned = 1;
				V.fs_rentMultiplier = 2;
				if (V.pistolOwned === 1 || V.pistolAmmo > 0) {
					V.pistolOwned = 0;
					V.pistolAmmo = 0;
					V.fs_pistolStolen = 1;
				}
				fs.log('贝利回归后的警告已触发（租金翻倍 + 手枪被偷）');
			}
			/* 手枪被偷的提示只显示一次 */
			if (V.fs_pistolStolen === 1 && V.fs_pistolStolenSeen === 1) V.fs_pistolStolen = 0;
		} catch (e) {
			fs.warn('贝利回归结算失败: ' + e.message);
		}
	};

	/* 租金倍率（回归后翻倍） */
	fs.rentMultiplier = function () {
		try { return V.fs_rentMultiplier || 1; }
		catch (e) { return 1; }
	};

	/* ---------- 初始化 ---------- */
	fs.register('bank', function () {
		fs.ensureData();
		if (V.fs_autopay === undefined) V.fs_autopay = false;
		if (V.fs_rentSurcharges === undefined) V.fs_rentSurcharges = 0;
		if (V.fs_rentMultiplier === undefined) V.fs_rentMultiplier = 1;
		fs.log('银行与贝利回归模块已加载');
	});
})();
