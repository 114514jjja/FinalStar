/* 回归测试：祝福卷轴的「用 → 到期」必须对称（不需要开游戏，纯函数沙箱）。
   跑法：node tools/test_scroll.js   → 期望输出「PASS」 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.dirname(__dirname);
const code = fs.readFileSync(path.join(root, 'fs-witch.js'), 'utf8');
const sandbox = { console };
sandbox.window = {};
sandbox.V = { money: 1e9, fsData: {}, stressmax: 10000, traumamax: 1000, arousalmax: 1000,
              trauma: 900, stress: 100, arousal: 100 };
vm.createContext(sandbox);
sandbox.window.finalStar = { ensureData() {}, log() {}, register() {} };
vm.runInContext(code, sandbox);
const F = sandbox.window.finalStar, V = sandbox.V;

function buyUse(key) {
    F.buyScroll(key, false);
    return V.fsData.scrolls[V.fsData.scrolls.length - 1] === undefined ? false : F.useScroll(V.fsData.scrolls.length - 1);
}
function expireAll() {
    V.fsData.blessings.forEach(b => {
        const floor = F.maxFloor(b.stat);
        const back = (b.value || 0) * (b.up === false ? -1 : 1);
        const apply = (typeof b.applied === 'number') ? b.applied : back;
        V[b.stat + 'max'] = Math.max(floor, V[b.stat + 'max'] - apply);
    });
    V.fsData.blessings = [];
}
const checks = [];
function chk(name, ok) { checks.push([name, ok]); }

buyUse('traumaDown');
chk('安魂：1000 → 800', V.traumamax === 800);
buyUse('arousalDown');
chk('清心：1000 → 800', V.arousalmax === 800);
buyUse('stressUp');
chk('压力耐受：10000 → 10200', V.stressmax === 10200);
expireAll();
chk('到期回到 trauma 1000', V.traumamax === 1000);
chk('到期回到 arousal 1000', V.arousalmax === 1000);
chk('到期回到 stress 10000', V.stressmax === 10000);

let bad = checks.filter(c => !c[1]);
checks.forEach(c => console.log((c[1] ? '  ok   ' : '  FAIL ') + c[0]));
console.log(bad.length ? ('FAIL ' + bad.length) : 'PASS');
process.exit(bad.length ? 1 : 0);
