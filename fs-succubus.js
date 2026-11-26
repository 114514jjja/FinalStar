/* fs-succubus.js —— 天生魅魔：30 天纯洁魅魔、破处移除、异常淫荡 */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;
	/* 金色成就：天生魅魔（纯洁 30 天） */
	fs.ensureSuccubusFeat = function () {
		try {
			if (typeof setup === 'undefined' || !setup.feats) return false;
			if (!setup.feats['天生魅魔']) {
				setup.feats['天生魅魔'] = {
					title: '天生魅魔',
					desc: '以天生魅魔背景保持纯洁 30 天。',
					difficulty: 3,
					series: 'finalstar',
					filter: ['All', 'General'],
					softLockable: true
				};
			}
			return true;
		} catch (e) { return false; }
	};
	fs.succubusAchieve = function () {
		try {
			fs.ensureSuccubusFeat();
			if (window.SugarCube && SugarCube.Wikifier) {
				SugarCube.Wikifier.wikifyEval('<<earnFeat "天生魅魔">>');
			}
		} catch (e) { }
	};
	if (typeof fs.onInit === 'function') fs.onInit(fs.ensureSuccubusFeat);

	fs.succubusTick = function () {
		try {
			if (!V.succubus) return;
			if (!V.fsData.succubusStart) V.fsData.succubusStart = Number(Time.days) || 0;
			var broken = false;
			try {
				var p = V.player || {};
				if (p.virginity) {
					if (p.virginity.vaginal === false) broken = true;
					if (p.virginity.anal === false) broken = true;
				}
			} catch (e) { }
			if (broken) { V.pureSuccubus = false; return; }
			var days = (Number(Time.days) || 0) - (Number(V.fsData.succubusStart) || 0);
			if (!V.pureSuccubus && days >= 30) {
				V.pureSuccubus = true;
				try { fs.succubusAchieve(); } catch (e) { }
				try { fs.notify && fs.notify('你获得了特质：纯洁魅魔'); } catch (e2) { }
			}
		} catch (e) { }
	};
	fs.onDisplay(function () { setTimeout(fs.succubusTick, 120); });
	fs.log('天生魅魔模块已加载');
})();
