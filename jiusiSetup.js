/* 简易深拷贝（普通 JS 上下文里没有 SugarCube 的 clone） */
window.modClone = function (obj) {
	if (Array.isArray(obj)) return obj.map(window.modClone);
	if (obj && typeof obj === "object") {
		var r = {};
		for (var k in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, k)) r[k] = window.modClone(obj[k]);
		}
		return r;
	}
	return obj;
};

window.jiusiEnsure = function () {
	if (!window.C || !C.npc || !window.V || !V.NPCNameList || !window.setup || !setup.baseNNPC) return false;
	if (!Object.prototype.hasOwnProperty.call(C.npc, "玖肆")) {
		/* ⚠️ 实战教训（问题记录的「<<endnpc>> 读 .trust 炸」的成因之一）：
		   Object.defineProperty 不写 enumerable / configurable 时**默认都是 false**。
		   后果：
		     · 不可枚举 → 原版任何 Object.keys(C.npc) / for..in 都**看不到玖肆**，
		       于是走"这个 NPC 没登记"的分支；
		     · 不可配置 → 一旦 Maplebirch（用户装了 v5.4.136）或读档流程**整体换掉 C.npc**，
		       我们这条就没了，而且连重新定义都会抛 Cannot redefine property。
		   原版 <<endnpc>> 第一句就是 C.npc[名字].trust —— C.npc["玖肆"] 一缺就直接炸成
		   「Cannot read properties of undefined (reading 'trust')」。
		   所以这里必须显式写 enumerable: true, configurable: true。 */
		try {
			Object.defineProperty(C.npc, "玖肆", {
				enumerable: true,
				configurable: true,
				get: function () {
					var i = V.NPCNameList.indexOf("玖肆");
					if (i === -1) {
						if (!C.npc._jiusiSafe) {
							C.npc._jiusiSafe = {
								nam: "玖肆", title: "响尾蛇", type: "human",
								pregnancy: {}, pregnancyAvoidance: 100,
								love: 0, lust: 0, dom: 0, trust: 0, trauma: 0,
								rage: 0, purity: 0, corruption: 0, state: "active", init: 1
							};
						}
						return C.npc._jiusiSafe;
					}
					return V.NPCName[i];
				},
				set: function (val) {
					var i = V.NPCNameList.indexOf("玖肆");
					if (i !== -1) V.NPCName[i] = val;
				}
			});
		} catch (e) {
			/* 已经存在但不可配置 → 删不掉也改不了。别让整段注册挂掉，记一笔就够。 */
			try { if (window.finalStar && finalStar.warn) finalStar.warn('C.npc.玖肆 重定义失败：' + e.message); } catch (e2) { }
		}
	}
	var idx = V.NPCNameList.indexOf("玖肆");
	/* 关系字段：重建时要从备份恢复，否则「玖肆好感会重置」。
	   原因：下面那个自愈分支只用 setup.baseNNPC 造一份全新记录，
	   不保留 love/lust/trust —— 只要她的记录变成假值（被游戏或别的模组清掉），好感就归零。
	   注意本文件比 framework.js 先加载，所以这里不能依赖 finalStar.*，只能用 V.fsData。 */
	var REL_KEYS = ["love", "lust", "dom", "trust", "trauma", "rage", "purity", "corruption", "obsession", "devotion", "obedience", "harmony", "ferocity", "fear", "hatred", "jealousy"];
	function jiusiBackup() {
		try { V.fsData = V.fsData || {}; return V.fsData.jiusiNpcBackup || null; } catch (e) { return null; }
	}
	function jiusiSaveBackup(npc) {
		try {
			if (!npc || typeof npc !== 'object') return;
			V.fsData = V.fsData || {};
			var b = V.fsData.jiusiNpcBackup || (V.fsData.jiusiNpcBackup = {});
			var saved = 0;
			for (var i = 0; i < REL_KEYS.length; i++) {
				var k = REL_KEYS[i];
				if (typeof npc[k] === 'number') { b[k] = npc[k]; if (npc[k] > 0) saved++; }
			}
			if (npc.state !== undefined) b.state = npc.state;
		} catch (e) { }
	}
	/* 用备份补齐"新建记录"的关系字段（只补备份里有的，不覆盖已存在的正数） */
	function jiusiRestore(npc) {
		try {
			var b = jiusiBackup();
			if (!b || !npc) return 0;
			var n = 0;
			for (var i = 0; i < REL_KEYS.length; i++) {
				var k = REL_KEYS[i];
				if (typeof b[k] !== 'number') continue;
				if (typeof npc[k] !== 'number' || (Number(npc[k]) === 0 && b[k] !== 0)) { npc[k] = b[k]; n++; }
			}
			return n;
		} catch (e) { return 0; }
	}
	if (idx !== -1 && V.NPCName[idx] && typeof V.NPCName[idx] === 'object') {
		jiusiSaveBackup(V.NPCName[idx]);            /* 每次启动先把现有关系值备份下来 */
	}
	if (idx === -1) {
		var nnpc = Object.assign({}, setup.baseNNPC);
		nnpc.nam = "玖肆";
		nnpc.title = "响尾蛇";
		nnpc.type = "human";
		nnpc.insecurity = "weak";
		nnpc.pronoun = "f";
		nnpc.gender = "f";
		nnpc.hairColour = "white";
		nnpc.eyeColour = "blue";
		nnpc.description = "玖肆";
		nnpc.init = 1;
		nnpc.name_known = 1;
		nnpc.state = "active";
		nnpc.virginity = Object.assign({}, setup.NPCVirginityTypesVirgin || {});
		nnpc.chastity = { penis: "", vagina: "", anus: "" };
		var restored1 = jiusiRestore(nnpc);         /* ← 新建时也从备份恢复 */
		V.NPCName.push(nnpc);
		V.NPCNameList.push("玖肆");
		if (restored1) { try { console.log('[终星] 玖肆记录重建：已从备份恢复 ' + restored1 + ' 项关系值'); } catch (e) { } }
	} else if (!V.NPCName[idx]) {
		var nnpc2 = Object.assign({}, setup.baseNNPC);
		nnpc2.nam = "玖肆";
		nnpc2.title = "响尾蛇";
		nnpc2.type = "human";
		nnpc2.insecurity = "weak";
		nnpc2.pronoun = "f";
		nnpc2.gender = "f";
		nnpc2.hairColour = "white";
		nnpc2.eyeColour = "blue";
		nnpc2.description = "玖肆";
		nnpc2.init = 1;
		nnpc2.name_known = 1;
		nnpc2.state = "active";
		nnpc2.virginity = Object.assign({}, setup.NPCVirginityTypesVirgin || {});
		nnpc2.chastity = { penis: "", vagina: "", anus: "" };
		var restored2 = jiusiRestore(nnpc2);         /* ← 覆盖重建时也从备份恢复（这就是"好感重置"的修复点） */
		V.NPCName[idx] = nnpc2;
		if (restored2) { try { console.log('[终星] 玖肆记录被重建：已从备份恢复 ' + restored2 + ' 项关系值'); } catch (e) { } }
	}
	if (setup.loveAlias && setup.loveAlias["玖肆"] === undefined) {
		setup.loveAlias["玖肆"] = function () { return "好感"; };
	}
	/* 副手持物槽：$worn.handheld2（另一只手） */
	if (V.worn && V.worn.handheld2 === undefined && setup.clothes && setup.clothes.handheld && setup.clothes.handheld[0]) {
		V.worn.handheld2 = window.modClone(setup.clothes.handheld[0]);
	}
	return true;
};

