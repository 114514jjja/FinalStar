/* gen_city_map.cjs — 莫伦斯「田」字新城地图 + 两个新设施图标
 * 零依赖（只用 fs / path / zlib），自写 PNG 编码，与项目其它图标生成器同一套画法。
 *
 * 产出（img/misc/icon/finalstar/）：
 *   morans-map-city.png  640×640  田字：3×3 共 9 格，四角的街区 + 中间的莫伦大厦广场，
 *                                  格与格之间是马路（虚线 + 斑马线），马路四个方向各有一个「路口」落点
 *   morans-store.png     32×32    便利商店（条纹雨棚 + 灯箱）
 *   morans-clinic.png    32×32    诊所（绿十字 + 门）
 *
 * 运行：node tools/gen_city_map.cjs
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'img', 'misc', 'icon', 'finalstar');

/* ---------------- PNG 编码 ---------------- */
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(b) { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
}
function writePng(file, w, h, rgba) {
  const stride = w * 4 + 1, raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) { raw[y * stride] = 0; rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

/* ---------------- 画布 ---------------- */
function canvas(w, h) { return { w, h, b: Buffer.alloc(w * h * 4) }; }
function px(c, x, y, col) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  c.b[i] = col[0]; c.b[i + 1] = col[1]; c.b[i + 2] = col[2]; c.b[i + 3] = col.length > 3 ? col[3] : 255;
}
function rect(c, x0, y0, x1, y1, col) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(c, x, y, col); }
function frame(c, x0, y0, x1, y1, col) {
  for (let x = x0; x <= x1; x++) { px(c, x, y0, col); px(c, x, y1, col); }
  for (let y = y0; y <= y1; y++) { px(c, x0, y, col); px(c, x1, y, col); }
}
function disc(c, cx, cy, r, col) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) px(c, cx + x, cy + y, col);
}
function ring(c, cx, cy, r, col) {
  for (let a = 0; a < 360; a += 0.4) {
    const rad = a * Math.PI / 180;
    px(c, cx + Math.cos(rad) * r, cy + Math.sin(rad) * r, col);
    px(c, cx + Math.cos(rad) * (r - 1), cy + Math.sin(rad) * (r - 1), col);
  }
}
function line(c, x0, y0, x1, y1, col) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    px(c, x, y, col);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

/* ---------------- 配色 ---------------- */
const C = {
  bg: [18, 20, 25],
  sidewalk: [34, 37, 44],
  road: [42, 45, 52],
  roadEdge: [56, 60, 68],
  dash: [150, 132, 72],
  block: [33, 36, 43],
  blockEdge: [62, 68, 78],
  build: [45, 49, 58],
  buildLit: [58, 63, 73],
  window: [214, 186, 96],
  windowDim: [92, 84, 62],
  gold: [212, 178, 92],
  goldDim: [120, 100, 56],
  plaza: [45, 40, 30],
  green: [72, 108, 78],
  red: [150, 66, 66],
  teal: [66, 132, 130],
  purple: [104, 78, 138],
  blue: [78, 104, 150],
};

