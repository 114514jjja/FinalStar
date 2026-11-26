/* ============================================================
   终星 FinalStar —— 战斗：物资面板（纯信息）+ 战斗收尾
   魔法与射击的动作按钮不再由框架注册：
     - 「射击」「吟唱魔法」等动作由 TweeReplacer 注入到
       Widgets Actions Left Hand / Right Hand（patch/LeftActions.txt、RightActions.txt）
     - 效果文本由 Widgets Effects Man 注入（patch/CastEffects.txt）
     - 按钮颜色由 ReplacePatcher 写进 ingame.js 的 combatActionColours
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* ---------- 战斗物资面板：注入到战斗界面最下方（纯展示） ---------- */
	fs.refreshPanel = function () {
		var slot = document.getElementById('fs-combat-slot');
		if (!slot) return;
		try {
			while (slot.firstChild) slot.removeChild(slot.firstChild);
			new Wikifier(slot, '<<fs_combat_panel>>');
		} catch (e) {
			fs.warn('刷新物资面板失败: ' + e.message);
		}
	};

	fs.injectCombatPanel = function () {
		try {
			if (!fs.inCombat()) return;
			if (V.fs_combatPanel === false) return;
			/* 83：手持物里没有魔书 / 制式手枪时，面板不显示 */
			var hasPistol = (typeof fs.pistolInHand === 'function') && fs.pistolInHand();
			if (!fs.hasBookInHand() && !hasPistol) return;
			var pc = fs.passageHost ? fs.passageHost() : document.getElementById('passage-content');
			if (!pc) return;
			if (document.getElementById('fs-combat-slot')) return;
			/* ⚠️ 原先把面板塞进正文的**最后一个子 div** 里（divs[divs.length-1]）。
			   问题：那个子 div 不保证是整宽容器 —— 在手机窄屏下它可能是个窄列，
			   面板继承了它的宽度 → 表格列被压塌成一条竖线（用户截图报的）。
			   现在直接挂到正文容器 pc 上，取满宽。 */
			var wrap = document.createElement('div');
			wrap.className = 'fs-combat-container';
			var slot = document.createElement('div');
			slot.id = 'fs-combat-slot';
			wrap.appendChild(slot);
			pc.appendChild(wrap);
			new Wikifier(slot, '<<fs_combat_panel>>');
		} catch (e) {
			fs.warn('注入物资面板失败: ' + e.message);
		}
	};

	fs.log('战斗物资模块已加载（面板为纯信息显示，动作按钮走手部动作）');

	fs.register('combat', function () {
		fs.onDisplay(function () { setTimeout(fs.injectCombatPanel, 30); });
	});

})();
