/* fs-rattlesnake.js — 响尾蛇系统：控制台的"第一次载入"动画 + 登录门 + 94 彩蛋
 *
 * 用户要的效果：
 *   打开控制台第一次 → 一段像代码在加载的动画（真实用我们模组自己的源代码在滚）
 *   → 错位的白/红小字：「世界线因你而变动」「罪人」
 *   → 屏幕中间一只 01 组成的眼睛，下面写「响尾蛇系统」，再下面两个选项：登录 / 退出
 *   → 之后照常显示控制台
 *   彩蛋：搜索框输入 94 弹出一段剧情文本（玖肆在这个系统里留下的第一次异常抗击记录）
 *
 * 用户定的边界（重要，别越界）：
 *   · 阵亡的都是原创无名同伴，绝不牵动原版任何角色；
 *   · 文本形式 = 先损坏日志、最后一段是玖肆的原话；
 *   · 动画只在第一次打开时播一次；「退出」之后下次仍回到登录界面；
 *   · 彩蛋不列在控制台里，只有输 94 才出现。
 *
 * 「94」= 玖肆 = 九四，所以系统里她就是「94 号」。
 */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	function V_() { return (typeof V !== 'undefined' && V) ? V : null; }

	fs.rsBooted = function () { try { return V_() && V.fs_rsBooted === 1; } catch (e) { return false; } };
	fs.rsLogged = function () { try { return V_() && V.fs_rsLogged === 1; } catch (e) { return false; } };
	fs.rsNeedGate = function () { return !fs.rsLogged(); };

	fs.rsLogin = function () {
		try {
			var v = V_(); if (!v) return false;
			v.fs_rsLogged = 1;
			fs.log('响尾蛇系统：已登录');
			return true;
		} catch (e) { return false; }
	};
	fs.rsLogout = function () {
		try {
			fs.rsClearStage();      /* ← 退出时同样先撤掉全屏舞台 */
			var v = V_(); if (!v) return false;
			v.fs_rsLogged = 0;
			fs.log('响尾蛇系统：已退出');
			/* 关掉浮层（回到原段落） */
			try {
				var host = document.getElementById('customOverlayContent');
				if (host) { host.innerHTML = ''; }
				if (window.$ && $('#customOverlay')) $('#customOverlay').hide();
			} catch (e2) { }
			return true;
		} catch (e) { return false; }
	};
	fs.rsMarkBooted = function () {
		try { var v = V_(); if (v) v.fs_rsBooted = 1; } catch (e) { }
	};

	/* ---------- 滚动用的"源代码" ----------
	   设计说明：「代码循环那一块改成理论上会出现一个名字为响尾蛇的按钮代码，
	   这串循环代码动画要充斥整个屏幕」。
	   所以这一段不再是"随便滚动的模组源码"，而是一段真的会造出一个名叫「响尾蛇」的按钮的代码：
	   定义 SYSTEM → createButton(label) → createButton('响尾蛇', …) → appendChild → 校验 → 等操作者按下。
	   动画会循环滚 3 遍（见 rsRunBoot），配合全屏的代码区，铺满整个屏幕。 */
	fs.rsCodeLines = [
		"/* ── FinalStar · 构造「响尾蛇」操作界面 ── */",
		"'use strict'",
		"",
		"const SYSTEM = {",
		"    name    : '响尾蛇',",
		"    build   : 'v0.27',",
		"    channel : 'private',",
		"    state   : 'booting'",
		"}",
		"",
		"/* 造一个按钮；label 就是它显示出来的字。 */",
		"function createButton(label, onClick) {",
		"    const el = document.createElement('button')",
		"    el.className   = 'link-internal macro-button'",
		"    el.textContent = label",
		"    el.addEventListener('click', onClick)",
		"    return el",
		"}",
		"",
		"const panel = document.createElement('div')",
		"panel.id = 'fs-rs-actions'",
		"",
		"const btn = createButton('响尾蛇', function () {",
		"    return SYSTEM.enter()",
		"})",
		"",
		"panel.appendChild(btn)",
		"document.body.appendChild(panel)",
		"",
		"/* ── 校验 ── */",
		"assert(btn.textContent === '响尾蛇')      /* OK */",
		"assert(btn.isConnected === true)          /* OK */",
		"SYSTEM.state = 'ready'",
		"",
		"/* 屏幕上现在应该有一个写着「响尾蛇」的按钮。 */",
		"/* 等待操作者按下它 …… */",
		"while (SYSTEM.state !== 'entered') {",
		"    idle(1)",
		"}",
		"",
	];

	/* 行号补零（全屏代码区里有个行号栏看着才像终端） */
	fs.rsPad = function (n) {
		var s = String(n);
		while (s.length < 4) s = ' ' + s;
		return s;
	};

	/* ---------- 错位提示语（白 / 红小字） ---------- */
	fs.rsGlitchLines = [
		{ t: '世界线因你而变动', cls: 'fs-rs-w' },
		{ t: '罪人', cls: 'fs-rs-r' },
		{ t: '记录者不是你的同伴', cls: 'fs-rs-w dim' },
		{ t: '这一条线上，你已经死过很多次', cls: 'fs-rs-r' }
	];

	/* ---------- 94 彩蛋：玖肆留下的第一次异常抗击记录 ----------
	   阵容：全部为原创无名同伴（只有编号），不牵动原版任何角色。
	   结尾呼应模组自己的那句「记忆会证明我们来过。」（洞穴勋章/见证者那条线） */
	var EGG_LOG = [
		'<span class="fs-rs-red">[记录损坏]</span> 第一次异常抗击 · 行动编号 ██-01',
		'参与单位 ██　返回 <span class="fs-rs-red">2</span>',
		'',
		'<span class="fs-rs-dim">03:12</span>　异常边界没有闭合。我们按预案进去了。',
		'<span class="fs-rs-dim">03:40</span>　外侧的传声断了。██ 号没有回应。',
		'<span class="fs-rs-dim">04:05</span>　它们不在我们以为的那一层。',
		'<span class="fs-rs-dim">04:26</span>　退路在我们身后合上。那不是异常做的——是那栋楼。',
		'<span class="fs-rs-dim">05:00</span>　███、███、███……<span class="fs-rs-dim">（此处被反复覆盖，无法还原）</span>',
		'',
		'<span class="fs-rs-red">记录在此中断。</span>'
	];
	var EGG_WORDS = [
		'我不知道该把这段话放在哪儿，所以放在这儿。',
		'',
		'回来的一共两个人。我是其中一个。这件事我到现在都没想明白该怎么算——',
		'他们不是被吃掉的，也不是被撕碎的。他们只是<span class="fs-rs-w">不再继续</span>了。',
		'像一句话说到一半，剩下的半句从来不存在。',
		'',
		'我把每一个人的编号都记住了。那是我唯一还能替他们做的事。',
		'',
		'如果你在读这个：别把「活下来」当成赢。',
		'那天之后我才明白，有些仗打完，人还在，但已经不剩什么了。',
		'',
		'<span class="fs-rs-dim">……记忆会证明我们来过。</span>'
	];

	fs.rsEggHtml = function () {
		var h = [];
		h.push('<div class="fs-panel fs-console fs-rs-egg">');
		h.push('<h3><img class="fs-rs-eye-sm" src="img/misc/icon/finalstar/ui-rattlesnake.png" alt=""> 响尾蛇系统 · 残缺条目</h3>');
		h.push('<div class="fs-rs-log">');
		for (var i = 0; i < EGG_LOG.length; i++) h.push(EGG_LOG[i] + '<br>');
		h.push('</div>');
		h.push('<hr class="fs-rs-hr">');
		h.push('<div class="fs-rs-words">');
		h.push('<div class="fs-rs-sig">—— 以下为 <span class="fs-rs-w">94 号</span>留下的私人条目 ——</div>');
		for (var j = 0; j < EGG_WORDS.length; j++) h.push(EGG_WORDS[j] + '<br>');
		h.push('</div>');
		h.push('<br><div class="fs-sub">（本条不在控制台列表里。清空搜索框即可回去。）</div>');
		h.push('</div>');
		return h.join('');
	};

	/* ---------- 载入动画 + 登录界面 ---------- */
	/* 动画只在第一次打开控制台时播一次；之后（含"退出"之后）直接给登录界面 */
	fs.rsStageHtml = function () {
		var boot = !fs.rsBooted();
		var h = [];
		h.push('<div class="fs-panel fs-console fs-rs-stage" id="fs-rs-stage">');
		h.push('<div class="fs-rs-brand"><img class="fs-rs-eye" src="img/misc/icon/finalstar/ui-rattlesnake.png" alt="">');
		h.push('<div class="fs-rs-title">响尾蛇系统</div>');
		h.push('<div class="fs-rs-sub" id="fs-rs-sub">' + (boot ? '正在载入……' : '等待登录') + '</div></div>');
		if (boot) {
			h.push('<div class="fs-rs-code" id="fs-rs-code"></div>');
			h.push('<div class="fs-rs-glitch" id="fs-rs-glitch"></div>');
		} else {
			h.push('<div class="fs-rs-code fs-rs-code-quiet" id="fs-rs-code"></div>');
			h.push('<div class="fs-rs-glitch" id="fs-rs-glitch"></div>');
		}
		h.push('<div class="fs-rs-actions" id="fs-rs-actions"' + (boot ? ' style="visibility:hidden"' : ' style="visibility:visible"') + '>');
		h.push('<input type="button" class="link-internal macro-button fs-rs-btn" value="登录" onclick="finalStar.rsDoLogin()">');
		h.push('<input type="button" class="link-internal macro-button fs-rs-btn fs-rs-btn-exit" value="退出" onclick="finalStar.rsLogout()">');
		h.push('</div>');
		if (boot) h.push('<div class="fs-rs-skip" id="fs-rs-skip"><a href="javascript:void(0)" onclick="finalStar.rsSkip()">跳过</a></div>');
		h.push('</div>');
		if (boot) setTimeout(function () { fs.rsRunBoot(); }, 60);
		return h.join('');
	};

	/* 把舞台搬到 document.body 上。
	   为什么必须搬：舞台想用 position:fixed + inset:0 铺满视口，但验证它落在 **(602, 32)** ——
	   尺寸是 1400×900（对的），位置却是偏的。原因是祖先链上有 transform / filter / contain，
	   按 CSS 规范，position:fixed 会改以那个祖先为包含块，不再相对视口。
	   搬到 body 下就没有这个祖先了。
	   ⚠️ 搬到 body 之后，控制台面板重新渲染不会顺手删掉它（面板只替换 #customOverlayContent），
	   所以登录/退出前必须自己调用 rsClearStage()，否则会留下一层全屏遮挡。 */
	fs.rsRelocateStage = function () {
		try {
			var el = document.getElementById('fs-rs-stage');
			if (!el || !document.body) return false;
			if (el.parentNode !== document.body) document.body.appendChild(el);
			el.style.position = 'fixed';
			el.style.top = '0'; el.style.left = '0';
			el.style.right = '0'; el.style.bottom = '0';
			el.style.width = '100%'; el.style.height = '100%';
			return true;
		} catch (e) { return false; }
	};
	fs.rsClearStage = function () {
		try {
			var el = document.getElementById('fs-rs-stage');
			if (el && el.parentNode) el.parentNode.removeChild(el);
		} catch (e) { }
	};

	fs.rsDoLogin = function () {
		fs.rsClearStage();          /* ← 先撤掉全屏舞台，再重渲染控制台面板 */
		fs.rsLogin();
		/* 登录后要重新渲染的是控制台面板（fs_panel_console），不是设置面板首页 ——
		   控制台是独立面板，由「控制台」标签按钮 <<replace #customOverlayContent>> 渲染出来的。
		   第一版这里调的是 openSettings()（回设置首页），所以登录后看不到控制台。 */
		setTimeout(function () {
			try {
				var host = document.getElementById('customOverlayContent');
				if (host && window.jQuery) { jQuery(host).wiki('<<fs_panel_console>>'); return; }
			} catch (e) { }
			try { if (typeof fs.openSettings === 'function') fs.openSettings(); } catch (e2) { }
		}, 0);
		return true;
	};

	/* 动画：代码循环往下滚（铺满全屏）→ 错位小字 → 出现登录按钮 */
	var _bootTimer = null;
	var BOOT_CYCLES = 3;        /* 代码循环滚 3 遍 */
	var BOOT_MAX_NODES = 640;   /* 代码区最多保留这么多 DOM 节点（≈320 行），超出从头删，防止无限增长 */
	fs.rsRunBoot = function () {
		try {
			var codeEl = document.getElementById('fs-rs-code');
			var glitchEl = document.getElementById('fs-rs-glitch');
			var actEl = document.getElementById('fs-rs-actions');
			var subEl = document.getElementById('fs-rs-sub');
			if (!codeEl || !glitchEl) return;
			var lines = fs.rsCodeLines.slice();
			var i = 0, gi = 0, cycle = 0, lineNo = 1;
			clearInterval(_bootTimer);
			_bootTimer = setInterval(function () {
				if (cycle < BOOT_CYCLES) {
					var buf = [];
					/* 一次补 3~5 行，滚得快一点，全屏才填得满 */
					var add = 3 + Math.floor(Math.random() * 3);
					for (var k = 0; k < add; k++) {
						if (i >= lines.length) {
							cycle++; i = 0;
							if (cycle >= BOOT_CYCLES) break;
							buf.push('<span class="fs-rs-cmt">/* ───────── 循环 ' + (cycle + 1) + ' / ' + BOOT_CYCLES + ' ───────── */</span>');
						}
						var ln = lines[i++];
						buf.push('<span class="fs-rs-ln">' + fs.rsPad(lineNo++) + '</span>' + (ln === '' ? '&nbsp;' : fs.rsEsc(ln)));
					}
					if (buf.length) {
						/* 用临时节点插入，顺便把节点数压在上限内（等价于"一直往下滚"但 DOM 不涨） */
						var wrap = document.createElement('div');
						wrap.innerHTML = buf.join('<br>') + '<br>';
						while (wrap.firstChild) codeEl.appendChild(wrap.firstChild);
						while (codeEl.childNodes.length > BOOT_MAX_NODES) codeEl.removeChild(codeEl.firstChild);
						codeEl.scrollTop = codeEl.scrollHeight;
					}
					return;
				}
				/* 代码滚完 → 逐条放错位小字 */
				if (gi < fs.rsGlitchLines.length) {
					var g = fs.rsGlitchLines[gi++];
					glitchEl.insertAdjacentHTML('beforeend', '<div class="fs-rs-line ' + g.cls + '">' + g.t + '</div>');
					return;
				}
				clearInterval(_bootTimer); _bootTimer = null;
				fs.rsMarkBooted();
				if (subEl) subEl.textContent = '等待登录';
				if (actEl) actEl.style.visibility = 'visible';
				var skip = document.getElementById('fs-rs-skip');
				if (skip) skip.style.display = 'none';
				if (codeEl) codeEl.classList.add('fs-rs-code-quiet');
			}, 90);
		} catch (e) { fs.warn('响尾蛇载入动画失败: ' + e.message); }
	};
	/* 跳过动画 */
	fs.rsSkip = function () {
		try { clearInterval(_bootTimer); _bootTimer = null; } catch (e) { }
		fs.rsMarkBooted();
		var actEl = document.getElementById('fs-rs-actions');
		if (actEl) actEl.style.visibility = 'visible';
		var subEl = document.getElementById('fs-rs-sub');
		if (subEl) subEl.textContent = '等待登录';
		var skip = document.getElementById('fs-rs-skip');
		if (skip) skip.style.display = 'none';
		return true;
	};
	fs.rsEsc = function (s) {
		return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	};

	/* ================= 游戏内「残缺版」= 控制台第 11 个分区 =================
	   设计说明：游戏内这份只显示最近三条发帖记录，想往下看会被阻止；
	   拦法选的是乱码式（看起来是数据本身坏了，不是权限不够）；
	   而且游戏内这份与手机 app 那份分开写、要更残缺（用户明确选的）。
	   所以这里不是把 app 的数据抄过来，而是重写成"本机缓存只剩三条"的形态：
	   名字被覆写成 ███ 的、回复被截断的、时间戳对不上的 —— 这些残缺都是故意的。 */
	fs.rsWeakPosts = [
		{
			when: '新国56年12月30日 23:58',
			name: '西蕾丝提娅', handle: '@celeste_melt',
			body: '明天就是新的一年了。\n本部只剩我一个人。我把所有的灯都打开，走廊从头亮到尾，像以前一样。\n我坐在这里等。等幻界，等警报，等谁来跟我说一句话。\n什么都没来。\n所以我写下这一条。如果有人还能看到它，那说明这个地方还在。',
			rep: [
				{ n: '洛璃', h: '@luo_li_thread', t: '我在。我看到了。' },
				{ n: '缪莎', h: '@miansha_', t: '我在。' },
				{ n: '新人311', h: '@xin_ren_311', t: '我在。' },
				{ n: '███', h: '@███', t: '我 在 。' }
			],
			note: '（另有 3 条回复：@qian_ci_22 / @S_W_night / @limei_meng —— 内容已覆写）'
		},
		{
			when: '新国56年11月20日 16:40',
			name: '梨梦元（笙歌）', handle: '@limei_meng',
			body: '我开始写最后一份记录。\n不是给谁看的，格式随便写的。第一行我写的是：新国一年，东方家族成立了响尾蛇。\n写到今天，写了五十六年。中间很多都记不清了，我只能写我还记得的名字。\n写完最后一行我发现：我记得的名字比数字少得多。',
			rep: [
				{ n: '洛璃', h: '@luo_li_thread', t: '名字给我一份。我替你记住。' },
				{ n: '笙歌', h: '@limei_meng', t: '好。谢谢你。' }
			],
			note: ''
		},
		{
			when: '新国56年11月8日 02:14',
			name: '新人311', handle: '@xin_ren_311',
			body: '好久没人发帖了。我来发一条，就一条。\n我不是想问为什么死了这么多人。这个问题我四年前就不问了。\n我只想说：我从进响尾蛇到现在，一共认识过六十一个人。今天还活着的，我知道的有三个。\n如果我以后也不发了，请不要以为我忘了。',
			rep: [
				{ n: '缪莎', h: '@miansha_', t: '我看见了。' },
				{ n: '西蕾丝提娅', h: '@celeste_melt', t: '我看见了。' }
			],
			note: '（本条时戳校验未通过，与缓存索引不一致，无法校正）'
		}
	];

	fs.rsWeakHtml = function () {
		var h = [];
		h.push('<div class="fs-sub">本机缓存　·　仅存 <span class="gold">3</span> 条　' +
			'<span class="red">（其余记录不可读取）</span></div><br>');
		for (var i = 0; i < fs.rsWeakPosts.length; i++) {
			var p = fs.rsWeakPosts[i];
			h.push('<div style="margin:0 0 .7rem 0">');
			h.push('<span class="fs-tag">' + fs.rsEsc(p.name) + '</span>　' +
				'<span class="fs-sub">' + fs.rsEsc(p.handle) + '　' + fs.rsEsc(p.when) + '</span><br>');
			h.push('<div class="fs-sub" style="white-space:pre-wrap">' + fs.rsEsc(p.body) + '</div>');
			for (var k = 0; k < p.rep.length; k++) {
				var r = p.rep[k];
				h.push('<div class="fs-sub" style="padding-left:1.2em">· ' +
					fs.rsEsc(r.n) + '　' + fs.rsEsc(r.h) + '：' + fs.rsEsc(r.t) + '</div>');
			}
			if (p.note) h.push('<div class="fs-sub" style="padding-left:1.2em;opacity:.6">' + p.note + '</div>');
			h.push('</div>');
		}
		h.push('<input type="button" class="link-internal macro-button" value="查看更多" ' +
			'onclick="finalStar.rsMorePosts()">');
		return h.join('');
	};

	/* 「查看更多」→ 乱码式拒绝（用户选的）：像数据本身坏了，而不是权限不够。
	   文案沿用小说《响尾蛇记录档案》那套"覆写失败 / 解码失败"的写法。 */
	fs.rsMorePosts = function () {
		try {
			var el = document.getElementById('fs-weak-posts');
			if (!el) return false;
			el.innerHTML = '<div class="fs-sub">' +
				'/𝙍𝘼⃟𝙏𝙏𝙇𝙀/请求已发出<br>' +
				'　　　/𝙎.⃟𝙒/连接未能建立<br><br>' +
				'<span class="red">/𝙍𝘼⃟𝙏𝙏𝙇𝙀/覆写失败</span><br>' +
				'请求的记录不存在，或已被覆写<br>' +
				'(error499，未知错误)<br><br>' +
				'只剩下 3 条。<br>' +
				'　　剩下的　全都不在了。<br><br>' +
				'(解码失败，您似乎遇到了一点问题，这不是我的错，也不是你的问题...)<br><br>' +
				'██  不要回应  ██  不要  ██  回应  ██' +
				'</div>';
			fs.log('残缺版：查看更多 → 已覆写（故意）');
			return true;
		} catch (e) { return false; }
	};

	fs.log('响尾蛇系统已加载（动画只播一次 / 登录门 / 输 94 出彩蛋 / 控制台残缺版）');
})();
