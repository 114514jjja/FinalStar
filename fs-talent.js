/* fs-talent.js —— 天赋树：点数、解锁、退款、面板 */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* 33 个天赋：tree=combat/charm/daily/neutral；cost=点数；pre=前置；cond=特殊条件 */
	fs.talents = [
		{ id: 'c1', tree: 'combat', name: '好战', cost: 20, pre: [], icon: 'sword', desc: '受到的伤害 -1。' },
		{ id: 'c2', tree: 'combat', name: '坚韧', cost: 30, pre: ['c1'], icon: 'shield', desc: '疼痛增长 -10%。' },
		{ id: 'c3', tree: 'combat', name: '反击', cost: 30, pre: ['c1'], icon: 'fist', desc: '每场首次受击反弹 2 点。' },
		{ id: 'c4', tree: 'combat', name: '连击', cost: 50, pre: ['c1'], icon: 'cards', desc: '原创卡牌战每回合多出 1 张。' },
		{ id: 'c5', tree: 'combat', name: '猎手', cost: 50, pre: ['c2'], icon: 'eye', desc: '对怪物伤害 +10%（原创）。' },
		{ id: 'c6', tree: 'combat', name: '铁皮', cost: 50, pre: ['c2'], icon: 'armor', desc: '原创战斗开局获得 5 护甲。' },
		{ id: 'c7', tree: 'combat', name: '弹药节省', cost: 30, pre: ['c1'], icon: 'bullet', desc: '射击 15% 不消耗子弹。' },
		{ id: 'c8', tree: 'combat', name: '本能', cost: 20, pre: [], icon: 'boot', desc: '遭遇战中 15% 概率闪避伤害。' },
		{ id: 'c9', tree: 'combat', name: '压制', cost: 50, pre: ['c6'], icon: 'fist', desc: '敌人攻击 -2（原创）。' },
		{ id: 'c10', tree: 'combat', name: '血勇', cost: 50, pre: ['c2'], icon: 'sword', desc: '疼痛过半时伤害 +15%（原创）。' },

		{ id: 'h1', tree: 'charm', name: '魅惑入门', cost: 20, pre: [], icon: 'heart', desc: '解锁魅惑点用途。' },
		{ id: 'h2', tree: 'charm', name: '精液爱好者', cost: 30, pre: ['h1'], icon: 'drop', desc: '遭遇战后收集体液进背包。' },
		{ id: 'h3', tree: 'charm', name: '魅魔觉醒', cost: 50, pre: ['h2'], icon: 'moon', desc: '可食用收集物回复饥饿。' },
		{ id: 'h4', tree: 'charm', name: '甜言', cost: 30, pre: ['h1'], icon: 'lips', desc: '原版诱惑检定 +5%。' },
		{ id: 'h5', tree: 'charm', name: '曲线', cost: 30, pre: ['h4'], icon: 'heart', desc: '展示身体时诱惑加成。' },
		{ id: 'h6', tree: 'charm', name: '顺从之美', cost: 30, pre: ['h1'], icon: 'drop', desc: '被压制时压力增长减半。' },
		{ id: 'h7', tree: 'charm', name: '采补', cost: 50, pre: ['h1'], icon: 'moon', desc: '敌人高潮时自身性奋下降。' },
		{ id: 'h8', tree: 'charm', name: '催情体香', cost: 50, pre: ['h4'], icon: 'lips', desc: '敌人高潮阈值降低（原版）。' },
		{ id: 'h9', tree: 'charm', name: '收集癖', cost: 50, pre: ['h2'], icon: 'drop', desc: '收集物可堆叠、可出售。' },
		{ id: 'h10', tree: 'charm', name: '魅惑精通', cost: 50, pre: ['h7', 'h8'], icon: 'heart', desc: '每次获得魅惑点 +1。' },

		{ id: 'd1', tree: 'daily', name: '打工达人', cost: 30, pre: [], icon: 'coin', desc: '每次打工额外 +£10。' },
		{ id: 'd2', tree: 'daily', name: '讲价', cost: 20, pre: [], icon: 'coin', desc: '商店价格 -5%。' },
		{ id: 'd3', tree: 'daily', name: '省吃', cost: 20, pre: [], icon: 'star', desc: '饥饿增长 -10%。' },
		{ id: 'd4', tree: 'daily', name: '好眠', cost: 20, pre: [], icon: 'moon', desc: '睡眠恢复压力 +10%。' },
		{ id: 'd5', tree: 'daily', name: '早睡早起', cost: 30, pre: ['d4'], icon: 'star', desc: '睡醒后当天压力额外 -10。' },
		{ id: 'd6', tree: 'daily', name: '路熟', cost: 50, pre: ['d2'], icon: 'boot', desc: '莫伦斯城内移动时间 -25%（原版小镇不生效）。' },
		{ id: 'd7', tree: 'daily', name: '拾荒', cost: 30, pre: ['d2'], icon: 'coin', desc: '街头事件额外获得小钱。' },
		{ id: 'd8', tree: 'daily', name: '学业', cost: 30, pre: [], icon: 'cards', desc: '上课成绩 +5%。' },
		{ id: 'd9', tree: 'daily', name: '社交', cost: 50, pre: ['d8'], icon: 'lips', desc: '好感获取 +2。' },
		{ id: 'd10', tree: 'daily', name: '警觉', cost: 30, pre: [], icon: 'eye', desc: '森林地区遭遇战概率降低。' },

		{ id: 'n1', tree: 'neutral', name: '共鸣', cost: 30, pre: ['c1', 'h1'], icon: 'star', desc: '原创战斗伤害 +5%，原版战斗疼痛 -5%。两套战斗都吃到被动。', both: true },
		{ id: 'n2', tree: 'neutral', name: '双面', cost: 50, pre: ['n1'], icon: 'cards', desc: '原创卡牌战攻击有 20% 概率额外获得 1 魅惑点。', both: true },
		{ id: 'n3', tree: 'neutral', name: '深渊契约', cost: 50, pre: ['n1'], icon: 'moon', desc: '原创战斗伤害 +15%，但受到的疼痛 +10%。', both: true, cond: 'jiusiMax' }
	];
	fs.talentData = function () {
		try {
			V.fsData.talent = V.fsData.talent || { combat: 0, charm: 0, day: 0, today: { combat: 0, charm: 0 }, unlocked: [], refunded: [] };
			return V.fsData.talent;
		} catch (e) { return null; }
	};
	fs.talentHas = function (id) { var t = fs.talentData(); return !!(t && t.unlocked.indexOf(id) !== -1); };
	fs.talentAdd = function (kind, n) {
		try {
			var t = fs.talentData();
			if (!t) return false;
			var today = (window.Time && Time.days) ? Number(Time.days) : 0;
			if (t.day !== today) { t.day = today; t.today = { combat: 0, charm: 0 }; }
			var inc = Number(n) || 1;
			/* 「魅惑精通」：每次获得魅惑点额外 +1（仍受每日 5 点上限） */
			if (kind === 'charm' && inc > 0 && fs.talentHas('h10')) inc += 1;
			if (t.today[kind] >= 5) return false;
			t.today[kind] = Math.min(5, t.today[kind] + inc);
			t[kind] += inc;
			return true;
		} catch (e) { return false; }
	};
	fs.talentCanUnlock = function (id) {
		try {
			var t = fs.talentData(), x = null;
			for (var i = 0; i < fs.talents.length; i++) if (fs.talents[i].id === id) x = fs.talents[i];
			if (!x || t.unlocked.indexOf(id) !== -1) return 'owned';
			for (var p = 0; p < x.pre.length; p++) if (t.unlocked.indexOf(x.pre[p]) === -1) return 'pre';
			if (x.cond === 'jiusiMax') {
				var j = V.NPCNameList ? V.NPCNameList.indexOf('玖肆') : -1;
				if (j === -1 || !V.NPCName[j] || Number(V.NPCName[j].love) < 100) return 'cond';
				if (!(V.fsData.mor && V.fsData.mor.cleared)) return 'cond';
			}
			if (x.both) { if (t.combat < x.cost || t.charm < x.cost) return 'points'; }
			else if (t[x.tree] < x.cost) return 'points';
			return 'ok';
		} catch (e) { return 'error'; }
	};
	fs.talentUnlock = function (id) {
		try {
			var r = fs.talentCanUnlock(id);
			if (r !== 'ok') return r;
			var t = fs.talentData(), x = null;
			for (var i = 0; i < fs.talents.length; i++) if (fs.talents[i].id === id) x = fs.talents[i];
			if (x.both) { t.combat -= x.cost; t.charm -= x.cost; } else { t[x.tree] -= x.cost; }
			t.unlocked.push(id);
			return 'ok';
		} catch (e) { return 'error'; }
	};
	fs.talentRefund = function (id) {
		try {
			var t = fs.talentData();
			var i = t.unlocked.indexOf(id);
			if (i === -1) return 'no';
			t.unlocked.splice(i, 1);
			if (t.refunded.indexOf(id) === -1) t.refunded.push(id);
			return 'ok';   /* 不返还点数，只退回技能 */
		} catch (e) { return 'error'; }
	};
	fs.talentHtml = function (tab) {
		try {
			var t = fs.talentData();
			var list = fs.talents.filter(function (x) { return x.tree === tab; });
			var h = ['<div class="fs-talent-bar">战斗点 ' + t.combat + '　魅惑点 ' + t.charm + '　今日 ' + t.today.combat + '/5 · ' + t.today.charm + '/5</div>'];
			h.push('<div class="fs-talent-grid">');
			for (var i = 0; i < list.length; i++) {
				var x = list[i], st = fs.talentCanUnlock(x.id), cls = 'fs-talent';
				if (st === 'owned') cls += ' on'; else if (st !== 'ok') cls += ' off';
				h.push('<div class="' + cls + '" onclick="finalStar.talentClick(\'' + x.id + '\')">'
					+ '<div class="fs-talent-ico"><<icon "finalstar/talent-' + x.icon + '.png">></div>'
					+ '<div class="fs-talent-name">' + x.name + '</div>'
					+ '<div class="fs-talent-cost">' + x.cost + ' 点</div>'
					+ '<div class="fs-talent-desc">' + x.desc + '</div></div>');
			}
			h.push('</div>');
			return h.join('');
		} catch (e) { return ''; }
	};
	fs.talentClick = function (id) {
		try {
			if (fs.talentHas(id)) { fs.talentRefund(id); }
			else { var r = fs.talentUnlock(id); if (r !== 'ok') { fs.talentMsg = ({ pre: '前置天赋没点。', points: '点数不够。', cond: '条件未满足。', owned: '' })[r] || '不能解锁。'; } else fs.talentMsg = ''; }
			fs.goPassage('FS Talent', true);
		} catch (e) { }
	};

	/* 页签切换：不用 <<button>>，避免被 DoL 的 Links.generateLinkNumbers 加上 (1) 前缀；
	   直接写原生 button，类名由 CSS 的 .tab button 接管。 */
	fs.talentTab = function (tab) {
		try {
			if (['combat', 'charm', 'daily', 'neutral'].indexOf(tab) === -1) return false;
			V.fs_talentTab = tab;
			fs.goPassage('FS Talent', true);
			return true;
		} catch (e) { return false; }
	};

	/* 侧栏「天赋」按钮（UI 元素，不写进剧情） */
	/*  修：以前是"找可见的『背包』元素 → cloneNode → 插在它后面"。
	   但 querySelectorAll 按文档顺序会先命中背包所在的 **div.sidebarButtonSplit**，
	   克隆出来的行被 textContent='天赋' 清掉了按钮，于是侧栏左下角只剩一行裸文字。
	   现在照 fs-links.js 的 injectBagButton 写法，直接造原版按钮：
	   div.sidebarButtonSplit + button.link-internal.macro-button，放进 #overlayButtons，
	   位置在「模组设置」之后、「背包」之前。 */
	fs.talentSidebar = function () {
		try {
			var host = document.getElementById('overlayButtons');
			if (!host) return;

			var row = document.getElementById('fs-talent-row');
			if (!row) {
				row = document.createElement('div');
				row.className = 'sidebarButtonSplit';
				row.id = 'fs-talent-row';
			}
			var btn = document.getElementById('fs-talent-btn');
			if (!btn) {
				btn = document.createElement('button');
				btn.type = 'button';
				btn.id = 'fs-talent-btn';
				btn.className = 'link-internal macro-button';
				btn.title = '终星 · 天赋树';
				btn.textContent = '天赋';
				btn.addEventListener('click', function (ev) {
					if (ev) ev.preventDefault();
					try { fs.goPassage('FS Talent'); } catch (e) { }
				});
			}
			if (btn.parentNode !== row) row.appendChild(btn);

			/* 侧栏每次重绘都会把整块 #overlayButtons 换掉；这里每次都把行挂回去。
			   找不到「模组设置」就挂在「背包」前；两者都没有才放末尾。 */
			if (row.parentNode !== host) {
				var anchor = document.getElementById('fs-sidebar-split') || document.getElementById('fs-bag-row');
				if (anchor && anchor.parentNode === host) host.insertBefore(row, anchor.nextSibling);
				else host.appendChild(row);
			}
		} catch (e) { }
	};
	/* 侧栏会被原版整块重绘，按钮可能被冲掉：低频守护，发现没了就补回。 */
	setInterval(function () { try { fs.talentSidebar(); } catch (e) { } }, 1500);
	fs.onDisplay(function () { setTimeout(fs.talentSidebar, 60); fs.talentCharmWatch(); fs.talentLoveWatch(); });


	/* 魅惑点：原版遭遇里敌方高潮结束战斗时 +1（用 enemyarousal 判定） */
	fs.talentCharmWatch = function () {
		try {
			V.fsData = V.fsData || {};
			if (V.combat === 1) {
				var emax = Number(V.enemyarousalmax) || 0;
				if (emax > 0 && Number(V.enemyarousal) >= emax && !V.fsData.charmPending) {
					V.fsData.charmPending = 1;
					/* 采补：敌人高潮时自身性奋下降 15% */
					if (fs.talentHas('h7')) {
						var amax = Number(V.arousalmax) || 1000;
						V.arousal = Math.max(0, (Number(V.arousal) || 0) - Math.round(amax * 0.15));
						fs.log('天赋「采补」：性奋 -15%');
					}
					/* 精液爱好者：把敌人的高潮收集进背包 */
					if (fs.talentHas('h2')) {
						V.fsData.charmItems = V.fsData.charmItems || {};
						V.fsData.charmItems['精液'] = (Number(V.fsData.charmItems['精液']) || 0) + 1;
						fs.log('天赋「精液爱好者」：收集到 1 份精液');
					}
				}
				return;
			}
			if (V.fsData.charmPending) {
				V.fsData.charmPending = 0;
				fs.talentAdd('charm', 1);
				fs.log('魅惑点 +1（敌方高潮结束）');
			}
		} catch (e) { }
	};


	/* 社交：所有 NPC 的正面好感获取翻倍（对比上一次快照，补上同样的增量） */
	fs.talentLoveWatch = function () {
		try {
			if (!fs.talentHas('d9') || !V.NPCName) { fs.talentLoveSnap = null; return; }
			var snap = fs.talentLoveSnap;
			var cur = {};
			for (var i = 0; i < V.NPCName.length; i++) {
				var n = V.NPCName[i]; if (!n || !n.nam) continue;
				cur[n.nam] = Number(n.love) || 0;
				if (snap && snap[n.nam] !== undefined) {
					var d = cur[n.nam] - snap[n.nam];
					if (d > 0 && d < 20) n.love = Math.min(100, cur[n.nam] + d);
				}
			}
			fs.talentLoveSnap = cur;
		} catch (e) { }
	};

	fs.log('天赋模块已加载（33 个天赋 / 四页签 / 点数）');
})();