/* 注入 mod 专属手持物：魔法书 */
window.modEnsureHeldItems = function () {
	if (!window.setup || !setup.clothes || !setup.clothes.handheld) return false;
	if (window.modFixClothesCn) window.modFixClothesCn();
	/* 识别"这本魔书"要宽松：一旦它已经被显示成「赤裸」，
	   name/variable 就不再是「魔法书」了 —— 用 name 当判据等于"坏了就认不出来、永远修不回来"。
	   所以再加上 iconFile 这条身份线索（我们自己的图标，原版 naked 不可能有）。 */
	var BOOK_ICON = "magic-book.png";
	function isBookEntry(x) {
		return !!x && (x.name === "魔法书" || x.variable === "魔法书" || x.iconFile === BOOK_ICON);
	}
	function repairWornBook(slot) {
		try {
			var it = (window.V && V.worn) ? V.worn[slot] : null;
			if (!isBookEntry(it)) return false;
			it.name = "魔法书"; it.name_cap = "魔法书"; it.variable = "魔法书";
			it.slot = slot;
			it.iconFile = BOOK_ICON;
			it.type = ['magic'];     /* 英文标识符给系统；中文显示名由 framework.js 挂进 setup.shopDetails */
			it.description = BOOK_DESC;
			it.cn_name = "魔法书"; it.cn_name_cap = "魔法书"; it.cn_description = BOOK_DESC;
			return true;
		} catch (e) { return false; }
	}
	var BOOK_DESC = "一本记载着世间秘辛的旧书，书页边缘流淌着稀薄的金色流沙。";
	var _bk = setup.clothes.handheld.filter(isBookEntry)[0];
	if (_bk) {
		/* 用新的克隆式重建一份，替换掉旧字段那件（属性一致但不再影响头发） */
		var _fresh = mk("魔法书", "魔法书", BOOK_DESC, 90000, BOOK_ICON);
		_fresh.index = _bk.index;
		setup.clothes.handheld[_bk.index] = _fresh;
		repairWornBook("handheld");
		repairWornBook("handheld2");
		return true;
	}
	function mk(name, nameCap, desc, cost, icon) {   /* 函数声明：可被上方的旧档修复代码提前调用 */
		/* __MK_CLONE__ 与制式手枪同源：直接克隆原版空手物品，只改显示字段。
		   这样手持栏里不会画出任何身体贴图，也不会影响头发图层（旧版手写字段会触发头发消失）。 */
		var base = window.clone ? clone(setup.clothes.handheld[0]) : JSON.parse(JSON.stringify(setup.clothes.handheld[0]));
		base.index = setup.clothes.handheld.length;
		base.slot = "handheld";
		base.name = name;
		base.name_cap = nameCap;
		base.variable = name;
		base.description = desc;
		base.cost = cost;
		base.iconFile = icon;
		base.shop = [];
		/* ⚠️ type 就是 DoL 的**物品特质标签**（原版：setup.clothingTraits 由所有物品的 type 摊平去重而来）。
		   三条结论都是验证出来的：
		     ① 克隆源是原版 `naked`（空手），type 是 ["naked"] → 不清就显示「裸露」；
		     ② 清成空数组 → 特质整个没了；
		     ③ **写中文也不显示** —— 原版 59 个标签全是英文小写标识符（holy / enchanting / naked …），
		        显示名是标签经翻译映射出来的，而且我们的物品注册得晚、标签压根没进 setup.clothingTraits。
		   所以按用户定的方案：**英文标识符给系统，中文由我们自己的映射给玩家**
		   （相当于本模组自带一份针对这两个标签的特化汉化）。 */
		base.type = ['magic'];
		base.cn_name = name;
		base.cn_name_cap = nameCap;
		base.cn_description = desc;
		return base;
	}
	setup.clothes.handheld.push(mk("魔法书", "魔法书", "一本记载着世间秘辛的旧书，书页边缘流淌着稀薄的金色流沙。", 90000, "magic-book.png"));
	return true;
};

