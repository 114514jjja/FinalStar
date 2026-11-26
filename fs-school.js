/* ============================================================
   终星 FinalStar —— 校园线（规划书 110）
   1. 我们原创的遭遇事件不显示按钮，像原版霸凌事件一样直接出现
   2. 玖肆在数学课上阻止霸凌事件（纸团、钢笔、图钉、起哄等）
   3. 送信事件改为玖肆陪同；途中遇到遭遇战立刻结束
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* 数学课霸凌类事件名（阻止对象） */
	fs.mathsBullyEvents = [
		'mathsEvent1',
		'mathsWhitneyPaperBall',
		'mathsWhitneyPen',
		'mathsWhitneyProtractor',
		'mathsPenThrow',
		'mathsSafe6',
		'mathsLowerLiftTease',
		'mathsTFears'
	];

	fs.jiusiInSchool = function () {
		try {
			/* 必须「已经见过她」再谈保护：只判 jiusiProtect 会出现「没认识玖肆，数学课却冒出她的送信/救场」。 */
			return Number(V.jiusiProtect) === 1 && Number(V.jiusiMeet) === 1 && V.location === 'school';
		} catch (e) { return false; }
	};

	/* 本次是否由玖肆出面（避免每节课都触发） */
	fs.jiusiStopChance = 0.34;

	/* ---------- 事件池拦截：数学课霸凌 ---------- */
	fs.patchEventPool = function () {
		try {
			if (!window.Macro || !Macro.get) { fs.warn('事件池拦截：Macro 不可用'); return false; }
			var orig = Macro.get('runeventpool');
			if (!orig || !orig.handler) { fs.warn('事件池拦截：未找到 runeventpool'); return false; }
			if (orig.__fsPatched) { fs.log('事件池拦截：已打过补丁'); return true; }
			var origHandler = orig.handler;
			Macro.add('runeventpool', {
				skipArgs: true,
				handler: function () {
					var T = (typeof State !== 'undefined' && State.temporary) ? State.temporary : window.T;
					var restored = null;
					try {
						if (T && Array.isArray(T.eventpool) && fs.jiusiInSchool()) {
							var before = T.eventpool.length;
							var kept = T.eventpool.filter(function (e) {
								return fs.mathsBullyEvents.indexOf(e && e.name) === -1;
							}).map(function (e) {
								/* 送信：玖肆在数学课时改为陪同前往 */
								if (e && e.name === 'mathsMessageDelivery') {
									return { name: e.name, weight: e.weight, content: '<<fs_maths_note_jiusi>>' };
								}
								return e;
							});
							/* 只要确实拦下了霸凌事件，就有概率让玖肆出面 */
							if (kept.length < before && Math.random() < fs.jiusiStopChance) {
								kept.push({
									name: 'fsJiusiMathsStop',
									weight: 1,
									content: '<<fs_maths_jiusi_stop>>'
								});
							}
							restored = T.eventpool;
							T.eventpool = kept;
						}
					} catch (e) { }
					try {
						return origHandler.call(this);
					} finally {
						try { if (restored && T) T.eventpool = restored; } catch (e) { }
					}
				}
			});
			var patched = Macro.get('runeventpool');
			if (patched) patched.__fsPatched = true;
			fs.log('事件池拦截已安装（数学课霸凌 ' + fs.mathsBullyEvents.length + ' 项）');
			return true;
		} catch (e) {
			fs.warn('事件池拦截失败: ' + e.message);
			return false;
		}
	};

	/* ---------- 送信：玖肆陪同（遭遇战立刻结束） ---------- */
	fs.noteWithJiusi = function () {
		try {
			V.fs_noteWithJiusi = 1;
			return true;
		} catch (e) { return false; }
	};
	/* 遭遇战立刻结束：清除战斗状态并给出文本 */
	fs.endEncounterByJiusi = function () {
		try {
			V.combat = 0;
			V.enemyhealth = 0;
			V.enemyanger = 0;
			if (typeof V.enemyno === 'number') V.enemyno = 0;
			fs.log('玖肆介入：遭遇战立刻结束');
			return true;
		} catch (e) { return false; }
	};

	fs.log('校园模块已加载（遭遇事件直击 / 玖肆数学课与送信）');
	fs.register('school', function () {
		/* 数学课霸凌事件由 TweeReplacer 在段落层直接改走玖肆分支；
		   若运行环境提供了 SugarCube Macro 全局，再装一层事件池兜底 */
		if (typeof Macro !== 'undefined' && Macro && Macro.get) fs.patchEventPool();
		else fs.log('事件池兜底跳过（无 Macro 全局，已由段落替换处理）');
	});

	/* ---------- 数学课「偷偷拆信」的后果：当天下午校长办公室进不去 ----------
	   要的文本：大门紧锁 / 敲门没有反应 / 保安罕见地站在门口 / 玩家没法进去。
	   做法：在段落层拦，不去改原版的链接。
	   为什么：进办公室的链接有好几条（`[[Head's office (0:02)|Head's Office]]` 等），
	   而且大多是 `Head's Office` 段落内部互跳 —— 去改链接就得碰原版锚点，版本一动就失配；
	   拦段落只要比对段落名，稳得多，而且不覆写任何原版段落（本项目的不变式）。
	   「短暂」= 只锁这一个下午：跨天（fs.onDay）自动清掉。 */
	fs.HEAD_OFFICE = "Head's Office";
	fs.headOfficeLocked = function () {
		try {
			var v = (typeof V !== 'undefined' && V) ? V : null;
			if (!v || Number(v.fs_headOfficeLocked) !== 1) return false;
			var cur = (typeof fs.currentPassage === 'function') ? fs.currentPassage() : '';
			return cur === fs.HEAD_OFFICE;
		} catch (e) { return false; }
	};
	if (fs.onInit) {
		fs.onInit(function () {
			try {
				if (fs.headOfficeLocked() && typeof fs.goPassage === 'function') fs.goPassage('FS Head Office Locked', true);
			} catch (e) { }
		});
	}
	if (fs.onDay) {
		fs.onDay(function () {
			try {
				if (V && Number(V.fs_headOfficeLocked) === 1) { V.fs_headOfficeLocked = 0; fs.log('校长办公室已恢复开放（跨天）'); }
			} catch (e) { }
		});
	}

})();