/* ---------------- 640×640 城市地图 ---------------- */
function cityMap() {
  const S = 640, c = canvas(S, S);
  rect(c, 0, 0, S - 1, S - 1, C.bg);

  const M = 18, B = 184, G = 26;
  const xs = [M, M + B + G, M + 2 * (B + G)];
  const ys = xs.slice();
  const blockRect = (i, j) => [xs[i], ys[j], xs[i] + B - 1, ys[j] + B - 1];

  /* 人行道底 + 马路 */
  rect(c, 0, 0, S - 1, S - 1, C.sidewalk);
  for (let k = 0; k < 2; k++) {
    const gx = xs[0] + B + k * G, gy = ys[0] + B + k * G;
    rect(c, gx, 0, gx + G - 1, S - 1, C.road);
    rect(c, 0, gy, S - 1, gy + G - 1, C.road);
  }
  /* 马路边缘线 */
  for (let k = 0; k < 2; k++) {
    const gx = xs[0] + B + k * G, gy = ys[0] + B + k * G;
    rect(c, gx, 0, gx, S - 1, C.roadEdge);
    rect(c, gx + G - 1, 0, gx + G - 1, S - 1, C.roadEdge);
    rect(c, 0, gy, S - 1, gy, C.roadEdge);
    rect(c, 0, gy + G - 1, S - 1, gy + G - 1, C.roadEdge);
  }
  /* 虚线中线 */
  for (let k = 0; k < 2; k++) {
    const gx = xs[0] + B + k * G + (G >> 1), gy = ys[0] + B + k * G + (G >> 1);
    for (let y = 8; y < S; y += 18) rect(c, gx - 1, y, gx, y + 8, C.dash);
    for (let x = 8; x < S; x += 18) rect(c, x, gy - 1, x + 8, gy, C.dash);
  }

  /* 9 个街区 */
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const [x0, y0, x1, y1] = blockRect(i, j);
    if (i === 1 && j === 1) continue;              /* 中央留给大厦广场 */
    rect(c, x0, y0, x1, y1, C.block);
    frame(c, x0, y0, x1, y1, C.blockEdge);
    /* 屋顶色条（每个街区一点性格） */
    const tints = [
      [C.green, C.purple, C.teal],
      [C.blue, null, C.goldDim],
      [C.red, C.green, C.teal],
    ];
    const tint = tints[j][i];
    if (tint) rect(c, x0 + 6, y0 + 6, x1 - 6, y0 + 9, tint);
  }

  /* 各街区的建筑：几个方块 + 窗点 */
  function building(x, y, w, h, lit) {
    rect(c, x, y, x + w, y + h, C.build);
    rect(c, x, y, x + w, y + 2, C.buildLit);
    for (let yy = y + 7; yy < y + h - 5; yy += 9) {
      for (let xx = x + 5; xx < x + w - 4; xx += 8) {
        px(c, xx, yy, lit && ((xx + yy) % 3 === 0) ? C.window : C.windowDim);
        px(c, xx + 1, yy, lit && ((xx + yy) % 3 === 0) ? C.window : C.windowDim);
      }
    }
  }
  const spots = [
    [[60, 60, 40, 34], [120, 70, 34, 26], [70, 120, 46, 30]],          /* 西北：公园 */
    [[240, 55, 52, 40], [306, 66, 40, 32], [250, 120, 64, 26]],        /* 北：学校 */
    [[470, 58, 40, 38], [520, 70, 32, 30], [480, 122, 52, 28]],        /* 东北：高档小区 */
    [[50, 244, 40, 36], [110, 250, 34, 30], [60, 300, 50, 24]],        /* 西：步行街 */
    [[470, 246, 40, 34], [520, 252, 32, 28], [480, 300, 48, 26]],      /* 东：政府 */
    [[62, 462, 38, 34], [116, 470, 34, 26], [70, 518, 44, 22]],        /* 西南：便利店 */
    [[248, 470, 44, 40], [306, 478, 40, 32], [258, 524, 40, 24]],      /* 南：住宅区 */
    [[470, 466, 40, 38], [520, 474, 34, 30], [480, 522, 44, 24]],      /* 东南：诊所 */
  ];
  spots.forEach((bs, i) => bs.forEach(([x, y, w, h]) => building(x, y, w, h, i % 2 === 0)));

  /* 中央：大厦广场 */
  const cx = 320, cy = 320;
  disc(c, cx, cy, 82, C.plaza);
  ring(c, cx, cy, 82, C.goldDim);
  ring(c, cx, cy, 78, C.goldDim);
  /* 大厦本体：一栋高一点的楼 + 窗户 + 顶部金点 */
  rect(c, cx - 22, cy - 34, cx + 22, cy + 30, C.build);
  rect(c, cx - 22, cy - 34, cx + 22, cy - 30, C.buildLit);
  frame(c, cx - 22, cy - 34, cx + 22, cy + 30, C.goldDim);
  for (let yy = cy - 26; yy < cy + 24; yy += 8) {
    for (let xx = cx - 16; xx < cx + 16; xx += 7) {
      px(c, xx, yy, ((xx + yy) % 4 === 0) ? C.window : C.windowDim);
      px(c, xx + 1, yy, ((xx + yy) % 4 === 0) ? C.window : C.windowDim);
    }
  }
  disc(c, cx, cy - 40, 4, C.gold);
  /* 广场四角的灯 */
  [[-64, -64], [64, -64], [-64, 64], [64, 64]].forEach(([dx, dy]) => disc(c, cx + dx, cy + dy, 3, C.dash));

  /* 四个路口：斑马线 + 路口点 */
  function crosswalk(x, y, horiz) {
    for (let k = -G; k <= G; k += 6) {
      if (horiz) rect(c, x + k, y - 9, x + k + 2, y + 9, [190, 190, 180]);
      else rect(c, x - 9, y + k, x + 9, y + k + 2, [190, 190, 180]);
    }
  }
  const gapX = xs[0] + B + (G >> 1), gapX2 = xs[1] + B + (G >> 1);
  const gapY = ys[0] + B + (G >> 1), gapY2 = ys[1] + B + (G >> 1);
  crosswalk(cx, gapY, true); crosswalk(cx, gapY2, true);
  crosswalk(gapX, cy, false); crosswalk(gapX2, cy, false);
  [[cx, gapY], [cx, gapY2], [gapX, cy], [gapX2, cy]].forEach(([x, y]) => {
    disc(c, x, y, 7, C.road);
    ring(c, x, y, 7, C.gold);
    disc(c, x, y, 2, C.gold);
  });

  /* 外框 */
  frame(c, 1, 1, S - 2, S - 2, C.blockEdge);
  frame(c, 2, 2, S - 3, S - 3, [44, 47, 55]);
  return c;
}

