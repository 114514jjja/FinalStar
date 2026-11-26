/* ============================================================
   终星 FinalStar —— 地下洞穴：层数 / 前进 / 怪物 / 数值上限快照
   ============================================================ */
(function () {
	'use strict';
	var fs = window.finalStar;
	if (!fs) return;

	/* ---------- 洞穴配置 ---------- */
	fs.cave = {
		floors: 3,
		stepsPerFloor: 10,
		/* 每层逐步提高遇怪概率：一层 25% → 二层 35% → 三层 50% */
		encounterChanceByFloor: { 1: 0.25, 2: 0.35, 3: 0.5 }
	};
	fs.encounterChance = function (floor) {
		var t = fs.cave.encounterChanceByFloor[floor];
		return (typeof t === 'number') ? t : 0.25;
	};

	/* ---------- 怪物（第一层第一只已指定，其余为原创） ---------- */
	fs.caveMobs = [
		{
			key: 'eyeTentacle', name: '缠尸触手', floor: 1,
			hp: 300, dmgMin: 10, dmgMax: 50, guarantee: true,
			desc: '通体发黑，像是缠绕在尸体上的触手怪。胸口处张开一只眼睛——它眨了一下，然后盯住了你。'
		},
		{
			key: 'boneCrawler', name: '啃骨者', floor: 1,
			hp: 320, dmgMin: 15, dmgMax: 45, guarantee: false,
			desc: '一团由碎骨拼成的蠕动物体，关节处渗出粘稠的黑液。它靠听觉找人。'
		},
		{
			key: 'mistWraith', name: '雾中哀影', floor: 2,
			hp: 520, dmgMin: 50, dmgMax: 90, guarantee: true,
			desc: '半透明的轮廓浮在雾气里，看不清脸，只有不断开合的嘴。它记得每一个死在这里的人。'
		},
		{
			key: 'rustHound', name: '锈猎犬', floor: 2,
			hp: 640, dmgMin: 60, dmgMax: 100, guarantee: false,
			desc: '由生锈的铁链与残肢拧成的四足生物，跑起来时链条哗啦作响。'
		},
		{
			key: 'graySister', name: '灰修女', floor: 2,
			hp: 560, dmgMin: 55, dmgMax: 95, guarantee: false,
			desc: '穿着灰袍的高瘦身影，双手合十，指缝间却滴着血。她低声念着与你无关的祷词。'
		},
		{
			key: 'starEater', name: '噬星者', floor: 3,
			hp: 1200, dmgMin: 100, dmgMax: 170, guarantee: true,
			desc: '它没有形状，只有一片缓慢旋转的黑暗。你看向它时，某种东西正在从你身上被抽走。'
		},
		{
			key: 'chorusBeast', name: '合唱兽', floor: 3,
			hp: 900, dmgMin: 90, dmgMax: 150, guarantee: false,
			desc: '数十张脸长在同一具躯体上，同时开口说话。它们说出的都是你的名字。'
		}
	];

	fs.mobsForFloor = function (floor) {
		return fs.caveMobs.filter(function (m) { return m.floor === floor; });
	};

	/* ---------- 数值上限快照（进入洞穴前记录，离开后回滚 → 临时祝福消失） ---------- */
	/* 洞穴遭遇：非自然现象 → 理智扣减 */
	fs.caveSanityHit = function () { try { if (finalStar.sanityOnEldritch) finalStar.sanityOnEldritch(); } catch (e) { } };

	fs.snapshotLimits = function () {
		fs.ensureData();
		V.fsData.limits = {
			painmax: V.painmax, stressmax: V.stressmax, traumamax: V.traumamax,
			arousalmax: V.arousalmax, tirednessmax: V.tirednessmax, taken: Date.now()
		};
		fs.log('已记录进入洞穴前的数值上限');
		return V.fsData.limits;
	};
	fs.restoreLimits = function () {
		fs.ensureData();
		var snap = V.fsData.limits;
		if (!snap) return false;
		['painmax', 'stressmax', 'traumamax', 'arousalmax', 'tirednessmax'].forEach(function (k) {
			if (typeof snap[k] === 'number') V[k] = snap[k];
		});
		if (typeof V.pain === 'number' && typeof V.painmax === 'number' && isFinite(V.painmax)) V.pain = Math.min(V.pain, V.painmax);
		if (typeof V.stress === 'number') V.stress = Math.min(V.stress, V.stressmax);
		V.fsData.limits = null;
		fs.log('已回滚数值上限（临时祝福消失）');
		return true;
	};

	/* ---------- 每层环境文本（63：每次前进都有环境变化） ---------- */
	fs.caveEnvPool = {
		1: [
			'头顶那道裂缝又暗了一分。你能看见灰尘在光里缓慢地翻滚，像水里悬着的沙。',
			'脚下的碎石比刚才更碎了，踩上去会陷进去半寸——有人在这条路上来回走过很多次。',
			'岩壁上有一道新的划痕，齐肩高，笔直得像用尺子量过。你不记得刚才经过时看见过它。',
			'空气里铁锈的味道浓了一点。你摸了摸鼻子——没有流血。',
			'通道在这里往右拐了一个很小的弯。拐过去以后，你身后那段路看上去和刚才不太一样了。',
			'地上有一小片干掉的水渍，形状很像一只手按出来的。',
			'头顶传来一声很闷的响动，像是有谁在很远的地方合上了一扇门。',
			'越往前走，回声越短。你的脚步声好像被什么东西吃掉了。',
			'墙上嵌着几枚生了锈的铁钉，间隔完全一致——有人在这里挂过东西，挂了很久。',
			'你停下来的时候，前面也停了。你迈步的时候，前面慢半拍地跟上。'
		],
		2: [
			'霜比刚才更厚了，踩下去会先陷进去，再发出很脆的一声。',
			'甜味里混进了一点别的什么——像是花放久了以后那种发腻的腐味。',
			'墙上浮出一片模糊的水痕，形状像一张侧脸。你再看时，它已经被霜盖住了。',
			'你的呼吸在面前结成一小团白雾，久久不散，像是停在那里看着你。',
			'通道两侧的岩壁忽然变得很光滑，像是被谁反复抚摸过。',
			'你听见有人在很远的地方低声说话。你听不清词，但那语调像是在报数。',
			'地上散落着几片指甲，边缘整齐，像是被仔细剪下来的。',
			'霜下面压着一层旧的脚印。你数了三遍，每一次数出来的数目都不一样。',
			'前面传来水声。你走过去，那里是干的。',
			'你回头看了一眼。来时的路上，霜是完整的——没有你的脚印。'
		],
		3: [
			'黑色的水从岩缝里渗出来，滴在地上，亮一下，然后被黑暗吃掉。',
			'你踩到了一样软的东西。你低头看，那里只有石头。',
			'黑暗在这一段有了重量。你往前走的每一步，都像是要推开什么东西。',
			'你听见自己的心跳，然后听见第二颗心跳，比你的慢半拍。',
			'前方的通道贴满了同一种刻痕：一颗星，被反复刻了一千遍。',
			'这里的地面开始向下倾斜，坡度很小，但你能感觉到自己一直在往深处走。',
			'有一瞬间，你看见通道尽头站着一个人影。等你眨眼，那里只有你的火把。',
			'空气忽然变得很甜，和上面那层一样——你不确定自己是不是在往下走。',
			'你的手在岩壁上摸到了一片温的地方。你把手收回来，指尖是干净的。',
			'所有的声音都停了。连你自己的呼吸都停了半拍——然后才重新开始。'
		]
	};
	fs.caveEnv = function (floor, step) {
		var pool = fs.caveEnvPool[floor] || fs.caveEnvPool[1];
		var idx = (Math.max(1, step || 1) - 1) % pool.length;
		return pool[idx];
	};

	/* ---------- 勋章交付博物馆（67：温特 5940 钱） ---------- */
	fs.hasMedal = function () {
		try { return !!(V.fsData && V.fsData.medal); } catch (e) { return false; }
	};
	fs.medalGiven = function () {
		try { return !!(V.fsData && V.fsData.medalGiven); } catch (e) { return false; }
	};
	fs.giveMedalToWinter = function () {
		fs.ensureData();
		if (!V.fsData.medal) return false;
		if (V.fsData.medalGiven) return false;
		V.fsData.medalGiven = true;
		V.fsData.medal = false;
		V.money += 5940 * 100;
		fs.log('勋章已交付温特（+5940）');
		return true;
	};

	/* ---------- 洞穴拾取物 ---------- */	fs.giveSuitcase = function () {
		fs.ensureData();
		if (!Array.isArray(V.fsData.suitcases)) V.fsData.suitcases = [];
		V.fsData.suitcases.push({ value: 20 + Math.floor(Math.random() * 81), opened: false });
		return true;
	};
	fs.sellSuitcase = function (index) {
		fs.ensureData();
		if (!Array.isArray(V.fsData.suitcases)) return false;
		var s = V.fsData.suitcases[index];
		if (!s) return false;
		V.money += s.value * 100;
		V.fsData.suitcases.splice(index, 1);
		return s.value;
	};
	fs.giveAntique = function () {
		fs.ensureData();
		if (!Array.isArray(V.fsData.antiques)) V.fsData.antiques = [];
		var list = ['锈蚀的铜镜', '刻着蛇纹的石牌', '没有指针的怀表', '半枚断裂的银币', '装满黑沙的小瓶'];
		var item = list[Math.floor(Math.random() * list.length)];
		V.fsData.antiques.push(item);
		return item;
	};
	fs.giveCross = function () {
		fs.ensureData();
		V.fsData.cross = (V.fsData.cross || 0) + 1;
		return true;
	};
	fs.giveMedal = function () {
		fs.ensureData();
		V.fsData.medal = true;
		return true;
	};

	/* ---------- 洞穴战败恢复 ---------- */
	fs.caveDefeatRecover = function () {
		try {
			fs.restoreLimits();
			/* 疼痛真实上限是 200（原版 painClamp() 里的字面量；mod 自己的 painmax 只是镜像它）。
			   原来按 painmax*0.4 算，而 painmax 被错造成 1000 → 疼痛被设成 400，是上限的 2 倍。 */
			if (typeof V.pain === 'number') V.pain = 40;
			if (typeof V.stress === 'number') V.stress = Math.floor(V.stressmax * 0.3);
			fs.log('洞穴战败恢复完成（贝利线）');
		} catch (e) { }
	};

	/* ---------- 洞穴进度 ---------- */
	fs.caveState = function () {
		fs.ensureData();
		var c = V.fsData.cave;
		if (typeof c.floor !== 'number') c.floor = 1;
		if (typeof c.step !== 'number') c.step = 0;
		if (!Array.isArray(c.log)) c.log = [];
		return c;
	};
	fs.caveAdvance = function () {
		var c = fs.caveState();
		c.step += 1;
		if (c.step > fs.cave.stepsPerFloor) c.step = fs.cave.stepsPerFloor;
		return c;
	};
	fs.caveNextFloor = function () {
		var c = fs.caveState();
		if (c.step < fs.cave.stepsPerFloor) return false;
		c.floor += 1;
		c.step = 0;
		return true;
	};
	fs.caveCleared = function () {
		try { return !!(V.fsData && V.fsData.cave && V.fsData.cave.cleared); }
		catch (e) { return false; }
	};
	fs.caveFinish = function () {
		var c = fs.caveState();
		c.cleared = true;
		fs.ensureData();
		V.fsData.witness = true;
		V.fsData.medal = true;
		if (typeof fs.grantWitness === 'function') fs.grantWitness();
		fs.log('洞穴通关：获得勋章与「见证者」特质');
		return true;
	};

	/* ---------- 随机事件池 ---------- */
	fs.caveEvents = function (floor) {
		var pool = [];
		/* 「什么也没遇到」概率最大 */
		for (var i = 0; i < 6; i++) pool.push('nothing');
		if (floor === 1) {
			pool.push('moneySmall', 'fightMark');
		} else if (floor === 2) {
			pool.push('moneySmall', 'moneySmall', 'scroll', 'agent', 'nun', 'suitcase');
		} else {
			pool.push('moneyMid', 'moneyMid', 'antique', 'scroll', 'corpse', 'skeleton', 'cross', 'suitcase');
		}
		return pool;
	};
	fs.caveRollEvent = function (floor) {
		var pool = fs.caveEvents(floor);
		var pick = pool[Math.floor(Math.random() * pool.length)];
		if (Math.random() < fs.encounterChance(floor)) pick = 'fight';
		return { type: pick, fight: pick === 'fight' };
	};

	fs.initCave = function () {
		fs.caveState();
		fs.log('地下洞穴模块已加载（' + fs.cave.floors + ' 层 × '
			+ fs.cave.stepsPerFloor + ' 次前进 / ' + fs.caveMobs.length + ' 种怪物）');
	};

	fs.register('cave', function () { fs.initCave(); });

})();
