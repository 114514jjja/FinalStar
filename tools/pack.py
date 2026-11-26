#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把工作树打成 FinalStar.mod.zip（条目顺序与原交付包一致），并自带逐字节复核。

顺序（与原包一致）：boot.json → README.md → 脚本（字母序）→ twee（boot.json 里的顺序）
                    → css → 图片（imgFileList 顺序）→ 补丁 txt（params 顺序）→ 其余文件

用法：
  python3 tools/pack.py                     # 输出到 dist/FinalStar-v<版本>.mod.zip
  python3 tools/pack.py --out /sdcard/...   # 指定输出路径
打包后会用 zipfile 重新读一遍，逐条与磁盘文件比对字节，不一致就 exit 1。
"""
import argparse
import hashlib
import json
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def build_list(boot):
    order = []
    order.append('boot.json')
    scripts = sorted(f for f in (boot.get('scriptFileList_inject_early') or [])
                     + (boot.get('scriptFileList') or []))
    order += scripts
    order += boot.get('tweeFileList') or []
    order += boot.get('styleFileList') or []
    order += boot.get('imgFileList') or []
    for addon in boot.get('addonPlugin') or []:
        for p in addon.get('params') or []:
            rf = p.get('replaceFile') if isinstance(p, dict) else None
            if rf and rf not in order:
                order.append(rf)
    # 其余（不参与加载、但需要随包分发的东西，例如彩蛋图）
    for dirpath, _d, files in os.walk(ROOT):
        for fn in files:
            rel = os.path.relpath(os.path.join(dirpath, fn), ROOT).replace(os.sep, '/')
            if rel.startswith(('dist/', 'tools/', 'docs/', '.git/', '_tools_run/')):
                continue
            # 开发期文件不进包：.gitignore、_*.cjs（作者工具链的本地副本）、开发报告
            base = os.path.basename(rel)
            if base in ('README.md', 'release_url.txt'):
                continue
            if '__pycache__' in rel or base.endswith('.pyc'):
                continue
            if base.startswith('.') or base.startswith('_') or base.startswith('开发报告'):
                continue
            if rel not in order:
                order.append(rel)
    return order


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out')
    args = ap.parse_args()
    boot = json.load(open(os.path.join(ROOT, 'boot.json'), encoding='utf-8'))
    out = args.out or os.path.join(ROOT, 'dist', 'FinalStar-%s.mod.zip' % boot['version'])
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    order = build_list(boot)
    missing = [f for f in order if not os.path.isfile(os.path.join(ROOT, f))]
    if missing:
        print('[X] 缺少文件，拒绝打包：', missing)
        return 1
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for rel in order:
            z.write(os.path.join(ROOT, rel), rel)
    # 逐字节复核
    bad = 0
    with zipfile.ZipFile(out) as z:
        names = z.namelist()
        if names != order:
            print('[!] 条目顺序与预期不同')
        for rel in order:
            disk = open(os.path.join(ROOT, rel), 'rb').read()
            got = z.read(rel)
            if hashlib.sha256(disk).digest() != hashlib.sha256(got).digest():
                bad += 1
                print('[X] 字节不一致：', rel)
    size = os.path.getsize(out)
    print('打包完成：%s' % out)
    print('  条目 %d，压缩后 %d 字节（%s），逐字节复核 %s'
          % (len(order), size, boot['version'], '全部一致' if bad == 0 else '%d 处不一致' % bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