/* ---------------- 32×32 图标 ---------------- */
function iconStore() {
  const c = canvas(32, 32);
  rect(c, 0, 0, 31, 31, [0, 0, 0, 0]);
  /* 墙体 */
  rect(c, 3, 11, 28, 29, [60, 62, 74]);
  frame(c, 3, 11, 28, 29, [96, 100, 116]);
  /* 条纹雨棚 */
  for (let y = 4; y <= 10; y++) {
    for (let x = 2; x <= 29; x++) {
      const stripe = ((x - 2) % 6) < 3;
      px(c, x, y, stripe ? [196, 72, 72] : [232, 226, 210]);
    }
  }
  frame(c, 2, 4, 29, 10, [120, 60, 60]);
  /* 门与窗 */
  rect(c, 13, 18, 20, 29, [30, 32, 40]);
  frame(c, 13, 18, 20, 29, [110, 112, 126]);
  rect(c, 6, 15, 11, 21, [206, 188, 120]);
  rect(c, 22, 15, 27, 21, [206, 188, 120]);
  /* 灯箱 */
  rect(c, 8, 2, 23, 3, [232, 232, 210]);
  return c;
}
function iconClinic() {
  const c = canvas(32, 32);
  rect(c, 0, 0, 31, 31, [0, 0, 0, 0]);
  rect(c, 3, 8, 28, 29, [224, 228, 226]);
  frame(c, 3, 8, 28, 29, [92, 110, 104]);
  rect(c, 3, 8, 28, 10, [150, 66, 66]);
  /* 十字 */
  rect(c, 13, 13, 18, 23, [64, 158, 116]);
  rect(c, 9, 17, 22, 20, [64, 158, 116]);
  /* 门 */
  rect(c, 22, 22, 26, 29, [52, 60, 62]);
  /* 窗 */
  rect(c, 6, 13, 10, 17, [130, 176, 200]);
  rect(c, 6, 21, 10, 25, [130, 176, 200]);
  return c;
}

