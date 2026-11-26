/* ============================================================
   终星 FinalStar —— 核心数据与工具
   （脚本顺序：framework.js → fs-core.js → 其它模块）
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* ---------- 魔书魔法技能 ---------- */
	fs.skills = {
		fs_heal: {
			key: 'fs_heal', name: '治疗术', icon: 'finalstar/skill-heal.png',
			colour: 'green', hint: '小幅降低疼痛值', order: -9
		},
		fs_assault: {
			key: 'fs_assault', name: '强攻术', icon: 'finalstar/skill-assault.png',
			colour: 'red', hint: '造成 150 点伤害', order: -8
		},
		fs_soulshake: {
			key: 'fs_soulshake', name: '荡魂术', icon: 'finalstar/skill-soulshake.png',
			colour: 'purple', hint: '大幅降低敌人怒气', order: -7
		}
	};
	fs.skillList = ['fs_heal', 'fs_assault', 'fs_soulshake'];
	fs.dailyCastLimit = 10;

	/* ---------- 段落跳转工具（修「点了没反应」类 bug） ----------
	   背景：本 mod 的 twee 里曾大量用 [[文字|$passage]] 表示"留在当前段落"。
	   但 SugarCube 2.36 里 passage 是内置函数 passage()，"$passage" 这个变量
	   引擎从未赋值。于是 [[关上背包|$passage]] 会去跳一个名叫 "$passage" 的段落 ——
	   它不存在，点击后什么也不发生（背包退不掉就是这么来的）。
	   下面这些函数是唯一正确入口；twee 里请用
	     <<run finalStar.goPassage()>>   —— 留在当前段落（重绘）
	     <<run finalStar.goPrevious()>>  —— 返回上一段
	   不要再写 $passage。 */

	/* 当前段落名（安全版） */
	fs.currentPassage = function () {
		try {
			if (typeof passage === 'function') return String(passage());
			if (window.SugarCube && SugarCube.State) return String(SugarCube.State.passage);
		} catch (e) { }
		return '';
	};

	/* 段落是否存在（挡住 "$passage" 这类无效目标） */
	fs.hasPassage = function (name) {
		name = String(name == null ? '' : name);
		if (!name || /^\$/.test(name)) return false;
		try {
			if (typeof has === 'function') return !!has(name);
			if (window.SugarCube && SugarCube.Story) return !!SugarCube.Story.get(name);
		} catch (e) { }
		return false;
	};

	/* 真正的跳转：延后到当前点击处理结束之后再执行。
	   为什么必须延后（踩过的坑）：
	   SugarCube 的 <<link [[文字|目标]]>> 会先跑链接里的代码，然后才跳到"目标"段落。
	   如果在点击回调里同步调 Engine.play()，我们刚跳走就被宏的目标覆盖 ——
	   表现就是"点了没反应"或跳到错的地方，而且怎么查代码都查不出问题。
	   放进 setTimeout(…,0) 让宏先走完，再执行我们的跳转，就不会被覆盖。 */
	fs._goto = function (name) {
		try {
			var to = String(name == null ? '' : name);
			if (!to) return false;
			setTimeout(function () {
				try { SugarCube.Engine.play(to); } catch (e) { }
			}, 0);
			return true;
		} catch (e) { return false; }
	};

	/* 跳到指定段落；目标无效或为空时退回当前段落。force=true 时即使目标就是
	   当前段落也重绘一次（刷新数值显示用）。 */
	fs.goPassage = function (name, force) {
		try {
			var to = String(name == null ? '' : name);
			if (!fs.hasPassage(to)) to = fs.currentPassage();
			if (!to) return false;
			var cur = fs.currentPassage();
			if (to === cur && !force) return true;
			return fs._goto(to);
		} catch (e) { return false; }
	};

	/* 返回上一段（"走开 / 离开 / 先放着"这类返回语义）
	   ⚠️  修：这个 SugarCube 版本里 **没有 previous() 函数**，
	     原来 `typeof previous === 'function'` 永远为 false，整条兜底路径变成
	     "重播当前段落" —— 表现就是菜单里点「走开」原地不动、永远出不来。
	     改用 State.history 取上一帧的段落名。 */
	fs.previousPassage = function () {
		try {
			var h = (window.SugarCube && SugarCube.State && SugarCube.State.history) ? SugarCube.State.history : null;
			if (h && h.length >= 2) {
				var m = h[h.length - 2];
				var p = String((m && m.passage) || '');
				if (p) return p;
			}
		} catch (e) { }
		try { if (typeof previous === 'function') return String(previous()); } catch (e) { }
		return '';
	};
	fs.goPrevious = function () {
		try {
			var pv = fs.previousPassage();
			var cur = fs.currentPassage();
			if (pv && pv !== cur && fs.hasPassage(pv)) return fs._goto(pv);
			/* 真的没有上一步（比如直接跳进来的调试场景）：回卧室，别把玩家困在菜单里 */
			if (fs.hasPassage('Bedroom') && cur !== 'Bedroom') return fs._goto('Bedroom');
			return fs.goPassage(cur, true);
		} catch (e) { return false; }
	};

	/* ---------- 死路兜底（维护说明 §6-F 第 29 条） ----------
	   本包此前缺这个能力（维护说明说  已加，但打出来的包里没有）。
	   规则收得很紧，避免把正常段落改花：
	     · 只管 `FS ` 开头的原创段落（原版段落不碰）；
	     · 正文里已经有任何可点元素（链接 / 按钮 / 原版 data-passage 链接）就什么都不做；
	     · 同一段落只补一次；出口走 goPrevious()（会自己找上一段，找不到才回卧室）。 */
	fs.deadEndGuard = function () {
		try {
			if (typeof State === 'undefined' || !State || !State.passage) return false;
			var name = String(State.passage);
			if (name.indexOf('FS ') !== 0) return false;
			var host = fs.passageHost ? fs.passageHost() : null;
			if (!host) return false;
			if (document.getElementById('fs-deadend')) return false;
			if (host.querySelector('a[data-passage], a.link-internal, button, input[type="button"]')) return false;
			var box = document.createElement('div');
			box.id = 'fs-deadend';
			var tip = document.createElement('span');
			tip.className = 'grey';
			tip.textContent = '（这里似乎走到了尽头。已自动为你准备出口。）';
			box.appendChild(document.createElement('br'));
			box.appendChild(tip);
			box.appendChild(document.createElement('br'));
			var a = document.createElement('a');
			a.className = 'link-internal';
			a.textContent = '继续';
			a.setAttribute('href', 'javascript:void(0)');
			a.onclick = function () { try { fs.goPrevious(); } catch (e) { } return false; };
			box.appendChild(a);
			host.appendChild(box);
			try { fs.log('死路兜底触发：' + name); } catch (e) { }
			return true;
		} catch (e) { return false; }
	};

	/* 记录"进背包之前在哪"，供关上背包精确返回。
	   侧栏按钮随时可点，单靠 previous() 猜不一定准，存一份最稳。 */
	fs.openBag = function () {
		try {
			var from = fs.currentPassage();
			if (fs.hasPassage(from) && from !== 'FS Bag') {
				try { if (window.SugarCube && SugarCube.State) SugarCube.State.variables.fs_bagFrom = from; } catch (e) { }
			}
		} catch (e) { }
		try { setTimeout(function () { try { SugarCube.Engine.play('FS Bag'); } catch (e) { } }, 0); } catch (e) { }
	};

	/* 关上背包：优先回到进背包前的段落。
	   注意本函数只负责跳转，链接的宏目标必须写成当前段落自己（FS Bag Close），
	   否则宏会在我们跳走之后再把我们拽回它自己的目标。 */
	fs.closeBag = function () {
		try {
			var from = '';
			try { if (window.SugarCube && SugarCube.State) from = String(SugarCube.State.variables.fs_bagFrom || ''); } catch (e) { }
			if (fs.hasPassage(from)) return fs._goto(from);
			return fs.goPrevious();
		} catch (e) { return false; }
	};

	/* ---------- 魔法刻印 ---------- */
	fs.seals = {
		assault: {
			key: 'assault', name: '强攻', icon: 'finalstar/seal-assault.png', price: 1500,
			/* 两个加成写在这里，别散落在代码里：
			   · hitBonus  —— 「空手」= 遭遇战里的「打击」按钮，由 fs.handleSealHit 结算
			   · spellBonus —— 魔书法术，由 fs.spells.assault.apply 结算（那边读的是同一个字段名，见下） */
			hitBonus: 150, spellBonus: 30,
			desc: '刻印在羊皮纸上的一柄断剑。空手打击造成的伤害增加 150，魔法造成的伤害增加 30。'
		},
		firststrike: {
			key: 'firststrike', name: '先动', icon: 'finalstar/seal-firststrike.png', price: 2000,
			desc: '一道凝固的闪电。魔书法术伤害 +10；疼痛或性奋达到上限时，你依然能翻开魔书——本模组的吟唱本来就不受这两项限制。'
		},
		counter: {
			key: 'counter', name: '反击', icon: 'finalstar/seal-counter.png', price: 500,
			desc: '一面小小的圆盾。遭遇战中受到伤害时（疼痛值增加），固定反击敌人 50 点伤害。'
		},
		alchemy: {
			key: 'alchemy', name: '炼金', icon: 'finalstar/seal-alchemy.png', price: 2500,
			desc: '瓶中流动的金色液体。你收到的任何钱都有 10% 概率变成双倍，另有 20% 概率不消耗金钱。'
		},
		/* ---- 以下 5 枚为 0.27 追加 ---- */
		bloodmoon: {
			key: 'bloodmoon', name: '血月', icon: 'finalstar/seal-bloodmoon.png', price: 3000,
			desc: '一轮暗红的残月。命中敌人时额外造成 20 点伤害，并把这份痛楚转回你身上——自身疼痛减少 20。'
		},
		echo: {
			key: 'echo', name: '回响', icon: 'finalstar/seal-echo.png', price: 3500,
			desc: '两道重叠的波纹。你施放的法术伤害增加 40，与强攻刻印的加成叠加。'
		},
		silence: {
			key: 'silence', name: '静默', icon: 'finalstar/seal-silence.png', price: 2800,
			desc: '一枚被布条缠住的钟。遭遇战中敌人每回合的怒气下降 50，攻势会越来越软。'
		},
		venom: {
			key: 'venom', name: '毒牙', icon: 'finalstar/seal-venom.png', price: 3200,
			desc: '一截细长的黑色獠牙。命中敌人后使其中毒 3 回合，每回合额外流失 15 点生命。'
		},
		starlight: {
			key: 'starlight', name: '星辉', icon: 'finalstar/seal-starlight.png', price: 8000,
			desc: '一点不肯熄灭的星光。遭遇战中每回合回复：疼痛 -25、压力 -50。'
		}
	};
	fs.sealList = ['assault', 'firststrike', 'counter', 'alchemy', 'bloodmoon', 'echo', 'silence', 'venom', 'starlight'];

	fs.hasSeal = function (key) {
		try { return Array.isArray(V.fsData.seals) && V.fsData.seals.includes(key); }
		catch (e) { return false; }
	};
	fs.equippedSeal = function () {
		try { return V.fsData.sealEquipped || 'none'; }
		catch (e) { return 'none'; }
	};
	fs.sealName = function (key) {
		if (!key || key === 'none') return '无';
		return fs.seals[key] ? fs.seals[key].name : '未知刻印';
	};
	fs.giveSeal = function (key) {
		if (!fs.seals[key]) return false;
		fs.ensureData();
		if (!V.fsData.seals.includes(key)) V.fsData.seals.push(key);
		return true;
	};
	/* 装备刻印：消耗品，被替换下来的刻印不返还 */
	fs.equipSeal = function (key) {
		if (!fs.seals[key]) return false;
		fs.ensureData();
		var idx = V.fsData.seals.indexOf(key);
		if (idx === -1) return false;
		V.fsData.seals.splice(idx, 1);   /* 消耗掉 */
		V.fsData.sealEquipped = key;
		return true;
	};

	/* ---------- 子弹 ---------- */
	fs.bullets = {
		soft: {
			key: 'soft', name: '软弹', icon: 'finalstar/bullet-soft.png', price: 50,
			damage: 30, kill: false,
			desc: '专攻于训练用的子弹，谁会买这种新手弹呢。对敌人造成 30 点伤害。'
		},
		silver: {
			key: 'silver', name: '银色子弹', icon: 'finalstar/bullet-silver.png', price: 150,
			damage: 100, kill: false,
			desc: '非正规的子弹。虽然杀伤力有限，但却是每一个特工的不二选择。对敌人造成 100 点伤害。'
		},
		normal: {
			key: 'normal', name: '子弹', icon: 'finalstar/bullet-normal.png', price: 300,
			damage: 300, kill: false,
			desc: '最普通的子弹，根本没有任何特别的。虽然响尾蛇并没有弄清楚，为什么普通子弹杀不死这里的人。对敌人造成 300 点伤害。'
		},
		silverrune: {
			key: 'silverrune', name: '银色雕纹子弹', icon: 'finalstar/bullet-silverrune.png', price: 500,
			damage: 100, kill: true,
			desc: '响尾蛇研制的特攻，所需极其繁琐，削减了其攻击力。对敌人造成 100 点伤害，且能击杀已命名角色。'
		},
		blackrune: {
			key: 'blackrune', name: '黑色雕纹子弹', icon: 'finalstar/bullet-blackrune.png', price: 700,
			damage: 5000, kill: true,
			desc: '响尾蛇使用特殊手段制造的特攻，能够发挥出原本的水平。对敌人造成 5000 点伤害，且能击杀已命名角色。'
		}
	};
	fs.bulletList = ['soft', 'silver', 'normal', 'silverrune', 'blackrune'];

	/* ---------- 魔女小屋：两个小药瓶 ----------
	   世界观依据（用户的小说）：**魔法**是上帝用来「帮助御神者对抗奇迹感染」的力量，
	   而感染是「沾染残次的奇迹」、最终会变成迷失生物 —— 所以「缓解感染」的药属于魔法体系；
	   「精神腐化会极大加速腐化进程」，所以「恢复理智」同样有设定支撑。
	   价格由用户拍板：缓解感染 £70、恢复理智 £100（便宜，因为是消耗品）。
	   ⚠️ 单位：表里 price 是**元**，扣款写 price * 100（分）—— 与刻印/子弹一致。 */
	fs.vials = {
		cleanse: {
			key: 'cleanse', name: '净化剂', icon: 'finalstar/vial-cleanse.png', price: 70,
			desc: '一瓶泛着青绿色微光的药水。它对残次的奇迹有中和作用——喝下去，感染会退一点。',
			infect: -15
		},
		clarity: {
			key: 'clarity', name: '清明剂', icon: 'finalstar/vial-sanity.png', price: 100,
			desc: '一瓶颜色偏蓝紫的药水，入口冰凉。它压得住那些在你脑子里反复响起的声音。',
			sanity: 20
		}
	};
	fs.vialList = ['cleanse', 'clarity'];
	fs.vialCount = function (key) {
		try { return Math.max(0, Number((V.fsData && V.fsData.vials && V.fsData.vials[key]) || 0)); } catch (e) { return 0; }
	};
	fs.buyVial = function (key) {
		try {
			var d = fs.vials[key]; if (!d) return false;
			V.fsData = V.fsData || {}; V.fsData.vials = V.fsData.vials || {};
			V.fsData.vials[key] = fs.vialCount(key) + 1;
			fs.log('买了 ' + d.name + '（现有 ' + V.fsData.vials[key] + ' 瓶）');
			return true;
		} catch (e) { return false; }
	};
	/* 使用：扣 1 瓶 → 生效。感染走本轮新补的 fs.infectAdd，理智走已有的 fs.sanityAdd。 */
	fs.useVial = function (key) {
		try {
			var d = fs.vials[key]; if (!d) return { ok: false, msg: '没有这种药。' };
			if (fs.vialCount(key) <= 0) return { ok: false, msg: '你身上没有' + d.name + '了。' };
			V.fsData.vials[key] = fs.vialCount(key) - 1;
			var notes = [];
			if (typeof d.infect === 'number' && typeof fs.infectAdd === 'function') {
				var before = fs.infect(); fs.infectAdd(d.infect);
				notes.push('感染 ' + before + ' → ' + fs.infect());
			}
			if (typeof d.sanity === 'number' && typeof fs.sanityAdd === 'function') {
				var b2 = fs.sanity(); fs.sanityAdd(d.sanity);
				notes.push('理智 ' + b2 + ' → ' + fs.sanity());
			}
			fs.log('用了 ' + d.name + '：' + notes.join('；'));
			return { ok: true, msg: '你喝下了' + d.name + '。', notes: notes };
		} catch (e) { return { ok: false, msg: '出错：' + e.message }; }
	};

	fs.bulletName = function (key) {
		var k = key || (V.fsData && V.fsData.currentBullet) || 'normal';
		return fs.bullets[k] ? fs.bullets[k].name : '未装填';
	};
	fs.bulletCount = function (key) {
		try { return (V.fsData.bullets && V.fsData.bullets[key]) || 0; }
		catch (e) { return 0; }
	};
	fs.giveBullets = function (key, n) {
		if (!fs.bullets[key]) return false;
		fs.ensureData();
		V.fsData.bullets[key] = (V.fsData.bullets[key] || 0) + (n || 1);
		return true;
	};
	fs.useBullet = function (key, n) {
		var have = fs.bulletCount(key);
		var need = n || 1;
		if (have < need) return false;
		V.fsData.bullets[key] = have - need;
		return true;
	};
	fs.setCurrentBullet = function (key) {
		if (!fs.bullets[key]) return false;
		fs.ensureData();
		V.fsData.currentBullet = key;
		return true;
	};
	/* 当前正在使用的子弹：优先选中的，否则挑一种有存货的 */
	fs.activeBullet = function () {
		fs.ensureData();
		var cur = V.fsData.currentBullet;
		if (cur && fs.bulletCount(cur) > 0) return cur;
		for (var i = 0; i < fs.bulletList.length; i++) {
			var k = fs.bulletList[i];
			if (fs.bulletCount(k) > 0) return k;
		}
		return cur || 'normal';
	};
	fs.bulletListText = function () {
		var out = [];
		for (var i = 0; i < fs.bulletList.length; i++) {
			var k = fs.bulletList[i];
			var n = fs.bulletCount(k);
			if (n > 0) out.push(fs.bullets[k].name + '×' + n);
		}
		return out.length ? out.join('、') : '（无备弹）';
	};
	/* 战斗面板里的弹药切换按钮（返回 HTML 字符串，供 widget 直接 print） */
	fs.bulletButtons = function () {
		var cur = fs.activeBullet();
		var html = '';
		for (var i = 0; i < fs.bulletList.length; i++) {
			var k = fs.bulletList[i];
			var n = fs.bulletCount(k);
			if (n <= 0) continue;
			var b = fs.bullets[k];
			var active = (k === cur) ? ' fs-active' : '';
			html += '<span class="fs-btn' + active + '" onclick="finalStar.setCurrentBullet(\'' + k + '\'); $.wiki(\'<<replace &quot;#fs-combat-slot&quot;>><<fs_combat_panel>><</replace>>\');">'
				+ b.name + '×' + n + '</span>';
		}
		return html || '<span class="fs-sub">（无备弹）</span>';
	};

	/* ---------- 战斗状态判断 ---------- */
	fs.hasBookInHand = function () {
		try {
			if (V.magicBook !== 1) return false;
			var h1 = V.worn && V.worn.handheld && V.worn.handheld.name;
			var h2 = V.worn && V.worn.handheld2 && V.worn.handheld2.name;
			return h1 === '魔法书' || h2 === '魔法书';
		} catch (e) { return false; }
	};
	fs.castsToday = function () {
		try { return (V.daily && V.daily.magicCasts) || 0; }
		catch (e) { return 0; }
	};
	fs.hasBook = function () {
		try { return Number(V.magicBook) === 1; } catch (e) { return false; }
	};
	/* 0.27：只要【拥有】魔书就能吟唱（不必握在手里），每日次数仍受限；
	   这样动作区一定会有「吟唱魔法」，法术由面板切换 */
	fs.canCast = function () {
		return fs.hasBook() && fs.castsToday() < fs.dailyCastLimit;
	};
	/* 动作区注入：射击（手枪在手）+ 吟唱魔法（拥有魔书），各只保留一个动作项。
	   由 twee 补丁在动作库锚点后调用 <<run finalStar.ensureActions(_leftaction)>> */
	fs.ensureActions = function (map) {
		try {
			if (!map || typeof map !== 'object') return false;
			var k;
			if (typeof fs.handHasPistol === 'function' && fs.handHasPistol()) {
				if (!map['射击']) map['射击'] = 'shoot';
			}
			if (fs.hasBook()) {
				for (k in map) {
					if (typeof map[k] === 'string' && map[k].indexOf('cast') === 0) delete map[k];
				}
				map[fs.canCast() ? '吟唱魔法' : '吟唱魔法（今日魔力已尽）'] = 'cast';
			}
			return true;
		} catch (e) { return false; }
	};
	fs.inCombat = function () {
		try {
			/* ⚠️ 原来只判 `V.combat === 1 && V.consensual !== 1` —— **不要求真的存在敌人**。
			   而原版在「被跟踪」这类遭遇的**开场文本**阶段就已经把 $combat 置 1 了：
			   那时正文还在描写被跟踪、动作按钮都还没出来，于是战斗物资面板提前冒了出来
			   （问题记录的「还没进入遭遇战呢，怎么会出现这个界面」）。
			   改成与 fs.inFight() 同一套「真的在打」判据：**必须有活着的敌人**
			   （原版遭遇战看 $enemyhealth，我们自己的洞穴战看 $fsMobHp）。 */
			if (typeof fs.inFight === 'function') {
				return fs.inFight() && V.consensual !== 1;
			}
			return Number(V.combat) === 1 && Number(V.enemyhealth) > 0 && V.consensual !== 1;
		} catch (e) { return false; }
	};

	/* ---------- 打开设置面板 ----------
	   踩坑记录（原实现是坏的，且不只影响一个入口）：
	     原写法 $.wiki('<<overlayReplace "finalStarPanel">>')
	   但本体的 <<overlayReplace>> 是个 switch 固定分支表的 widget：
	     <<switch _key>> <<case "characteristics">>… <<case "social">>… <<case "traits">>
	     <<case "journal">>… <<case "bait">>… <<case "export">>… <<case "outfitEditor">>… <</switch>>
	   它只做三件事：把 #customOverlayContainer 取消隐藏、设 $currentOverlay = 传入的 key、
	   然后按 key 填内容。"finalStarPanel" 不在任何 case 里 ——
	   容器照样弹出来，但内容是空的（还带着上一次的 $currentOverlay 残留）。
	   所以「模组设置」按钮点开是白板，这不是跳转问题，而是这个宏用错了。

	   正确做法：容器结构是
	     #customOverlayContainer (onclick=closeOverlay())
	       └ #customOverlay (onclick 阻止冒泡)
	           ├ #customOverlayTitle
	           └ #customOverlayContent   ← 我们只要自己填这两块
	   于是不再借用 overlayReplace，直接用 wikifier 把本模组的两个 widget 写进去。 */
	/* 真正把面板画出来（前提：段落已经渲染完毕，否则会被随后的导航关掉） */
	fs._paintOverlayPanel = function () {
		var $c = jQuery('#customOverlayContainer');
		if (!$c.length) return false;
		jQuery('#customOverlay').removeClass('hidden');
		$c.removeClass('hidden');
		jQuery('#customOverlay').attr('data-overlay', 'finalStarPanel');
		var titleEl = document.getElementById('customOverlayTitle');
		var bodyEl = document.getElementById('customOverlayContent');
		if (titleEl) { titleEl.innerHTML = ''; jQuery(titleEl).wiki('<<fs_title_panel>>'); }
		if (bodyEl) { bodyEl.innerHTML = ''; jQuery(bodyEl).wiki('<<fs_panel_settings>>'); }
		if (bodyEl && !bodyEl.innerHTML.length) { try { jQuery(bodyEl).wiki('<<fs_panel_settings>>'); } catch (e) { } }
		return !!(bodyEl && bodyEl.innerHTML.length);
	};

	fs.openOverlayPanel = function () {
		try {
			if (typeof jQuery !== 'function') return false;
			/* 关键：点击 <<link>> 之后，SugarCube 还会做一次段落导航，
			   而 DoL 的 #customOverlayContainer 是挂在 UI 栏里的，
			   导航会把整块 UI 栏重建 → 我们刚建好的面板被换成一个新的（hidden）。
			   验证证据：点击瞬间面板已建好（正文 3157 字符、hidden=false），
			   等点击流程走完再看，容器又变回 hidden=true。
			   所以必须等 ":passageend"（段落渲染结束）再画，否则等于白画。 */
			var mid = false;
			try { mid = !!(State && typeof State.isIdle === 'function' && State.isIdle() === false); } catch (e) { }
			if (mid) {
				if (!fs.__overlayPending) {
					fs.__overlayPending = true;
					jQuery(document).one(':passageend.fsOverlayOpen', function () {
						fs.__overlayPending = false;
						setTimeout(function () { try { fs._paintOverlayPanel(); } catch (e) { } }, 0);
					});
				}
				return true;
			}
			return fs._paintOverlayPanel();
		} catch (e) {
			try { fs.log('打开设置面板失败: ' + e.message); } catch (e2) { }
			return false;
		}
	};

	/* 兼容旧名字 */
	fs.openSettings = function () { return fs.openOverlayPanel(); };

	fs.log('核心数据已加载：' + fs.skillList.length + ' 个技能 / '
		+ fs.sealList.length + ' 枚刻印 / ' + fs.bulletList.length + ' 种子弹');

	fs.register('core', function () {
		fs.log('核心数据就绪');
		/* 死路兜底挂在渲染完成后（setTimeout 0 让正文先落地，再判断有没有链接） */
		if (fs.onDisplay) fs.onDisplay(function () { setTimeout(function () { try { fs.deadEndGuard(); } catch (e) { } }, 0); });
	});

})();
