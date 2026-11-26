/* fs-book.js —— 卧室里的「棕色封面的童话书」
 *
 * 设计上（）：
 *   · 长线剧情结束、回到孤儿院卧室后，床头出现一个按钮「你发现床头有东西」
 *   · 点开发现是一本棕色封面的童话书；第一次会疑惑，继续调查，发现除第一页哪页都翻不动
 *   · 点「查看第一页」→ 俩人（苏梦棠 & 笙不瑜）留给玩家的话 + 玩家走过的故事线（分页）
 *   · 结尾一句：梦中棠溪过，笙苏不渝
 *   · 达成别的结局会解锁第二页、第三页……用来记住自己走过哪条线
 */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	fs.bookUnlocked = function () {
		try {
			var d = fs.mor();
			var list = (d && Array.isArray(d.endings)) ? d.endings.slice() : [];
			if (!list.length && d && d.ending) list = [d.ending];
			return list;
		} catch (e) { return []; }
	};
	fs.bookPageNo = function (key) {
		try {
			var list = fs.bookUnlocked();
			var i = list.indexOf(key);
			return i === -1 ? 0 : i + 1;
		} catch (e) { return 0; }
	};
	fs.bookHas = function (key) { return fs.bookPageNo(key) > 0; };

	fs.bookPageKey = function (i) {
		var list = fs.bookUnlocked();
		return list[Number(i) || 0] || null;
	};
	fs.bookOpen = function () {
		try {
			var found = !!(V.fsData && V.fsData.bookFound);
			fs.goPassage(found ? 'FS Book Menu' : 'FS Book Find');
		} catch (e) { }
	};

	fs.log('童话书模块已加载（结局后床头按钮 / 逐页解锁）');
})();
