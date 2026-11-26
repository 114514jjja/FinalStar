/* ============================================================
   终星 FinalStar —— 手枪手持物化 + 战斗面板操作（规划书 68 ~ 79 / 83）
   68  手枪改为手持物品（与魔书同一套装备槽逻辑）
   70  战斗中在界面最下方用折叠表格显示手枪 / 魔书使用情况
   78  射击按钮迁移到下方物资面板（选择射击 / 休息）
   79  一次射击完成伤害判定；可随时「停止使用」
   83  手持物里没有魔书 / 制式手枪时，面板不显示
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	fs.pistolItemName = '制式手枪';

	/* ---------- 68 手枪作为手持物注入 ---------- */
	/* 手枪物品在部分客户端/汉化包里会被按 variable 回退显示成原版「赤裸」，
	   所以识别与字段修正都按 名称 / variable / 图标 / 介绍 四重判定 */
	fs.pistolDesc = '一把来源不明的制式手枪，握把被磨得发亮。保险很轻，扣下去的时候几乎没有阻力。';
	fs.isPistolEntry = function (it) {
		try {
			if (!it) return false;
			if (it.name === fs.pistolItemName || it.name_cap === fs.pistolItemName) return true;
			if (it.variable === fs.pistolItemName) return true;
			if (it.iconFile === 'finalstar/pistol-standard.png') return true;
			if (it.description && String(it.description).indexOf('制式手枪') !== -1) return true;
		} catch (e) { }
		return false;
	};
	fs.repairPistolEntry = function (it) {
		try {
			if (!it) return false;
			it.name = fs.pistolItemName;
			it.name_cap = fs.pistolItemName;
			it.variable = fs.pistolItemName;
			it.slot = 'handheld';
			it.iconFile = 'finalstar/pistol-standard.png';
			it.description = fs.pistolDesc;
			/* 旧存档里那把也要给对特质标签 —— 否则它是老值（['normal']），永远显示不出来 */
			it.type = ['miracle'];   /* 英文标识符给系统；中文显示名由 framework.js 挂进 setup.shopDetails */
			/* 汉化模组的衣柜读 cn_name_cap，缺了会显示「服装中文属性缺失」 */
			it.cn_name = fs.pistolItemName;
			it.cn_name_cap = fs.pistolItemName;
			it.cn_description = fs.pistolDesc;
			return true;
		} catch (e) { return false; }
	};
	fs.pistolItemIndex = function () {
		try {
			if (!setup || !setup.clothes || !setup.clothes.handheld) return -1;
			for (var i = 0; i < setup.clothes.handheld.length; i++) {
				if (fs.isPistolEntry(setup.clothes.handheld[i])) return i;
			}
		} catch (e) { }
		return -1;
	};
	fs.ensurePistolItem = function () {
		try {
			if (!setup || !setup.clothes || !setup.clothes.handheld) return false;
			var idx = fs.pistolItemIndex();
			if (idx !== -1) {
				/* 已存在：每次启动都修正名称与介绍（防旧版残留 / 汉化回退成「赤裸」） */
				fs.repairPistolEntry(setup.clothes.handheld[idx]);
				setup.clothes.handheld[idx].index = idx;
				fs.repairWornPistol();
				return true;
			}
			var base = window.clone ? clone(setup.clothes.handheld[0]) : Object.assign({}, setup.clothes.handheld[0]);
			base.index = setup.clothes.handheld.length;
			base.slot = 'handheld';
			base.name = fs.pistolItemName;
			base.name_cap = fs.pistolItemName;
			base.variable = fs.pistolItemName;
			base.description = fs.pistolDesc;
			base.cost = 120000;
			base.integrity = 300;
			base.integrity_max = 300;
			base.fabric_strength = 20;
			base.reveal = 100;
			base.word = 'a';
			base.plural = 0;
			base.colour = 0;
			base.colour_options = [];
			base.colour_sidebar = 0;
			/* 旧存档里那把也要给对特质标签 */
			base.type = ['miracle'];
			base.gender = 'n';
			base.femininity = 0;
			base.warmth = 0;
			base.shop = [];
			base.accessory = 1;
			base.accessory_colour = 0;
			base.accessory_colour_options = [];
			base.back_img = 1;
			base.back_img_acc = 0;
			base.cursed = 0;
			base.location = 0;
			base.iconFile = 'finalstar/pistol-standard.png';
			base.accIcon = 0;
			base.zIndex = 'handheld_over_sleeve';
			base.coverBackImage = 0;
			fs.repairPistolEntry(base);
			setup.clothes.handheld.push(base);
			fs.repairWornPistol();
			if (window.modFixClothesCn) window.modFixClothesCn();
			fs.log('已注入手持物：' + fs.pistolItemName);
			return true;
		} catch (e) {
			fs.warn('注入手枪手持物失败: ' + e.message);
			return false;
		}
	};
	/* 手上那件如果是手枪（可能被显示成「赤裸」），把字段补齐，保证判定与显示一致 */
	fs.repairWornPistol = function () {
		try {
			if (fs.pistolItemIndex() === -1 || !V.worn) return false;
			var keys = ['handheld', 'handheld2'], fixed = false;
			for (var i = 0; i < keys.length; i++) {
				var w = V.worn[keys[i]];
				if (w && fs.isPistolEntry(w)) {
					w.name = fs.pistolItemName;
					w.name_cap = fs.pistolItemName;
					w.variable = fs.pistolItemName;
					w.iconFile = 'finalstar/pistol-standard.png';
					if (!w.description || String(w.description).indexOf('制式手枪') === -1) w.description = fs.pistolDesc;
					w.cn_name = fs.pistolItemName;
					w.cn_name_cap = fs.pistolItemName;
					w.cn_description = w.description;
					fixed = true;
				}
			}
			return fixed;
		} catch (e) { return false; }
	};

	/* ---------- 手持判断 ---------- */
	fs.slotName = function (key) {
		try {
			var w = V.worn && V.worn[key];
			return w && w.name ? w.name : '';
		} catch (e) { return ''; }
	};
	/* 槽位是否空着（原版空手物品名为 naked，汉化显示为「赤裸」） */
	fs.slotEmpty = function (key) {
		var n = fs.slotName(key);
		return n === '' || n === 'naked' || n === '赤裸' || n === '空手';
	};
	fs.slotHolds = function (key, name) {
		var n = fs.slotName(key);
		return n === name;
	};
	/* 槽位里是不是那把手枪（不依赖名字，防止显示成「赤裸」时误判） */
	fs.slotIsPistol = function (key) {
		try { return fs.isPistolEntry(V.worn && V.worn[key]); } catch (e) { return false; }
	};
	/* 手枪是否在手（主手 / 另一只手都算） */
	fs.pistolInHand = function () {
		try {
			fs.repairWornPistol();
			var inHand = fs.slotIsPistol('handheld') || fs.slotIsPistol('handheld2');
			if (!inHand) return false;
			/* 手上真有枪但剧情标记丢了（旧档 / 被抢后残留）→ 补回标记 */
			if (Number(V.pistolOwned) !== 1) V.pistolOwned = 1;
			return true;
		} catch (e) { return false; }
	};
	fs.handHasPistol = function () { return fs.pistolInHand(); };
	fs.pistolHandKey = function () {
		if (fs.slotIsPistol('handheld')) return 'handheld';
		if (fs.slotIsPistol('handheld2')) return 'handheld2';
		return null;
	};
	/* 装备 / 收起（68 的物品形式；停止使用 = 收回手里那把） */
	fs.equipPistol = function (key) {
		try {
			fs.ensurePistolItem();
			var idx = fs.pistolItemIndex();
			if (idx === -1) return false;
			var slot = (key === 'handheld2') ? 'handheld2' : 'handheld';
			if (slot === 'handheld2' && (!V.worn || V.worn.handheld2 === undefined)) return false;
			V.worn[slot] = window.clone ? clone(setup.clothes.handheld[idx]) : setup.clothes.handheld[idx];
			V.pistolOwned = 1;
			fs.ensurePistolInWardrobe();
			fs.refreshPanel();
			return true;
		} catch (e) { fs.warn('装备手枪失败: ' + e.message); return false; }
	};
	fs.unequipPistol = function () {
		try {
			var key = fs.pistolHandKey();
			if (!key) return false;
			V.worn[key] = window.clone ? clone(setup.clothes.handheld[0]) : setup.clothes.handheld[0];
			fs.log('已停止使用手枪（收回手中那把）');
			fs.refreshPanel();
			return true;
		} catch (e) { return false; }
	};
	/* 确保手枪出现在**衣柜的可选列表**里。
	   为什么需要：衣柜列表来自 selectWardrobe() → V.wardrobe（玩家拥有的衣服），
	   而我们的枪只进了 setup.clothes（全局定义）与 V.worn（身上）。
	   于是「卸下」之后身上空了、列表里又没有它 —— 玩家看到的就是"枪不见了"，
	   但 $pistolOwned 还是 1（魔女小屋照旧显示有）。这条补上缺失的那一环。
	   幂等：已经在列表里就不重复加。 */
	fs.ensurePistolInWardrobe = function () {
		try {
			if (Number(V.pistolOwned) !== 1) return false;
			fs.ensurePistolItem();
			var idx = fs.pistolItemIndex();
			if (idx === -1) return false;
			V.wardrobe = V.wardrobe || {};
			if (!Array.isArray(V.wardrobe.handheld)) V.wardrobe.handheld = [];
			var list = V.wardrobe.handheld;
			for (var i = 0; i < list.length; i++) { if (fs.isPistolEntry(list[i])) return false; }
			list.push(window.clone ? clone(setup.clothes.handheld[idx]) : setup.clothes.handheld[idx]);
			fs.log('已把手枪放进衣柜列表（这样「卸下」之后还能从列表里重新装备）');
			return true;
		} catch (e) { fs.warn('把手枪放进衣柜失败: ' + e.message); return false; }
	};
	/* 拥有手枪且手上空着时自动握在手里（每个存档只自动装备一次，避免覆盖玩家的收起操作） */
	fs.autoHoldPistol = function () {
		try {
			if (Number(V.pistolOwned) !== 1) return false;
			if (fs.pistolInHand()) { V.fs_pistolAutoHeld = 1; return false; }
			if (Number(V.fs_pistolAutoHeld) === 1) return false;
			/* 优先装进【手持物】（玩家最先看的地方），空着就握上 */
			if (fs.slotEmpty('handheld') && fs.equipPistol('handheld')) { V.fs_pistolAutoHeld = 1; return true; }
			if (fs.slotEmpty('handheld2') && fs.equipPistol('handheld2')) { V.fs_pistolAutoHeld = 1; return true; }
			return false;
		} catch (e) { return false; }
	};

	/* ---------- 78/79 面板操作 ---------- */
	fs.canShoot = function () {
		if (!fs.pistolInHand()) return false;
		if (Number(V.pistolAmmo) > 0) return true;
		return fs.bulletCount(fs.activeBullet()) > 0;
	};
	/* 开一枪：只消耗一发（弹仓优先，空仓则从当前子弹的备弹里自动上膛一发），
	   伤害完全按当前子弹类型结算 —— 动作区与面板都走这一条路。
	   返回 { ok, key, name, damage, kill, chamber, spare } */
	fs.shootOnce = function () {
		/* 必须在真正的遭遇战里（旧版只查枪在不在手上 → 能对空气开枪） */
		if (!fs.inFight()) return { ok: false, reason: 'notInFight' };
		try {
			if (!fs.pistolInHand()) return { ok: false, reason: 'notInHand' };
			var key = fs.activeBullet();
			var b = fs.bullets[key] || { name: '子弹', damage: 300, kill: false };
			var chamber = Number(V.pistolAmmo) || 0;
			/* 弹药节省：15% 概率不消耗这一发（空仓上膛同样适用） */
			var savedAmmo = false;
			try { savedAmmo = !!(fs.talentHas && fs.talentHas('c7') && Math.random() < 0.15); } catch (e) { }
			if (chamber > 0) {
				if (!savedAmmo) V.pistolAmmo = chamber - 1;
			} else if (fs.bulletCount(key) > 0) {
				/* 空仓：从备弹里上一发（也只扣一发） */
				if (!savedAmmo) fs.useBullet(key, 1);
			} else {
				return { ok: false, reason: 'noAmmo', key: key, name: b.name };
			}
			return {
				ok: true, key: key, name: b.name,
				damage: Number(b.damage) || 300,
				kill: !!b.kill,
				chamber: Number(V.pistolAmmo) || 0,
				spare: fs.bulletCount(key),
				savedAmmo: savedAmmo
			};
		} catch (e) {
			fs.warn('开枪结算失败: ' + e.message);
			return { ok: false, reason: 'error' };
		}
	};
	fs.panelLog = function (text) {
		try {
			V.fs_panelLog = text || '';
			if (text) fs.log('[面板] ' + String(text).replace(/<[^>]*>/g, '').slice(0, 80));
		} catch (e) { }
	};
	/* 射击：一次消耗一发，造成当前子弹的伤害；雕纹子弹可击杀已命名角色 */
	fs.panelShoot = function () {
		try {
			if (!fs.pistolInHand()) { fs.panelLog('<span class="red">制式手枪不在手上。</span>'); return { ok: false, reason: 'notInHand' }; }
			var shot = fs.shootOnce();
			if (!shot.ok) { fs.panelLog('<span class="red">弹仓是空的，也没有备弹了。</span>'); return shot; }
			var bdef = { name: shot.name, damage: shot.damage, kill: shot.kill };

			var target = (V.NPCList && V.NPCList[0]) || null;
			var tname = target && target.fullDescription ? target.fullDescription : null;
			var named = !!(tname && V.NPCNameList && V.NPCNameList.indexOf(tname) !== -1);
			var dmg = Number(bdef.damage) || 300;
			var killed = false;

			if (named && !bdef.kill) {
				/* 普通子弹打不死有名有姓的人，但足够让对方退缩 */
				dmg = Math.min(dmg, 200);
			}
			V.enemyhealth = (Number(V.enemyhealth) || 0) - dmg;

			if (named && bdef.kill) {
				killed = true;
				V.pistolKillName = tname;
				var idx = V.NPCNameList.indexOf(tname);
				if (idx !== -1 && V.NPCName[idx]) {
					var npc = V.NPCName[idx];
					['love', 'lust', 'dom', 'trust', 'trauma', 'rage', 'purity', 'corruption', 'obsession', 'obedience', 'hatred', 'jealousy', 'sub', 'devotion', 'fear', 'harmony', 'ferocity'].forEach(function (k) {
						if (npc[k] !== undefined) npc[k] = 0;
					});
					npc.state = 'dead';
					npc.init = 1;
					V.NPCDead = V.NPCDead || {};
					V.NPCDead[tname] = 1;
				}
				if (tname === 'Bailey') {
					V.baileyShot = 1;
					V.baileyRentSkipDays = 9999;
					V.fs_baileyShotDay = 0;
				}
				V.corpsePending = 1;
				V.fsCorpsePending = 1;
				V.fsKilled = 1;          /* 明确的「真的杀了人」标记 —— 埋尸只认它 */
				fs.panelLog('<span class="red">' + tname + '被' + bdef.name + '击穿了。ta倒下去的时候没有发出声音。</span>');
			} else if (Number(V.enemyhealth) <= 0) {
				V.corpsePending = 1;
				V.fsCorpsePending = 1;
				V.fsKilled = 1;          /* 明确的「真的杀了人」标记 —— 埋尸只认它 */
				fs.panelLog('<span class="red">' + (tname || '对方') + '倒了下去，不再动弹。你用掉了 1 发' + bdef.name + '。</span>');
			} else {
				fs.panelLog('<span class="gold">枪声在狭窄的空间里炸开。你打中了' + (tname || '对方') + '，造成 ' + dmg + ' 点伤害。</span>');
			}
			fs.refreshPanel();
			/* ⚠️ 这里原来返回 { bullet: <一个从未声明的标识符> }。
			   本文件是 'use strict'，于是每次开枪都在这里抛 ReferenceError：
			   异常被下面的 catch 吞掉、整个函数返回 {ok:false} ——
			   扣弹、扣血、击杀标记其实都已经结算了，但段落里的 <<if _r.ok>> 恒假，
			   「弹仓 X 发 · 本次伤害 X 点」永远不显示，控制台每次射击刷一条警告。
			   现在取 shot.key（fs.shootOnce 真实返回的字段）。 */
			return { ok: true, dmg: dmg, named: named, killed: killed, bullet: shot.key || '', ammo: V.pistolAmmo };
		} catch (e) {
			fs.warn('面板射击失败: ' + e.message);
			return { ok: false, reason: 'error' };
		}
	};
	/* 休息：不收枪，喘口气（小幅恢复） */
	fs.panelRest = function () {
		try {
			if (typeof V.pain === 'number') V.pain = Math.max(0, V.pain - 40);
			if (typeof V.stress === 'number') V.stress = Math.max(0, V.stress - 40);
			V.fs_panelRests = (Number(V.fs_panelRests) || 0) + 1;
			fs.panelLog('<span class="teal">你垂下手，靠着墙喘了几口气。疼痛与压力略微退去。</span>');
			fs.refreshPanel();
			return { ok: true };
		} catch (e) { return { ok: false }; }
	};
	/* 停止使用：把手枪收回手里那把 */
	fs.panelStop = function () {
		fs.unequipPistol();
		fs.panelLog('<span class="grey">你把手枪收回腰间。剩下的账，用拳头算。</span>');
		fs.refreshPanel();
		return { ok: true };
	};
	/* 面板按钮的 HTML（已按玩家要求取消：射击/魔法按钮回归左右手动作，面板只做信息展示） */
	fs.panelActionButtons = function () { return ''; };

	/* ================= 衣柜「另一只手」槽位：装备 / 卸下 =================
	   问题记录：「在另一只手那栏把手枪脱了，直接找不到了，但魔女小屋又显示我还有枪。」
	   根因：这个槽位是模组自建的，它的 <a onclick> 只改了 $worn.handheld2，
	     · 卸下时没有把东西**放回 $wardrobe.handheld**（原版衣柜是靠这个列表显示可装备物），
	     · 装备时也没有把它**从列表里拿走**（和原版衣柜语义相反，会重复）。
	   所以脱下来之后列表里没有它 → 「找不到」；而 $pistolOwned 还是 1 → 魔女小屋照旧说你有枪。
	   现在照原版语义补齐：穿 = 从列表拿走，脱 = 放回列表；并刷新一次衣柜段落。 */
	function _sameItem(a, b) {
		try {
			if (!a || !b) return false;
			if (a.variable && b.variable) return a.variable === b.variable;
			return String(a.name) === String(b.name);
		} catch (e) { return false; }
	}
	fs.refreshWardrobe = function () {
		try {
			/* 重放当前段落让界面立刻反映「穿上/脱下」。
			   ⚠️ 衣柜的分栏是 $lastWardrobeSlot 决定的：不先把它设回 handheld2，
			   重放会退回默认的「服饰套装」总览页（验证过一次）。 */
			try { if (V) V.lastWardrobeSlot = 'handheld2'; } catch (e) { }
			setTimeout(function () {
				try { SugarCube.Engine.play(SugarCube.State.passage); } catch (e) { }
			}, 0);
		} catch (e) { }
	};
	fs.equipHandheld2 = function (item) {
		try {
			fs.ensureData();
			if (!item) return false;
			V.worn = V.worn || {};
			V.worn.handheld2 = window.clone ? window.clone(item) : item;
			V.wardrobe = V.wardrobe || {};
			if (!Array.isArray(V.wardrobe.handheld)) V.wardrobe.handheld = [];
			for (var i = V.wardrobe.handheld.length - 1; i >= 0; i--) {
				if (_sameItem(V.wardrobe.handheld[i], item)) { V.wardrobe.handheld.splice(i, 1); break; }
			}
			if (fs.slotIsPistol && fs.slotIsPistol('handheld2')) V.pistolOwned = 1;
			fs.log('另一只手：装备 ' + (item.name || '物品'));
			fs.refreshWardrobe();
			return true;
		} catch (e) { fs.warn('装备到另一只手失败: ' + e.message); return false; }
	};
	fs.unequipHandheld2 = function () {
		try {
			fs.ensureData();
			V.worn = V.worn || {};
			var cur = V.worn.handheld2;
			if (cur && cur.name && cur.name !== 'naked') {
				V.wardrobe = V.wardrobe || {};
				if (!Array.isArray(V.wardrobe.handheld)) V.wardrobe.handheld = [];
				var dup = false;
				for (var i = 0; i < V.wardrobe.handheld.length; i++) {
					if (_sameItem(V.wardrobe.handheld[i], cur)) { dup = true; break; }
				}
				if (!dup) V.wardrobe.handheld.push(window.clone ? window.clone(cur) : cur);
				fs.log('另一只手：卸下 ' + (cur.name || '物品') + '（已放回衣柜）');
			}
			V.worn.handheld2 = window.clone ? window.clone(setup.clothes.handheld[0]) : setup.clothes.handheld[0];
			if (fs.ensurePistolInWardrobe) fs.ensurePistolInWardrobe();
			fs.refreshWardrobe();
			return true;
		} catch (e) { fs.warn('卸下失败: ' + e.message); return false; }
	};

	fs.log('手枪手持物模块已加载（面板只显示子弹与魔法信息，动作用左右手按钮）');
	fs.register('item', function () {
		fs.ensurePistolItem();
		fs.autoHoldPistol();
		/* 拿到手枪后（剧情里 $pistolOwned 变为 1）自动握一次 */
		if (fs.onInit) {
			fs.onInit(function () {
				try {
					if (Number(V.pistolOwned) === 1 && Number(V.fs_pistolAutoHeld) !== 1) fs.autoHoldPistol();
		if (fs.ensurePistolInWardrobe) fs.ensurePistolInWardrobe();
				} catch (e) { }
			});
		}
	});

})();