/* ---------------- 学校里/家里的 32×32 小图标 ---------------- */
function iconClass() {
  const c = canvas(32, 32);
  rect(c, 0, 0, 31, 31, [0, 0, 0, 0]);
  rect(c, 2, 5, 29, 26, [46, 74, 62]);            /* 黑板 */
  frame(c, 2, 5, 29, 26, [120, 104, 72]);
  for (let i = 0; i < 4; i++) rect(c, 6, 10 + i * 4, 6 + 12 - i * 2, 10 + i * 4, [214, 210, 190]);
  rect(c, 20, 12, 25, 17, [214, 210, 190]);
  rect(c, 2, 27, 29, 30, [90, 62, 40]);           /* 讲台 */
  return c;
}
function iconLibrary() {
  const c = canvas(32, 32);
  rect(c, 0, 0, 31, 31, [0, 0, 0, 0]);
  rect(c, 4, 5, 27, 10, [150, 60, 60]);
  rect(c, 4, 11, 24, 16, [60, 96, 150]);
  rect(c, 4, 17, 26, 22, [80, 130, 90]);
  frame(c, 4, 5, 27, 22, [40, 40, 48]);
  for (let i = 0; i < 3; i++) { px(c, 8, 7 + i * 6, [230, 226, 210]); px(c, 9, 7 + i * 6, [230, 226, 210]); }
  rect(c, 12, 24, 19, 29, [120, 100, 60]);
  return c;
}
function iconRoof() {
  const c = canvas(32, 32);
  rect(c, 0, 0, 31, 31, [0, 0, 0, 0]);
  rect(c, 2, 18, 29, 29, [70, 74, 84]);           /* 天台地面 */
  for (let x = 4; x < 29; x += 5) rect(c, x, 8, x + 1, 17, [150, 150, 158]);  /* 栏杆 */
  rect(c, 2, 7, 29, 8, [150, 150, 158]);
  disc(c, 24, 12, 3, [230, 200, 110]);            /* 天边的太阳 */
  return c;
}
function iconBath() {
  const c = canvas(32, 32);
  rect(c, 0, 0, 31, 31, [0, 0, 0, 0]);
  rect(c, 2, 4, 10, 5, [180, 186, 196]);          /* 花洒 */
  rect(c, 6, 5, 7, 9, [180, 186, 196]);
  for (let i = 0; i < 5; i++) { rect(c, 4 + i * 2, 11 + (i % 2), 4 + i * 2, 12 + (i % 2), [130, 176, 200]); }
  rect(c, 3, 16, 28, 27, [128, 180, 200]);        /* 浴缸 */
  rect(c, 4, 18, 27, 21, [200, 228, 236]);
  frame(c, 3, 16, 28, 27, [70, 90, 100]);
  return c;
}
function iconKitchen() {
  const c = canvas(32, 32);
  rect(c, 0, 0, 31, 31, [0, 0, 0, 0]);
  rect(c, 4, 14, 27, 26, [90, 92, 100]);          /* 锅 */
  frame(c, 4, 14, 27, 26, [140, 142, 150]);
  rect(c, 2, 12, 29, 14, [150, 152, 160]);
  rect(c, 14, 7, 17, 12, [150, 152, 160]);        /* 把手 */
  for (let i = 0; i < 3; i++) { rect(c, 8 + i * 6, 5, 9 + i * 6, 6, [220, 220, 214]); }
  return c;
}
function iconLiving() {
  const c = canvas(32, 32);
  rect(c, 0, 0, 31, 31, [0, 0, 0, 0]);
  rect(c, 3, 14, 28, 23, [110, 80, 70]);          /* 沙发 */
  rect(c, 3, 8, 28, 14, [130, 96, 82]);
  rect(c, 1, 12, 4, 23, [130, 96, 82]);
  rect(c, 27, 12, 30, 23, [130, 96, 82]);
  rect(c, 5, 24, 6, 28, [70, 50, 44]);
  rect(c, 25, 24, 26, 28, [70, 50, 44]);
  return c;
}
function iconRun() {
  const c = canvas(32, 32);
  rect(c, 0, 0, 31, 31, [0, 0, 0, 0]);
  rect(c, 4, 13, 19, 19, [224, 226, 230]);        /* 鞋面 */
  rect(c, 4, 19, 27, 22, [190, 70, 70]);          /* 鞋底 */
  rect(c, 8, 10, 15, 13, [224, 226, 230]);
  for (let x = 7; x < 26; x += 5) rect(c, x, 19, x + 1, 21, [240, 220, 220]);
  rect(c, 16, 8, 17, 13, [120, 120, 130]);
  return c;
}

