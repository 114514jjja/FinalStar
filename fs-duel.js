/* fs-duel.js —— 魔书专属遭遇战（独立卡牌战斗系统）
 *
 * 用户规格（）：
 *   · 打完一次莫伦斯长线（任意结局）之后，小镇上随机刷新这种遭遇战；只有持有「魔书」才会遇到。
 *   · 独立战斗：玩家出牌（一回合一张），点「结束回合」后怪物攻击；疼痛达到上限判负。
 *   · 怪物是洞穴那一类生物，纯战斗、无性内容；对玩家造成的伤害就是疼痛。
 *   · 判负文本：一阵耀眼的闪光覆盖住身体得以幸存，代价是感染大幅上涨。
 *   · 手持制式手枪时：开场文本后半句换成「经历了这么多的战斗你不再胆怯」，
 *     卡组从魔法变成物理（飞踢、蓄力…）。
 *   · 魔书的刻印/额外效果可以提供额外出牌（先动刻印 +1 张）。
 *
 * 实现：状态都在 $fsData.duel 里，UI 由 duelHtml() 生成，段落 FS Duel Battle 负责刷新。
 */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;
	function tal(id) { try { return !!(fs.talentHas && fs.talentHas(id)); } catch (e) { return false; } }

	fs.duelMonsters = [
		{ key: 'crawler', name: '灰皮爬行者', hp: 260, atk: 22, desc: '四肢反关节，皮肤像被水泡过的纸。' },
		{ key: 'walker', name: '洞穴行者', hp: 320, atk: 30, desc: '比人高，没有脸，走路的时候肩膀一高一低。' },
		{ key: 'spider', name: '磷光蜘蛛', hp: 240, atk: 18, poison: true, desc: '关节处透出一点磷光，走过的地方留下湿痕。' },
		{ key: 'faceless', name: '无面者', hp: 380, atk: 34, desc: '整张脸是平的，只有呼吸的起伏。' },
		{ key: 'well', name: '深井之物', hp: 460, atk: 42, desc: '从井口爬出来的东西，身上挂着水草和碎布。' }
	];

	fs.duelPainCap = function () {
		try { return 200 + (Number(V.fs_painCapBonus) || 0); } catch (e) { return 200; }
	};

	/* ---------- 卡牌 ---------- */
	fs.duelMagicCards = [
		{ key: 'spark', name: '火花', cost: 0, text: '对敌人造成 40 点伤害。', dmg: 40 },
		{ key: 'lance', name: '奥术锐刺', cost: 0, text: '造成 55 点伤害。', dmg: 55 },
		{ key: 'twin', name: '双生箭', cost: 0, text: '造成 22 点伤害，两次。', dmg: 22, hits: 2 },
		{ key: 'shield', name: '护盾', cost: 0, text: '本回合受到的伤害 -25。', armor: 25 },
		{ key: 'mend', name: '治愈', cost: 0, text: '疼痛 -30。', pain: -30 },
		{ key: 'bind', name: '束缚', cost: 0, text: '敌人本场攻击 -8。', atkDown: 8 }
	];
	fs.duelPhysicalCards = [
		{ key: 'kick', name: '飞踢', cost: 0, text: '造成 45 点伤害。', dmg: 45 },
		{ key: 'charge', name: '蓄力', cost: 0, text: '下一张牌伤害翻倍。', charge: true },
		{ key: 'punch', name: '直拳', cost: 0, text: '造成 32 点伤害。', dmg: 32 },
		{ key: 'roll', name: '翻滚', cost: 0, text: '本回合受到的伤害 -20。', armor: 20 },
		{ key: 'guard', name: '格挡', cost: 0, text: '本回合受到的伤害 -30，疼痛 -10。', armor: 30, pain: -10 }
	];
	fs.duelDeck = function (kind) {
		if (kind === 'physical') return fs.duelPhysicalCards.slice();
		if (kind === 'both') return fs.duelMagicCards.concat(fs.duelPhysicalCards);
		return fs.duelMagicCards.slice();
	};

	/* ---------- 状态 ---------- */
	fs.duel = function () {
		try {
			var d = V.fsData.duel;
			if (!d || typeof d !== 'object') return null;
			return d;
		} catch (e) { return null; }
	};
	fs.duelActive = function () { return !!fs.duel(); };

	fs.duelBegin = function () {
		try {
			var mon = fs.duelMonsters[Math.floor(Math.random() * fs.duelMonsters.length)];
			/* 卡组由**手里拿的东西**决定：
			   只拿魔书 → 魔法卡；只拿手枪 → 格斗卡；两样都在手上 → 两套牌混编、初始行动点 2；
			   两样都没拿 → none（只能逃）。 */
			var hasBook = !!(fs.hasBookInHand && fs.hasBookInHand());
			var hasGun = !!(fs.pistolInHand && fs.pistolInHand());
			var kind = (hasBook && hasGun) ? 'both' : (hasBook ? 'magic' : (hasGun ? 'physical' : 'none'));
			var extra = 0;
			try { if (fs.equippedSeal && fs.equippedSeal() === 'firststrike') extra = 1; } catch (e) { }
			var ap = (kind === 'both') ? 2 : 1;
			var d = {
				kind: kind,
				name: mon.name,
				desc: mon.desc,
				hp: mon.hp,
				hpMax: mon.hp,
				atk: Math.max(5, mon.atk - (tal('c9') ? 2 : 0)),
				baseAtk: mon.atk,
				counterUsed: false,
				poison: 0,
				turn: 1,
				played: 0,
				maxPlay: ap + extra + ((window.finalStar && finalStar.talentHas && finalStar.talentHas('c4')) ? 1 : 0),
				armor: ((window.finalStar && finalStar.talentHas && finalStar.talentHas('c6')) ? 5 : 0),
				charge: 0,
				hand: [],
				log: ['<span class="red">' + mon.name + ' 出现了。</span>'],
				over: ''
			};
			fs.duelDraw(d, 3);
			V.fsData.duel = d;
			fs.log('魔书遭遇战开始：' + mon.name + '（' + kind + '）');
			return d;
		} catch (e) { return null; }
	};
	fs.duelDraw = function (d, n) {
		try {
			/* 设计说明：每个回合开始把**当前整套卡**都亮出来。
			   随机抽 3 张会出现「这回合只有蓄力/防守」的亏轮次情况，直接全亮。 */
			d.hand = fs.duelDeck(d.kind);
			return d.hand;
		} catch (e) { return []; }
	};

	/* 被动加成：刻印影响卡牌伤害（只在魔法卡组生效） */
	fs.duelCardDamage = function (d, card) {
		var dmg = Number(card.dmg) || 0;
		if (!dmg) return 0;
		if (d.kind === 'magic' || d.kind === 'both') {
			try {
				if (fs.equippedSeal && fs.equippedSeal() === 'assault') dmg += 25;
				if (fs.equippedSeal && fs.equippedSeal() === 'echo') dmg += 15;
				if (fs.equippedSeal && fs.equippedSeal() === 'bloodmoon') dmg += 20;
			} catch (e) { }
		}
		if (Number(d.charge) > 0) { dmg *= 2; d.charge = 0; }
		/* 猎手：原创卡牌战的敌人都是怪物，伤害 +10% */
		if (dmg > 0 && tal('c5')) dmg *= 1.1;
		/* 血勇：疼痛过半时伤害 +15% */
		if (dmg > 0 && tal('c10') && Number(V.pain) >= fs.duelPainCap() / 2) dmg *= 1.15;
		if (dmg > 0 && tal('n1')) dmg *= 1.05;              /* 共鸣 */
		if (dmg > 0 && tal('n3')) dmg *= 1.15;              /* 深渊契约 */
		return Math.round(dmg);
	};

	fs.duelPlay = function (i) {
		try {
			var d = fs.duel();
			if (!d || d.over) return 'no';
			if (Number(d.played) >= Number(d.maxPlay)) return 'limit';   /* 本回合行动点用完了 */
			var card = d.hand[i];
			if (!card) return 'none';
			var dmg = fs.duelCardDamage(d, card);
			var notes = [];
			if (dmg > 0) {
				var hits = Number(card.hits) || 1;
				d.hp = Math.max(0, d.hp - dmg * hits);
				notes.push('「' + card.name + '」造成 ' + (dmg * hits) + ' 点伤害');
				/* 双面：攻击附带魅惑，20% 概率额外 1 魅惑点 */
				if (tal('n2') && fs.talentAdd && Math.random() < 0.2) {
					if (fs.talentAdd('charm', 1)) notes.push('双面：魅惑 +1');
				}
			}
			if (card.armor) { d.armor = (Number(d.armor) || 0) + card.armor; notes.push('获得 ' + card.armor + ' 点护甲'); }
			if (card.pain) {
				V.pain = Math.max(0, (Number(V.pain) || 0) + card.pain);
				notes.push('疼痛 ' + card.pain);
			}
			if (card.atkDown) { d.atk = Math.max(5, (Number(d.atk) || 0) - card.atkDown); notes.push('敌人攻击 -' + card.atkDown); }
			if (card.charge) { d.charge = 1; notes.push('蓄力：下一张牌伤害翻倍'); }
			/* 血月刻印：命中时自身疼痛小回 */
			try {
				if (d.kind === 'magic' && fs.equippedSeal && fs.equippedSeal() === 'bloodmoon' && dmg > 0) {
					V.pain = Math.max(0, (Number(V.pain) || 0) - 10);
					notes.push('血月刻印把痛楚抽走了一点');
				}
			} catch (e) { }
			d.played = (Number(d.played) || 0) + 1;
			d.hand.splice(i, 1);
			d.log = (d.log || []).concat(['<span class="green">' + notes.join('；') + '</span>']);
			if (d.hp <= 0) { d.over = 'win'; }
			if (d.over === 'win' && !d.pointGiven) { try { if (fs.talentAdd) fs.talentAdd('combat', 1); } catch (e3) { } d.pointGiven = 1; }
			return d.over ? 'win' : 'ok';
		} catch (e) { return 'error'; }
	};

	fs.duelEndTurn = function () {
		try {
			var d = fs.duel();
			if (!d) return 'no';
			if (d.over) return d.over;
			/* 怪物攻击：疼痛伤害，护甲减免 */
			var dmg = Number(d.atk) || 10;
			var armor = Number(d.armor) || 0;
			var taken = Math.max(0, dmg - armor);
			/* 好战：受到的伤害 -1；坚韧：疼痛增长 -10% */
			if (taken > 0 && tal('c1')) taken = Math.max(0, taken - 1);
			if (taken > 0 && tal('c2')) taken = Math.round(taken * 0.9);
			/* 本能：15% 概率闪避这次攻击 */
			if (taken > 0 && tal('c8') && Math.random() < 0.15) {
				taken = 0;
				d.log = (d.log || []).concat(['<span class="green">天赋「本能」：你预判了它的动作，攻击落空。</span>']);
			} else {
				d.log = (d.log || []).concat(['<span class="red">' + d.name + ' 扑了上来，疼痛 +' + taken + '</span>']);
			}
			d.armor = 0;
			V.pain = (Number(V.pain) || 0) + taken;
			/* 反击：每场首次受击反弹 2 点 */
			if (taken > 0 && tal('c3') && !d.counterUsed) {
				d.counterUsed = true;
				d.hp = Math.max(0, d.hp - 2);
				d.log = d.log.concat(['<span class="green">天赋「反击」：反弹 2 点伤害</span>']);
			}
			/* 中毒（毒牙刻印） */
			if (Number(d.poison) > 0) {
				d.hp = Math.max(0, d.hp - 15);
				d.poison = Number(d.poison) - 1;
				d.log = d.log.concat(['<span class="teal">毒还在往里走，敌人 -15</span>']);
			}
			/* 判负：疼痛达到上限 */
			if (Number(V.pain) >= fs.duelPainCap()) { d.over = 'lose'; return 'lose'; }
			if (d.hp <= 0) { d.over = 'win'; return 'win'; }
			d.turn = (Number(d.turn) || 1) + 1;
			d.played = 0;
			d.log = d.log.concat(['<span class="grey">—— 第 ' + d.turn + ' 回合 ——</span>']);
			fs.duelDraw(d, 3);
			return 'ok';
		} catch (e) { return 'error'; }
	};

	fs.duelFinish = function () {
		try {
			var d = fs.duel();
			V.fsData.duel = null;
			return d ? d.over : '';
		} catch (e) { return ''; }
	};

	/* ---------- 触发：长线通关后，城里/镇上随机刷 ---------- */
	fs.duelCanSpawn = function () {
		try {
			var m = (V.fsData && V.fsData.mor) ? V.fsData.mor : null;
			if (!m || !m.cleared) return false;                 /* 长线至少通关一次 */
			/* 没有魔书也能遇到：只要通关过、并且手里有魔书或制式手枪（或持有手枪），
			   这样「有枪没书」的那套格斗卡剧情才用得上 */
			var _gunHand = !!(fs.pistolInHand && fs.pistolInHand());
			var _gunHave = false;
			try { _gunHave = Number(V.pistolOwned) === 1; } catch (e) { }
			if (!fs.hasBook() && !_gunHand && !_gunHave) return false;
			if (V.fs_duelOff === true) return false;            /* 设置里开了「妖魔退散」→ 不再刷 */
			if (fs.duelActive()) return false;
			if (Number(V.combat) === 1) return false;           /* 不在原版战斗里 */
			if (Number(V.fsCaveActive) === 1) return false;     /* 不在自家洞穴战里 */
			var cur = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || '';
			if (/^FS Duel/.test(cur)) return false;
			/* 用户确认：原版小镇和莫伦斯城都要刷。
			   FS Morans* 是城里，普通段落算原版小镇；其它 FS 段落（战斗/赌桌等）不打断。 */
			var isOurCity = /^FS Morans/.test(cur);
			if (/^FS /.test(cur) && !isOurCity) return false;
			if (Number(V.outside) !== 1) return false;
			if (String(V.location) !== 'town') return false;
			return true;
		} catch (e) { return false; }
	};
	fs.duelTrySpawn = function () {
		try {
			if (!fs.duelCanSpawn()) return false;
			var chance = 0.06;
			if (Math.random() > chance) return false;
			fs.log('魔书遭遇战刷新');
			try { if (fs.currentPassage) V.fsData.duelReturn = fs.currentPassage(); } catch (e) { }
			if (typeof fs.goPassage === 'function') return fs.goPassage('FS Duel Intro', true);
		} catch (e) { }
		return false;
	};

	/* ---------- UI ---------- */
	fs.duelHtml = function () {
		try {
			var d = fs.duel();
			if (!d) return '<span class="red">战斗状态丢失。</span>';
			var cap = fs.duelPainCap();
			var pain = Number(V.pain) || 0;
			var hpPct = Math.max(0, Math.round(d.hp / d.hpMax * 100));
			var painPct = Math.max(0, Math.min(100, Math.round(pain / cap * 100)));
			var h = [];
			h.push('<div class="fs-duel">');
			h.push('<div class="fs-duel-foe" ondragover="event.preventDefault()" ondrop="finalStar.duelDrop(event)"><span class="gold">' + d.name + '</span>　<span class="fs-sub">' + d.desc + '　（把卡牌拖到这里也能出牌）</span></div>');
			h.push('<div class="fs-duel-bar"><span>敌人</span><div class="fs-duel-track"><div class="fs-duel-fill fs-duel-foe-fill" style="width:' + hpPct + '%"></div></div><span>' + d.hp + ' / ' + d.hpMax + '</span></div>');
			h.push('<div class="fs-duel-bar"><span>疼痛</span><div class="fs-duel-track"><div class="fs-duel-fill fs-duel-pain-fill" style="width:' + painPct + '%"></div></div><span>' + pain + ' / ' + cap + '</span></div>');
			h.push('<div class="fs-sub">第 ' + d.turn + ' 回合　·　本回合可出 ' + d.maxPlay + ' 张，已出 ' + d.played + ' 张' + (d.armor ? ('　·　护甲 ' + d.armor) : '') + (d.charge ? '　·　蓄力中' : '') + '</div>');
			h.push('<div class="fs-duel-log">' + (d.log || []).join('<br>') + '</div>');
			h.push('<div class="fs-duel-hand">');
			if (d.over) {
				h.push('<span class="gold">战斗结束。</span>');
			} else {
				for (var i = 0; i < d.hand.length; i++) {
					var c = d.hand[i];
					var spent = Number(d.played) >= Number(d.maxPlay);
					h.push('<div class="fs-duel-card' + (spent ? ' fs-duel-card-off' : '') + '" data-i="' + i + '" draggable="' + (spent ? 'false' : 'true') + '"'
						+ (spent ? '' : ' onclick="finalStar.duelClick(' + i + ')"')
						+ (spent ? '' : ' ondragstart="finalStar.duelDrag(event,' + i + ')"') + '>'
						+ '<div class="fs-duel-card-name">' + c.name + '</div>'
						+ '<div class="fs-duel-card-text">' + c.text + '</div></div>');
				}
			}
			h.push('</div>');
			h.push('</div>');
			return h.join('');
		} catch (e) { return '<span class="red">战斗界面出错：' + e.message + '</span>'; }
	};


	/* 点击/拖拽出牌：点卡牌直接打出；拖到战场也能出（移动端用长按拖动不现实，先给点击 + HTML5 拖放） */
	fs.duelClick = function (i) {
		try {
			var r = fs.duelPlay(i);
			fs.duelRefresh();
			return r;
		} catch (e) { return 'error'; }
	};
	fs.duelRefresh = function () {
		try { if (fs.goPassage) fs.goPassage('FS Duel Battle', true); else SugarCube.Engine.play('FS Duel Battle'); } catch (e) { }
	};
	fs.duelDrag = function (ev, i) {
		try { ev.dataTransfer.setData('text/plain', String(i)); } catch (e) { }
	};
	fs.duelDrop = function (ev) {
		try {
			ev.preventDefault();
			var i = Number(ev.dataTransfer.getData('text/plain'));
			if (isFinite(i)) fs.duelClick(i);
		} catch (e) { }
	};
	fs.duelEnd = function () {
		try {
			var r = fs.duelEndTurn();
			fs.duelRefresh();
			return r;
		} catch (e) { return 'error'; }
	};

	fs.duelReturnTo = function () {
		try { return V.fsData.duelReturn || ''; } catch (e) { return ''; }
	};
	/* 判负：闪光保命，感染大幅上涨 */
	fs.duelPenalty = function () {
		try {
			var cap = fs.duelPainCap();
			V.pain = Math.max(0, cap - 20);
			if (typeof fs.infectAdd === 'function') fs.infectAdd(30);
			else { V.fsData.infect = Math.min(100, (Number(V.fsData.infect) || 0) + 30); }
			V.stress = Math.min(Number(V.stressmax) || 1000, (Number(V.stress) || 0) + 100);
			return true;
		} catch (e) { return false; }
	};

	fs.duelReward = function () {
		try {
			var gain = 2000;                                  /* £20 */
			V.money = (Number(V.money) || 0) + gain;
			V.stress = Math.max(0, (Number(V.stress) || 0) - 60);
			return gain;
		} catch (e) { return 0; }
	};

	/* ---------- 控制台：一键把测试条件摆好 ---------- */
	fs.duelCheat = function (act) {
		var msg = '';
		try {
			if (act === 'book' || act === 'both') {
				V.magicBook = 1;
				var idx = -1;
				try {
					for (var i = 0; i < setup.clothes.handheld.length; i++) {
						var it = setup.clothes.handheld[i];
						if (it && (it.name === '魔法书' || it.variable === '魔法书')) { idx = i; break; }
					}
				} catch (e) { }
				if (idx >= 0) { V.worn = V.worn || {}; V.worn.handheld2 = window.clone ? clone(setup.clothes.handheld[idx]) : setup.clothes.handheld[idx]; }
				msg += '已持有并握住魔书';
			}
			if (act === 'gun' || act === 'both') {
				try { if (fs.equipPistol) fs.equipPistol('handheld'); } catch (e) { }
				V.pistolOwned = 1;
				msg += (msg ? '；' : '') + '已持有制式手枪（手）';
			}
			if (act === 'clear') {
				V.fsData.mor = V.fsData.mor || {};
				V.fsData.mor.cleared = 1;
				msg = '已标记「长线已通关」';
			}
			if (act === 'start') { msg = '开始遭遇战'; try { fs.goPassage('FS Duel Intro', true); } catch (e) { } return msg; }
			if (act === 'reset') { V.fsData.duel = null; msg = '已清空战斗状态'; }
			if (!msg) msg = '未知操作';
			if (fs.refreshPanel) fs.refreshPanel();
		} catch (e) { msg = '出错: ' + e.message; }
		return msg;
	};

	/* ================= 10 个色情相关事件（小镇随机） ================= */
	/*  外包稿：G4C（Gemini 4 Carbon），10 条街景，无名路人，成年人。 */
	fs.eroticEvents = [
		{ key: 'brush_past', text: '窄道上男人与你迎面擦身，故意放慢脚步，滚烫的胯部隔着薄裤重重蹭过你的大腿根。那团已经半勃起的硬热轮廓清晰地顶了你一下，他灼热的鼻息喷在你耳廓上，粗糙的指腹顺势擦过你臀缝边缘，力道暧昧却未死死按住，只要你往旁侧退开半步就能脱离这片燥热。' },
		{ key: 'borrow_light', text: '穿紧身针织衫的女人停在你面前借火，俯身凑近火苗时，丰满温热的乳房隔着薄衣贴上你的小臂，两颗充血硬挺的乳头清晰地抵着你的皮肤摩擦。她吐出湿热的呼吸，双腿微并着摩挲裙下已经泛潮发烫的阴唇，眼神勾人地望着你，却留着空当任你随时收手退开。' },
		{ key: 'rain_shelter', text: '骤雨把你们逼进狭窄雨棚，身旁的男人越贴越近，温热的躯体从背后贴上你，裤裆里高高胀起的阴茎隔着湿透的布料抵在你臀瓣之间，随着他粗重的喘息一跳一跳地发烫。他的手掌试探着覆上你的胯侧摩挲，动作留着试探的分寸，只要你往前迈出半步就能避开。' },
		{ key: 'bus_stop', text: '昏暗的公交站牌下，穿短裙的女人紧挨着你坐下，滚烫的大腿贴着你的腿侧厮磨，微喘的热气喷在你颈窝。她借着背包遮挡牵起你的指尖，按向她裙下湿透发黏的内裤裆部，让你触到那粒充血发硬的阴蒂，但她的手指只是虚拢着，你随时能抽回手起身走开。' },
		{ key: 'alley_entrance', text: '昏暗巷口斜靠着个年轻男人，见你路过便迎上前，带着汗意的滚烫胸膛贴近你，急促的呼吸扫过你的锁骨。他牛仔裤拉链处被勃起的阴茎撑出硕大鼓包，隔着衣料缓慢顶蹭你的小腹，哑声问你要不要进去快活，却也没堵死你往街面退开的路。' },
		{ key: 'crowd', text: '热闹的集市人群将你挤向边缘，身后贴上一具滚烫的男性躯体，粗重的鼻息紧贴着你耳后。一只大手顺着腰线滑下，隔着裤料揉捏你的臀肉，他硬得发烫的阴茎更挤向你腿根缓慢磨蹭，不过人群仍在流动，你只需顺势往前迈步就能挣开他。' },
		{ key: 'stair_corner', text: '窄小的楼梯转角处，迎面走下的成熟女人非但没让，反而将滚烫的身躯贴向你，热息洒在你唇边。她薄衫下的乳头充血硬挺，裙下湿润发烫的阴部隔着布料抵住你的大腿厮磨，手掌还隔着裤料轻抚你胯间试探，但身后台阶空着，你退后一步便能避开。' },
		{ key: 'shop_door', text: '推开街边店门时，身后的高大男人伸手替你撑门，滚烫的胸膛却顺势从背后覆上来，沉重的呼吸熏热你的耳尖。他另一只手扶住你腰侧，裤裆里勃起发硬的阴茎隔着薄裤重重贴在你臀沟处碾磨，但他并未堵住门口，你只要抬脚跨进店里就能甩开他。' },
		{ key: 'car_window', text: '路边停着的轿车降下车窗，驾驶座上的女人借口问路，趁你俯身时微喘着吐出热气，敞开的领口下两颗乳头充血硬挺。她裙摆撩至腰际，露出腿间湿亮充血的阴唇与黏腻水光，滚烫的指尖轻轻勾住你的手背摩挲，但并未用力，你直起身就能走开。' },
		{ key: 'fitting_room', text: '路过服装店试衣间门口时，门帘微掀，里面的女人喘着粗气勾住你的衣袖，滚烫的呼吸扑在你颈侧。她半解的衬衫下乳头硬挺发红，短裙下未着寸缕的阴唇早已充血湿透、渗出黏腻水迹，温热的手拉着你的指尖往她胸口贴，却留着余地任你抽手退开。' }
	];
	fs.eroticNow = function () {
		try {
			var i = V.fsData.eroticKey;
			return (i == null) ? null : fs.eroticEvents[i] || null;
		} catch (e) { return null; }
	};
	fs.eroticCanSpawn = function () {
		try {
			if (fs.duelActive ? fs.duelActive() : false) return false;
			if (V.fs_duelOff === true) return false;                /* 同「妖魔退散」开关 */
			if (Number(V.combat) === 1 || Number(V.fsCaveActive) === 1) return false;
			var cur = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || '';
			if (/^FS /.test(cur)) return false;
			/* 只在真正的街面上发生：赌场、学校、店铺、室内段落一律不刷，
			   否则会出现“人在赌场里却被晚班公交搭讪”的割裂感 */
			if (/casino|school|shop|store|mall|cafe|pub|brothel|bedroom|class|office|kitchen|bath|home/i.test(cur)) return false;
			if (Number(V.outside) !== 1 || String(V.location) !== 'town') return false;
			/* 白天与傍晚都可能，深夜不再强行套用 */
			try { var _h = (window.Time && Time.hour !== undefined) ? Number(Time.hour) : 12; if (_h < 7 || _h > 22) return false; } catch (e) { }
			return true;
		} catch (e) { return false; }
	};
	fs.eroticTrySpawn = function () {
		try {
			if (!fs.eroticCanSpawn()) return false;
			var _pc = 0.03;
			try { var _cur = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || ''; if (/forest|woods|deepwood/i.test(_cur) && window.finalStar && finalStar.talentHas && finalStar.talentHas('d10')) _pc = 0.015; } catch (e5) { }
			if (Math.random() > _pc) return false;
			V.fsData.eroticKey = Math.floor(Math.random() * fs.eroticEvents.length);
			V.fsData.eroticReturn = fs.currentPassage ? fs.currentPassage() : '';
			/* 先写冷却再跳转：goPassage 可能让外层 onInit 提前结束，导致冷却没写上，
			   回到街道后立刻又刷一个事件。 */
			try { V.fsData.randCooldown = 2 + Math.floor(Math.random() * 3); } catch (e4) { }
			fs.goPassage('FS Erotic Scene', true);
			return true;
		} catch (e) { return false; }
	};
	fs.eroticResolve = function (choice) {
		try {
			var ev = fs.eroticNow();
			if (!ev) return '这段已经结束了。';
			if (choice === 'accept') {
				V.arousal = Math.min(Number(V.arousalmax) || 500, (Number(V.arousal) || 0) + 120);
				V.stress = Math.max(0, (Number(V.stress) || 0) - 40);
				V.fsData.eroticKey = null;
				return '你没有躲开。对方得了默许，动作更近了一步；你听见自己的呼吸变了。' + (fs.statHint ? fs.statHint('性奋', 1, 'red') : '');
			}
			V.stress = (Number(V.stress) || 0) + 60;
			V.fsData.eroticKey = null;
			return '你往后退开，把距离重新拉开。对方看了你一眼，没有再追。' + (fs.statHint ? fs.statHint('压力', 1, 'red') : '');
		} catch (e) { return ''; }
	};
	fs.eroticReturnTo = function () {
		try { return V.fsData.eroticReturn || 'Bedroom'; } catch (e) { return 'Bedroom'; }
	};

	/* ================= 原版小镇的随机事件（与莫伦斯无关） ================= */
	fs.townEvents = [
		{ t: '有人从你身边挤过去，肩膀撞得你偏了半步。你摸了摸口袋，东西还在。', a: '回头看了一眼，那人已经混进人流里。', b: '算了，继续走。' },
		{ t: '街角坐着一个裹着旧外套的人，面前的纸杯里只有几枚硬币。他没有抬头，也没有开口。', a: '往杯子里放了一点钱。', b: '绕开他走过去。' },
		{ t: '你注意到身后有脚步声，不快不慢，和你保持着同一个距离。你停，它也停。', a: '拐进人多的那条街。', b: '停下来，回头看。' },
		{ t: '巷口靠着一个人，见你过来，站直了："一个人？这条街晚上不太平。"', a: '点了点头，没有停下。', b: '当没听见，径直走过。' },
		{ t: '雨突然大了，你躲进店门口的屋檐。没过多久，另一个人也挤了进来，肩膀几乎贴着你。', a: '往里让了让。', b: '把位置让出来，自己走进雨里。' },
		{ t: '街上有人在发传单，塞到你手里一张，又压低声音说："晚上有空吗？"', a: '把传单折起来收下。', b: '塞回去，摆手走开。' },
		{ t: '路边聚着一小群人，你经过时，前面的人回头看了你一眼，往旁边挪了挪。', a: '道了声谢，往前一步。', b: '站在原地等。' },
		{ t: '街口有个人在发糖，说是"讨个吉利"。糖纸是红的，他笑得很客气。', a: '接了一颗。', b: '摇摇头，绕过去。' }
	];
	fs.townEventReturn = function () { try { return V.fsData.townEventReturn || ''; } catch (e) { return ''; } };
	fs.townEventNow = function () { try { var i = V.fsData.townEventKey; return (i == null) ? null : (fs.townEvents[i] || null); } catch (e) { return null; } };
	fs.townEventResolve = function (which) {
		try {
			var ev = fs.townEventNow();
			if (!ev) return '……';
			V.fsData.townEventKey = null;
			var extra = '';
			if (tal('d7')) {
				var gain = 100 + Math.floor(Math.random() * 201);
				V.money = (Number(V.money) || 0) + gain;
				extra = ' <span class="green">你在路边捡到 £' + (gain / 100).toFixed(2) + '。</span>';
			}
			if (which === 'a') { V.stress = Math.max(0, (Number(V.stress) || 0) - 30); return ev.a + (fs.statHint ? fs.statHint('压力', -1, 'green') : '') + extra; }
			V.stress = (Number(V.stress) || 0) + 20;
			return ev.b + (fs.statHint ? fs.statHint('压力', 1, 'red') : '') + extra;
		} catch (e) { return ''; }
	};
	fs.townEventTrySpawn = function () {
		try {
			if (String(V.location) !== 'town' || Number(V.outside) !== 1) return false;
			if (Number(V.combat) === 1) return false;
			var cur = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || '';
			if (/^FS /.test(cur)) return false;
			if (V.fsData.townEventKey != null) return false;
			if (Math.random() > 0.04) return false;
			V.fsData.townEventKey = Math.floor(Math.random() * fs.townEvents.length);
			V.fsData.townEventReturn = cur;
			fs.goPassage('FS Town Event', true);
			return true;
		} catch (e) { return false; }
	};

	fs.register('duel', function () {
		fs.onInit(function () {
			setTimeout(function () {
				try {
					/* 冷却：任何一次原创事件之后，接下来 2~4 个段落不再抽，避免“走十步七次事件” */
					var cd = Number(V.fsData.randCooldown) || 0;
					if (cd > 0) { V.fsData.randCooldown = cd - 1; return; }
					var hit = fs.duelTrySpawn();
					if (!hit) hit = fs.eroticTrySpawn();
					if (!hit) hit = fs.townEventTrySpawn();
					if (hit) V.fsData.randCooldown = 2 + Math.floor(Math.random() * 3);
				} catch (e) { }
			}, 80);
		});
	});

	fs.log('魔书遭遇战模块已加载（卡牌战斗 / 疼痛判负 / 长线通关后随机刷新）');
})();