/* ============================================================
   汉化模组兼容：给「中文名的模组服装」补上 cn_name / cn_name_cap
   ModI18N 的衣柜用 _itemData.cn_name_cap 显示名字，缺失时就会拼一句
   「(服装中文属性缺失,请联系服装mod作者)」。原版物品由它自己插字段，
   模组新增的（我们的魔法书、制式手枪等）只能由我们自己补。
   只处理名字里含中文的物品，绝不覆盖原版英文名物品的汉化。
   ============================================================ */
window.modFixClothesCn = function () {
	try {
		if (!window.setup || !setup.clothes) return 0;
		var CJK = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/;
		var fixed = 0;
		var fixOne = function (it) {
			if (!it || typeof it !== 'object') return;
			if (typeof it.name !== 'string' || !CJK.test(it.name)) return;   /* 只补中文名物品 */
			if (it.cn_name === undefined) it.cn_name = it.name;
			if (it.cn_name_cap === undefined) it.cn_name_cap = it.name_cap || it.name;
			if (it.cn_description === undefined && it.description !== undefined) it.cn_description = it.description;
			fixed++;
		};
		Object.keys(setup.clothes).forEach(function (slot) {
			var list = setup.clothes[slot];
			if (list && list.length) for (var i = 0; i < list.length; i++) fixOne(list[i]);
		});
		/* 身上穿的那份是 clone，也要补 */
		if (window.V && V.worn) {
			Object.keys(V.worn).forEach(function (k) { fixOne(V.worn[k]); });
		}
		return fixed;
	} catch (e) { return 0; }
};

/* ================= <<endnpc>> 兜底（用户实机报的报错） =================
   报错原文：`bad evaluation: TypeError: Cannot read properties of undefined (reading 'trust')`，
   出现在「和玖肆对话、点离开」的那一刻。根因在原版 base-system/named-npcs.twee 的 <<endnpc>>：
   无参分支会对 $npc 里每个名字执行 `C.npc[_nam].trust += …`；
   只要 C.npc["玖肆"] 在这一瞬间不在（例如 Maplebirch 之类框架整体换掉了 C.npc，
   而我们每段只在 passageinit 重装一次），就会炸在整个链接求值上 —— 点击直接变成报错弹窗。

   处理：包住 endnpc 的 handler —— 先补一次玖肆的注册，再执行原逻辑；
   万一还有别的 NPC 缺失，也只在控制台留一条警告，不让整个点击失败。 */
