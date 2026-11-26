/* ============================================================
   终星 FinalStar —— 三系魔法（面板选择 + 立即吟唱）+ 星光（原创内容）
   · 战斗物资面板里选择法术，点一下立刻吟唱（消耗每日 10 次里的一次）
   · 「终星 · 最后一颗星」：夜里在卧室窗前看星星（原创小场景）
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* ---------- 三系魔法：面板选择 ---------- */
	fs.spells = {
		heal: {
			key: 'heal', name: '治疗术', icon: 'finalstar/skill-heal.png', colour: 'green',
			desc: '金色的流沙顺着手腕攀上来，像温水一样漫过每一道伤口。',
			text: '你翻开魔书，指尖按上那些浮动的字迹——金色的流沙顺着手腕攀上来，像温水一样漫过每一道伤口。',
			apply: function () {
				var heal = 150;
				if (V.fsData && V.fsData.sealEquipped === 'alchemy') heal += 50;
				V.pain = Math.max(0, (V.pain || 0) - heal);
				return '疼痛 -' + heal;
			}
		},
		assault: {
			key: 'assault', name: '强攻术', icon: 'finalstar/skill-assault.png', colour: 'red',
			desc: '流沙凝成一条漆黑的蛇，贴地窜出咬进敌人体内。',
			text: '你念出书页上那段发烫的字句。流沙从纸缝里升起，在掌中盘旋、收紧，凝成一条漆黑的蛇。',
			apply: function () {
				var dmg = 150;
				if (V.fsData && V.fsData.sealEquipped === 'assault') dmg += ((fs.seals.assault && fs.seals.assault.spellBonus) || 30);   /* 魔法加成：与数据表同源 */
				if (V.fsData && V.fsData.sealEquipped === 'firststrike') dmg += 10;
			if (V.fsData && V.fsData.sealEquipped === 'echo') dmg += 40;   /* 回响刻印：法术 +40 */
				V.enemyhealth = (Number(V.enemyhealth) || 0) - dmg;
				return '造成 ' + dmg + ' 点伤害';
			}
		},
		soul: {
			key: 'soul', name: '荡魂术', icon: 'finalstar/skill-soulshake.png', colour: 'teal',
			desc: '没有声音的咒文，一层层抽走对方的杀意。',
			text: '你把掌心贴在书页上，念出那段没有声音的咒文。空气忽然安静下来。',
			apply: function () {
				var calm = 120;
				V.enemyanger = Math.max(0, (Number(V.enemyanger) || 0) - calm);
				if (V.enemyanger <= 20) V.enemyanger = 0;
				return '敌人怒气 -' + calm;
			}
		}
	};
	fs.spellList = ['heal', 'assault', 'soul'];
	fs.selectedSpell = function () {
		var k = (V.fsData && V.fsData.spell) || 'assault';
		return fs.spells[k] ? k : 'assault';
	};
	fs.setSpell = function (key) {
		if (!fs.spells[key]) return false;
		fs.ensureData();
		V.fsData.spell = key;
		fs.refreshPanel();
		return true;
	};
	/* 执行指定法术：写结果文本到 $fs_castText（供动作区「吟唱魔法」使用） */
	fs.applySpell = function (key) {
		try {
			var sp = fs.spells[key || fs.selectedSpell()] || fs.spells.assault;
			var result = sp.apply();
			var extra = '';
			if (V.enemyhealth !== undefined && Number(V.enemyhealth) <= 0 && sp.key === 'assault') {
				extra = '<br><span class="teal">它踉跄了一下，靠不住地退开半步。</span>';
			}
			V.fs_castText = '<span class="gold">' + sp.text + '</span><br><span class="green">' + sp.name + '：' + result +
				'</span> <span class="teal">今日已吟唱 ' + (V.daily.magicCasts || 0) + ' / 10 次。</span>' + extra;
			V.fs_panelLog = V.fs_castText;
			return result;
		} catch (e) {
			fs.warn('施法失败: ' + e.message);
			V.fs_castText = '<span class="red">魔力在指尖散开了。</span>';
			return '';
		}
	};
	/* 动作区「吟唱魔法」调用：施放面板当前选中的法术 */
	fs.applySelectedSpell = function () {
		return fs.applySpell(fs.selectedSpell());
	};

	/* 立即吟唱选中的法术（消耗当日次数）—— 面板按钮用 */
	fs.castSelected = function () {
		try {
			if (!fs.hasBook()) { fs.panelLog('<span class="red">你还没有魔书——吟唱不了。</span>'); fs.refreshPanel(); return { ok: false, reason: 'noBook' }; }
			if (!fs.canCast()) { fs.panelLog('<span class="red">今天的魔力已经用尽了。</span>'); fs.refreshPanel(); return { ok: false, reason: 'dry' }; }
			var key = fs.selectedSpell();
			var sp = fs.spells[key];
			V.daily.magicCasts = (V.daily.magicCasts || 0) + 1;
			var result = sp.apply();
			fs.panelLog('<span class="gold">' + sp.text + '</span><br><span class="green">' + sp.name + '：' + result +
				'</span> <span class="teal">今日已吟唱 ' + V.daily.magicCasts + ' / 10 次。</span>');
			fs.refreshPanel();
			return { ok: true, spell: key, result: result, casts: V.daily.magicCasts };
		} catch (e) {
			fs.warn('吟唱失败: ' + e.message);
			return { ok: false, reason: 'error' };
		}
	};
	/* 面板里的法术选择按钮（点击动作区的「吟唱魔法」施放选中的法术） */
	fs.spellButtons = function () {
		if (!fs.hasBook()) return '<span class="fs-sub">（没有魔书，无法吟唱）</span>';
		var cur = fs.selectedSpell();
		var dry = !fs.canCast();
		var html = '';
		fs.spellList.forEach(function (k) {
			var sp = fs.spells[k];
			var active = (k === cur) ? ' fs-active' : '';
			html += '<span class="fs-btn' + active + (dry ? ' fs-disabled' : '') + '" onclick="finalStar.setSpell(\'' + k + '\'); $.wiki(\'<<replace &quot;#fs-combat-slot&quot;>><<fs_combat_panel>><</replace>>\');">' +
				sp.name + '</span>';
		});
		return html;
	};
	fs.spellInfoText = function () {
		var cur = fs.selectedSpell();
		return fs.spells[cur].name + ' —— ' + fs.spells[cur].desc;
	};

	/* ---------- 原创内容：终星 · 最后一颗星 ---------- */
	/* 当天日期：⚠️ 不能用 `V.day` —— 原版没有这个字段（`Time.days` 才是累计天数，
	   由时间戳算）。原来 `V.fs_starWatchedDay === V.day` 两边都是 undefined →
	   恒为 true → `canWatchStar()` **永远返回 false**，屋顶看星星这条内容整段不可达。 */
	fs.starDay = function () {
		try { if (typeof Time !== 'undefined' && typeof Time.days === 'number' && isFinite(Time.days)) return Time.days; } catch (e) { }
		return 0;
	};
	fs.canWatchStar = function () {
		try {
			if (!V.fsData || !V.fsData.witness) return false;
			var day = fs.starDay();
			if (typeof V.fs_starWatchedDay === 'number' && V.fs_starWatchedDay === day) return false;
			return true;
		} catch (e) { return false; }
	};
	fs.watchStar = function () {
		try {
			fs.ensureData();
			V.fs_starWatchedDay = fs.starDay();
			V.fs_starWatches = (Number(V.fs_starWatches) || 0) + 1;
			V.fsData.starWatches = V.fs_starWatches;
			/* 星光：压力/创伤小幅回落，疲劳也轻一点 */
			V.stress = Math.max(0, (V.stress || 0) - 300);
			V.trauma = Math.max(0, (V.trauma || 0) - 200);
			V.tiredness = Math.max(0, (V.tiredness || 0) - 200);
			return V.fs_starWatches;
		} catch (e) { return 0; }
	};

	/* ---------- 刻印加成：接到动作区「击打 / 挣扎」上 ----------
	   DoL 自己的伤害计算我们插不进去（补丁锚点在不同版本会变），
	   所以改为在段落切换时补算一次，并把加成写在正文下方。 */
	fs.sealKeys = ['assault', 'firststrike', 'counter', 'alchemy', 'bloodmoon', 'echo', 'silence', 'venom', 'starlight'];

	fs.sealKey = function () {
		try {
			var k = V.fsData && V.fsData.sealEquipped;
			if (k && k !== 'none' && fs.sealKeys.indexOf(k) !== -1) return k;
		} catch (e) { }
		return null;
	};
	fs.sealBonus = function () {
		try {
			var k = fs.sealKey();
			if (!k) return 0;
			var def = (fs.seals && fs.seals[k]) || {};
			/* 「打击」加成读 hitBonus —— 强攻刻印是 +150（用户澄清：空手=打击按钮，这是该实现的功能）。
			   其余刻印各有专用分支（血月/毒牙在上面已 return），走到这里就是 0。 */
			var v = Number(def.hitBonus || def.damage || def.bonus || def.value || 0);
			return v > 0 ? v : 0;
		} catch (e) { return 0; }
	};
	fs.handleSealHit = function () {
		try {
			if (typeof V === 'undefined' || !V) return;
			var la = V.leftaction, ra = V.rightaction;
			var isHit = (la === 'lefthit' || la === 'righthit' || la === 'leftstruggle' || ra === 'righthit' || ra === 'lefthit' || ra === 'rightstruggle');
			if (!isHit) return;
			var key = fs.sealKey();
			/* 先处理「没有伤害字段」的刻印（它们不靠 sealBonus，否则会被下面的 bonus<=0 拦掉） */
			if (key === 'bloodmoon') {   /* 血月：额外 +20，并把痛楚转回自身 */
				V.enemyhealth = (Number(V.enemyhealth) || 0) - 20;
				V.pain = Math.max(0, (Number(V.pain) || 0) - 20);
				V.fs_castHtml = '<span class="gold">血月的刻印亮起——你击中它的同时，暗红的光把伤口上的痛抽走了一部分。</span>' +
					(fs.statHint ? fs.statHint('疼痛', -1, 'green') : '');
				fs.log('刻印触发：血月 +20（自身疼痛 -20）');
				return;
			}
			if (key === 'venom') {       /* 毒牙：使其中毒 3 回合 */
				V.fs_venomRounds = 3;
				V.fs_castHtml = '<span class="gold">毒牙的刻印咬进纸页，黑色的细线顺着手腕爬出去——它开始中毒了。</span><br><span class="fs-sub">（毒牙刻印：中毒 3 回合，每回合 -15）</span>';
				fs.log('刻印触发：毒牙（中毒 3 回合）');
				return;
			}
			var bonus = fs.sealBonus();
			if (bonus <= 0) return;
			V.enemyhealth = (Number(V.enemyhealth) || 0) - bonus;
			var name = (fs.seals && fs.seals[key] && fs.seals[key].name) || '强攻';
			/* 需求：触发刻印时要"体现出来"——魔书翻页、刻印浮现、金色流光 */
			V.fs_castHtml = '<span class="gold">魔书在你掌心翻开一页，' + name
				+ '刻印从纸面浮起，金色的流光顺着纹路爬过，一闪即逝。</span>'
				+ '<br><span class="fs-sub">（' + name + '刻印：本次额外造成 ' + bonus + ' 点伤害）</span>';
			fs.log('刻印触发：' + name + ' +' + bonus);
		} catch (e) { fs.warn('刻印击打补算失败: ' + e.message); }
	};

	fs.log('魔法选择与星光模块已加载');

	/* ---------- 动作区「吟唱魔法」的结算（JS 侧，不依赖段落替换是否生效） ---------- */
	/* 0.27 起动作区只有一个 cast 动作（法术由面板切换）；旧的 castheal 等 id 仍然兼容 */
	fs.spellActionValues = { castheal: 'heal', castassault: 'assault', castsoul: 'soul' };
	fs.handlePendingCast = function () {
		try {
			if (typeof V === 'undefined' || !V) return;
			var la = V.leftaction, ra = V.rightaction;
			var act = null;
			if (typeof la === 'string' && (la === 'cast' || fs.spellActionValues[la])) act = la;
			else if (typeof ra === 'string' && (ra === 'cast' || fs.spellActionValues[ra])) act = ra;
			var dry = (la === 'castdry' || ra === 'castdry');
			if (!act && !dry) return;
			/* 复位动作（DoL 要求同时给回默认动作，否则动作区生成会报错） */
			V.leftaction = 0; V.rightaction = 0;
			V.leftactiondefault = 'rest'; V.rightactiondefault = 'rest';
			var spellKey = (act && act !== 'cast') ? fs.spellActionValues[act] : fs.selectedSpell();
			var html;
			if (dry) {
				html = '<span class="red">你翻开魔书，书页上的金色流沙纹丝不动——今天再也挤不出一丝魔力了。</span>';
			} else if (!fs.hasBook()) {
				html = '<span class="red">魔书不在身上，念出的字句散在空气里，什么也没发生。</span>';
			} else if ((V.daily.magicCasts || 0) >= fs.dailyCastLimit) {
				html = '<span class="red">魔力枯竭了。'
					+ (fs.spells[spellKey] ? fs.spells[spellKey].name : '法术') + '的字句在纸上散开，你什么也没能抓住。</span>';
			} else {
				V.daily.magicCasts = (V.daily.magicCasts || 0) + 1;
				fs.applySpell(spellKey);
				html = V.fs_castText;
			}
			V.fs_castHtml = html;
		} catch (e) {
			fs.warn('魔法动作结算失败: ' + e.message);
		}
	};
	/* 把施法 / 开枪的结果贴到**正文最顶上**（渲染完成后调用）。
	   ⚠️ 原来是 appendChild（贴在正文**最下方**）—— 设计上"挪到顶上，让我们第一时间知道触发了什么"，
	   所以改成 insertBefore 到第一个子节点之前。
	   （正文太长时，贴在下面的触发提示要滚很久才看得到，等于没提示。） */
	fs.flushCastText = function () {
		try {
			var html = V.fs_castHtml;
			if (!html) return;
			var pc = fs.passageHost ? fs.passageHost() : document.getElementById('passage-content');
			if (!pc) return;
			if (document.getElementById('fs-cast-result')) { document.getElementById('fs-cast-result').remove(); }
			var d = document.createElement('div');
			d.id = 'fs-cast-result';
			d.className = 'fs-cast-result';
			new Wikifier(d, html);
			/* ⚠️ 以前是 insertBefore(pc.firstChild)：把「射击（手枪）」这个**动作按钮**
			   插到了正文最上面，看起来像一句话顶在开头（用户实机截图报的就是这个）。
			   动作应该排在正文与选项之后 —— 改为追加到段落末尾。 */
			pc.appendChild(d);
			V.fs_castHtml = '';
			if (fs.refreshPanel) fs.refreshPanel();
		} catch (e) { }
	};

	fs.register('star', function () {
		/* 段落初始化（渲染前）时动作变量还在，先结算数值；渲染后再补上文本 */
		/* 每回合刻印效果：静默（敌人怒气↓）/ 星辉（自身恢复）/ 毒牙（中毒掉血） */
		fs.sealTurnTick = function () {
			try {
				if (typeof V === 'undefined' || !V) return;
				var key = fs.sealKey();
				/* ⚠️ 原来的判据是：
				     (V.combat === 1) || (Number(V.enemyhealth) > 0 && V.enemyanger !== undefined)
				   第二个分支就是"**走在路上也会触发**"的根源 —— 战斗结束后 V.enemyhealth /
				   V.enemyanger 会残留下来，于是大街上每次进段落都判定成"在战斗中"，
				   刻印照样结算（验证结果：走路时疼痛/压力真的在降）。
				   这跟本模组早先"没枪也能对空气开枪"是同一类错误（那边也是 enemyhealth>0 残留）。
				   统一改用本模组已有的**唯一**战斗判据 fs.inFight()
				   （要求 V.combat === 1 且确实有活着的敌人；洞穴战斗另算），
				   不要再在别处造第二个判据。 */
				var inCombat = (typeof fs.inFight === 'function') ? fs.inFight() : (V.combat === 1);
				if (!key || !inCombat) return;
				var notes = [];
				if (key === 'silence' && Number(V.enemyanger) > 0) { V.enemyanger = Math.max(0, Number(V.enemyanger) - 50); notes.push('静默刻印压住了对方的火气'); }
				/* 星辉刻印：设计上「至少对半削弱」→ 疼痛 −50→−25、压力 −100→−50；价格另翻倍到 8000（见 fs-core.js）。
				   实装后如仍嫌强，把这两个数继续往下调即可（用户说"至少"对半）。 */
				if (key === 'starlight') { V.pain = Math.max(0, (Number(V.pain) || 0) - 25); V.stress = Math.max(0, (Number(V.stress) || 0) - 50); notes.push('星辉刻印的光落下来，疼和紧都松了一些'); }
				if (Number(V.fs_venomRounds) > 0) { V.enemyhealth = (Number(V.enemyhealth) || 0) - 15; V.fs_venomRounds = Number(V.fs_venomRounds) - 1; notes.push('毒牙的毒还在往里走'); }
				if (notes.length) V.fs_castHtml = '<span class="gold">魔书上的刻印依次亮起，金色的流光在纸面游走。</span><br><span class="fs-sub">（' + notes.join('；') + '）</span>';
			} catch (e) { }
		};

		/* ---------- 遭遇战中：射出子弹（0.5.11.9 没有原版动作栏锚点，改为自建入口） ---------- */
		fs.shootLink = function () {
			try {
				if (typeof V === 'undefined' || !V) return;
				/* 只有真的在遭遇战里才给入口：V.combat===1 且确实有敌人（旧判据用 enemyhealth>0，战斗结束后会残留 → 能对空气开枪） */
				var inFight = (finalStar.inFight ? finalStar.inFight() : false);
				if (!inFight) return;
				var cur = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || '';
				if (/^FS /.test(cur)) return;
				/* ⚠️ 这里原来没有任何"玩家有没有枪"的检查：
				   第 281 行算出来的 `owned` 是个死变量，从头到尾没用过，
				   函数随后就无条件把「射击（手枪）」加进正文 ——
				   所以没枪也会冒出射击按钮（问题记录的「出遭遇战根本就没有枪」）。
				   判定统一用「手枪在手」，与动作区注入 fs-core.js、战斗面板 fs-combat.js 同一套，
				   别在这里再造第二个判据。 */
				if (typeof fs.handHasPistol !== 'function' || !fs.handHasPistol()) return;
				/* 弹药显示必须**把弹仓算进去**：验证结果时标签写「当前弹药 0 发」（那只是备弹），
				   可弹仓里压着 3 发，按钮照旧能开火 → 看起来像 0 发也能射击。
				   现在：弹仓 + 备弹都显示；两者都为 0 时**干脆不给入口**（没子弹就没有射击按钮）。 */
				var chamber = Number(V.pistolAmmo) || 0;
				var spare = (typeof fs.bulletCount === 'function' && typeof fs.activeBullet === 'function')
					? (Number(fs.bulletCount(fs.activeBullet())) || 0) : 0;
				if (chamber + spare <= 0) return;
				var line = '<a data-passage="FS Shoot" class="link-internal">射击（手枪）</a>'
					+ '<span class="fs-sub">（弹仓 ' + chamber + ' 发 · 备弹 ' + spare + ' 发）</span>';
				V.fs_castHtml = (V.fs_castHtml ? V.fs_castHtml + '<br>' : '') + line;
			} catch (e) { }
		};

		/* ---------- 遭遇战中：给出「骗 ta 吃下药丸」的入口 ---------- */
		fs.pillCombatLink = function () {
			try {
				if (typeof finalStar === 'undefined' || !finalStar.pillOwned) return;
				if (finalStar.pillOwned() <= 0) return;
				/* 药丸只能在遭遇战里用：必须真的在战斗中（旧判据用残留的 enemyhealth → 随时随地都能塞 ✗） */
				var inFight = (finalStar.inFight ? finalStar.inFight() : false);
				if (!inFight) return;
				var cur = (window.SugarCube && SugarCube.State && SugarCube.State.passage) || '';
				if (/^FS Pill/.test(cur)) return;
				var extra = '<span class="gold">你口袋里那枚灰白色的小药片硌着手心。</span><br>'
					+ '<a data-passage="FS Pill Use" class="link-internal">骗 ta 吃下药丸</a>'
					+ '<br><span class="fs-sub">（需要诡术 A 级；药丸剩 ' + finalStar.pillOwned() + ' 颗）</span>';
				V.fs_castHtml = (V.fs_castHtml ? V.fs_castHtml + '<br>' : '') + extra;
			} catch (e) { }
		};

		if (fs.onInit) fs.onInit(function () { fs.handlePendingCast(); fs.handleSealHit(); fs.sealTurnTick(); fs.pillCombatLink(); fs.shootLink(); if (finalStar.pillTick) finalStar.pillTick(); if (finalStar.alchemyWatch) finalStar.alchemyWatch(); if (finalStar.rentSurchargeTick) finalStar.rentSurchargeTick(); });
		fs.onDisplay(function () { setTimeout(fs.flushCastText, 60); });
	});

})();
