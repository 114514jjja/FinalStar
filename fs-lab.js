/* fs-lab.js —— 新内容：排水系统尽头的实验室
   用户口述规格（照此写，不自创设定）：
     · 玖肆好感达 50% 时与她聊天，她会交给玩家一把钥匙
     · 宅邸街的下水道住宅区排水系统里，有一道墙上有钥匙孔；打开是一间简陋的实验室
     · 地上散落着大片某种实验材料；有一个纸箱，玩家可以选择在里面睡觉
     · 第三次玖肆会告诉玩家「这里似乎被盯上了」，之后纸箱无法再提供睡觉的帮助
     · 摆弄器材会发现一本日记：记着一段传奇的冒险故事，后面不是被撕掉就是被涂黑，
       只在末尾写着「x计划」；一个熟悉的地点映入眼帘——宅邸街，有重大事件要发生，
       已无法阻止，现实堕落

   状态都放在 V.fsData.labData 下（沿用模组既有约定：不新增顶层存档字段）。
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* 领钥匙所需的好感（与段落里 love gte 50 的门保持一致） */
	fs.labMinLove = 50;

	function lab() {
		fs.ensureData();
		if (!V.fsData.labData || typeof V.fsData.labData !== 'object') {
			V.fsData.labData = { key: 0, keyGiven: 0, opened: 0, boxSleeps: 0, warned: 0, diary: 0 };
		}
		var L = V.fsData.labData;
		if (typeof L.boxSleeps !== 'number' || !isFinite(L.boxSleeps)) L.boxSleeps = 0;
		if (typeof L.key !== 'number') L.key = 0;
		return L;
	}
	fs.labState = lab;

	/* 玖肆好感：用模组已有的那套（它自己会算惩罚/别名），取不到就退回存档字段 */
	fs.labLove = function () {
		try { if (typeof fs.jiusiLove === 'function') return Number(fs.jiusiLove()) || 0; } catch (e) { }
		try { return Number(V.fsData.jiusiLike) || 0; } catch (e) { return 0; }
	};

	/* ---------- 钥匙 ---------- */
	fs.labCanGetKey = function () {
		try { var L = lab(); return (!L.keyGiven && !L.key && fs.labLove() >= fs.labMinLove); } catch (e) { return false; }
	};
	fs.hasLabKey = function () { try { var L = lab(); return !!L.key; } catch (e) { return false; } };
	fs.giveLabKey = function () {
		try {
			var L = lab();
			L.key = 1;
			L.keyGiven = 1;
			fs.log('玖肆把钥匙交给了玩家（好感 ' + fs.labLove() + ' ≥ ' + fs.labMinLove + '）');
			return true;
		} catch (e) { return false; }
	};

	/* ---------- 实验室 ---------- */
	fs.labOpened = function () { try { return !!lab().opened; } catch (e) { return false; } };
	fs.openLab = function () {
		try {
			var L = lab();
			L.opened = 1;
			/* 记住「实验室是哪天开的」——长线剧情「莫伦斯」要在开启后**第 3 天**触发相遇场景。
			   （ 新增；morMarkLab 自己会判重，重复调用不会覆盖第一天） */
			if (typeof fs.morMarkLab === 'function') fs.morMarkLab();
			/* 打开过一次之后，钥匙就没用了：留在手里只是纪念品 */
			fs.log('实验室已开启');
			return true;
		} catch (e) { return false; }
	};

	/* ---------- 纸箱睡觉 ----------
	   规格：可以睡；第三次玖肆会说「这里似乎被盯上了」，之后纸箱不再能睡。
	   所以判定顺序是「先看有没有已经被警告过」→ 再加一次计数 → 第三次返回 'warn'。 */
	fs.labBoxSleeps = function () { try { return Number(lab().boxSleeps) || 0; } catch (e) { return 0; } };
	fs.labBoxCanSleep = function () { try { return !lab().warned; } catch (e) { return false; } };
	fs.labWarned = function () { try { return !!lab().warned; } catch (e) { return false; } };
	fs.labBoxUse = function () {
		try {
			var L = lab();
			if (L.warned) return 'done';                 /* 已经被盯上：纸箱不再提供帮助 */
			L.boxSleeps = (Number(L.boxSleeps) || 0) + 1;
			if (L.boxSleeps >= 3) {
				L.warned = 1;
				fs.log('纸箱第三次：玖肆警告「这里似乎被盯上了」，此后不可再睡');
				return 'warn';
			}
			fs.log('在纸箱里睡了第 ' + L.boxSleeps + ' 次');
			return 'ok';
		} catch (e) { return 'done'; }
	};

	/* ---------- 日记 ---------- */
	fs.labDiaryFound = function () { try { return !!lab().diary; } catch (e) { return false; } };
	fs.findLabDiary = function () {
		try {
			var L = lab();
			L.diary = 1;
			L.opened = 1;                                /* 翻过器材就算进过实验室了 */
			fs.log('在实验器材里发现了日记');
			return true;
		} catch (e) { return false; }
	};

	/* ---------- 入口：已从「排水系统段落内」改到「下水道菜单」 ----------
	    用户改规格：不再在 Residential Drain 正文里挂"墙上的钥匙孔"，
	   改为在原版 Storm Drain Entrance（点下水道那个菜单）里出现第三个选项「？？？」。
	   实现方式是 boot.json 的 TweeReplacer + LabSewerOption.txt（纯 twee 条件），
	   所以原来这里的 labDrainHtml() 已删除 —— 别再加回来，否则会出现两个入口。 */

	fs.log('实验室模块已加载（钥匙门 ' + fs.labMinLove + '% 好感 / 纸箱限两次 / 第三次被警告 / 入口在下水道菜单）');
})();
