#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 img/misc/icon/finalstar/talent-*.png 统一重绘成 48x48 金色天赋徽章。
源图是历次生成的 32x32 单色 glyph；这里只做统一配色 + 圆环底座，不改变文件名。
用法：python3 tools/gen_talent_icon_pack.py
"""
import glob
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, 'img', 'misc', 'icon', 'finalstar')
S = 4  # 超采样
SIZE = 48
DARK = (55, 40, 16)
LIGHT = (245, 225, 150)
RING = (216, 180, 90, 210)
INNER = (245, 225, 150, 85)


def recolor(im):
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = (r * 299 + g * 587 + b * 114) // 1000
            if lum < 45:
                col = (32, 25, 14)          # 眼珠等深色细节保留
            else:
                t = max(0.0, min(1.0, lum / 255.0))
                col = tuple(int(DARK[i] + (LIGHT[i] - DARK[i]) * t) for i in range(3))
            px[x, y] = (col[0], col[1], col[2], a)
    return im


def badge(src):
    glyph = recolor(Image.open(src)).resize((30 * S, 30 * S), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE * S, SIZE * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    c = SIZE * S // 2
    r = 21 * S
    d.ellipse([c - r, c - r, c + r, c + r], fill=(16, 14, 10, 130))
    d.ellipse([c - r, c - r, c + r, c + r], outline=RING, width=2 * S)
    r2 = 18 * S
    d.ellipse([c - r2, c - r2, c + r2, c + r2], outline=INNER, width=S)
    gw, gh = glyph.size
    canvas.alpha_composite(glyph, (c - gw // 2, c - gh // 2))
    out = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    out.save(src)


def main():
    files = sorted(glob.glob(os.path.join(ICON_DIR, 'talent-*.png')))
    if not files:
        raise SystemExit('没有找到 talent-*.png')
    for f in files:
        badge(f)
        print('redraw', os.path.basename(f))
    print('done', len(files))


if __name__ == '__main__':
    main()
