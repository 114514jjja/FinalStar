/* ============================================================
   终星 FinalStar —— 时间事件（无框架：按段落推进自行检测小时/天）
   见证者回复 / 每日重置 / 每周一银行结算
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* 见证者特质：每小时回复（压力/疲劳/创伤/疼痛 每小时减少 200~1500） */
	function witnessHourly(data) {
		try {
			fs.ensureData();
			if (!V.fsData.witness) return;
			var ticks = (data && data.hours) || 1;
			var lo = 200, hi = 1500;
			var rnd = function () { return lo + Math.floor(Math.random() * (hi - lo + 1)); };
			for (var i = 0; i < ticks; i++) {
				var ds = rnd(), dt = rnd(), dtr = rnd(), dp = rnd();
				V.stress = Math.max(0, (V.stress || 0) - ds);
				V.tiredness = Math.max(0, (V.tiredness || 0) - dt);
				V.trauma = Math.max(0, (V.trauma || 0) - dtr);
				V.pain = Math.max(0, (V.pain || 0) - dp);
				fs.log('见证者回复：[压力-' + ds + ' 疲劳-' + dt + ' 创伤-' + dtr + ' 疼痛-' + dp + ']');
			}
		} catch (e) { }
	}

	/* 每日：重置每日计数、临时祝福到期、贝利回归计时；周一额外结算银行 */
	function dailyTick() {
		try {
			fs.ensureData();
			/* 每日清零：把模组自己塞进 $daily 的计数逐项清掉。
			   ⚠️ 为什么必须自己清：原版**不会重建 $daily**（全仓只有 variablesStart2 建过一次），
			   它只逐字段清自己认识的那些；模组新增的键（magicCasts / fsLoaf / jiusiFlirt /
			   casinoNPCEvent / jiusiAmmo / fsBankFaint / bankVisited）没人清 → 会变成"一生存一次"。
			   最要命的是 magicCasts：「每日 10 次吟唱」在放过 10 次之后会**永久枯竭**
			   （canCast 读的就是它）。原版若哪天改成整体重建 $daily，这里多清一遍也无害。 */
			if (V.daily) {
				['fsCasts', 'magicCasts', 'fsLoaf', 'jiusiFlirt', 'casinoNPCEvent',
					'jiusiAmmo', 'fsBankFaint', 'bankVisited'].forEach(function (k) {
						try { delete V.daily[k]; } catch (e) { }
					});
			}
			if (fs.baileyDailyTick) fs.baileyDailyTick({});

			if (Array.isArray(V.fsData.blessings)) {
				var expired = [];
				V.fsData.blessings.forEach(function (b) {
					if (!b || typeof b.days !== 'number') return;
					b.days -= 1;
					if (b.days <= 0) expired.push(b);
				});
				expired.forEach(function (b) {
					var i = V.fsData.blessings.indexOf(b);
					if (i !== -1) V.fsData.blessings.splice(i, 1);
					/* ⚠️ 到期必须**反向还原**使用时的效果，而不是一律往下减：
					   up=1 的卷轴当时把上限加上去了，到期就该减回来；up=0 的卷轴当时把上限减下去了，
					   到期就该加回来。原写法无条件 `- value`，于是「清心 / 宽心 / 安魂」这类减上限的
					   卷轴到期**又减一次** —— 上限永久比原值低 400，再也回不去。 */
					var back = (b.value || 0) * (b.up === false ? -1 : 1);
					if (b.stat === 'pain') {
						/* 疼痛上限的真身在原版 painClamp() 里，这里同步那条 ReplacePatcher 读的加成 */
						V.fs_painCapBonus = (Number(V.fs_painCapBonus) || 0) + (b.up === false ? (b.value || 0) : -(b.value || 0));
						if (V.fs_painCapBonus < 0) V.fs_painCapBonus = 0;
						V.painmax = 200 + Number(V.fs_painCapBonus);
					} else if (b.stat && typeof V[b.stat + 'max'] === 'number') {
						/* 优先按「实际生效的变化量」反向抵消（旧存档没有 applied 才退回按 value 推算）；
						   下限按属性取（trauma/arousal 初始就是 1000，写死 1000 会让减上限卷轴失效）。 */
						var _floor = (typeof fs.maxFloor === 'function') ? fs.maxFloor(b.stat) : 100;
						var _apply = (typeof b.applied === 'number') ? b.applied : back;
						V[b.stat + 'max'] = Math.max(_floor, V[b.stat + 'max'] - _apply);
					}
					if (b.stat && typeof V[b.stat] === 'number' && Number(V[b.stat + 'max']) > 0 && V[b.stat] > V[b.stat + 'max']) {
						V[b.stat] = V[b.stat + 'max'];
					}
					fs.log('临时祝福到期：' + (b.stat || '?') + ' -' + (b.value || 0));
				});
			}

			try {
				if (typeof Time !== 'undefined' && Time.weekDay === 1) weeklyTick();
			} catch (e) { }
		} catch (e) {
			fs.warn('每日事件失败: ' + e.message);
		}
	}

	/* 每周一：银行利息 5% + 代理缴费 */
	function weeklyTick() {
		try {
			fs.ensureData();
			if (fs.bankInterest) {
				var gain = fs.bankInterest();
				if (gain > 0) {
					V.fs_bankInterestNotice = gain;
					fs.log('银行利息 +' + gain);
				}
			}
			V.fs_autopayPaidWeek = 0;
			if (fs.autopayRent) {
				var ap = fs.autopayRent();
				if (ap && ap.paid) {
					V.fs_autopayNotice = ap.amount;
					fs.log('代理缴费成功：' + ap.amount);
				} else if (ap && ap.paid === false) {
					V.fs_autopayFailNotice = 1;
					fs.log('代理缴费失败：余额不足');
				}
			}
		} catch (e) {
			fs.warn('每周事件失败: ' + e.message);
		}
	}

	fs.initEvents = function () {
		fs.onHour(witnessHourly);
		fs.onDay(dailyTick);
		fs.log('已注册：见证者每小时回复 / 每日结算（含每周一银行结算）');
	};

	fs.register('events', function () { fs.initEvents(); });

})();
