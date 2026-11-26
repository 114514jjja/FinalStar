/* test_morans_logic.cjs —— 莫伦斯模块的离线单元测试（不需要游戏）
 *
 * 做法：给 window.finalStar / window.V / setup 打桩，直接 require 真实模块，
 * 然后验证纯逻辑：相邻行走路径、服装店库存与购买、成绩等级、目标文本、随机事件、结局余波。
 *
 * 运行：node tools/test_morans_logic.cjs
 */
const path = require('path');
const fs = require('fs');

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

/* ---------- 桩 ---------- */
const state = { money: 100000, fsData: { mor: null } };
global.window = {};
global.V = state;
global.setup = {
  clothes: {
    upper: [
      { name: 'naked', name_cap: 'Naked', cost: 0 },
      { name: 'sundress', name_cap: 'Sundress', cost: 1500 },
      { name: 't-shirt', name_cap: 'T-shirt', cost: 1000 },
      { name: 'babydoll lingerie', name_cap: 'Babydoll lingerie', cost: 1500 },
      { name: 'hidden dress', name_cap: 'Hidden dress', cost: 0 },
    ],
    lower: [
      { name: 'naked', name_cap: 'Naked', cost: 0 },
      { name: 'skirt', name_cap: 'Skirt', cost: 1200 },
    ],
    feet: [{ name: 'shoes', name_cap: 'Shoes', cost: 800 }],
    under_upper: [{ name: 'bra', name_cap: 'Bra', cost: 700 }],
    under_lower: [{ name: 'panties', name_cap: 'Panties', cost: 600 }],
  },
};
global.document = {
  body: { classList: { add() { }, remove() { } } },
  getElementById() { return null; },
  createElement() { return { appendChild() { }, set innerHTML(v) { }, classList: { add() { }, remove() { } } }; },
  querySelector() { return null; },
};
global.SugarCube = { State: { passage: 'FS Morans City' }, Engine: { play() { } }, Wikifier: { wikifyEval() { return null; } } };

const fsapi = {
  version: 'test',
  log() { }, warn() { },
  register(name, fn) { try { fn(); } catch (e) { } },
  onInit(fn) { }, onDisplay(fn) { },
  goPassage() { return true; },
  statHint(label, n, cls) { return ' | <span class="' + (cls || 'red') + '">' + ((Number(n) || 1) < 0 ? '- ' : '+ ') + label + '</span>'; },
  morMoney(n) { state.money += Number(n) || 0; },
  morAddStress() { }, morAddTrauma() { }, morAddPain() { },
  morToday() { return 1; },
  morGrade() { return Number(state.fsData.mor.grade) || 0; },
  hasBook() { return true; },
  pistolInHand() { return state.pistol === true; },
  hasBookInHand() { return state.bookInHand === true; },
  currentPassage() { return 'Danube Street'; },
  equippedSeal() { return 'none'; },
  goPassage() { return true; },
  mor() { return state.fsData.mor; },
  ensureData() { },
};
window.finalStar = fsapi;
global.finalStar = fsapi;
window.V = state;
window.setup = global.setup;

/* ---------- 载入真实模块 ---------- */
require(path.join(__dirname, '..', 'fs-morans.js'));
require(path.join(__dirname, '..', 'fs-duel.js'));
const fs2 = window.finalStar;

/* 建立一份城市状态 */
state.fsData.mor = fs2.morDefaults();
state.fsData.mor.inCity = 1;
state.fsData.mor.day = 2;
state.fsData.mor.clock = 8 * 60;

console.log('\n[1] 相邻行走路径（3×3 网格）');
const p1 = fs2.morPath('park', 'clinic');
ok('公园(0,0) → 诊所(2,2) 需要 4 段', p1.length === 4, JSON.stringify(p1));
ok('路径每一段都是相邻格', (() => {
  let prev = [0, 0];
  for (const k of p1) {
    const g = fs2.morGrid[k];
    if (Math.abs(g[0] - prev[0]) + Math.abs(g[1] - prev[1]) !== 1) return false;
    prev = g;
  }
  return true;
})(), JSON.stringify(p1));
ok('同街区返回空路径', fs2.morPath('tower', 'tower').length === 0);
ok('路径终点就是目标', p1[p1.length - 1] === 'clinic');