function iconWard() {
  const c = canvas(32, 32);
  rect(c, 0, 0, 31, 31, [0, 0, 0, 0]);
  /* 符纸：黄纸 + 红字 */
  rect(c, 9, 2, 22, 29, [226, 205, 130]);
  frame(c, 9, 2, 22, 29, [150, 120, 70]);
  rect(c, 11, 4, 20, 6, [190, 60, 60]);
  rect(c, 13, 8, 18, 9, [190, 60, 60]);
  rect(c, 12, 12, 19, 13, [190, 60, 60]);
  rect(c, 14, 15, 17, 22, [190, 60, 60]);
  rect(c, 12, 24, 19, 25, [190, 60, 60]);
  /* 旁边的光点：退散 */
  disc(c, 5, 8, 2, [230, 230, 210]);
  disc(c, 26, 12, 2, [230, 230, 210]);
  disc(c, 4, 22, 2, [230, 230, 210]);
  return c;
}

/* 红月版地图：同一张底图，压暗、染红、加几道裂缝 */
function cityMapRed() {
  const c = canvas(640, 640);
  rect(c, 0, 0, 639, 639, [14, 10, 14]);
  /* 先画一张破败的城市（自绘，不再复用完好版） */
  const M = 18, B = 184, G = 26;
  const xs = [M, M + B + G, M + 2 * (B + G)];
  const ys = xs.slice();

  /* 马路（裂开） */
  rect(c, 0, 0, 639, 639, [26, 22, 26]);
  for (let k = 0; k < 2; k++) {
    const gx = xs[0] + B + k * G, gy = ys[0] + B + k * G;
    rect(c, gx, 0, gx + G - 1, 639, [34, 30, 34]);
    rect(c, 0, gy, 639, gy + G - 1, [34, 30, 34]);
    for (let y = 8; y < 640; y += 22) rect(c, gx + (G >> 1) - 1, y, gx + (G >> 1), y + 7, [90, 70, 50]);
    for (let x = 8; x < 640; x += 22) rect(c, x, gy + (G >> 1) - 1, x + 7, gy + (G >> 1), [90, 70, 50]);
  }

  /* 街区：塌角 + 破屋顶 + 碎砖 */
  const rand = (() => { let s = 1337; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const x0 = xs[i], y0 = ys[j], x1 = x0 + B - 1, y1 = y0 + B - 1;
    const isCenter = (i === 1 && j === 1);
    /* 地面 */
    rect(c, x0, y0, x1, y1, isCenter ? [46, 30, 22] : [28, 26, 30]);
    frame(c, x0, y0, x1, y1, [70, 50, 44]);
    /* 塌掉的一角：用背景色吃掉三角块 */
    const corner = Math.floor(rand() * 4);
    const cx = corner % 2 === 0 ? x0 : x1, cy = corner < 2 ? y0 : y1;
    for (let t = 0; t < 64; t++) {
      for (let u = 0; u < 64 - t; u++) {
        const px2 = cx + (cx === x0 ? t : -t);
        const py2 = cy + (cy === y0 ? u : -u);
        px(c, px2, py2, [16, 12, 16]);
      }
    }
    /* 断墙锯齿 */
    for (let t = 0; t < B; t += 6) {
      const h = 2 + Math.floor(rand() * 6);
      px(c, x0 + t, y0 + h, [10, 8, 10]);
      px(c, x0 + t, y1 - h, [10, 8, 10]);
    }
    /* 建筑：只画半截，顶上参差 */
    for (let b = 0; b < 3; b++) {
      const bw = 34 + Math.floor(rand() * 22), bh = 20 + Math.floor(rand() * 26);
      const bx = x0 + 18 + Math.floor(rand() * (B - 70));
      const by = y0 + 18 + Math.floor(rand() * (B - 70));
      rect(c, bx, by, bx + bw, by + bh, [36, 30, 34]);
      frame(c, bx, by, bx + bw, by + bh, [64, 46, 42]);
      /* 顶被削掉一块 */
      const cut = 6 + Math.floor(rand() * 12);
      rect(c, bx + Math.floor(bw / 3), by, bx + bw, by + cut, [18, 14, 18]);
      /* 窗（大多黑了） */
      for (let yy = by + cut + 4; yy < by + bh - 4; yy += 8) {
        for (let xx = bx + 4; xx < bx + bw - 4; xx += 7) {
          if (rand() < 0.55) px(c, xx, yy, [10, 8, 12]);
          else if (rand() < 0.3) px(c, xx, yy, [120, 60, 40]);
        }
      }
    }
    /* 塌陷：整块屋顶塌掉 */
    if (rand() < 0.8) {
      const vx = x0 + 24 + Math.floor(rand() * (B - 100));
      const vy = y0 + 24 + Math.floor(rand() * (B - 100));
      const vw = 48 + Math.floor(rand() * 40), vh = 36 + Math.floor(rand() * 30);
      rect(c, vx, vy, vx + vw, vy + vh, [12, 9, 12]);
      /* 断裂边缘 */
      for (let t = 0; t < vw; t += 3) {
        px(c, vx + t, vy + Math.floor(rand() * 5), [90, 60, 50]);
        px(c, vx + t, vy + vh - Math.floor(rand() * 5), [60, 40, 34]);
      }
    }
    /* 碎砖堆 */
    for (let t = 0; t < 90; t++) {
      const rx = x0 + 10 + Math.floor(rand() * (B - 20));
      const ry = y0 + 10 + Math.floor(rand() * (B - 20));
      px(c, rx, ry, [70, 34, 28]);
      px(c, rx + 1, ry, [96, 44, 34]);
      if (rand() < 0.5) px(c, rx, ry + 1, [40, 22, 20]);
    }
    /* 裂缝 */
    for (let t = 0; t < 2; t++) {
      let x = x0 + 20 + rand() * (B - 40), y = y0 + 20 + rand() * (B - 40);
      for (let n = 0; n < 46; n++) {
        px(c, x, y, [8, 6, 8]);
        x += rand() * 6 - 3; y += rand() * 6 - 3;
      }
    }
  }

  /* 中央大厦：塌了一半 */
  rect(c, 292, 250, 342, 386, [40, 32, 34]);
  frame(c, 292, 250, 342, 386, [90, 60, 50]);
  rect(c, 292, 250, 342, 300, [18, 14, 18]);      /* 上半截没了 */
  rect(c, 292, 300, 342, 302, [140, 70, 50]);     /* 断口 */
  for (let yy = 306; yy < 380; yy += 9) for (let xx = 298; xx < 336; xx += 8) if (rand() < 0.6) px(c, xx, yy, [12, 10, 14]);

  /* 红月：放在住宅区（下方中间那格），半径覆盖大半个地图 */
  const S = 640;
  const mx = 320, my = 510, R = 560;
  const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const base = Buffer.from(c.b);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const r = base[i], g = base[i + 1], b = base[i + 2];
      const d = Math.hypot(x - mx, y - my) / R;
      const inside = 1 - smooth(d);
      const core = Math.pow(Math.max(0, 1 - d), 2.4);
      /* 月色是“染”上去的：保留原亮度层次，避免把建筑细节糊掉 */
      const lumK = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
      const redR = 60 + 120 * lumK + 80 * core;
      const redG = 8 + 34 * lumK + 20 * core;
      const redB = 10 + 30 * lumK + 18 * core;
      let nr = r * (1 - inside) + redR * inside;
      let ng = g * (1 - inside) + redG * inside;
      let nb = b * (1 - inside) + redB * inside;
      /* 边缘阴影 */
      const shade = Math.max(0, Math.min(1, (d - 0.92) / 0.4));
      const dim = 1 - shade * 0.5;
      c.b[i] = Math.min(255, Math.round(nr * dim));
      c.b[i + 1] = Math.min(255, Math.round(ng * dim));
      c.b[i + 2] = Math.min(255, Math.round(nb * dim));
    }
  }
  /* 月盘：抬到住宅区上空，半透明只提亮，不盖掉建筑细节 */
  const moonY = my - 90, moonR = 130;
  for (let y = -moonR; y <= moonR; y++) {
    for (let x = -moonR; x <= moonR; x++) {
      const dd = Math.hypot(x, y) / moonR;
      if (dd > 1) continue;
      const a = Math.pow(1 - dd, 0.9) * 0.55;
      const i = ((moonY + y) * 640 + (mx + x)) * 4;
      if (i < 0 || i >= c.b.length) continue;
      c.b[i] = Math.min(255, Math.round(c.b[i] * (1 - a) + 236 * a));
      c.b[i + 1] = Math.min(255, Math.round(c.b[i + 1] * (1 - a) + 120 * a));
      c.b[i + 2] = Math.min(255, Math.round(c.b[i + 2] * (1 - a) + 100 * a));
    }
  }
  /* 月亮上的裂纹 */
  let lx = mx - 50, ly = my - 150;
  for (let t = 0; t < 80; t++) {
    px(c, lx, ly, [120, 26, 22]);
    lx += Math.random() * 4 - 1.4; ly += Math.random() * 4 - 2;
  }
  return c;
}

