/* fs-food.js — 饥饿接入原版吃饭动作（不是我们自己塞入口）
 *
 * 用户的要求：「在学校吃午饭这种恢复饥饿的事件不是在卧室点击，我更希望是在原版的世界里面添加这种额外的附属性，
 *              比如在学校选择吃午饭无论是自己吃还是跟谁吃都会恢复饥饿，文本也能额外添加一段」
 *            「在商店里买咖啡在 -压力 后面加上 -饥饿」
 *
 * 做法：按段落名挂钩。段落名是英文的、稳定的，整合包换译文也不会失配 —— 比拿英文正文当锚点可靠得多。
 *      （正文锚点的问题见交接文档 §4.3：汉化环境里含英文文本的锚点会全部失效。）
 *
 * 数值提示用原版自己的 API：window.statDisplay.statChange(label, amount, cls)
 *   —— 它输出的就是 ` | <span class="green">- Stress</span>` 这种原生提示。
 *   我们把它插在最后一个原生提示后面，也就是用户说的「-压力后面」。
 *   标签文字会跟着原版走：原版提示是中文就写「饥饿」，是英文就写 "Hunger"。
 */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* ---------- 挂哪些原版段落、回多少饥饿 ----------
	   段落名全部核对过确实存在于 0.5.12.13（见 canteen.twee / main.twee / meal.twee / christmas.twee）。 */
	fs.foodHooks = {
		/* 学校食堂：自己吃 + 跟每个人吃，都算一顿 */
		'Canteen Lunch': { h: 50, t: '你把托盘上的东西一样样吃干净。食堂的吵闹声反而让人安心。' },
		'Canteen Lunch Robin': { h: 50, t: '你和罗宾面对面坐着，谁都没提钱的事。这顿饭吃得比你想的饱。' },
		'Canteen Lunch Robin CD 1': { h: 50, t: '你和罗宾面对面坐着，谁都没提钱的事。这顿饭吃得比你想的饱。' },
		'Canteen Robin Whitney': { h: 50, t: '你和罗宾一起把这顿饭吃完了——惠特尼在附近，但没人过来。' },
		'Canteen Lunch Kylar': { h: 50, t: '凯拉一直低头扒饭，偶尔抬眼看你一下。你们都没说话，但这顿饭吃完了。' },
		'Canteen Lunch Sydney': { h: 50, t: '西德尼把书推到一边，认真地把饭吃完。你也是。' },
		'Canteen Lunch Sandwich': { h: 30, t: '三明治不算丰盛，但顶饿。' },
		'Canteen Milkshake': { h: 20, t: '冰凉的奶昔顺着喉咙下去，至少胃里不再空落落的。' },
		/* 咖啡馆 */
		'Cafe Eat': { h: 40, t: '咖啡馆的份量不算大，但吃完确实踏实了些。' },
		'Cafe Pancakes': { h: 45, t: '松饼上的糖浆粘在嘴角，你顺手擦掉。这一顿很甜。' },
		'Cafe Coffee': { h: 10, t: '咖啡填不饱肚子，但至少让人清醒。' },   /* 用户说咖啡按常识判断 → 只填一点 */
		/* 其它原版进食点（顺带接上） */
		'Danube Meal': { h: 45, t: '' },
		'Docks Lunch': { h: 45, t: '' },
		'Eden Lunch': { h: 45, t: '' },
		'Eden Christmas Meal': { h: 50, t: '' }
	};

	fs.foodHookNames = function () { return Object.keys(fs.foodHooks); };

	/* ---------- 原生样式的「- Hunger / - 饥饿」提示 ---------- */
	/* 找原版提示用的标签文字：原版 statChange 的输出形如 ` | <span class="green">- Stress</span>`，
	   前缀是数量个 "- " / "+ "，所以用「以 - / + 开头」判断与语言无关。 */
	function indicatorLabel() {
		try {
			var spans = document.querySelectorAll('#passages span.green, #passages span.red');
			for (var i = spans.length - 1; i >= 0; i--) {
				var t = (spans[i].textContent || '').trim();
				if (/^([-+]\s)+/.test(t)) {
					/* 原版提示是中文（被汉化过）就用中文，否则沿用英文 */
					return /[\u4e00-\u9fa5]/.test(t) ? '饥饿' : 'Hunger';
				}
			}
		} catch (e) { }
		return '饥饿';                       /* 兜底：本项目面向中文环境 */
	}
	function indicatorNode(amount) {
		try {
			if (window.statDisplay && typeof statDisplay.statChange === 'function') {
				return statDisplay.statChange(indicatorLabel(), Math.abs(Number(amount) || 1), 'green');
			}
		} catch (e) { }
		return null;
	}
	/* 把「+ 饥饿」插在最后一个原生数值提示后面（= 用户说的「-压力后面」）。
	   找不到原生提示就追加到正文末尾。 */
	fs.foodIndicator = function (amount) {
		try {
			var node = indicatorNode(amount);
			if (!node) return false;
			var host = fs.passageHost ? fs.passageHost() : null;
			if (!host) return false;
			var anchor = null;
			var spans = host.querySelectorAll('span.green, span.red');
			for (var i = spans.length - 1; i >= 0; i--) {
				if (/^([-+]\s)+/.test((spans[i].textContent || '').trim())) { anchor = spans[i]; break; }
			}
			if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(node, anchor.nextSibling);
			else host.appendChild(node);
			return true;
		} catch (e) { return false; }
	};

	/* 额外文本：插在正文末尾（用统一的 fs.passageHost()，见交接文档 §4.5） */
	fs.foodNote = function (text) {
		try {
			if (!text) return false;
			var host = fs.passageHost ? fs.passageHost() : null;
			if (!host) return false;
			var d = document.createElement('div');
			d.className = 'fs-food-note';
			d.id = 'fs-food-note';
			d.innerHTML = '<br>' + text;
			var old = document.getElementById('fs-food-note');
			if (old && old.parentNode) old.parentNode.removeChild(old);
			host.appendChild(d);
			return true;
		} catch (e) { return false; }
	};

	/* ---------- 挂钩执行 ---------- */
	fs.foodApply = function () {
		try {
			var p = (typeof fs.currentPassage === 'function') ? fs.currentPassage()
				: ((window.SugarCube && SugarCube.State) ? String(SugarCube.State.passage) : '');
			var hk = fs.foodHooks[p];
			if (!hk) return false;
			/* 防重复：用**这次进入段落的令牌**去重，不要用墙上时钟。
			   原来用 Date.now() 的 2 秒窗口：停留期间只要发生间隔 >2 秒的第二次渲染
			   （重绘 / 700ms 自愈周期 / 自绘 passage() 链接）就会**再加一次**饥饿（食堂一次 +100）；
			   反之间隔 <2 秒的真实二次进入会被吞掉。
			   改用 SugarCube 的历史长度：同一次停留内恒定（重绘不会变），每真正过一段就 +1。 */
			var turn = '';
			try {
				if (window.SugarCube && SugarCube.State && SugarCube.State.history) turn = String(SugarCube.State.history.length);
			} catch (e1) { turn = ''; }
			var token = turn ? (p + '#' + turn) : (p + '#' + Math.floor(Date.now() / 2000));   /* 取不到就退回旧行为 */
			if (fs._foodLast && fs._foodLast.token === token) return false;
			fs._foodLast = { p: p, token: token, t: Date.now() };
			var before = fs.hunger();
			fs.hungerAdd(hk.h);
			var got = fs.hunger() - before;
			/* 提示与文本都延到正文渲染完之后再插 */
			setTimeout(function () { fs.foodIndicator(Math.max(1, Math.round(hk.h / 10))); }, 30);
			setTimeout(function () { fs.foodNote(hk.t); }, 45);
			fs.log('原版进食挂钩：' + p + ' 饥饿 +' + got);
			return true;
		} catch (e) { return false; }
	};

	/* ================= 孤儿院大厅的长桌（每天最多 3 个面包） ================= */
	var LOAF_MAX = 3;
	fs.loafMax = LOAF_MAX;
	fs.loafToday = function () { try { return Number(V.daily && V.daily.fsLoaf) || 0; } catch (e) { return 0; } };

	/* 拿到面包时的旁白（随机） */
	var TAKE_TEXT = [
		'没人看你。你顺手拿了一个，塞进怀里。',
		'旁边的小个子抬头看了一眼，又低下头去。',
		'桌上剩下的不多了，你挑了个最大的。',
		'有人哼了一声，但没说什么。',
		'面包还是温的。你把它收好。'
	];
	/* 拿多了被拦下的旁白 —— 有的语气好，有的语气不好（设计上随机） */
	var BLOCK_NICE = [
		'一个女孩把手按在篮子上："今天的不够分了，你明天早点来吧。"',
		'"你已经拿过了，对吧？"她说得很轻，"留点给别人。"',
		'有个年纪更小的孩子拽了拽你的袖子："我也还没吃……"',
		'管桌子的大孩子冲你摆手："明天再来，今天真没了。"'
	];
	var BLOCK_MEAN = [
		'"你还想拿？"有人把篮子往自己那边拖，"脸呢。"',
		'"你已经拿够了。"对方连头都没抬，"滚。"',
		'一只手把你的手腕打开："别的手都没你这么勤快。"',
		'"再伸手我就去告诉贝利。"'
	];
	function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

	/* 取一个面包：成功 → 进背包；超过上限 → 被阻止（随机语气） */
	fs.loafTake = function () {
		try {
			var v = V; if (!v) return { ok: false, text: '（读不到存档）' };
			var n = fs.loafToday();
			if (n >= LOAF_MAX) {
				var mean = Math.random() < 0.5;
				return { ok: false, text: pick(mean ? BLOCK_MEAN : BLOCK_NICE), mean: mean };
			}
			v.daily = v.daily || {};
			v.daily.fsLoaf = n + 1;
			v.bread = (Number(v.bread) || 0) + 1;              /* 进背包（背包会列出 bread） */
			fs.log('长桌：拿走面包 ' + v.daily.fsLoaf + '/' + LOAF_MAX + '（背包面包 ' + v.bread + '）');
			return { ok: true, text: pick(TAKE_TEXT), count: v.daily.fsLoaf };
		} catch (e) { return { ok: false, text: '出错：' + e.message }; }
	};

	fs.log('原版进食挂钩已加载（' + Object.keys(fs.foodHooks).length + ' 个段落） + 孤儿院长桌（每天 ' + LOAF_MAX + ' 个面包）');
})();