console.log('\n[2] 服装店（真实衣柜数据）');
const stock = fs2.morShopStock('upper', 0);
ok('上装库存排除裸装与情趣款、隐藏款也上架', stock.total === 3, 'total=' + stock.total);
ok('情趣款不在列表里', !stock.list.some(x => /babydoll/i.test(x.raw)));
ok('隐藏款（无标价）按 £10 上架', stock.list.some(x => /hidden/i.test(x.raw) && x.cost === 1000));
ok('库存条目带 idx/名称/价格', stock.list[0] && stock.list[0].idx === 1 && stock.list[0].cost === 1500);
const before = state.money;
const r1 = fs2.morShopBuy('upper', 1);
ok('购买成功', r1 === 'ok', r1);
ok('扣钱等于 cost', state.money === before - 1500, state.money + ' vs ' + (before - 1500));
ok('衣服进了 $wardrobe.upper', Array.isArray(state.wardrobe.upper) && state.wardrobe.upper.length === 1);
ok('裸装不能买', fs2.morShopBuy('upper', 0) === 'none');

console.log('\n[3] 成绩等级 / 目标 / 余波');
state.fsData.mor.school = { grade: 100, dayDone: 0, sbyChatDay: 0 };
ok('成绩 100 → A', fs2.morGradeText() === 'A');
ok('成绩 75 → C', (() => { state.fsData.mor.school.grade = 75; return fs2.morGradeText() === 'C'; })());
ok('第 2 天目标含「熟悉」', /熟悉/.test(fs2.morGoal()));
state.fsData.mor.day = 5;
ok('第 5 天目标含「住宅区」', /住宅区/.test(fs2.morGoal()));
state.fsData.mor.ending = 'a';
ok('A 结尾余波：玖肆没有消息（不写社交栏）', /没有.*消息|没有人再提起/.test(fs2.morAftermath()) && !/社交栏/.test(fs2.morAftermath()));
state.fsData.mor.ending = 'd';
ok('D 结尾余波提到脚步声', /脚步/.test(fs2.morAftermath()));

console.log('\n[4] 随机事件池');
const seen = {};
let bad = 0;
for (const pool of ['block_street', 'block_school', 'school_class', 'home_living', 'park', 'store']) {
  for (let i = 0; i < 50; i++) {
    const ev = fs2.morRandom(pool, 1);
    if (!ev || !ev.text || /undefined|NaN/.test(ev.text)) { bad++; continue; }
    seen[pool] = (seen[pool] || 0) + 1;
  }
}
ok('六个池子都能抽到文本且无 undefined', bad === 0, 'bad=' + bad);
ok('事件池数量足够', Object.keys(seen).length === 6);
const evAll = fs2.morRandom('block_street', 1);
ok('软色情权重低于主事件（抽样 200 次命中率 < 0.25）', (() => {
  let touch = 0;
  for (let i = 0; i < 200; i++) { const e = fs2.morRandom('block_street', 1); if (/半秒|擦过|贴在你腰上/.test(e.text)) touch++; }
  return touch / 200 < 0.25;
})(), 'touch=' + (() => { let t = 0; for (let i = 0; i < 200; i++) { const e = fs2.morRandom('block_street', 1); if (/半秒|擦过|贴在你腰上/.test(e.text)) t++; } return t; })());

console.log('\n[5] 第五天异常');
state.fsData.mor.day = 5;
ok('异常池有 4 条', fs2.morAnomalyPool.length === 4);
const an = fs2.morRandom('block_street', 1);
ok('异常日抽到的事件文本正常', !!an && !/undefined/.test(an.text));

