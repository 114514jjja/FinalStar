/* fs-cheat.js — 终星控制台作弊功能（给测试用：没有进度靠前的存档也能直达内容）
 *
 * 设计要点（都是踩过的坑）：
 *  · 列表一律由 JS 生成 HTML，点击走文档级委派 —— 不在 twee 里用 <<for>> 生成链接。
 *    交接文档 §4.4：<<for>> + 链接文本里求值会整列重复 / 报 "Cannot read properties of undefined (reading 'name')"。
 *  · 所有写变量的地方都先判存在，只改真正存在的变量，并把改了哪些报出来 —— 不瞎写。
 *  · 深拷贝用 JSON，不用 clone()：交接文档 §4.1 说过 clone 只存在于 SugarCube 表达式上下文，
 *    模组注入的普通 JS 里必须用 window.modClone（或干脆别用）。JSON 拷贝对这些纯数据对象最稳。
 *  · 跳转统一走 fs.goPassage()（另一个会话在 fs-core.js 加的跳转工具，见 README 第 50 条）。
 *  · 时间跳转照抄 DoL 自己的 debug 菜单：Time.getNextWeekdayDate(n) → Time.timeTravel(...) → Time.setTime(h,m)。
 */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	function num(v, d) { var n = Number(v); return isNaN(n) ? (d || 0) : n; }
	function V_() { return (typeof V !== 'undefined' && V) ? V : null; }
	function jclone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return null; } }

	/* ---------- 已核对存在的原版地点段落（不要凭感觉加名字：
	   Street / School / Hospital / Police / Lake / Sewers / Underground / Cafe / Farm / Prison / Compound / Manor
	   在 0.5.12.13 里都不存在，加了就是死链） ---------- */
	fs.cheatPlaces = [
		['孤儿院·卧室', 'Bedroom'], ['孤儿院·大厅', 'Orphanage'],
		['多瑙河街', 'Danube Street'], ['麋鹿街', 'Elk Street'], ['狼街', 'Wolf Street'], ['商业街', 'High Street'],
		['博物馆', 'Museum'], ['神殿', 'Temple'], ['成人商店', 'Adult Shop'], ['水疗中心', 'Spa'],
		['脱衣舞俱乐部', 'Strip Club'], ['妓院', 'Brothel'], ['购物中心一楼', 'Shopping Centre'], ['购物中心二楼', 'Shopping Centre Top'], ['街机厅', 'Arcade'],
		['公交车站', 'Bus'], ['码头', 'Docks'], ['岛', 'Island'], ['荒野', 'Moor'],
		['森林', 'Forest'], ['海滩', 'Beach'], ['疯人院', 'Asylum']
	];

	/* ---------- 剧情战斗分组（按名字归集，用于验「玖肆不再乱入」） ---------- */
	fs.cheatStoryGroups = [
		['象牙幽灵线（分裂 / 潜行 / 绑架）', /Wraith|Schism/],
		['麋鹿庄园', /Elk Compound/],
		['艾弗里', /^Avery/],
		['惠特尼', /Whitney/],
		['罗宾', /Robin/],
		['凯拉', /Kylar/],
		['西德尼', /Sydney/],
		['雷顿', /Leighton/],
		['噩梦', /Nightmare/]
	];

	/* 关系字段：正面拉满、负面清零 */
	var REL_POS = ['love', 'lust', 'trust', 'dom', 'obsession', 'devotion', 'obedience', 'harmony', 'ferocity'];
	var REL_NEG = ['trauma', 'rage', 'hatred', 'fear', 'jealousy'];

	/* ================= 作弊动作 ================= */

	/* ① 解锁所有文物（博物馆收藏全捐）。状态链：notFound → found → talk → museum */
	fs.cheatMuseum = function () {
		try {
			var v = V_(); if (!v) return '失败：读不到存档';
			if (!v.museumAntiques) return '失败：这个存档还没有博物馆数据（先去一次博物馆）';
			var a = v.museumAntiques.antiques || {}, p = v.museumAntiques.paintings || {};
			var ka = Object.keys(a), kp = Object.keys(p), na = 0, np = 0, i;
			for (i = 0; i < ka.length; i++) if (a[ka[i]] !== 'museum') { a[ka[i]] = 'museum'; na++; }
			for (i = 0; i < kp.length; i++) if (p[kp[i]] !== 'museum') { p[kp[i]] = 'museum'; np++; }
			v.museumAntiques.museumCount = ka.length;      /* maxCount 只数 antiques，这里对齐 */
			v.museumAntiques.stolenCount = 0;
			v.museumAntiques.recoveredCount = 0;
			if (Array.isArray(v.museumAntiqueJournalHints)) v.museumAntiqueJournalHints = [];
			return '文物已全部入库：古物 ' + ka.length + ' 件（新捐 ' + na + '）、画作 ' + kp.length + ' 幅（新捐 ' + np + '）';
		} catch (e) { return '失败：' + e.message; }
	};

	/* ② 解锁全部成就 */
	fs.cheatFeats = function () {
		try {
			var v = V_(); if (!v) return '失败：读不到存档';
			if (!v.feats) return '失败：这个存档还没有成就数据';
			var defs = (typeof setup !== 'undefined' && setup && setup.feats) ? setup.feats : null;
			if (!defs) return '失败：读不到 setup.feats（成就定义）';
			v.feats.currentSave = v.feats.currentSave || {};
			v.feats.allSaves = v.feats.allSaves || {};
			var keys = Object.keys(defs), n = 0, now = Date.now();
			for (var i = 0; i < keys.length; i++) {
				if (v.feats.currentSave[keys[i]] === undefined) { v.feats.currentSave[keys[i]] = now; n++; }
				if (v.feats.allSaves[keys[i]] === undefined) v.feats.allSaves[keys[i]] = now;
			}
			v.feats.locked = false;
			return '成就已解锁：本存档新增 ' + n + ' 项，合计 ' + keys.length + ' 项';
		} catch (e) { return '失败：' + e.message; }
	};

	/* ③ 成就币 */
	fs.cheatCoins = function (n) {
		try {
			var v = V_(); if (!v || !v.feats) return '失败：读不到成就数据';
			v.feats.allSaves = v.feats.allSaves || {};
			v.feats.allSaves.points = num(v.feats.allSaves.points) + num(n, 100);
			return '成就币 +' + num(n, 100) + ' → 现有 ' + v.feats.allSaves.points;
		} catch (e) { return '失败：' + e.message; }
	};

	/* ④ 食谱全解锁（V.foodstuff[key].knows_recipe） */
	fs.cheatRecipes = function () {
		try {
			fs.ensureData();
			var v = V_(); if (!v) return '失败：读不到存档';
			/* ⚠️ 原来的写法是错的：我在 **V.foodstuff** 上找 `.recipe`，
			   但食谱定义不在那里 —— 原版自己的写法（从游戏包原文取出）是：
			     setup.foodstuff[item].recipe.ingredients   ← 食谱定义
			     $foodstuff[item].knows_recipe              ← 已学标记
			   所以旧代码扫 V.foodstuff 的 recipe/cookable 永远命中 0，
			   回显就成了「食谱类食物共 0 项」。（问题记录的「学习了零个新东西」。）
			   现在改成遍历 setup.foodstuff，用原版同一套判据（有 recipe 且有 ingredients）。 */
			if (typeof setup === 'undefined' || !setup.foodstuff) return '失败：读不到 setup.foodstuff（游戏版本不符？）';
			if (!v.foodstuff || typeof v.foodstuff !== 'object') v.foodstuff = {};
			var keys = Object.keys(setup.foodstuff), total = 0, learned = 0, made = 0;
			for (var i = 0; i < keys.length; i++) {
				var k = keys[i];
				var def = setup.foodstuff[k];
				if (!def || !def.recipe || !def.recipe.ingredients) continue;
				total++;
				if (!v.foodstuff[k] || typeof v.foodstuff[k] !== 'object') v.foodstuff[k] = {};
				if (v.foodstuff[k].knows_recipe === true) { learned++; continue; }
				v.foodstuff[k].knows_recipe = true;
				made++;
			}
			return '食谱已解锁：新学会 ' + made + ' 项（食谱共 ' + total + ' 项，本来已会 ' + learned + ' 项）';
		} catch (e) { return '失败：' + e.message; }
	};

	/* ⑤ 服装全解锁：把 setup.clothes 每个槽位的每件衣服都塞进 $wardrobe（照抄原版写法
	   $wardrobe[slot].push(clone(setup.clothes[slot][i]))，只是深拷贝改用 JSON） */
	fs.cheatClothes = function () {
		try {
			var v = V_(); if (!v) return '失败：读不到存档';
			var C = (typeof setup !== 'undefined' && setup && setup.clothes) ? setup.clothes : null;
			if (!C) return '失败：读不到 setup.clothes（服装定义）';
			v.wardrobe = v.wardrobe || {};
			var slots = 0, added = 0, skipped = 0;
			for (var slot in C) {
				if (!Object.prototype.hasOwnProperty.call(C, slot)) continue;
				if (!Array.isArray(C[slot])) continue;          /* 只处理「槽位 → 数组」这种结构 */
				slots++;
				if (!Array.isArray(v.wardrobe[slot])) v.wardrobe[slot] = [];
				/* 用 variable/name 判重，避免重复塞入 */
				var owned = {};
				for (var k = 0; k < v.wardrobe[slot].length; k++) {
					var it = v.wardrobe[slot][k];
					if (it && typeof it === 'object') owned[it.variable || it.name || ('#' + k)] = 1;
				}
				for (var j = 0; j < C[slot].length; j++) {
					var src = C[slot][j];
					if (!src || typeof src !== 'object') continue;
					var key = src.variable || src.name || ('@' + j);
					if (owned[key]) { skipped++; continue; }
					var cp = jclone(src);
					if (!cp) continue;
					v.wardrobe[slot].push(cp);
					owned[key] = 1;
					added++;
				}
			}
			return '服装已全解锁：扫了 ' + slots + ' 个槽位，新增 ' + added + ' 件（本来就有 ' + skipped + ' 件）';
		} catch (e) { return '失败：' + e.message; }
	};

	/* ⑥ NPC 关系全满（所有有名有姓的角色） */
	fs.cheatRelations = function () {
		try {
			var v = V_(); if (!v) return '失败：读不到存档';
			if (!Array.isArray(v.NPCName)) return '失败：这个存档还没有具名 NPC 数据';
			var n = 0;
			for (var i = 0; i < v.NPCName.length; i++) {
				var npc = v.NPCName[i];
				if (!npc || typeof npc !== 'object') continue;
				for (var a = 0; a < REL_POS.length; a++) if (typeof npc[REL_POS[a]] === 'number') npc[REL_POS[a]] = 100;
				for (var b = 0; b < REL_NEG.length; b++) if (typeof npc[REL_NEG[b]] === 'number') npc[REL_NEG[b]] = 0;
				n++;
			}
			return 'NPC 关系已全满：' + n + ' 名角色（正面拉满 100 / 负面清零）——' +
				'名单：' + (v.NPCNameList || []).slice(0, 8).join('、') + ((v.NPCNameList || []).length > 8 ? ' 等' : '');
		} catch (e) { return '失败：' + e.message; }
	};

	/* ⑦ 钱 / 技能 / 玖肆好感 */
	fs.cheatMoney = function (n) {
		try {
			var v = V_(); if (!v) return '失败：读不到存档';
			v.money = num(v.money) + num(n, 1000000);
			return '金钱 → ' + v.money;
		} catch (e) { return '失败：' + e.message; }
	};
	fs.cheatSkills = function () {
		try {
			var v = V_(); if (!v) return '失败：读不到存档';
			var SKILL = ['athletics', 'skulduggery', 'swimmingskill', 'danceskill', 'housekeeping',
				'science', 'maths', 'english', 'history', 'physique', 'willpower', 'beauty', 'allure',
				'promiscuity', 'exhibitionism', 'deviancy', 'corruption', 'sex', 'awareness', 'tending'];
			var done = [], skip = [];
			for (var i = 0; i < SKILL.length; i++) {
				var k = SKILL[i];
				if (typeof v[k] === 'number') { v[k] = 1000; done.push(k); } else skip.push(k);
			}
			var CLEAR = ['pain', 'stress', 'trauma', 'arousal', 'tiredness', 'drugged', 'drunk', 'hallucinogen'];
			var cleared = [];
			for (var j = 0; j < CLEAR.length; j++) if (typeof v[CLEAR[j]] === 'number') { v[CLEAR[j]] = 0; cleared.push(CLEAR[j]); }
			return '技能/属性拉满 ' + done.length + ' 项' + (skip.length ? '（本存档没有：' + skip.join('/') + '）' : '') +
				'；负面状态清零：' + cleared.join('/');
		} catch (e) { return '失败：' + e.message; }
	};
	fs.cheatJiusi = function (n) {
		try {
			fs.ensureData();
			var v = V_(); if (!v) return '失败：读不到存档';
			var before = (typeof fs.jiusiLove === 'function') ? fs.jiusiLove() : num(v.fsData.jiusiLike);
			/* 新模型下好感的真源是原版的 NPCName.love，所以作弊要改那个；
			   顺便把"留奴隶"造成的惩罚清零，否则改了也看不出来。 */
			var npc = (typeof fs.jiusiNpc === 'function') ? fs.jiusiNpc() : null;
			if (npc) {
				npc.love = Math.max(0, Math.min(100, num(npc.love) + num(n, 100)));
				if (v.fsData) { v.fsData.jiusiPenalty = 0; v.fsData.jiusiPenaltyWeeks = 0; v.fsData.jiusiDisappointed = 0; }
			} else {
				v.fsData.jiusiPenalty = Math.max(0, num(v.fsData.jiusiPenalty) - num(n, 100));
			}
			v.jiusiMeet = 1; v.jiusiProtect = 1;
			var after = (typeof fs.jiusiLove === 'function') ? fs.jiusiLove() : num(v.fsData.jiusiLike);
			return '玖肆好感 ' + before + ' → ' + after + '（并已设为"认识 + 受她保护"，惩罚已清零）';
		} catch (e) { return '失败：' + e.message; }
	};

	/* ⑧ 一键全解锁食物：把 22 种常驻食物字段一次拉满（只动存档里真实存在的字段，并把动了哪些报出来）。
	   ⚠️ 用户原话是「每个食物20份改成全解锁」——那种"每种给固定数量"的写法是别的模组的做法，
	   这里改成真正的"全解锁"：所有食物一次到位，不必逐个点。 */
	fs.cheatFood = function (qty) {
		try {
			fs.ensureData();
			var v = V_(); if (!v) return '失败：读不到存档';
			var keys = fs.foodKeys || [];
			var n = Number(qty) || 99;
			var done = [], made = [], names = [];
			for (var i = 0; i < keys.length; i++) {
				var k = keys[i];
				if (v[k] === undefined) made.push(k);          /* 新档很多食物字段压根不存在 */
				v[k] = Math.max(Number(v[k]) || 0, n);          /* 不存在就建出来，这才是"全解锁" */
				done.push(k);
				if (fs.foodNames && fs.foodNames[i]) names.push(fs.foodNames[i]);
			}
			return '食物已全解锁：' + done.length + ' 种拉到 ' + n
				+ (made.length ? '（其中 ' + made.length + ' 种是新建的）' : '')
				+ '　' + (names.length ? names.join('、') : done.join('、'));
		} catch (e) { return '失败：' + e.message; }
	};

	/* ---------- 原版作弊分区：延后用 jQuery(...).wiki() 填充 ----------
	   为什么不直接在 twee 里写 <<cheats-npcs>>：
	   验证把 <<cheats-characterStats>> 等放进 `fs_console_sec_9` 这个 widget 上下文里会报
	   `bad evaluation from attribute`，并连带 8 条 `Cannot read properties of null (reading 'children')`；
	   而同样的宏直接 `jQuery(el).wiki(...)` 求值就正常（characterVisual / cheats-npcs / cheats-other 都成）。
	   所以统一走"DOM 就绪后由 JS 填充"，与 #fs-cheat-box / #fs-char-box 是同一招（§4.4 那类坑）。

	   ⚠️ 但不是五个都能用，验证（0.5.12.13）：
	     cheats-characterVisual  80883 字符  ✓
	     cheats-npcs 65173 字符 ✓（好感微调就在这一栏，正是用户要的）
	     cheats-other             8238 字符  ✓
	     cheats-characterStats    ✗ 原版自身在这套环境里报
	        `<span>: bad evaluation from attribute directive "@class":
	         Cannot read properties of undefined (reading 'includes')`
	        （报错在它嵌套调用的 numberStepper 里，不在这个 widget 正文里）
	     cheats-teleport          ✗ 同样只渲染出错误块
	   注意一个我自己踩过的判断错误：`jQuery(el).wiki()` 遇到 widget 内部错误不会抛异常，
	   而是把错误文本渲染进容器 —— 所以当时我用 `len>0` 判断"成功"是错的（那个 1433 其实是错误信息长度）。
	   正确判据是看内容里有没有"出错"。

	   处理方式：逐个尝试 → 检测出错 → 就地换成一句人话说明（不把原版报错糊在玩家脸上），
	   并告诉玩家等价功能在哪个分区。这样在别的环境里万一它是好的，也照样能用。 */
	var VC_NOTES = {
		'fs-vc-stats': '原版这一栏在当前游戏环境里加载失败（原版自身依赖没满足）。等价功能：'
			+ '<span class="gold">◆ 作弊功能</span> 里的「技能属性拉满 / 钱 +100万 / 成就币」。',
		'fs-vc-teleport': '原版这一栏在当前游戏环境里加载失败。等价功能：'
			+ '<span class="gold">◆ 地点与剧情直达</span>（22 个地点 + 剧情战斗）。',
	};
	/* ================= 原版区域解锁 =================
	   用户澄清：
	   - 废弃商店有阶段剧情 → 保留 0~22 滑块，一格一个进度；低于 22 回到废弃/上锁。
	   - 施粥棚没有特殊剧情 → 只有 0 / 100 两个状态。
	   - 不做分支结局；不要一键解锁/一键上锁按钮，只留滑块 + 确认。
	   其它建筑按 config 追加。 */
	fs.buildingConfigs = [{
		id: 'adultshop',
		name: '废弃商店（Elk Street）',
		note: '0~22 阶段；22 = 解锁为成人商店，低于 22 = 废弃/上锁；不触发分支结局。',
		max: 22,
		mode: 'staged',
		unit: '阶段',
		get: function () {
			try {
				if (V.adultshopunlocked) return 22;
				return Math.max(0, Math.min(21, Number(V.adultshopprogress) || 0));
			} catch (e) { return 0; }
		},
		apply: function (value) {
			try {
				var v = V, n = Math.max(0, Math.min(22, Math.round(Number(value) || 0)));
				v.adultshopprogress = n;
				v.adultshopcontribution = n;
				if (n >= 22) {
					v.adultshopintro = 1;
					v.adultshopunlocked = true;
					v.adultshophelped = 0;
					try { delete v.adultshopgrandopening; } catch (e) { }
					try { delete v.adultshopopeningevent; } catch (e) { }
					try { delete v.adultshopopeningsydney; } catch (e) { }
					if (v.adultshopdegree === undefined) v.adultshopdegree = 1;
					return '已解锁：废弃商店 → 成人商店（22/22，不触发分支结局）。';
				}
				v.adultshopintro = 0;
				v.adultshophelped = 0;
				try { delete v.adultshopunlocked; } catch (e) { }
				try { delete v.adultshopgrandopening; } catch (e) { }
				try { delete v.adultshopopeningevent; } catch (e) { }
				try { delete v.adultshopopeningsydney; } catch (e) { }
				try { delete v.adultshopdegree; } catch (e) { }
				return '已设为阶段 ' + n + '/22（低于 22，商店保持废弃/上锁）。';
			} catch (e) { return '失败：' + e.message; }
		}
	}, {
		id: 'soupkitchen',
		name: '施粥棚（Wolf Street）',
		note: '0 = 未发现，100% = 已发现；没有特殊剧情，只有两态。',
		max: 1,
		mode: 'binary',
		onLabel: '已发现',
		offLabel: '未发现',
		get: function () {
			try { return V.soup_kitchen_known === 1 ? 1 : 0; } catch (e) { return 0; }
		},
		apply: function (value) {
			try {
				var v = V, on = Number(value) >= 1;
				if (on) {
					v.soup_kitchen_known = 1;
					v.soup_kitchen_init = 1;
					return '已解锁：施粥棚已出现在 Wolf Street。';
				}
				v.soup_kitchen_known = 0;
				v.soup_kitchen_init = 0;
				return '已还原：施粥棚重新变为未发现。';
			} catch (e) { return '失败：' + e.message; }
		}
	}, {
		id: 'farmstage',
		name: '农场·剧情阶段',
		note: '0~12 阶段；抬高阶段会同步清空当前开垦地，不补播剧情。',
		max: 12,
		mode: 'staged',
		unit: '阶段',
		get: function () {
			try { return Math.max(0, Math.min(12, Number(V.farm_stage) || 0)); } catch (e) { return 0; }
		},
		apply: function (value) {
			try {
				var v = V, n = Math.max(0, Math.min(12, Math.round(Number(value) || 0)));
				v.farm_stage = n;
				if (n > 0) {
					if (!v.farm) v.farm = {};
					v.farm.clearing = 100;
				}
				if (n >= 7 && v.wardrobes && v.wardrobes.alexFarm) v.wardrobes.alexFarm.unlocked = true;
				return '农场剧情阶段已设为 ' + n + '/12。';
			} catch (e) { return '失败：' + e.message; }
		}
	}, {
		id: 'farmdefense',
		name: '农场·防御设施',
		note: '0~4 级；对应原版 $farm.wall（围墙/栅栏等防御升级）。',
		max: 4,
		mode: 'staged',
		unit: '级',
		get: function () {
			try { return Math.max(0, Math.min(4, Number(V.farm && V.farm.wall) || 0)); } catch (e) { return 0; }
		},
		apply: function (value) {
			try {
				var v = V, n = Math.max(0, Math.min(4, Math.round(Number(value) || 0)));
				if (!v.farm) v.farm = {};
				v.farm.wall = n;
				return '农场防御设施已设为 ' + n + '/4 级。';
			} catch (e) { return '失败：' + e.message; }
		}
	}, {
		id: 'farmplots',
		name: '农场·农田',
		note: '0~9 块；增加时补标准土地，减少时从末尾移除。',
		max: 9,
		mode: 'staged',
		unit: '块地',
		get: function () {
			try { return Math.max(0, Math.min(9, (V.plots && V.plots.farm) ? V.plots.farm.length : 0)); } catch (e) { return 0; }
		},
		apply: function (value) {
			try {
				var v = V, n = Math.max(0, Math.min(9, Math.round(Number(value) || 0)));
				if (!v.plots) v.plots = {};
				if (!Array.isArray(v.plots.farm)) v.plots.farm = [];
				while (v.plots.farm.length < n) {
					var base = (typeof setup !== 'undefined' && setup.tending && setup.tending.plot_base) ? JSON.parse(JSON.stringify(setup.tending.plot_base)) : {};
					base.bed = 'earth'; base.quality = 3; base.size = 'large';
					v.plots.farm.push(base);
				}
				while (v.plots.farm.length > n) v.plots.farm.pop();
				return '农场农田已设为 ' + n + '/9 块。';
			} catch (e) { return '失败：' + e.message; }
		}
	}, {
		id: 'brothel',
		name: '妓院（工作解锁）',
		note: '0 = 未接工作，100% = 已接工作；妓院建筑本身一直能进。',
		max: 1,
		mode: 'binary',
		onLabel: '已接工作',
		offLabel: '未接工作',
		get: function () {
			try { return V.brotheljob === 1 ? 1 : 0; } catch (e) { return 0; }
		},
		apply: function (value) {
			try {
				var v = V, on = Number(value) >= 1;
				v.brotheljob = on ? 1 : 0;
				if (on && v.wardrobes && v.wardrobes.brothel) v.wardrobes.brothel.unlocked = true;
				return on ? '已解锁：妓院工作已接。' : '已还原：妓院工作未接。';
			} catch (e) { return '失败：' + e.message; }
		}
	}, {
		id: 'temple',
		name: '神庙·等级',
		note: '0=预备，1=入门，2=修士，3=祭司；只改等级，不补剧情。',
		max: 3,
		mode: 'staged',
		unit: '级',
		label: function (n) { return ['预备', '入门', '修士', '祭司'][n] || ''; },
		get: function () {
			try {
				var ranks = ['prospective', 'initiate', 'monk', 'priest'];
				var i = ranks.indexOf(V.temple_rank);
				return i < 0 ? 0 : i;
			} catch (e) { return 0; }
		},
		apply: function (value) {
			try {
				var v = V, n = Math.max(0, Math.min(3, Math.round(Number(value) || 0)));
				var ranks = ['prospective', 'initiate', 'monk', 'priest'];
				v.temple_rank = ranks[n];
				if (n >= 2 && v.wardrobes && v.wardrobes.temple) v.wardrobes.temple.unlocked = true;
				return '神庙等级已设为 ' + ranks[n] + '（' + n + '/3）。';
			} catch (e) { return '失败：' + e.message; }
		}
	}];
	fs._buildDraft = {};
	fs._buildingCfg = function (id) {
		for (var i = 0; i < fs.buildingConfigs.length; i++) if (fs.buildingConfigs[i].id === id) return fs.buildingConfigs[i];
		return null;
	};
	fs._buildingDraft = function (id) {
		if (!fs._buildDraft[id]) {
			var cfg = fs._buildingCfg(id);
			fs._buildDraft[id] = { value: cfg ? cfg.get() : 0 };
		}
		return fs._buildDraft[id];
	};
	fs._buildingText = function (cfg, d) {
		var pct = cfg.mode === 'binary' ? (d.value ? 100 : 0) : Math.round(d.value / cfg.max * 100);
		if (cfg.mode === 'binary') return (d.value ? '100% · ' : '0% · ') + (d.value ? (cfg.onLabel || '已解锁') : (cfg.offLabel || '未解锁'));
		var s = d.value + ' / ' + cfg.max + '（' + pct + '%）';
		if (cfg.unit) s += ' · ' + cfg.unit;
		if (cfg.label) s += ' · ' + cfg.label(d.value);
		return s;
	};
	fs.buildingUnlockHtml = function () {
		var h = [];
		for (var i = 0; i < fs.buildingConfigs.length; i++) {
			var cfg = fs.buildingConfigs[i], d = fs._buildingDraft(cfg.id);
			var binary = cfg.mode === 'binary', max = cfg.max;
			var pct = binary ? (d.value ? 100 : 0) : Math.round(d.value / max * 100);
			var val = fs._buildingText(cfg, d);
			h.push('<div class="fs-build" id="fs-build-' + cfg.id + '">');
			h.push('<div class="fs-build-h"><span class="gold">' + cfg.name + '</span> <span class="fs-build-pct" id="fs-build-pct-' + cfg.id + '">' + pct + '%</span></div>');
			h.push('<div class="fs-sub">' + cfg.note + '</div>');
			h.push('<input type="range" min="0" max="' + max + '" step="1" value="' + d.value + '" oninput="finalStar.buildingSlide(\'' + cfg.id + '\', this.value)">');
			h.push('<div class="fs-build-row"><span id="fs-build-val-' + cfg.id + '">' + val + '</span></div>');
			h.push('<button type="button" class="fs-build-confirm" onclick="finalStar.buildingConfirm(\'' + cfg.id + '\')">确认</button>');
			h.push('<div class="fs-build-msg" id="fs-build-msg-' + cfg.id + '"></div>');
			h.push('</div>');
		}
		return h.join('');
	};
	fs._buildingUpdate = function (id) {
		var cfg = fs._buildingCfg(id); if (!cfg) return;
		var d = fs._buildingDraft(id), binary = cfg.mode === 'binary';
		var pct = binary ? (d.value ? 100 : 0) : Math.round(d.value / cfg.max * 100);
		var val = fs._buildingText(cfg, d);
		var el;
		if ((el = document.getElementById('fs-build-pct-' + id))) el.textContent = pct + '%';
		if ((el = document.getElementById('fs-build-val-' + id))) el.textContent = val;
	};
	fs.buildingSlide = function (id, value) {
		var cfg = fs._buildingCfg(id); if (!cfg) return;
		var d = fs._buildingDraft(id), n = Number(value) || 0;
		d.value = (cfg.mode === 'binary') ? (n >= 1 ? 1 : 0) : Math.max(0, Math.min(cfg.max, Math.round(n)));
		fs._buildingUpdate(id);
	};
	fs.buildingConfirm = function (id) {
		var cfg = fs._buildingCfg(id); if (!cfg) return;
		var d = fs._buildingDraft(id);
		var msg = cfg.apply(d.value);
		d.value = cfg.get();
		var box = document.getElementById('fs-build-msg-' + id);
		if (box) box.innerHTML = '<span class="green">' + String(msg).replace(/[<>&]/g, '') + '</span>';
		fs._buildingUpdate(id);
		var slider = document.querySelector('#fs-build-' + id + ' input[type=range]');
		if (slider) slider.value = d.value;
	};
	fs.fillBuildingUnlocks = function () {
		try {
			var el = document.getElementById('fs-building-unlocks');
			if (el) el.innerHTML = fs.buildingUnlockHtml();
		} catch (e) { fs.warn('建筑解锁填充失败：' + e.message); }
	};

	fs.fillVanillaCheats = function () {
		var MAP = [
			['fs-vc-stats', '<<cheats-characterStats>>'],
			['fs-vc-visual', '<<cheats-characterVisual>>'],
			['fs-vc-npcs', '<<cheats-npcs>>'],
			['fs-vc-teleport', '<<cheats-teleport>>'],
			['fs-vc-other', '<<cheats-other>>'],
		];
		var ok = 0, bad = [];
		for (var i = 0; i < MAP.length; i++) {
			var id = MAP[i][0];
			try {
				var el = document.getElementById(id);
				if (!el) continue;
				if (!window.jQuery) { bad.push(id + ':没有 jQuery'); continue; }
				jQuery(el).empty().wiki(MAP[i][1]);
				/* 关键：wiki() 内部出错不抛异常，只能查渲染结果里有没有"出错" */
				var txt = el.innerText || '';
				if (/出错|error within widget code/.test(txt)) {
					var m = txt.match(/出错[^\n]{0,160}/);
					bad.push(id + ':' + (m ? m[0] : '渲染出错'));
					el.innerHTML = '<div class="fs-sub"><span class="gold">◆ 提示</span>　'
						+ (VC_NOTES[id] || '原版这一栏在当前环境里加载失败，已跳过。') + '</div>';
					continue;
				}
				ok++;
			} catch (e) {
				bad.push(id + ':' + e.message);
				try {
					var e2 = document.getElementById(id);
					if (e2) e2.innerHTML = '<div class="fs-sub">' + (VC_NOTES[id] || ('加载失败：' + e.message)) + '</div>';
				} catch (e3) { }
			}
		}
		if (bad.length) fs.log('原版作弊分区：成功 ' + ok + ' 个，失败 ' + bad.length + ' 个 —— ' + bad.join(' / '));
		return ok;
	};

	/* ⑨ 时间：跳到周一晚上（照抄 DoL debug 菜单的写法）。
	   DoL 的 weekDay 是 1=周日 … 7=周六，所以周一 = 2。 */
	fs.cheatTimeMonday = function () {
		try {
			var v = V_(); if (!v) return '失败：读不到存档';
			if (typeof Time === 'undefined') return '失败：读不到 Time';
			if (typeof Time.getNextWeekdayDate !== 'function' || typeof Time.timeTravel !== 'function') {
				return '失败：这个版本没有 getNextWeekdayDate / timeTravel';
			}
			var d = Time.getNextWeekdayDate(2);              /* 下一个周一 */
			Time.timeTravel(d);
			if (typeof Time.setTime === 'function') Time.setTime(19, 0);
			var wd = (typeof Time.weekDayName === 'string') ? Time.weekDayName : Time.weekDayName;
			return '已跳到：' + String(wd) + ' ' + Time.hour + ':' + ('0' + Time.minute).slice(-2) + '（周一晚上，玖肆该跟着你）';
		} catch (e) { return '失败：' + e.message; }
	};
	fs.cheatTimeAdvance = function (min) {
		try {
			if (typeof Time === 'undefined' || typeof Time.pass !== 'function') return '失败：读不到 Time.pass';
			Time.pass(num(min, 60) * 60);                   /* Time.pass 收的是秒 */
			return '时间推进 +' + num(min, 60) + ' 分钟 → ' + Time.weekDayName + ' ' + Time.hour + ':' + ('0' + Time.minute).slice(-2);
		} catch (e) { return '失败：' + e.message; }
	};
	/* 跳到周二早上 6:00 —— 用来确认她不再守着（她的守候到周二早上六点为止） */
	fs.cheatTimeTuesdayMorning = function () {
		try {
			if (typeof Time === 'undefined') return '失败：读不到 Time';
			Time.timeTravel(Time.getNextWeekdayDate(3));    /* 3 = 周二 */
			Time.setTime(6, 0);
			return '已跳到：' + String(Time.weekDayName) + ' ' + Time.hour + ':' + ('0' + Time.minute).slice(-2) + '（周二早上，她不该再跟着）';
		} catch (e) { return '失败：' + e.message; }
	};

	/* ⑨ 完成度显示 */
	fs.cheatProgress = function () {
		try {
			var v = V_(); if (!v) return '';
			var out = [];
			if (v.museumAntiques && v.museumAntiques.antiques) {
				var tot = Object.keys(v.museumAntiques.antiques).length;
				out.push('文物 ' + num(v.museumAntiques.museumCount) + '/' + tot);
			} else out.push('文物 无数据');
			if (v.feats && v.feats.currentSave) {
				var cur = Object.keys(v.feats.currentSave).length;
				var all = (typeof setup !== 'undefined' && setup && setup.feats) ? Object.keys(setup.feats).length : '?';
				out.push('成就 ' + cur + '/' + all);
			} else out.push('成就 无数据');
			if (v.foodstuff) {
				var kr = 0, tot2 = 0;
				for (var k in v.foodstuff) {
					if (!Object.prototype.hasOwnProperty.call(v.foodstuff, k)) continue;
					var f = v.foodstuff[k];
					if (!f || typeof f !== 'object') continue;
					if (f.knows_recipe !== undefined || f.recipe === true || f.cookable === true) { tot2++; if (f.knows_recipe === true) kr++; }
				}
				out.push('食谱 ' + kr + '/' + tot2);
			}
			if (v.feats && v.feats.allSaves) out.push('成就币 ' + num(v.feats.allSaves.points));
			if (v.wardrobe) {
				var w = 0;
				for (var s in v.wardrobe) if (Object.prototype.hasOwnProperty.call(v.wardrobe, s) && Array.isArray(v.wardrobe[s])) w += v.wardrobe[s].length;
				out.push('衣柜 ' + w + ' 件');
			}
			return out.join('　|　');
		} catch (e) { return '失败：' + e.message; }
	};

	/* ⑩ 状态行 */
	fs.cheatState = function () {
		try {
			var v = V_(); if (!v) return '读不到存档';
			var t = [];
			t.push('第 ' + num(v.day) + ' 天 / ' + (typeof Time !== 'undefined' ? Time.weekDayName + ' ' + Time.hour + '时' : '?'));
			t.push('钱 ' + num(v.money));
			t.push('疼痛 ' + num(v.pain) + ' 压力 ' + num(v.stress) + ' 创伤 ' + num(v.trauma));
			if (num(v.combat) === 1) t.push('战斗中（敌血 ' + num(v.enemyhealth) + '）');
			t.push('玖肆 ' + (num(v.jiusiMeet) === 1 ? '认识' : '未认识') + '/' + (num(v.jiusiProtect) === 1 ? '保护中' : '未保护') + '/好感' + ((typeof fs.jiusiLove === 'function') ? fs.jiusiLove() : num(v.fsData && v.fsData.jiusiLike)));
			if (typeof fs.sanity === 'function') t.push('理智 ' + fs.sanity());
			if (typeof fs.hunger === 'function') t.push('饥饿 ' + fs.hunger());
			return t.join('　|　');
		} catch (e) { return '失败：' + e.message; }
	};

	/* ================= 界面 ================= */

	/* ---------- 遭遇预热（修「跳进去就报未定义代词 he」） ----------
	   根因（已用段落原文 + 验证双重证实）：原版的「续篇」段落（* Molestation / * Rape / * Sex 等）
	   开头都是 <<if $molestationstart is 1>> … <</if>>，而那个 flag 是上一个段落在遭遇开始时置的。
	   我们从控制台直接跳进续篇 → flag 不是 1 → 整块初始化被跳过 → <<maninit>> 没跑 →
	   $index 没被设置 → <<stateman>> 里的 <<He>> 读到 $NPCList[undefined] → 「未能定义代词" He"」，
	   并连带 <<actionsman>> 报错（验证 V.index=undefined / V.npc=[] / V.npcrow=[]）。
	   修法：跳之前把该按的开关按上，让段落自己的初始化去跑 ——
	   不抄原版逻辑、不改那 889 条名单、也不覆写任何原版段落。

	   ⚠️ 副作用控制（用户专门问过，写在这里）：
	     · 这个 flag 是一次性消耗的：续篇第一行就 <<set $molestationstart to 0>>，
	       所以只影响这一次跳转，不会残留到后续正常遭遇；
	     · 两道保险：① 只在目标段落确实用到这个 flag 时才置（读段落原文判断，不瞎置）；
	                 ② 跳完 3 秒再查一次，没被消耗就自己清掉，防止污染正常流程。
	     · 已知效果：预热后段落自身的初始化会执行（<<controlloss>> / <<violence 1>> / <<molested>> 等），
	       也就是从控制台跳进遭遇会真的产生遭遇效果 —— 这是"跳进一个遭遇"的应有行为，不隐瞒。 */
	fs.WARM_FLAGS = [{ flag: 'molestationstart', probe: '$molestationstart is 1' }];

	/* 读一个段落的原文。三路兜底，因为单靠某一路会读不到：
	     ⚠️ 第一版只用了 State.passages[name].source —— 验证读不到（返回空），于是预热静默失效，
	        报错照旧。本项目的探针早就有验证过的读法：直接读 DOM 里的 tw-passagedata。
	     ① SugarCube.State.passages[name]（有 source/text 就用）
	     ② SugarCube.Story.get(name).text
	     ③ DOM: tw-passagedata[name="…"].textContent（探针用的就是这条，最可靠） */
	fs.passageText = function (name) {
		try {
			var st = (typeof SugarCube !== 'undefined' && SugarCube.State) ? SugarCube.State : null;
			var p = (st && st.passages) ? st.passages[name] : null;
			if (p && (p.source || p.text)) return String(p.source || p.text);
		} catch (e) { }
		try {
			var g = (typeof SugarCube !== 'undefined' && SugarCube.Story && SugarCube.Story.get) ? SugarCube.Story.get(name) : null;
			if (g && g.text) return String(g.text);
		} catch (e) { }
		try {
			var el = document.querySelector('tw-passagedata[name="' + name + '"]');
			if (el && el.textContent) return String(el.textContent);
		} catch (e) { }
		return '';
	};

	/* 目标段落是否需要预热；需要就置上并返回 flag 名，否则返回 null */
	fs.warmupFor = function (name) {
		try {
			var v = V_(); if (!v) return null;
			var src = fs.passageText(name);
			if (!src) { fs.log('遭遇预热跳过（读不到段落原文）：' + name); return null; }
			for (var i = 0; i < fs.WARM_FLAGS.length; i++) {
				var w = fs.WARM_FLAGS[i];
				if (src.indexOf(w.probe) === -1) continue;
				if (Number(v[w.flag]) === 1) return null;  /* 本来就是 1 → 不用动 */
				v[w.flag] = 1;
				fs.log('遭遇预热：' + name + ' → 置 ' + w.flag + ' = 1');
				return w.flag;
			}
			return null;
		} catch (e) { return null; }
	};
	/* 保险②：跳完还没被消耗就自己清掉 */
	fs.clearWarmup = function (flag) {
		try {
			var v = V_(); if (!v || !flag) return false;
			if (Number(v[flag]) === 1) { v[flag] = 0; fs.log('遭遇预热未被消耗，已清除：' + flag); return true; }
			return false;
		} catch (e) { return false; }
	};

	/* 场景预热：只置 flag 是不够的（验证 $index 仍是 undefined）。
	   `$index` 是"当前人物索引"，原版的入口段是靠 `<<generatey1>>` 之类生成场景 NPC、
	   再由 `<<person1>>` / `<<personselect>>` 把 $index 指过去，续篇才有东西可读。
	   所以这里补的那一半就是这两件事 —— 全在我们自己的代码里，不克隆、不覆写原版段落、不影响正常游玩。
	   注意用 try 包住每一步：生成失败也不能让跳转本身挂掉。 */
	fs.warmScene = function () {
		try {
			var v = V_(); if (!v) return false;
			var SC = (typeof SugarCube !== 'undefined') ? SugarCube : null;
			var run = null;
			if (SC && SC.Wikifier && typeof SC.Wikifier.wikifyEval === 'function') {
				run = function (t) { SC.Wikifier.wikifyEval(t); };
			} else if (typeof window.wikifier === 'function') {
				run = function (t) { window.wikifier(t); };
			}
			var did = [];
			/* ① 没有场景 NPC 就先生成一个（续篇里的 <<maninit>> / <<man>> 需要有对象可操作） */
			if (!(v.NPCList && v.NPCList.length && v.NPCList[0])) {
				if (run) { try { run('<<generatey1>>'); did.push('generatey1'); } catch (e) { fs.log('生成场景 NPC 失败：' + e.message); } }
			} else { did.push('已有NPC'); }
			/* ② 代词与索引：直接叫原版做，不要手工模拟。
			   第一版我只手动设 `v.index = 0` —— 结果 `$index` 有了、`$pronoun` 没有，
			   widget 于是走到它自己的 fallback 分支，照样渲染出
			   「[错误：未能定义代词到"He"]」（源码里那行就是它的兜底文案）。
			   而原版让这两件事一起成立的入口是 `<<personselect>>`：
			   它选中场景 NPC 并从该 NPC 取出代词。所以这里直接调它。
			   仍然保留 index 的手工兜底：万一 personselect 不可用，至少别让索引是 undefined。 */
			if (run) {
				try { run('<<personselect 0>>'); did.push('personselect 0'); }
				catch (e) { fs.log('personselect 失败：' + e.message); }
			}
			if (v.index === undefined || v.index === null || v.index === '') { v.index = 0; did.push('index=0(兜底)'); }
			fs.log('场景预热：' + did.join(' + ') + '　NPCList=' + ((v.NPCList || []).length) + '　index=' + v.index);
			return true;
		} catch (e) { return false; }
	};

	fs.cheatJump = function (name) {
		try {
			/* 控制台直接跳色情事件时没有正常触发流程，eroticReturn 可能是上一次的段落；
			   这里补一个安全返回，避免离开事件后回到缺 person 的场景报错。 */
			if (name === 'FS Erotic Scene') {
				try {
					V.fsData.eroticKey = Math.floor(Math.random() * (fs.eroticEvents ? fs.eroticEvents.length : 10));
					V.fsData.eroticReturn = 'Bedroom';
				} catch (e0) { }
			}
			var warmed = fs.warmupFor(name);
			if (warmed) {
				fs.warmScene();                              /* 补上"生成场景 NPC + 指好 $index"那一半 */
				setTimeout(function () { fs.clearWarmup(warmed); }, 3000);
			}
			if (typeof fs.goPassage === 'function') { fs.goPassage(name, true); return true; }
			if (typeof SugarCube !== 'undefined' && SugarCube.Engine) { setTimeout(function () { SugarCube.Engine.play(name); }, 0); return true; }
		} catch (e) { }
		return false;
	};

	function btn(label, act, arg, title) {
		return '<a href="javascript:void(0)" data-fs-cheat="' + act + '"' + (arg ? ' data-fs-arg="' + String(arg).replace(/"/g, '&quot;') + '"' : '') +
			(title ? ' title="' + String(title).replace(/"/g, '&quot;') + '"' : '') + '>' + label + '</a>';
	}

	/* ================= 剧情直达：剔除"不能空手进"的段落 =================
	   为什么需要（这一段是本轮最贵的教训，写清楚免得以后又想"补个 flag 就能跳"）：
	     原版的遭遇段落分入口段和续篇两类。续篇（* Molestation / * Rape / * Sex 等）开头都写着
	     `<<if $molestationstart is 1>> … <</if>>`，而那个 flag 是入口段在遭遇开始时置的；
	     续篇里还会直接引用 `$NPCList[0]`，以及 `<<man>>` / `<<stateman>>` 这些依赖已生成场景 NPC 的东西。
	     我们若直接 `Engine.play` 跳进续篇 → 初始化块整块被跳过 → `$index` 没设置 →
	     `<<He>>` 读到 `$NPCList[undefined]` → 「未能定义代词" He"」，再连带 `<<actionsman>>` 报错。
	   试过的修法（已验证，不够）：跳前置 `$molestationstart = 1` 做"遭遇预热"。
	     预热确实生效、也确实被段落自己消耗掉（无残留，验证 flag 跳完为 0），"未能定义代词"也消失了；
	     但接着会撞上第三方 addon：整合包里的 `DoLTimeWrapperAddon` / `TimeHookManager` 钩住了时间函数，
	     段落里一跑 `<<pass 10 seconds>>`，它转调 `minutePassed` 就在 `.includes` 上崩 —— 因为我们是跳进去的、
	     状态是半拉子的，而它没做空值保护。这不是我们能在自己代码里补干净的。
	   所以正解是不把这类段落列进直达列表：宁可不给，也不给一个点了就报错的按钮。
	   判定方式：读段落原文，命中先决条件标记就剔除。读不到原文时不拦（宁可放过，不可错杀）。 */
	fs.COLD_BLOCK = [
		'$molestationstart is 1',
		'$combatstart is 1',
		'$sexstart is 1',
		'$masturbationstart is 1',
		'$prostitutionstart is 1',
		'$rapeplaystart is 1'
	];
	/* ⚠️ 判据修正（第二轮）：只按 `$molestationstart` 那类 flag 剔除不够。
	   验证：`Asylum Machine Wraith Finish` 通过了 flag 检查，点下去照样报同一个错 ——
	   因为有一批段落根本没有 flag 判断，它们就是默默假定"场景里已经有 NPC 了"。
	   真正准确的判据是能力式的：
	     段落引用了场景 NPC（<<person>> / <<He>> / <<stateman>> / <<man>> / <<actionsman>> …）
	     却自己不做 NPC 生成（<<generatey*>> / <<generatem*>> / <<generatef*>> / <<generatenpc>>）
	     → 就说明它依赖"进门前的场景"，空手进必炸。
	   （`<<maninit>>` 只初始化既有 NPC，不算生成，所以不放进 GEN 白名单。） */
	/* ⚠️ 判据修正（第三轮，）：前两轮的名单两头都不准，有验证证据：
	   ① 生成器漏了 <<generate1/2/3>> 这一族（原来只写了 generatey/generatem/generatef/generatebeast）——
	      `Adult Shop Night Guard Found` 第 2 行就是 <<generate1>><<person1>>，它自己生成 NPC，
	      却被判成「需要流程」误杀。全量扫下来误杀 6 条：Nightmare Eden / Nightmare Harper /
	      Nightmare Office 3 / Schism 4 / Schism 5 / Schism 7。
	   ② 引用白名单只收了大写 <<He>>，漏了小写 <<he>>/<<him>>/<<his>>/<<hers>>/<<their>> ——
	      而 DoL 正文里小写才是常用写法，于是 20 条「用小写代词却不生成 NPC」的段落留在列表里，
	      点下去照样报「未能定义代词」+ bad conditional expression。样例：Farm Assault Intercept Wraith /
	      Forest Wraith Gwylan 7 / Nightmare Corrupt Sydney 4,5,7,11。
	   名单改成从游戏文件里实际存在的 widget 名列出来的（`开发检查脚本` 扫全游戏 5094 个 widget），
	   不靠手写前缀猜 —— 前缀写法会误伤：`<<he` 会命中 `<<head_down>>`，`<<his` 会命中 `<<hirsuteHideCheck>>`。
	   另外：DoL 没有 <<she>> / <<her>> / <<hir>> 这些 widget（男女一律用 <<he>>，由代词表决定渲染成他/她），
	   所以它们不该出现在白名单里 —— 这也解释了为什么女性 NPC 报的错也是「未能定义代词到"He"」。 */
	fs.COLD_NPC_REF = [
		'<<person',                 /* person / person1..6 / personselect / personname / personsimple / person_dance … */
		'<<He>>', '<<he>>', '<<Hes>>', '<<hes>>', '<<He_Short>>',
		'<<Him>>', '<<him>>', '<<His>>', '<<his>>',
		'<<his1>>', '<<his2>>', '<<his3>>', '<<his4>>', '<<his5>>', '<<his6>>', '<<hisselect>>',
		'<<Hers>>', '<<hers>>', '<<their>>', '<<himself>>',
		'<<man>>', '<<woman>>', '<<girl>>', '<<Girl>>', '<<girls>>',
		'<<stateman>>', '<<actionsman>>', '<<effectsman>>', '<<beasttype>>', '<<beastspeech>>'
	];
	/* 生成器改用正则，不再用前缀数组。真实存在的生成器有 170+ 个
	   （generate1..6、generatey1..6、generateym/yf/yp/yv 1..6、generatef/m/s/sf/sm/v/p 1..6、
	     generatebear/boar/cat/dog/dolphin/fox/lizard/pig/snake/spider/wolf 1..6、
	     generateNPC、generateWraith、generateCultist、generateDemon、generatePolice、generate_* …），
	   逐个列数组必然再漏一次。规则：`<<generate` + 名字里带数字，或 + 已知的（可带参数的）具名生成器。 */
	fs.COLD_NPC_GEN_RE = /<<generate(?:[a-z_]*[0-9]|NPC\b|Wraith\b|Cultist\b|Demon\b|Police\b|Security\b|Manager\b|Doctor\b|Initiate\b|Confessor\b|AdultShopCustomer\b|RandomTeacher\b|Sailor\b|Mickey\b|Plant\b|_)/i;
	fs.COLD_NPC_GEN = ['<<generate'];   /* 旧名字保留供别处引用；判定已改用上面的正则 */
	fs.canEnterCold = function (name) {
		try {
			var src = fs.passageText ? fs.passageText(name) : '';
			if (!src) return true;
			/* ① 有显式先决 flag 的，直接判不可空手进 */
			for (var i = 0; i < fs.COLD_BLOCK.length; i++) {
				if (src.indexOf(fs.COLD_BLOCK[i]) !== -1) return false;
			}
			/* ② 引用场景 NPC 却不自己生成 → 同样不可空手进 */
			var hasRef = false, k;
			for (k = 0; k < fs.COLD_NPC_REF.length; k++) if (src.indexOf(fs.COLD_NPC_REF[k]) !== -1) { hasRef = true; break; }
			if (hasRef && !fs.COLD_NPC_GEN_RE.test(src)) return false;
			return true;
		} catch (e) { return true; }
	};
	/* 全量判定一次并缓存（889 条逐个查 DOM 太贵，只在第一次算）。
	   ⚠️ 验证还发现第二类坏条目：名单里有段落名在当前版本根本不存在
	   （例：`Street Prostitution Robbery` —— 点下去报「段落不存在」）。
	   这跟"不能空手进"是同一类问题：都是"列了个点了不对的东西"，所以一起剔除。
	   分两类计数，日志里能看出各有多少。 */
	var _coldCache = null, _coldStat = null;
	fs.coldBlocked = function () {
		try {
			if (_coldCache) return _coldCache;
			var out = {}, missing = 0, needsFlow = 0;
			var all = fs.storyBattles || [];
			for (var i = 0; i < all.length; i++) {
				var n = all[i];
				var src = fs.passageText ? fs.passageText(n) : '';
				if (!src) { out[n] = 1; missing++; continue; }      /* 段落不存在 → 死链，剔除 */
				if (!fs.canEnterCold(n)) { out[n] = 1; needsFlow++; }
			}
			_coldCache = out;
			_coldStat = { missing: missing, needsFlow: needsFlow, total: all.length };
			fs.log('剧情直达：剔除 ' + (missing + needsFlow) + ' / ' + all.length +
				' 条（段落不存在 ' + missing + ' 条 / 需按流程进 ' + needsFlow + ' 条）');
			return out;
		} catch (e) { return {}; }
	};
	fs.coldStat = function () { return _coldStat; };

	/* 直跳预览的醒目警告（ 用户选的方案：保留这一块，但如实标注）。
	   为什么要写这段话：验证清空场景状态后抽样 12 条直跳，7 条（58%）报错。
	   缺的不是 NPC（那一类已经被 canEnterCold 滤掉），而是遭遇进行中的其它状态 ——
	   <<struggle>> / <<endcombat>> / <<endevent>> / <<exitWraith>> 这类宏在场景外必炸，
	   而这类没有文本特征可筛，判据做不到"列出来就一定不报错"。所以只能如实告诉玩家。 */
	fs.coldJumpWarning = function () {
		return '<div class="fs-sub" style="border-left:2px solid #ff6b6b;padding:.2em 0 .2em .5em;color:#ff9a9a">' +
			'<span class="red">⚠ 这一块是原版遭遇段落的「直跳预览」，不是正式入口。</span><br>' +
			'这些段落都假定「遭遇已经在进行中」。直接跳进去会缺前置状态而报错' +
			'（验证：清空场景状态后抽样 12 条，7 条报错）。<br>' +
			'想看某条场景，建议按正常流程走到那里；直跳看坏了读档即可，不影响存档本身。' +
			'</div>';
	};

	/* 剧情战斗列表（可搜索 / 可展开全部） */
	fs.cheatStoryHtml = function (filter) {
		var blocked = fs.coldBlocked();
		var all = fs.storyBattles || [];
		var list = all.filter(function (x) { return !blocked[x]; });
		var nBlocked = all.length - list.length;
		var st = fs.coldStat ? fs.coldStat() : null;
		var note = nBlocked ? ('<div class="fs-sub">已剔除 <span class="gold">' + nBlocked +
			'</span> 条不列在这里：' +
			(st ? ('段落在本版本不存在 ' + st.missing + ' 条、需要按剧情流程进入 ' + st.needsFlow + ' 条') : '不满足直达条件') +
			'（后者直接跳进去会缺前置状态、必然报错）。</div>') : '';
		var f = String(filter || '').toLowerCase().trim();
		var h = [];
		h.push(fs.coldJumpWarning());
		if (note) h.push(note);
		if (f) {
			var hit = [];
			for (var i = 0; i < list.length; i++) if (list[i].toLowerCase().indexOf(f) !== -1) hit.push(list[i]);
			hit.sort();
			h.push('<div class="fs-sub">搜索「' + f.replace(/[<>&]/g, '') + '」命中 <span class="gold">' + hit.length + '</span> 条</div>');
			if (hit.length > 120) h.push('<div class="fs-sub">（只显示前 120 条，再输几个字缩小范围）</div>');
			for (var j = 0; j < Math.min(hit.length, 120); j++) h.push(btn(fs.storyBattleLabel ? fs.storyBattleLabel(hit[j]) : hit[j], 'goto', hit[j], hit[j]) + '<br>');
			return h.join('');
		}
		/* 没搜索：按分组折叠；另给一个"全部展开" */
		var shown = {};
		for (var g = 0; g < fs.cheatStoryGroups.length; g++) {
			var name = fs.cheatStoryGroups[g][0], re = fs.cheatStoryGroups[g][1], got = [];
			for (var k = 0; k < list.length; k++) if (re.test(list[k])) { got.push(list[k]); shown[list[k]] = 1; }
			if (!got.length) continue;
			got.sort();
			h.push('<details class="fs-console-group"><summary>' + name + '（' + got.length + '）</summary><div>');
			for (var m = 0; m < got.length; m++) h.push(btn(fs.storyBattleLabel ? fs.storyBattleLabel(got[m]) : got[m], 'goto', got[m], got[m]) + '<br>');
			h.push('</div></details>');
		}
		var rest = [];
		for (var p = 0; p < list.length; p++) if (!shown[list[p]]) rest.push(list[p]);
		rest.sort();
		h.push('<details class="fs-console-group"><summary>其余剧情战斗（' + rest.length + '）</summary><div>');
		for (var q = 0; q < rest.length; q++) h.push(btn(fs.storyBattleLabel ? fs.storyBattleLabel(rest[q]) : rest[q], 'goto', rest[q], rest[q]) + '<br>');
		h.push('</div></details>');
		return h.join('');
	};

	/* 搜索：同时搜「作弊功能」和「剧情段落」；输 94 出彩蛋（不列在控制台里，只有输才出现） */
	fs.cheatSearchIndex = function () {
		return [
			{ label: '解锁所有古董', kw: '古董 文物 博物馆 antique museum 收藏', act: 'museum' },
			{ label: '解锁全部成就', kw: '成就 feats 达成', act: 'feats' },
			{ label: '解锁所有食谱', kw: '食谱 料理 做饭 recipe food', act: 'recipes' },
			{ label: '解锁所有服装', kw: '服装 衣服 衣柜 穿搭 clothes wardrobe', act: 'clothes' },
			{ label: 'NPC 关系全满', kw: '关系 好感 信任 npc relation love', act: 'relations' },
			{ label: '成就币 +100', kw: '成就币 币 点数 vrelcoin', act: 'coins' },
			{ label: '钱 +100万', kw: '钱 金钱 金币 money', act: 'money' },
			{ label: '技能属性拉满', kw: '技能 属性 数值 拉满 skill stat', act: 'skills' },
			{ label: '玖肆好感 +100', kw: '玖肆 94 好感 jiusi', act: 'jiusi' },
			{ label: '跳到周一晚上 19:00', kw: '时间 周一 星期一 晚上 monday', act: 'monday' },
			{ label: '跳到周二早上 6:00', kw: '时间 周二 星期二 早上 tuesday', act: 'tuesday' },
			{ label: '时间 +1 小时', kw: '时间 一小时', act: 'adv60' },
			{ label: '时间 +8 小时', kw: '时间 八小时', act: 'adv480' }
		];
	};

	/* 搜索结果的渲染：作弊功能 + 剧情段落；94 → 彩蛋 */
	fs.cheatSearchHtml = function (filter) {
		var f = String(filter || '').toLowerCase().trim();
		if (!f) return fs.cheatStoryHtml('');
		/* 彩蛋：输 94（也容忍「九四 / 玖肆」）→ 玖肆留下的记录。不列在控制台里，只有输才出。 */
		if (f === '94' || f === '九四' || f === '玖肆') {
			if (typeof fs.rsEggHtml === 'function') return fs.rsEggHtml();
			return '<div class="fs-sub">（彩蛋模块未加载）</div>';
		}
		var h = [];
		var acts = fs.cheatSearchIndex(), hitA = [];
		for (var i = 0; i < acts.length; i++) {
			var a = acts[i];
			if ((a.label + ' ' + a.kw).toLowerCase().indexOf(f) !== -1) hitA.push(a);
		}
		/* ⚠️ 这里原来直接用 fs.storyBattles 全量 889 条，完全没过冷进入判据 ——
		   而用户实际就是从「搜索」这条路点到那条必然报错的段落的（`Adult Shop Night Guard Molestation`
		   正好是 storyBattles[0]，在搜索框里输任何字它都排在最前面，跟用户截图完全对得上）。
		   判据只在「不搜索」的默认分支里生效 = 形同虚设。现在两边走同一套判据。 */
		var _blkS = fs.coldBlocked();
		var list = (fs.storyBattles || []).filter(function (x) { return !_blkS[x]; }), hitS = [];
		for (var j = 0; j < list.length; j++) if (list[j].toLowerCase().indexOf(f) !== -1) hitS.push(list[j]);
		hitS.sort();

		h.push('<div class="fs-sub">搜索「' + f.replace(/[<>&]/g, '') + '」→ 作弊功能 <span class="gold">' + hitA.length +
			'</span> 项 / 剧情段落 <span class="gold">' + hitS.length + '</span> 条</div>');
		if (hitA.length) {
			h.push('<span class="fs-tag">◆ 作弊功能</span><br>');
			for (var k = 0; k < hitA.length; k++) h.push(btn(hitA[k].label, hitA[k].act) + '　');
			h.push('<br><br>');
		}
		if (hitS.length) {
			h.push(fs.coldJumpWarning());
			h.push('<span class="fs-tag">◆ 剧情段落（点进去看玖肆是否乱入）</span><br>');
			if (hitS.length > 120) h.push('<div class="fs-sub">（只显示前 120 条，再输几个字缩小范围）</div>');
			for (var m = 0; m < Math.min(hitS.length, 120); m++) h.push(btn(hitS[m], 'goto', hitS[m], hitS[m]) + '<br>');
			h.push('<br>');
		}
		if (!hitA.length && !hitS.length) h.push('<div class="fs-sub">没有匹配项。</div>');
		return h.join('');
	};

	/* ================= 角色专属事件 / 长线剧情 =================
	   ⚠️ 这里不再用 setup.debugMenu 的 Character / Events 分类。
	   那一栏是原版调试菜单的，装的是「默认诱惑 / 变得诱惑 / 躲藏 / 容貌」这类外观与身体状态作弊项，
	   根本不是角色剧情 —— 用户一眼就看出来了（「角色专属事件里面哪来的躲藏容貌纯洁下降这些东西」）。
	   我当初的错在于把原版的 `Character` 分类硬当成「角色专属事件」，标签和内容对不上。
	   现在改成自己维护的清单，每一段的段落名都逐条核对过真实存在（`verify_story_entries.cjs` 会卡）。
	   标签是对段落名的直译，不编剧情。 */
	fs.charEvents = [
		['凯拉 Kylar', [
			['绑架开场（地下室）', 'Kylar Abduction Intro'],
			['地下室', 'Kylar Basement'],
			['万圣节', 'Kylar Halloween Start'],
			['监狱相遇', 'Prison Kylar Intro'],
			['卧室摄像头', 'Bedroom Kylar Camera'],
		]],
		['罗宾 Robin', [
			['卧室', 'Robin Room Bed Intro'],
			['耻辱柱', 'Robin Pillory Intro'],
			['地下舞台', 'Underground Robin Stage Intro'],
			['森林服装', 'Robin Forest Costume Intro'],
			['校医务室', 'School Infirmary Robin CD Intro'],
		]],
		['惠特尼 Whitney', [
			['街头咖啡馆', 'Street Alex Cafe Whitney Intro'],
			['假阳具小偷', 'Whitney Dildo Thief'],
			['成人商店拍打', 'Adult Shop Whitney Spank Agree'],
		]],
		['艾弗里 Avery', [
			['扑克开场', 'Avery Cards Intro'],
			['办公室助理', 'Avery Office Assistant Intro'],
			['解雇', 'Avery Dismissal Intro'],
			['情人节错过', 'Avery Valentines Missed Intro'],
			['酒吧冬季歌唱', 'Avery Pub Winter Sing Intro'],
		]],
		['伊登 Eden', [
			['故事开始', 'Eden Story Begins'],
			['故事继续', 'Eden Story Continues'],
			['温泉', 'Eden Spring Intro'],
			['木筏', 'Eden Raft Intro'],
			['洗浴', 'Eden Bath Wash Intro'],
		]],
		['西德尼 Sydney', [
			['神殿·纯净', 'SV Sydney Temple Pure'],
			['神殿·腐化', 'SV Sydney Temple Corrupt'],
			['后室开场', 'Sydney Backroom Intro'],
			['后室邀请', 'Sydney Backroom Invitation Enter'],
		]],
		['雷顿 Leighton', [
			['警察局', 'Police Leighton'],
			['泳池惩罚', 'Pool Leighton Nude Punishment'],
			['扑克牌局', 'Avery Cards Leighton'],
		]],
		['贝利 Bailey', [
			['农场对峙', 'Farm Cottage Bailey Confront'],
			['农场拦截', 'Farm Assault Intercept Bailey'],
		]],
		['布莱尔 Briar', [
			['办公室', "Briar's Office"],
			['身份证', "Briar's Office ID"],
			['机器询问', 'Briar Machine Ask'],
		]],
	];

	fs.storyArcs = [
		['海岛', [
			['建造', 'Island Build'],
			['木筏', 'Island Build Raft'],
		]],
		['博物馆 · 无望循环', [
			['故事', 'Museum Hopeless Cycle Story'],
			['画作', 'Museum Hopeless Cycle Painting'],
			['挑战', 'Museum Hopeless Cycle Story Challenge'],
		]],
		['象牙幽灵', [
			['分裂', 'Schism'],
			['测试开场', 'Wraith Test Start'],
		]],
		['多米努斯 Domus', [
			['画作', 'Domus Painting'],
			['阁楼画作', 'Domus Loft Painting'],
			['窗户', 'Domus Window'],
		]],
		['农场绑架', [['开场', 'Farm Abduction wake']]],
		['荒野绑架', [['开场', 'Moor Abduction']]],
		['森林小屋', [['小屋', 'Forest Cabin']]],
		['街头绑架', [['醒来', 'Street Kidnap Wake']]],
		['街机厅绑架', [['被绑', 'Arcade Tenyclus Kidnapped']]],
		['妓院地下室', [['地下室', 'Brothel Basement']]],
		['迷宫画作', [['画作', 'Maze Painting']]],
	];

	/* 通用渲染：[[组名, [[标签, 段落名], …]], …] → 可搜索的分组列表 */
	fs.storyListHtml = function (groups, filter, titleTag) {
		var f = String(filter || '').toLowerCase().trim();
		var h = [];
		var total = 0, shown = 0;
		for (var g = 0; g < groups.length; g++) {
			var gname = groups[g][0], items = groups[g][1] || [];
			var hit = [];
			for (var i = 0; i < items.length; i++) {
				total++;
				var label = items[i][0], pas = items[i][1];
				if (f && (label.toLowerCase().indexOf(f) === -1 && pas.toLowerCase().indexOf(f) === -1 && gname.toLowerCase().indexOf(f) === -1)) continue;
				hit.push(items[i]);
			}
			if (!hit.length) continue;
			shown += hit.length;
			h.push('<div class="fs-story-group"><span class="fs-tag">◆ ' + gname + '</span><br>');
			for (var k = 0; k < hit.length; k++) {
				h.push(btn(hit[k][0], 'goto', hit[k][1], hit[k][1]) + '　');
			}
			h.push('</div>');
		}
		if (f) h.unshift('<div class="fs-sub">搜索「' + f.replace(/[<>&]/g, '') + '」命中 <span class="gold">' + shown + '</span> / ' + total + ' 条</div><br>');
		if (!shown && f) h.push('<div class="fs-sub">没有命中。可以试：凯拉 / 海岛 / 博物馆 / 绑架 / 幽灵</div>');
		return h.join('');
	};
	fs.charEventsHtml = function (filter) { return fs.storyListHtml(fs.charEvents, filter); };
	fs.storyArcHtml = function (filter) { return fs.storyListHtml(fs.storyArcs, filter); };

	fs.cheatHtml = function () {
		var h = [];
		h.push('<span class="fs-tag">◆ 一键作弊（测试用）</span>');
		h.push('<div class="fs-sub">' + fs.cheatState() + '</div>');
		h.push('<div class="fs-sub">' + fs.cheatProgress() + '</div>');
		h.push('<div id="fs-cheat-msg" class="fs-sub"></div><br>');

		h.push('<span class="fs-tag">◆ 解锁</span><br>');
		h.push(btn('解锁所有古董', 'museum') + '　');
		h.push(btn('解锁全部成就', 'feats') + '　');
		h.push(btn('解锁所有食谱', 'recipes') + '　');
		h.push(btn('解锁所有服装', 'clothes', null, '把每件衣服都塞进衣柜（会很多件）') + '<br>');
		h.push(btn('一键全解锁食物', 'food', null, '把 22 种常驻食物字段一次拉满') + '　');
		h.push(btn('NPC 关系全满', 'relations') + '　');
		h.push(btn('成就币 +100', 'coins') + '　');
		h.push(btn('钱 +100万', 'money') + '　');
		h.push(btn('技能属性拉满', 'skills') + '　');
		h.push(btn('玖肆好感 +100', 'jiusi') + '<br><br>');

		h.push('<span class="fs-tag">◆ 时间（验玖肆的守候用）</span><br>');
		h.push(btn('跳到周一晚上 19:00', 'monday', null, '她该跟着你') + '　');
		h.push(btn('跳到周二早上 6:00', 'tuesday', null, '她不该再跟着') + '　');
		h.push(btn('时间 +1 小时', 'adv60') + '　');
		h.push(btn('时间 +8 小时', 'adv480') + '<br>');
		return h.join('');
	};

	/* ---------- 地点与剧情直达（从「作弊功能」里拆出来，别再一股脑塞一起） ---------- */
	fs.goHtml = function () {
		var h = [];
		h.push('<span class="fs-tag">◆ 地点直达</span><br>');
		for (var i = 0; i < fs.cheatPlaces.length; i++) {
			h.push(btn(fs.cheatPlaces[i][0], 'goto', fs.cheatPlaces[i][1], fs.cheatPlaces[i][1]) + '　');
			if ((i + 1) % 6 === 0) h.push('<br>');
		}
		h.push('<br><br>');
		h.push('<span class="fs-tag">◆ 剧情直达</span><br>');
		h.push('<div class="fs-sub">搜索剧情战斗段落，点进去看她是否还会乱入。</div>');
		h.push('<input type="text" id="fs-cheat-search" placeholder="搜索剧情（例：Wraith / Elk；也能输 94）" style="width:70%">　');
		h.push(btn('清空', 'searchclear') + '<br>');
		h.push('<div id="fs-cheat-story" class="fs-cheat-scroll">' + fs.cheatSearchHtml('') + '</div>');
		return h.join('');
	};

	/* 刻印遭遇列表 —— 用 JS 生成，替掉原来那段 <<for>> 写法。
	   原来：<<for _k range finalStar.sealList>><<capture _k>><<link [[<<print finalStar.seals[_k].name>>|FS Console Seal]]>>…
	   SugarCube 的 <<for _x range array>> 取的是下标（0,1,2…），所以 finalStar.seals[_k] 是 undefined，
	   再取 .name 就是 "Cannot read properties of undefined (reading 'name')"（交接文档 §4.4 的原话）。 */
	fs.consoleSealHtml = function () {
		try {
			var list = fs.sealList || [];
			var h = [];
			for (var i = 0; i < list.length; i++) {
				var key = list[i];
				var s = (fs.seals && fs.seals[key]) ? fs.seals[key] : null;
				var label = s && s.name ? s.name : String(key);
				h.push('<a href="javascript:void(0)" data-fs-seal="' + key + '" title="' + String(key) + '">' + label + '</a>');
			}
			return h.join('　');
		} catch (e) { return '<span class="red">刻印列表生成失败：' + e.message + '</span>'; }
	};

	/* 分区内过滤：原版调试菜单的条目是 <div id="Group-N"><a>名字</a>…</div>，
	   这里按文本命中把不匹配的 div 隐藏掉（不动原版数据）。 */
	fs.consoleFilter = function (el) {
		try {
			var q = String((el && el.value) || '').toLowerCase().trim();
			var host = document.getElementById('fs-console-shown');
			if (!host) return 0;
			var list = host.querySelector('.fs-debug-list');
			if (!list) return 0;
			var rows = list.children, shown = 0;
			for (var i = 0; i < rows.length; i++) {
				var r = rows[i];
				if (r.tagName !== 'DIV') continue;          /* 只处理条目行 */
				var hit = !q || ((r.textContent || '').toLowerCase().indexOf(q) !== -1);
				r.style.display = hit ? '' : 'none';
				if (hit) shown++;
			}
			return shown;
		} catch (e) { return 0; }
	};

	/* 控制台子标签切换：标记选中 + 把对应分区渲染进 #fs-console-shown。
	   分区是 <<widget "fs_console_sec_N">>，里面全是 SugarCube 宏（<<link>> / <<icon>>），
	   所以不能用 JS 拼字符串，必须走 jQuery(...).wiki() 让引擎去跑宏
	   —— 和 fs-core.js 打开设置面板用的是同一招（jQuery(bodyEl).wiki('<<fs_panel_settings>>')）。 */
	fs.consoleTabPick = function (el) {
		try {
			var n = (el && el.getAttribute) ? el.getAttribute('data-fs-sec') : null;
			if (n === null || n === undefined) return false;
			var row = document.getElementById('fs-console-tabs');
			if (row) {
				var btns = row.querySelectorAll('button');
				for (var i = 0; i < btns.length; i++) btns[i].classList.remove('fs-tab-on');
			}
			if (el.classList) el.classList.add('fs-tab-on');
			var host = document.getElementById('fs-console-shown');
			/* ⚠️ 必须先 empty()：jQuery(el).wiki() 是追加到元素里，不是替换。
			   不 empty 的话每切一次标签就把新分区叠在旧分区后面（验证容器从 2362 涨到 3469 字符、
			   标题还停在第一个分区）。 */
			if (host && window.jQuery) jQuery(host).empty().wiki('<<fs_console_sec_' + n + '>>');
			return true;
		} catch (e) { fs.warn('控制台标签切换失败: ' + e.message); return false; }
	};

	/* 点击委派：只装一次
	   ⚠️⚠️ 必须是捕获阶段（第三个参数 true），不能用冒泡！
	   实机验证（0.5.12.13）：控制台整个挂在 #customOverlay 里，
	   `#customOverlay` 那条链上有人在捕获阶段调了 stopPropagation() ——
	   于是挂在 document 上的冒泡监听器永远不会触发：
	   capture 阶段的探针监听器计数 1、bubble 阶段计数 0、动作函数一次都没被调到。
	   表现就是问题记录的「大部分控制台功能失效：点全解锁古董 / 传送地点都没反应」——
	   按钮渲染得好好的（966 个可点条目），点下去什么都不发生，连一点报错都没有。
	   `fs-links.js` 的背包「吃一份」委派早就用了捕获（`}, true);`），所以背包是好的、控制台是死的。
	   （同理：`dispatchEvent` / `click()` 都一样无效 —— 事件根本没走到目标。）
	   教训："渲染出来了" ≠ "能点"。探针必须真的点一下、并核对副作用。 */
	if (!fs._cheatBound) {
		fs._cheatBound = true;
		document.addEventListener('click', function (ev) {
			var el = ev.target;
			/* 刻印按钮 */
			while (el && el !== document && !(el.getAttribute && (el.getAttribute('data-fs-cheat') || el.getAttribute('data-fs-seal')))) el = el.parentNode;
			if (!el || el === document || !el.getAttribute) return;
			var sealKey = el.getAttribute('data-fs-seal');
			if (sealKey) {
				try { fs.consoleSeal(sealKey); } catch (e) { }
				fs.cheatJump('FS Console Seal');
				return false;
			}
			var act = el.getAttribute('data-fs-cheat');
			var arg = el.getAttribute('data-fs-arg');
			var msg = '';
			try {
				if (act === 'museum') msg = fs.cheatMuseum();
				else if (act === 'feats') msg = fs.cheatFeats();
				else if (act === 'recipes') msg = fs.cheatRecipes();
				else if (act === 'clothes') msg = fs.cheatClothes();
				else if (act === 'food') msg = fs.cheatFood(99);
				else if (act === 'relations') msg = fs.cheatRelations();
				else if (act === 'coins') msg = fs.cheatCoins(100);
				else if (act === 'money') msg = fs.cheatMoney(1000000);
				else if (act === 'skills') msg = fs.cheatSkills();
				else if (act === 'jiusi') msg = fs.cheatJiusi(100);
				else if (act === 'monday') msg = fs.cheatTimeMonday();
				else if (act === 'tuesday') msg = fs.cheatTimeTuesdayMorning();
				else if (act === 'adv60') msg = fs.cheatTimeAdvance(60);
				else if (act === 'adv480') msg = fs.cheatTimeAdvance(480);
				else if (act === 'searchclear') {
					var inp = document.getElementById('fs-cheat-search');
					if (inp) inp.value = '';
					var box0 = document.getElementById('fs-cheat-story');
					if (box0) box0.innerHTML = fs.cheatSearchHtml('');
					return false;
				}
				else if (act === 'goto') { fs.cheatJump(arg); return; }
				else return;
			} catch (e) { msg = '出错：' + e.message; }
			/* 就地回显 + 刷新状态/完成度行 */
			try {
				var box = document.getElementById('fs-cheat-msg');
				if (box) box.innerHTML = '<span class="gold">' + msg + '</span>';
			} catch (e) { }
			fs.log('作弊面板：' + msg);
			return false;
		}, true);                                    /* ← 捕获阶段，见上面的说明 */
		/* 搜索框：输入即筛选（input 在 overlay 里能冒泡到 document，验证有效；
		   照样加捕获，免得以后 overlay 改动后又静默失效） */
		document.addEventListener('input', function (ev) {
			var t = ev.target;
			if (!t || !t.id) return;
			if (t.id === 'fs-cheat-search') {
				var box = document.getElementById('fs-cheat-story');
				if (box) box.innerHTML = fs.cheatSearchHtml(t.value);
			} else if (t.id === 'fs-char-search') {
				var b2 = document.getElementById('fs-char-box');
				if (b2) b2.innerHTML = fs.charEventsHtml(t.value);
			} else if (t.id === 'fs-story-search') {
				var b3 = document.getElementById('fs-story-box');
				if (b3) b3.innerHTML = fs.storyArcHtml(t.value);
			} else if (t.id === 'fs-origin-search') {
				var b4 = document.getElementById('fs-origin-box');
				if (b4) b4.innerHTML = fs.originHtml(t.value);
			}
		}, true);
	}

	/* ============ 原创事件一览（测试用） ============
	   设计说明：控制台要多一个「所有原创事件」的分类，方便在实机上逐条点，确认我们加的内容会不会报错。
	   只列**入口**段落（不列中途续篇）；带状态的段落（遭遇战 / 赌桌 / 对峙）跳进去可能缺前置，
	   看到报错先记段落名，再按正常流程复现。 */
	fs.originEvents = [
		['玖肆线 · 初遇与日常', [
			['布告板上的纸条', 'Orphanage Mysterious Note'], ['揭下纸条', 'Orphanage Note Hidden'], ['把纸条给贝利', 'Orphanage Note Bailey'], ['卧室夜访（初遇）', 'Bedroom Night Visitor'], ['孤儿院聊天', 'Orphanage Talk Jiusi'], ['和玖肆调情', 'Orphanage Flirt Jiusi'], ['实验室钥匙', 'Orphanage Talk Jiusi Key'], ['发现她在跟踪你', 'Jiusi Stalk Discovered'], ['玖肆失望', 'FS Jiusi Disappointed']
		]],
		['玖肆线 · 摩根', [
			['告诉她摩根的事', 'Jiusi Morgan Tell'], ['医院摩根', 'Hospital Morgan Chat']
		]],
		['校园', [
			['校园抢东西', 'School Bully Event'], ['数学课霸凌（她出面）', 'Maths Bully Jiusi Stop'], ['数学课送信（她陪同）', 'FS Maths Note Jiusi'], ['偷偷拆信', 'FS Maths Note Peek'], ['校长办公室锁门', 'FS Head Office Locked'], ['校门口乞丐', 'School Beggar Event'], ['魔书调查', 'Magic Book Investigate']
		]],
		['赌场', [
			['赌场门口', 'Casino Jiusi'], ['赌场大厅', 'Casino Jiusi Lobby'], ['一楼赌桌', 'Casino Jiusi Table'], ['二楼赌桌', 'Casino Jiusi Second Floor'], ['三楼楼梯', 'Casino Jiusi Third Stairs'], ['应征工作', 'Casino Job Accept'], ['赌场 NPC 事件', 'Casino NPC Event'], ['当众高潮', 'FS Casino Orgasm'], ['再来一个', 'FS Casino Encore'], ['昏倒', 'FS Casino Faint']
		]],
		['洗脑丸与奴隶', [
			['战斗中塞药', 'FS Pill Use'], ['做面包', 'FS Pill Bread'], ['面包给出去', 'FS Pill Bread Give'], ['奴隶管理', 'FS Slaves'], ['让 ta 去赚钱', 'FS Slave Pay'], ['解决欲望', 'FS Slave Serve'], ['叫停', 'FS Slave Serve Stop'], ['让 ta 走开', 'FS Slave Kill'], ['贝利警告', 'FS Bailey Slave Warn'], ['玖肆警告', 'FS Jiusi Slave Warn']
		]],
		['贝利与银行', [
			['贝利回归警告', 'Bailey Return Notice'], ['银行大厅', 'Bank Hall'], ['银行昏倒', 'Bank Faint'], ['营业处', 'Bank Hall Counter'], ['ATM', 'Bank Hall ATM'], ['代理缴费设置', 'Bank Autopay'], ['掀信封给贝利看', 'FS Rent Envelope'], ['代缴完成', 'FS Rent Autopay Done']
		]],
		['魔女小屋', [
			['魔女小屋', 'Witch Hut'], ['商店', 'Witch Hut Shop'], ['手枪与子弹', 'Witch Hut Gun'], ['询问她', 'Witch Hut Ask']
		]],
		['地下洞穴', [
			['发现洞穴', 'Cave Discover'], ['洞口', 'Cave Entrance'], ['深入一层', 'Cave Explore'], ['洞穴战斗', 'Cave Fight'], ['洞穴尽头', 'Cave End'], ['把勋章给温特', 'Museum Witness Medal']
		]],
		['埋尸（现用流程）', [
			['开始拖尸', 'FS Corpse Start'], ['被路人发现', 'FS Corpse Discovered'], ['拖到花园', 'FS Corpse Arrive Garden'], ['埋下', 'FS Corpse Bury']
		]],
		['实验室', [
			['打开暗门', 'FS Lab Unlock'], ['实验室里面', 'FS Lab Inside'], ['纸箱菜单', 'FS Lab Box Menu'], ['那本日记', 'FS Lab Diary'], ['第 3 天相遇', 'FS Lab Third Day']
		]],
		['莫伦斯', [
			['灰色迷雾', 'FS Morans Fog'], ['醒来', 'FS Morans Wake'], ['苏梦棠家', 'FS Morans Home'], ['和她聊天', 'FS Morans Home Chat'], ['小镇事件·随机（日常）', 'FS Town Event'],
			['色情事件·随机', 'FS Erotic Scene'],
			['结局预览（A~E）与玖肆回归', 'FS Console Endings'],
			['童话书（结局后床头）', 'FS Book Test'],
			['魔书遭遇战·开场', 'FS Duel Intro'], ['魔书遭遇战·战斗', 'FS Duel Battle'], ['魔书遭遇战·胜利', 'FS Duel Win'], ['魔书遭遇战·失败', 'FS Duel Lose'],
			['城市枢纽（田字地图）', 'FS Morans City'], ['大地点·到达', 'FS Morans Arrive'], ['街区页（大→中）', 'FS Morans District'], ['走路（相邻街区）', 'FS Morans Walk'], ['服装店（真实购买）', 'FS Morans Street Clothes'],
			['大厦', 'FS Morans Tower'], ['大厦·十四层', 'FS Morans Tower Floor14'],
			['政府·台阶', 'FS Morans Government Steps'], ['政府·窗口', 'FS Morans Government Window'], ['政府·问话', 'FS Morans Government Talk'],
			['高档小区·大门', 'FS Morans Estate Gate'], ['高档小区·花园', 'FS Morans Estate Garden'],
			['便利店·货架', 'FS Morans Store Shelf'], ['便利店·收银', 'FS Morans Store Counter'],
			['诊所·挂号', 'FS Morans Clinic Desk'], ['诊所·诊室', 'FS Morans Clinic Room'],
			['马路（必遇事件）', 'FS Morans Road'], ['便利商店', 'FS Morans Store'], ['诊所', 'FS Morans Clinic'], ['旅店（住一晚）', 'FS Morans Inn'],
			['学校·前操场', 'FS Morans School'], ['学校·跑道', 'FS Morans School Run'], ['学校·走廊', 'FS Morans School Hall'],
			['学校·教室', 'FS Morans School Class'], ['学校·图书馆', 'FS Morans School Library'], ['学校·食堂', 'FS Morans School Canteen'], ['学校·天台', 'FS Morans School Roof'],
			['家·客厅', 'FS Morans Home Flat'], ['家·主卧', 'FS Morans Home Bed'], ['家·厨房', 'FS Morans Home Kitchen'], ['家·浴室', 'FS Morans Home Bath'], ['公园', 'FS Morans Park'], ['步行街', 'FS Morans Street'], ['学校', 'FS Morans School'], ['世界异变', 'FS Morans Anomaly'], ['时间遥变迷图', 'FS Morans Lost'], ['回头（A）', 'FS Morans Back'], ['拒绝', 'FS Morans Refuse'], ['掏出硬币（B）', 'FS Morans Coin'], ['拿出娃娃（C）', 'FS Morans Doll'], ['最终逃跑', 'FS Morans Chase']
		]],
		['饥饿 / 理智 / 感染 / 星光', [
			['饿晕', 'FS Hunger Faint'], ['无署名信封', 'FS Sanity Gift'], ['感染满值', 'FS Infect Full'], ['屋顶看星星', 'Rooftop Last Star'], ['清理存档异常数据', 'FS Clean Save']
		]],
		['背包与进食', [
			['背包', 'FS Bag'], ['坐下来吃点', 'FS Eat Here'], ['长桌面包', 'FS Bread Table'], ['射击', 'FS Shoot']
		]],
	];
	fs.originHtml = function (filter) { return fs.storyListHtml(fs.originEvents, filter); };

	fs.log('作弊面板已加载（地点 ' + fs.cheatPlaces.length + ' / 剧情战斗 ' + ((fs.storyBattles || []).length) + '）');
})();
