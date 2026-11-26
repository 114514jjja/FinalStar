/* ============================================================
   终星 FinalStar —— 设置：区域注入 / 开关生效 / 见证者特质
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	fs.initSettings = function () {
		fs.ensureData();
		fs.log('设置模块已加载（侧边栏按钮 / 布告板入口 / 特质分组）');
	};

	/* ---------- 侧边栏「模组设置」按钮（白框 + 文字，直接写进侧边栏 DOM） ---------- */
	fs.injectSidebarButton = function () {
		try {
			if (V.fs_sidebarIcon === false) return false;
			if (document.getElementById('fs-sidebar-btn')) return true;
			/* 找到「存档 / SAVES」按钮（不依赖具体容器 id，桌面/移动端都适用） */
			var all = document.querySelectorAll('button, input[type=button]');
			var saveBtn = null;
			Array.prototype.forEach.call(all, function (b) {
				if (saveBtn) return;
				var label = ((b.value || b.textContent || '') + '').trim();
				if (/^(存档|SAVES|Save)$/i.test(label)) saveBtn = b;
			});
			var wrap = document.createElement('div');
			wrap.className = 'sidebarButtonSplit';
			wrap.id = 'fs-sidebar-split';
			var btn = document.createElement('input');
			btn.type = 'button';
			btn.id = 'fs-sidebar-btn';
			btn.className = 'saveMenuButton fs_sidebar_btn';
			btn.value = '模组设置';
			btn.title = '终星 · 模组设置';
			btn.setAttribute('onclick', 'finalStar.openSettings()');
			wrap.appendChild(btn);
			btn.value = '模组设置';
			btn.title = '终星 · 模组设置（点开可开关各项功能）';
			if (saveBtn && saveBtn.parentNode) {
				/* 需求：独立一行、位于「存档」下方 → 新建一行插在存档所在行的后面 */
				var row = saveBtn.parentNode;
				var host = row.parentNode || row;
				var newRow = document.createElement('div');
				newRow.className = 'sidebarButtonSplit fs_sidebar_row';
				newRow.id = 'fs-sidebar-split';
				newRow.appendChild(btn);
				host.insertBefore(newRow, row.nextSibling);
				wrap.remove();
				return true;
			}
			/* 兜底：挂到侧边栏容器或页面右下角 */
			var host = document.getElementById('storyCaptionDiv') || document.getElementById('ui-bar-body') || document.querySelector('#ui-bar');
			if (host) { host.appendChild(wrap); return true; }
			return false;
		} catch (e) {
			fs.warn('侧边栏按钮注入失败: ' + e.message);
			return false;
		}
	};
	/* 侧边栏会随段落重建，多次重试确保按钮在 */
	fs.ensureSidebarButton = function (tries) {
		tries = tries || 0;
		if (fs.injectSidebarButton()) return;
		if (tries < 6) setTimeout(function () { fs.ensureSidebarButton(tries + 1); }, 150);
	};

	/* ---------- 见证者特质：由段落替换写进「特质」页分组，这里只同步存档标记 ---------- */
	fs.registerTrait = function () { return true; };
	fs.grantWitness = function () {
		try {
			fs.ensureData();
			V.fsData.witness = true;
			if (!Array.isArray(V.backgroundTraits)) V.backgroundTraits = [];
			if (V.backgroundTraits.indexOf('见证者') === -1) V.backgroundTraits.push('见证者');
			return true;
		} catch (e) { return false; }
	};

	/* ---------- 开关查询（供其它模块与 twee 使用） ---------- */
	fs.opt = function (key) {
		try {
			switch (key) {
				case 'noCorpseDrag': return V.fs_noCorpseDrag === true;
				case 'freeCasino': return V.fs_freeCasino === true;
				case 'freeEncounter': return V.fs_freeEncounter === true;
				case 'casinoMaster': return V.fs_casinoMaster === true;
				case 'undying': return V.fs_undying === true;
				case 'combatPanel': return V.fs_combatPanel !== false;
				case 'sidebarIcon': return V.fs_sidebarIcon !== false;
			}
		} catch (e) { }
		return false;
	};

	/* ---------- 战斗收尾：杀人不埋尸 / 不死族 ---------- */
	fs.onCombatEnd = function () {
		try {
			fs.ensureData();
			/* 杀人不埋尸：直接清掉待拖尸标记 */
			if (fs.opt('noCorpseDrag') && V.corpsePending) {
				V.corpsePending = 0;
				V.corpseBody = null;
				fs.log('杀人不埋尸：已跳过拖尸环节');
			}
			/* 不死族：清理战败接走标记 */
			if (fs.opt('undying')) {
				V.fs_noDefeatTransfer = 1;
			} else {
				V.fs_noDefeatTransfer = 0;
			}
			/* 112：杀死遭遇战敌人 → 埋尸环节（两名以上敌人时其他人逃跑，无需埋尸） */
			if (typeof fs.corpseOnCombatEnd === 'function') fs.corpseOnCombatEnd();
		} catch (e) {
			fs.warn('战斗收尾处理失败: ' + e.message);
		}
	};

	/* ---------- 反击刻印：受到伤害时反伤（由战斗效果钩子调用） ---------- */
	fs.onPlayerHurt = function () {
		try {
			if (fs.equippedSeal() !== 'counter') return;
			if (typeof V.enemyhealth !== 'number') return;
			V.enemyhealth -= 50;
			fs.log('反击刻印触发：敌人 -50');
		} catch (e) { }
	};

	/* ---------- 炼金刻印：金钱获取加成（含「炼金大能」= 必定触发） ---------- */
	fs.alchemyTriggerText = function (kind) {
		try {
			if (kind === 'double') {
				V.fs_castHtml = '<span class="gold">魔书的纸页轻轻一颤，炼金刻印浮起一层薄薄的金光——'
					+ '瓶中的液体晃了一下，你手里的钱<span class="gold">多了一倍</span>。</span>';
			} else {
				V.fs_castHtml = '<span class="gold">炼金刻印在书页上亮起，金色的流光滑过你的指尖——'
					+ '这一次，钱<span class="gold">没有少</span>。</span>';
			}
		} catch (e) { }
	};
	/* 炼金刻印：金钱变动监听（原版没有统一的加钱钩子，改为每次段落刷新对比余额）
	   收钱 → 判定双倍；花钱 → 判定返还。炼金大能开启则必定触发。 */
	fs.alchemyWatch = function () {
		try {
			if (typeof V === 'undefined' || !V) return;
			var cur = Number(V.money) || 0;
			if (fs._alchemyLast === undefined) { fs._alchemyLast = cur; return; }
			var d = cur - fs._alchemyLast;
			fs._alchemyLast = cur;
			if (!d) return;
			if (fs.equippedSeal() !== 'alchemy') return;
			var master = V.fs_alchemyMaster === true;
			if (d > 0) {                                   /* 收到钱 */
				if (master || Math.random() < 0.1) {
					V.money = cur + d;                      /* 双倍：再加一份 */
					fs._alchemyLast = V.money;
					fs.alchemyTriggerText('double');
					fs.log('炼金刻印触发：收钱双倍 +' + d);
				} else if (Math.random() < 0.2) {
					fs.alchemyTriggerText('free');
					fs.log('炼金刻印触发：额外赏金（本次收入翻倍前的白拿）');
				}
			} else {                                        /* 花了钱 */
				if (master || Math.random() < 0.2) {
					V.money = cur - d;                      /* 返还 */
					fs._alchemyLast = V.money;
					fs.alchemyTriggerText('free');
					fs.log('炼金刻印触发：本次消费未扣除 ' + (-d));
				}
			}
		} catch (e) { }
	};
	/* 兼容旧调用：仍保留原函数 */
	fs.alchemyModify = function (amount) {
		try {
			if (fs.equippedSeal() !== 'alchemy') return amount;
			var master = V.fs_alchemyMaster === true;                 /* 炼金大能：必定触发 */
			if (master || Math.random() < 0.1) {                       /* 双倍 */
				fs.alchemyTriggerText('double');
				fs.log('炼金刻印触发：双倍' + (master ? '（炼金大能）' : ''));
				return amount * 2;
			}
			if (Math.random() < 0.2) {                                 /* 不消耗 / 白拿 */
				fs.alchemyTriggerText('free');
				fs.log('炼金刻印触发：本次不消耗金钱');
				return 0;
			}
			return amount;
		} catch (e) { return amount; }
	};

	/* ---------- 菜单化进食（食堂免费套餐 / 咖啡馆付费） ---------- */
	fs.dishTable = {
		'学校套餐': { hunger: 45, price: 0 }, '面包': { hunger: 20, price: 3 }, '土豆': { hunger: 15, price: 2 },
		'蜂蜜': { hunger: 10, price: 4 }, '苹果': { hunger: 12, price: 2 }, '奶酪': { hunger: 18, price: 5 },
		'熟肉': { hunger: 25, price: 8 }, '罐装食物': { hunger: 22, price: 6 }, '巧克力': { hunger: 15, price: 4 },
		'水': { hunger: 3, price: 1 }
	};
	/* 返回 'ok' / 'poor' / 'full' / 'eaten' / 'none' */
	/* 学校套餐一天只供一份（对应原版食堂的午餐时段）；用 Time.days 记天数 */
	fs.canteenUsed = function () {
		try { return Number(V.fs_canteenDay) === Number(Time.days); } catch (e) { return false; }
	};
	fs.eatDish = function (dish) {
		try {
			var d = fs.dishTable[dish];
			if (!d) return 'none';
			if (dish === '学校套餐' && fs.canteenUsed()) return 'eaten';
			if (fs.hunger() >= 100) return 'full';
			if (d.price > 0 && (Number(V.money) || 0) < d.price * 100) return 'poor';
			if (d.price > 0) { V.money = Number(V.money) - d.price * 100; fs._alchemyLast = V.money; }
			fs.hungerAdd(d.hunger);
			if (dish === '学校套餐') { try { V.fs_canteenDay = Number(Time.days); } catch (e) { } }
			fs.log('吃了 ' + dish + '（饥饿 +' + d.hunger + (d.price ? '，花费 £' + d.price : '，免费') + '）');
			return 'ok';
		} catch (e) { return 'error'; }
	};

	/* ---------- 控制台助手 ---------- */
	fs.consoleSeal = function (key) {
		try {
			fs.ensureData();
			V.fsData.seals = Array.isArray(V.fsData.seals) ? V.fsData.seals : [];
			if (V.fsData.seals.indexOf(key) < 0) V.fsData.seals.push(key);
			V.fsData.sealEquipped = key;
			V.magicBook = 1;                                   /* 自动装备魔法书（并把刻印条件改为直接触发） */
			V.fsData.cave = V.fsData.cave || { floor: 1, step: 0, log: [], known: true };
			V.fsCaveActive = 1; V.fsMobHp = 800; V.fsMobName = '控制台召唤的敌人';
			V.combat = 1; V.enemyhealth = 800;
			fs.log('控制台：进入 ' + key + ' 刻印遭遇战');
			return true;
		} catch (e) { return false; }
	};
	fs.consoleGive = function (what, qty) {
		try {
			V.fsData = V.fsData || {};
			V.fsData.consoleItems = V.fsData.consoleItems || {};
			var k = (what === 'potato') ? '土豆' : (what === 'honey' ? '蜂蜜' : what);
			V.fsData.consoleItems[k] = (V.fsData.consoleItems[k] || 0) + qty;
			try { if (typeof V.potato !== 'undefined') V.potato = (Number(V.potato) || 0) + qty; } catch (e) { }
			try { if (typeof V.honey !== 'undefined') V.honey = (Number(V.honey) || 0) + qty; } catch (e) { }
			fs.log('控制台：获得 ' + k + ' ×' + qty);
			return true;
		} catch (e) { return false; }
	};
	fs.consoleStat = function (what, d) {
		try {
			if (what === 'sanity') { fs.sanityAdd(d); return true; }
			V[what] = Math.max(0, (Number(V[what]) || 0) + Number(d || 0));
			fs.log('控制台：' + what + ' ' + d);
			return true;
		} catch (e) { return false; }
	};
	fs.consoleJiusi = function (d) {
		try {
			fs.ensureData();
			/* 真源是原版 NPCName.love；控制台 ± 直接改它，并清掉留奴隶的惩罚 */
			var npc = (typeof fs.jiusiNpc === 'function') ? fs.jiusiNpc() : null;
			var before = (typeof fs.jiusiLove === 'function') ? fs.jiusiLove() : 0;
			if (npc) {
				npc.love = Math.max(0, Math.min(100, num(npc.love) + Number(d || 0)));
				V.fsData.jiusiPenalty = 0;
				V.fsData.jiusiPenaltyWeeks = 0;
				V.fsData.jiusiDisappointed = 0;
			} else {
				V.fsData.jiusiPenalty = Math.max(0, num(V.fsData.jiusiPenalty) - Number(d || 0));
			}
			var after = (typeof fs.jiusiLove === 'function') ? fs.jiusiLove() : 0;
			fs.log('控制台：玖肆好感 ' + before + ' → ' + after);
			return after;
		} catch (e) { return 0; }
	};

	fs.register('settings', function () {
		fs.initSettings();
		/* 侧边栏按钮：每次段落显示后确保存在（侧边栏会随段落重绘） */
		fs.onDisplay(function () { setTimeout(function () { fs.ensureSidebarButton(0); }, 60); });
	});

})();