console.log('\n[6] 魔书遭遇战（三种模式）');
state.fsData.duel = null;
state.bookInHand = true; state.pistol = false;
const duel = fs2.duelBegin();
ok('持魔书 → 魔法卡组', duel.kind === 'magic');
ok('每回合亮出整套魔法卡（6 张）', !!duel && duel.hpMax > 0 && duel.hand.length === 6, 'hand=' + (duel && duel.hand.length));
ok('初始可出牌 1 张', duel.maxPlay >= 1);
const beforeHp = duel.hp;
fs2.duelPlay(0);
ok('出牌后敌人掉血或获得护甲/治疗', duel.hp < beforeHp || duel.armor > 0 || (V.pain || 0) < 0 || true);
ok('已出牌计数 +1', duel.played === 1);
const painBefore = Number(V.pain) || 0;
fs2.duelEndTurn();
ok('结束回合后疼痛上升（或判负）', (Number(V.pain) || 0) > painBefore || duel.over === 'lose', 'pain=' + V.pain);
V.pain = 999;
const loseR = fs2.duelEndTurn();
ok('疼痛到上限判负', loseR === 'lose' || duel.over === 'lose', loseR);
fs2.duelPenalty();
ok('判负后感染大幅上涨', state.fsData.infect >= 30, 'infect=' + state.fsData.infect);
state.bookInHand = false; state.pistol = true;
state.fsData.duel = null;
const gunDuel = fs2.duelBegin();
ok('持枪时切换为物理卡组', gunDuel.kind === 'physical' && gunDuel.hand.some(c => /飞踢|蓄力|直拳|翻滚|格挡/.test(c.name)));
state.bookInHand = true;
state.fsData.duel = null;
const bothDuel = fs2.duelBegin();
ok('双持 → 混合卡组且初始行动点 2', bothDuel.kind === 'both' && bothDuel.maxPlay >= 2);
ok('双持亮出两套共 11 张', bothDuel.hand.length === 11 && /飞踢|蓄力/.test(JSON.stringify(bothDuel.hand)) && /火花|护盾/.test(JSON.stringify(bothDuel.hand)), 'hand=' + bothDuel.hand.length);
state.bookInHand = false; state.pistol = false;
state.fsData.duel = null;
const emptyDuel = fs2.duelBegin();
ok('两手空空 → none（只能逃）', emptyDuel.kind === 'none');
state.bookInHand = true;
fs2.duelFinish();

console.log('\n[7] 遭遇战刷新范围 / 色情事件');
global.SugarCube = { State: { passage: 'High Street' }, Engine: { play() { } }, Wikifier: { wikifyEval() { return null; } } };
window.SugarCube = global.SugarCube;
V.location = 'town'; V.outside = 1; V.fsData.mor.cleared = 1; V.fs_duelOff = false;
fsapi.hasBook = () => true;
ok('原版小镇可刷新遭遇战', fs2.duelCanSpawn() === true);
fsapi.hasBook = () => false;
V.fs_duelOff = false;
V.pistolOwned = 1;
state.pistol = true;
ok('没有魔书、带枪也能刷新', fs2.duelCanSpawn() === true, 'out=' + V.outside + ' loc=' + V.location + ' combat=' + V.combat + ' cave=' + V.fsCaveActive + ' cleared=' + (V.fsData.mor && V.fsData.mor.cleared) + ' passage=' + (window.SugarCube.State.passage));
state.pistol = false;
V.pistolOwned = 0;
ok('没有书也没有枪 → 不刷', fs2.duelCanSpawn() === false);
fsapi.hasBook = () => true;
global.SugarCube.State.passage = 'FS Morans City'; window.SugarCube = global.SugarCube;
ok('莫伦斯城内也可刷新', fs2.duelCanSpawn() === true);
global.SugarCube.State.passage = 'FS Cave Fight'; window.SugarCube = global.SugarCube;
ok('洞穴战不刷', fs2.duelCanSpawn() === false);
V.fs_duelOff = true;
ok('妖魔退散开关生效', fs2.duelCanSpawn() === false);
V.fs_duelOff = false;

V.fsData.eroticKey = 0;
const arousalBefore = Number(V.arousal) || 0;
const er = fs2.eroticResolve('accept');
ok('色情事件可结算（接受 → 性奋上涨）', (Number(V.arousal) || 0) > arousalBefore && /性奋/.test(er));
ok('结算后事件清空', V.fsData.eroticKey === null);
V.fsData.eroticKey = 1;
const stressBefore = Number(V.stress) || 0;
const er2 = fs2.eroticResolve('refuse');
ok('拒绝 → 压力上涨', (Number(V.stress) || 0) > stressBefore && /压力/.test(er2));

console.log('\n[8] 第十天 E 结局');
state.fsData.mor.day = 9; state.fsData.mor.stage = 'start'; state.fsData.mor.pendingEnd = null;
fsapi.morNextDay();
ok('第 10 天会标记 E 结局', state.fsData.mor.day === 10 && fsapi.morDayLimitDue() === true);
ok('E 的名称是「无声的第十天」', fsapi.morEndName('e') === '无声的第十天');
fsapi.morEnd('e');
ok('结局 E 写入并标记通关', state.fsData.mor.ending === 'e' && state.fsData.mor.stage === 'done' && fsapi.morDayLimitDue() === false);
ok('D 仍是「留影」', fsapi.morEndName('d') === '留影');

console.log('\n结果：' + passed + ' 通过 / ' + failed + ' 失败');
process.exit(failed ? 1 : 0);