function iconBook() {
  const c = canvas(32, 32);
  rect(c, 0, 0, 31, 31, [0, 0, 0, 0]);
  /* 书壳 */
  rect(c, 5, 4, 27, 28, [104, 64, 34]);
  frame(c, 5, 4, 27, 28, [60, 34, 16]);
  /* 书脊 */
  rect(c, 5, 4, 9, 28, [80, 46, 22]);
  /* 金色题签 */
  rect(c, 11, 8, 24, 12, [196, 158, 86]);
  rect(c, 13, 14, 22, 15, [196, 158, 86]);
  /* 页口 */
  rect(c, 26, 6, 27, 26, [226, 214, 186]);
  return c;
}

/* ---------------- 输出 ---------------- */
fs.mkdirSync(OUT, { recursive: true });
const map = cityMap();
writePng(path.join(OUT, 'morans-map-city.png'), map.w, map.h, map.b);
const red = cityMapRed(); writePng(path.join(OUT, 'morans-map-red.png'), red.w, red.h, red.b);
const st = iconStore(); writePng(path.join(OUT, 'morans-store.png'), st.w, st.h, st.b);
const cl = iconClinic(); writePng(path.join(OUT, 'morans-clinic.png'), cl.w, cl.h, cl.b);
[['book-brown', iconBook], ['ui-ward', iconWard], ['morans-class', iconClass], ['morans-library', iconLibrary], ['morans-roof', iconRoof],
 ['morans-bath', iconBath], ['morans-kitchen', iconKitchen], ['morans-living', iconLiving],
 ['morans-run', iconRun]].forEach(([name, fn]) => {
  const c = fn(); writePng(path.join(OUT, name + '.png'), c.w, c.h, c.b);
});
console.log('已生成：morans-map-city.png / morans-map-red.png 640×640 + store/clinic/class/library/roof/bath/kitchen/living/run 32×32');