window.jiusiGuardEndnpc = function () {
	try {
		if (!window.Macro || typeof Macro.get !== "function") return false;
		var m = Macro.get("endnpc");
		if (!m || typeof m.handler !== "function") return false;
		if (m.handler.__fsGuard) return true;
		var orig = m.handler;
		m.handler = function () {
			try { if (typeof window.jiusiEnsure === "function") window.jiusiEnsure(); } catch (e) { }
			try { return orig.apply(this, arguments); }
			catch (e) {
				try { console.warn("[终星] endnpc 已跳过（" + e.message + "）；若反复出现请把这条发给作者"); } catch (e2) { }
			}
		};
		m.handler.__fsGuard = 1;
		return true;
	} catch (e) { return false; }
};

(function () {
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", window.jiusiEnsure);
	else window.jiusiEnsure();
	window.jiusiGuardEndnpc();
	var tries = 0;
	var timer = setInterval(function () {
		tries++;
		var a = window.jiusiEnsure();
		if (!window.jiusiGuardEndnpc()) a = false;      /* 没装上就继续重试 */
		var b = window.modEnsureHeldItems ? window.modEnsureHeldItems() : false;
		var c = !!(window.V && window.V.worn && window.V.worn.handheld2 !== undefined);
		if ((a && b && c) || tries > 900) clearInterval(timer);
	}, 250);
	/* 存档加载后（每次段落渲染前）确保玖肆 / 副手槽 / 手持物注入完成 */
	if (window.$ && window.$(document)) {
		window.$(document).on(":passageinit", function () {
			window.jiusiEnsure();
			if (window.modEnsureHeldItems) window.modEnsureHeldItems();
		});
	}
})();
/* ===== 莫伦斯两位角色：注册成真正的命名 NPC（社交栏里和原版角色同一种行） ===== */
(function () {
	function reg(name, title, pronoun, gender) {
		try {
			if (!window.V || !V.NPCNameList) return false;
			var i = V.NPCNameList.indexOf(name);
			if (i !== -1 && V.NPCName[i]) return true;
			if (typeof setup === "undefined" || !setup.baseNNPC) return false;
			var n = Object.assign({}, setup.baseNNPC);
			n.nam = name; n.title = title; n.type = "human";
			n.pronoun = pronoun; n.gender = gender;
			n.init = 1; n.name_known = 1; n.state = "active"; n.description = name;
			n.love = 0; n.lust = 0; n.dom = 0; n.trust = 0; n.trauma = 0; n.rage = 0; n.purity = 0; n.corruption = 0;
			n.chastity = { penis: "", vagina: "", anus: "" };
			n.virginity = Object.assign({}, setup.NPCVirginityTypesVirgin || {});
			n.harmony = 0; n.ferocity = 0;
			V.NPCName.push(n);
			V.NPCNameList.push(name);
			if (setup.loveAlias && !setup.loveAlias[name]) {
				setup.loveAlias[name] = function () { return "好感"; };
			}
			if (window.C && C.npc) {
				try {
					Object.defineProperty(C.npc, name, {
						enumerable: true, configurable: true,
						get: function () { var k = V.NPCNameList.indexOf(name); return k !== -1 ? V.NPCName[k] : n; },
						set: function (v) { var k = V.NPCNameList.indexOf(name); if (k !== -1) V.NPCName[k] = v; }
					});
				} catch (e) { }
			}
			return true;
		} catch (e) {
			try { console.warn("[终星] 注册 NPC 失败 " + name + "：" + e.message); } catch (e2) { }
			return false;
		}
	}
	window.fsEnsureExtraNpcs = function () {
		try {
			var done = !!(window.V && V.fsData && V.fsData.mor && V.fsData.mor.stage === "done");
			if (done) {
				/* 长线结束：把她们从命名 NPC 列表里摘掉，社交栏（重要/次要/已逝）都不再出现 */
				["苏梦棠", "笙不瑜"].forEach(function (nm) {
					var i = (V.NPCNameList || []).indexOf(nm);
					if (i !== -1) { V.NPCNameList.splice(i, 1); V.NPCName.splice(i, 1); }
				});
				return true;
			}
			var a = reg("苏梦棠", "四楼的住户", "f", "f");
			var b = reg("笙不瑜", "学生", "f", "f");
			return a && b;
		} catch (e) { return false; }
	};
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", window.fsEnsureExtraNpcs);
	else window.fsEnsureExtraNpcs();
	var tries = 0;
	var t = setInterval(function () {
		tries++;
		if (window.fsEnsureExtraNpcs() || tries > 900) clearInterval(t);
	}, 250);
	if (window.$ && window.$(document)) window.$(document).on(":passageinit", window.fsEnsureExtraNpcs);
})();
