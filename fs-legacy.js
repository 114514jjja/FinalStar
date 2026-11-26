/* fs-legacy.js — 0.27：把原本靠 ReplacePatcher 的 JS 文件补丁做的事，改由模组自己接管。
   原因：Lyra 等「把 JS 编译进 HTML」的发行版里，JS 补丁按 fileName（time.js / named-npc.js …）
   根本匹配不到文件，整批 JS 补丁静默失效 —— 每周子弹、次日收枪、贝利免租、死亡 NPC 屏蔽都成了死功能。
   这里用模组自己的运行时钩子重做一遍，不依赖任何框架。 */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) { console.error('[FinalStar] framework.js 未加载，fs-legacy 跳过'); return; }

	function num(v, d) { var n = Number(v); return isNaN(n) ? (d || 0) : n; }

	/* 玖肆每周送礼的日子。DoL 的 Time.weekDay 是 1=周日 … 7=周六（0.5.12.13 time.js 原文：
	   "Returns day of the week (1 being sunday, 7 being saturday)"），所以 2 = 周一。
	   ⚠️ 这里以前写着「1=周一」，注释是反的 —— 代码一直是对的，别照着注释去改代码。 */
	fs.weeklyAmmoWeekDay = 2;

	function giveWeeklyAmmo() {
		try {
			if (num(V.jiusiProtect) !== 1) return false;
			if (V.daily && V.daily.jiusiAmmo) return false;          /* 当天已领（含旧补丁发的） */
			if (num(Time.weekDay) !== num(fs.weeklyAmmoWeekDay, 2)) return false;
			var i = (V.NPCNameList || []).indexOf('玖肆');
			if (i === -1 || !V.NPCName[i] || num(V.NPCName[i].love) < 10) return false;
			fs.ensureData();
			V.fsData.bullets.blackrune = num(V.fsData.bullets.blackrune) + 1;
			if (!V.fsData.currentBullet) V.fsData.currentBullet = 'blackrune';
			V.daily.jiusiAmmo = 1;
			V.jiusiAmmoNotice = 1;
			V.jiusiRescueUsed = 0;
			fs.log('玖肆每周礼：黑色雕纹子弹 +1（现有 ' + V.fsData.bullets.blackrune + ' 发）');
			try { fs.panelLog('玖肆塞给你一发黑色雕纹子弹。（备弹 ' + V.fsData.bullets.blackrune + ' 发）'); } catch (e) { }
			return true;
		} catch (e) { fs.warn('每周子弹发放失败: ' + e.message); return false; }
	}
	fs.giveWeeklyAmmo = giveWeeklyAmmo;

	/* ---------- 每天推进 ---------- */
	fs.onDay(function () {
		try {
			/* 1) 手枪被抢 / 丢失：次日彻底消失（原 time.js 补丁） */
			if (V.pistolLostTimer && !V.pistolLostDone) {
				V.pistolOwned = 0;
				V.pistolAmmo = 0;
				V.pistolLostDone = 1;
				V.pistolLostNotice = 1;
				try {
					if (V.worn && typeof fs.slotIsPistol === 'function') {
						if (fs.slotIsPistol('handheld')) V.worn.handheld = clone(setup.clothes.handheld[0]);
						if (fs.slotIsPistol('handheld2')) V.worn.handheld2 = clone(setup.clothes.handheld[0]);
					}
				} catch (e2) { }
			}
			/* 2) 贝利受伤：7 天不来催租（原 time.js 补丁） */
			if (num(V.baileyRentSkipDays) > 0) {
				V.baileyRentSkipDays = num(V.baileyRentSkipDays) - 1;
				V.renttime = num(V.renttime) + 1;
			}
			/* 3) 玖肆每周一发黑色雕纹子弹 */
			giveWeeklyAmmo();
			/* 4) 每周一重置玖肆的两项「每周一次」救场标记。
			   台词是「周一守着你就是这点好处」（shootEffect.txt）与「每个周一…你在遭遇战里尖叫，她必定出现替你解围」
			   （MyModNote），所以这两项是按周一次，不是一生一次：
			     · $jiusiScreamRescueUsed 以前全代码没有任何重置点 → 尖叫救场一生只能触发一次；
			     · $jiusiRescueUsed 以前只在 giveWeeklyAmmo() 里重置，而那条要求好感 ≥10 →
			       好感不够时它永远停在 1，周一自动救场也变成一生一次。
			   这里放在周一无条件重置（不依赖送礼是否发放）。 */
			if (num(Time.weekDay) === 2) {
				V.jiusiRescueUsed = 0;
				V.jiusiScreamRescueUsed = 0;
			}
		} catch (e) { fs.warn('每日事件失败: ' + e.message); }
	});

	/* ---------- 死亡 / 失踪的 NPC 不再出场（原 named-npc.js 补丁） ---------- */
	fs.wrapNpcFunctions = function () {
		var ok = [];
		try {
			if (typeof window.statusCheck === 'function' && !window.statusCheck.__fsWrapped) {
				var orig = window.statusCheck;
				var wrapped = function (name) {
					try {
						var nnpc = (typeof C !== 'undefined' && C.npc) ? C.npc[name] : null;
						if (nnpc && (nnpc.state === 'dead' || nnpc.state === 'missing')) {
							/* 与原补丁一致：跳过该 NPC 的日程/状态刷新，直接返回 */
							if (V.debug === 0) { T[String(name).toLowerCase()] = nnpc; }
							return nnpc;
						}
					} catch (e) { }
					return orig.apply(this, arguments);
				};
				wrapped.__fsWrapped = 1;
				window.statusCheck = wrapped;
				ok.push('statusCheck');
			}
			if (typeof window.npcCanHunt === 'function' && !window.npcCanHunt.__fsWrapped) {
				var origHunt = window.npcCanHunt;
				var wrappedHunt = function (npc) {
					try {
						if (typeof npc === 'string' && (V.NPCNameList || []).includes(npc) && C.npc[npc]) {
							var st = C.npc[npc].state;
							if (st === 'dead' || st === 'missing') return false;
						}
					} catch (e) { }
					return origHunt.apply(this, arguments);
				};
				wrappedHunt.__fsWrapped = 1;
				window.npcCanHunt = wrappedHunt;
				ok.push('npcCanHunt');
			}
		} catch (e) { fs.warn('NPC 函数接管失败: ' + e.message); }
		if (ok.length) fs.log('已接管原版函数：' + ok.join(' / '));
		return ok;
	};

	/* ---------- 媚药改造：性奋"额外附加一次"（接管原 stat-changes.js 的 JS 补丁） ----------
	   为什么改成运行时：ReplacePatcher 在「JS 被编译进 HTML」的整合包里按文件名找不到 stat-changes.js，
	   那条补丁会**静默失效**（同一个原因让周子弹/收枪/免租都挪到了本文件）。而这个特质是赌场吃药事件
	   直接发到 $backgroundTraits 里的，玩家拿到特质却没有任何效果。
	   做法：包住 statChange.arousal —— 增加时把同一套公式再走一遍（等价于"附加一次"），
	   其它参数、其它来源一律不动；用 __fsAphroWrapped 做幂等，防止重复套壳。 */
	fs.wrapAphrodisiac = function () {
		try {
			var sc = (typeof window !== 'undefined') ? window.statChange : null;
			if (!sc || typeof sc.arousal !== 'function') return false;
			if (sc.arousal.__fsAphroWrapped) return true;
			var orig = sc.arousal;
			var wrapped = function (amount, source) {
				var r = orig.apply(this, arguments);
				try {
					if (Number(amount) > 0 && Array.isArray(V.backgroundTraits) &&
						V.backgroundTraits.indexOf('媚药改造') !== -1) {
						orig.call(this, amount, source);
					}
				} catch (e) { }
				return r;
			};
			wrapped.__fsAphroWrapped = 1;
			sc.arousal = wrapped;
			fs.log('已接管 statChange.arousal（媚药改造：性奋额外附加一次）');
			return true;
		} catch (e) { fs.warn('接管性奋入口失败: ' + e.message); return false; }
	};

	/* DoL 的 JS 在页面加载时同步执行，这里再多挂一次兜底（有些版本会晚一步定义） */
	fs.wrapNpcFunctions();
	if (fs.onInit) fs.onInit(function () { fs.repairStats(); fs.wrapNpcFunctions(); fs.corpseEntry(); fs.wrapAphrodisiac(); });

	/* ---------- 数值自愈：把 NaN / 非法上限修回合理值（例如旧版造成 pain=NaN 的存档） ---------- */
	fs.repairStats = function () {
		try {
			if (typeof V === 'undefined' || !V) return;
			/* ⚠️ `painmax` 在**原版里根本不存在**（全仓 0 处），但疼痛确实有一个真实上限：
			   stat-changes.js 的 `painClamp()` 写的是 `Math.clamp(V.pain, minPain(), 200)` ——
			   **硬上限 200**。另外 `$pain gte 100` 是原版到处在用的"痛到极点"**阈值**（不是上限）。
			   这里原来把 painmax 造成 1000，于是以它为准的判据全部失真
			   （战败 −5 理智要求 `pain >= 850` → 永不触发；洞穴战败恢复把疼痛设成 400 = 上限的 2 倍）。
			   现在按真实上限 200 造，并把旧档里的 1000 / 我一度错写的 100 都迁移过来。 */
			var defaults = { painmax: 200, stressmax: 1000, traumamax: 1000, arousalmax: 1000, fatiguemax: 1000, willpower: 100, willpowermax: 100 };
			var fixed = [];
			if (Number(V.painmax) === 1000 || Number(V.painmax) === 100) { V.painmax = 200; fixed.push('painmax(旧档迁移到真实上限 200)'); }
			if (Number(V.pain) > 200) { V.pain = 200; fixed.push('pain(超过原版上限 200 已夹紧)'); }
			Object.keys(defaults).forEach(function (k) {
				if (typeof V[k] !== 'number' || !isFinite(V[k]) || V[k] <= 0) { V[k] = defaults[k]; fixed.push(k); }
			});
			['pain', 'stress', 'trauma', 'arousal', 'tiredness', 'willpower'].forEach(function (k) {
				if (V[k] === undefined) return;
				if (typeof V[k] !== 'number' || !isFinite(V[k]) || V[k] < 0) { V[k] = 0; fixed.push(k); }
			});
			if (fixed.length) fs.log('数值自愈：' + fixed.join(' / '));
		} catch (e) { }
	};

	/* ---------- 埋尸流程入口（0.5.11.9 没有原版埋尸拖行，原补丁锚点不存在 → 由本钩子接管） ---------- */
	fs.corpseEntry = function () {
		try {
			if (typeof V === 'undefined' || !V) return;
			if (Number(V.corpsePending) !== 1) return;
			var p = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || '';
			if (/^FS Corpse/.test(p)) return;                     /* 已经在流程里，避免死循环 */
			/* ⚠️ 这里原来判的是 `V.fsCorpseNoDrag` —— **全仓没有任何地方写过这个字段**，
			   真正的开关是 `V.fs_noCorpseDrag`（由设置面板写入，fs.opt('noCorpseDrag') 读它）。
			   结果：开着「杀人不埋尸」用枪打死人，照样每次进段落都被拽进 FS Corpse Start。 */
			var _noDrag = (typeof fs.opt === 'function') ? fs.opt('noCorpseDrag') : (V.fs_noCorpseDrag === true);
			if (_noDrag) { V.corpsePending = 0; V.fsCorpsePending = 0; return; }   /* 设置里勾了"杀人不埋尸" */
			V.corpsePending = 0;
			V.fsCorpsePending = 1;
			fs.log('触发埋尸流程（原版该版本无此功能，由终星接管）');
			/* passageinit 期间不能直接跳转（会被忽略）→ 放到下一个事件循环 */
			setTimeout(function () { try { SugarCube.Engine.play('FS Corpse Start'); } catch (e) { fs.warn('跳转埋尸失败: ' + e.message); } }, 0);
		} catch (e) { }
	};

	fs.log('旧版 JS 补丁功能已内置（每周子弹 / 次日收枪 / 贝利免租 / 死亡NPC屏蔽）');
})();
