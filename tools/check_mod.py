#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""FinalStar 离线自检（不需要打开游戏）。

它做的事，就是把「装进游戏里才会暴露的问题」尽量提前到打包前：

  A. 包完整性：boot.json 引用的文件是否都在、有没有孤立文件
  B. 段落唯一性：模组自己有没有重名段落
  C. TweeReplacer 锚点模拟：按 boot.json 顺序对**真实游戏源码**逐条 try-catch 式重放，
     并区分「锚点不存在」「被上一条补丁吃掉」「自补丁（空转）」「命中多处（有歧义）」
  D. ReplacePatcher JS 锚点模拟：同上，针对 ingame.js / time.js / stat-changes.js / named-npc.js
  E. 跳转目标：模组里所有静态 [[…|目标]] / <<goto>> / Engine.play('…') 是否真的存在
  F. finalStar.* API：twee / js 里调用的函数是否真的定义过
  G. JS 语法：node --check 全部脚本
  H. 段落标签平衡：<<…>> 是否配对（跨行宏按累计深度算）

用法：
  python3 tools/check_mod.py --game /path/to/project
退出码：0 = 无 FAIL；1 = 有 FAIL（方便以后接进打包流程）
"""
import argparse
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_twee import load_tree  # noqa: E402

FAIL = []
WARN = []
INFO = []

# 已经人工核对过、确认「命中多处但首处就是正确位置」的锚点。
# 只写有依据的条目；新出现的多命中一律报 FAIL，逼着去确认。
EXPECTED_MULTI = {
    # 首处 = wardrobeList（现行衣柜），第二处 = oldWardrobeList（旧版衣柜，没人调用）
    ('Widgets Wardrobe', '<<if !Object.keys($worn).includes(_wardrobe_list)>>'):
        '首处是现行 wardrobeList，第二处是 oldWardrobeList',
    # 首处 = rentdue 主收租，第二处 = 罗宾房间那条分支
    ('Widgets Rent', '<<if $money gte $rentmoney + ($babyRent or 0)>>'):
        '首处是 rentdue 主流程，第二处是罗宾房间分支',
    # #42 先把 fsTraits.txt 的「终星」组插到 _traitLists 开头；#53 再往第一份 traits 列表
    # 塞天生魅魔/纯洁魅魔，所以首处正是「终星」组。其余 10 处是通用/技能组，不能动。
    ('Traits', '\t\t\ttraits: [\n\t\t\t\t{'):
        '首处是 #42 新增的「终星」组，天生魅魔/纯洁魅魔应落在这里',
}


def fail(section, msg):
    FAIL.append((section, msg))


def warn(section, msg):
    WARN.append((section, msg))


def info(section, msg):
    INFO.append((section, msg))


# ---------------------------------------------------------------- A 包完整性
def check_pack(root, boot):
    refs = set()
    for key in ('styleFileList', 'scriptFileList', 'scriptFileList_inject_early',
                'tweeFileList', 'imgFileList', 'additionFile'):
        for f in boot.get(key) or []:
            refs.add(f)
    for addon in boot.get('addonPlugin') or []:
        for p in addon.get('params') or []:
            if isinstance(p, dict) and p.get('replaceFile'):
                refs.add(p['replaceFile'])
    missing = sorted(r for r in refs if not os.path.isfile(os.path.join(root, r)))
    for m in missing:
        fail('A 包完整性', 'boot.json 引用了不存在的文件: %s' % m)
    referenced_dirs = ('img', 'css', 'twee')
    present = set()
    for dirpath, _d, files in os.walk(root):
        for fn in files:
            rel = os.path.relpath(os.path.join(dirpath, fn), root).replace(os.sep, '/')
            present.add(rel)
    orphans = sorted(p for p in present - refs
                     if p.startswith(referenced_dirs) and not p.endswith('.md'))
    for o in orphans:
        warn('A 包完整性', '文件没被 boot.json 引用（可能是死资源）: %s' % o)
    info('A 包完整性', '引用 %d 项，文件 %d 个，缺失 %d，孤立 %d'
         % (len(refs), len(present), len(missing), len(orphans)))
    # 版本一致性
    fw = open(os.path.join(root, 'framework.js'), encoding='utf-8').read()
    m = re.search(r"finalStar\.version\s*=\s*'([^']+)'", fw)
    if m and m.group(1) != boot.get('version'):
        fail('A 包完整性', 'framework.js 版本 %s 与 boot.json %s 不一致' % (m.group(1), boot.get('version')))
    else:
        info('A 包完整性', '版本一致: %s' % boot.get('version'))


# ---------------------------------------------------------------- C/D 补丁模拟
def apply_patches(items, get_content, set_content, kind):
    """按顺序重放补丁；返回每条的结局。content 由 get_content(passage) 取（返回可变字符串容器）。"""
    results = []
    for idx, p in enumerate(items):
        name = p.get('passage')
        anchor = p.get('findString')
        note = (p.get('_comment') or '').strip()
        # TweeReplacer 1.7.0 只认 replace / replaceFile；写成 replaceString 会被静默忽略
        # （isReplaceParams 直接返回 false）。 天生魅魔的四条补丁就是这么失效的。
        if isinstance(p, dict) and 'replaceString' in p:
            fail(kind, '#%d 字段名错误：TweeReplacer 不识别 replaceString，应为 replace（%s）' % (idx, note))
            results.append(('bad', idx, name, note, 'replaceString'))
            continue
        if p.get('replace') is None and not p.get('replaceFile'):
            fail(kind, '#%d 缺少 replace / replaceFile（%s）' % (idx, note))
            results.append(('bad', idx, name, note, 'no replace'))
            continue
        if anchor is None:
            fail(kind, '#%d 缺少 findString: %s' % (idx, note))
            results.append(('bad', idx, name, note, ''))
            continue
        content = get_content(name)
        if content is None:
            results.append(('no-passage', idx, name, note, '段落不存在'))
            continue
        hits = content.count(anchor)
        replace_all = bool(p.get('all'))
        if hits == 0:
            results.append(('missing', idx, name, note, '锚点不存在'))
        elif hits > 1 and replace_all:
            results.append(('ok', idx, name, note, 'all=true，替换 %d 处' % hits))
        elif hits > 1:
            results.append(('multi', idx, name, note, '命中 %d 处' % hits))
        else:
            results.append(('ok', idx, name, note, ''))
        if hits:
            repl = p.get('replace')
            if repl is None and p.get('replaceFile'):
                path = p['replaceFile']
                repl = read_text(os.path.join(ROOT, path)) if os.path.isfile(os.path.join(ROOT, path)) else ''
            set_content(name, content.replace(anchor, repl or '', -1 if replace_all else 1))
    return results


def read_text(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def check_twee_patches(root, boot, game, mod):
    addon = next((a for a in boot.get('addonPlugin') or []
                  if a.get('addonName') == 'TweeReplacerAddon'), None)
    if not addon:
        warn('C 段落补丁', 'boot.json 里没有 TweeReplacerAddon')
        return
    state = {}

    def get_content(name):
        if name in state:
            return state[name]
        if name in mod:          # 模组自己的段落：ModLoader 先把 tweeFileList 合并进 tw-storydata，
                                 # 再跑 afterPatchModToGame（文档 §2.3 第 14~15 步），所以自补丁有效
            state[name] = mod[name].body
            return state[name]
        if name in game:
            state[name] = game[name].body
            return state[name]
        return None

    def set_content(name, text):
        state[name] = text

    params = addon.get('params') or []
    results = apply_patches(params, get_content, set_content, 'C 段落补丁')
    own = 0
    for (status, idx, name, note, extra), p in zip(results, params):
        is_own = name in mod and name not in game
        if is_own:
            own += 1
        if status == 'ok':
            if is_own:
                info('C 段落补丁', '#%d 自补丁（有效，改的是模组自己的段落）: %s' % (idx, name))
            continue
        if status == 'no-passage':
            fail('C 段落补丁', '#%d 目标段落不存在于游戏与模组: %s（%s）' % (idx, name, note))
        elif status == 'missing':
            # 是模组自己的段落 → 自补丁空转（文档 §4.3 已记录，仅提示）
            if is_own:
                warn('C 段落补丁', '#%d 补丁打不上（目标是模组自己的段落，锚点已失配 → 该功能只有内联代码在生效）: %s'
                     % (idx, name))
            else:
                fail('C 段落补丁', '#%d 锚点失配: %s <<< %s' % (idx, name, note[:60]))
        elif status == 'multi':
            if (name, p.get('findString')) in EXPECTED_MULTI:
                info('C 段落补丁', '#%d 多命中但已核对（%s）: %s'
                     % (idx, EXPECTED_MULTI[(name, p.get('findString'))], name))
            else:
                fail('C 段落补丁', '#%d 锚点命中多处（只替换首处，结果可能不是你想的那处）: %s %s（%s）'
                     % (idx, name, extra, note[:40]))
    ok = sum(1 for r in results if r[0] == 'ok')
    info('C 段落补丁', '%d 条：命中 %d（其中自补丁 %d），失配 %d，多命中 %d'
         % (len(results), ok, own, sum(1 for r in results if r[0] == 'missing'),
            sum(1 for r in results if r[0] == 'multi' and (r[2], params[r[1]].get('findString')) not in EXPECTED_MULTI)))
    return state


def check_js_patches(root, boot, game):
    addon = next((a for a in boot.get('addonPlugin') or []
                  if a.get('addonName') == 'ReplacePatcherAddon'), None)
    if not addon:
        warn('D 脚本补丁', 'boot.json 里没有 ReplacePatcherAddon')
        return
    # 建立 文件名 -> 真实路径（源码树里按文件名匹配，与 ModLoader 的 getByNameWithOrWithoutPath 同理）
    by_name = {}
    for dirpath, _d, files in os.walk(game_root):
        for fn in files:
            by_name.setdefault(fn, os.path.join(dirpath, fn))
    files = {}
    ok = miss = nofile = 0
    for gi, group in enumerate(addon.get('params') or []):
        for idx, item in enumerate(group.get('js') or []):
            fn = item.get('fileName')
            src = item.get('from') or ''
            note = (item.get('_comment') or '').strip()
            path = by_name.get(fn)
            if not path:
                nofile += 1
                fail('D 脚本补丁', '目标文件不存在: %s（%s）' % (fn, note[:40]))
                continue
            if fn not in files:
                files[fn] = read_text(path)
            content = files[fn]
            hits = content.count(src)
            if hits == 0:
                miss += 1
                fail('D 脚本补丁', '锚点失配: %s <<< %s' % (fn, note[:60]))
            elif hits > 1:
                warn('D 脚本补丁', '锚点命中 %d 处（只替换首处）: %s %s' % (hits, fn, note[:40]))
                ok += 1
                files[fn] = content.replace(src, item.get('to') or '', 1)
            else:
                ok += 1
                files[fn] = content.replace(src, item.get('to') or '', 1)
    info('D 脚本补丁', '%d 条：命中 %d，失配 %d，文件缺失 %d（后者只在「JS 被编译进 HTML」的整合包上发生）'
         % (ok + miss + nofile, ok, miss, nofile))


# ---------------------------------------------------------------- E 跳转目标
LINK_RE = re.compile(r'\[\[([^\]]*?)\]\]')
GOTO_RE = re.compile(r'<<goto\s+(?:"([^"]+)"|\'([^\']+)\'|([^>\s]+))\s*>>')
PLAY_RE = re.compile(r'Engine\.play\(\s*[\'"]([^\'"]+)[\'"]')


def static_targets(text):
    out = []
    for m in LINK_RE.finditer(text):
        inner = m.group(1)
        if '|' in inner:
            tgt = inner.rsplit('|', 1)[1].strip()
        elif '->' in inner:
            tgt = inner.split('->', 1)[1].strip()
        elif '<-' in inner:
            tgt = inner.split('<-', 1)[0].strip()
        else:
            tgt = inner.strip()
        out.append(tgt)
    for m in GOTO_RE.finditer(text):
        out.append(next(g for g in m.groups() if g))
    for m in PLAY_RE.finditer(text):
        out.append(m.group(1))
    return out


def is_dynamic(t):
    t = t.strip()
    if not t:
        return True
    if t[0] in ('$', '_'):            # $var / _tempvar 作目标：运行时才知道
        return True
    return any(s in t for s in ('<<', '>>', '`', '{', '}', '+', '(', ')'))


def check_links(game, mod):
    known = set(game) | set(mod)
    bad = 0
    for p in mod.values():
        for tgt in static_targets(p.body):
            if is_dynamic(tgt):
                continue
            if tgt not in known:
                bad += 1
                fail('E 跳转目标', '%s（%s）→ 「%s」不存在' % (p.name, os.path.basename(p.file), tgt))
    info('E 跳转目标', '静态目标检查完成，缺失 %d 个' % bad)


# ---------------------------------------------------------------- F API 引用
API_USE = re.compile(r'finalStar\.([A-Za-z_]\w*)')


def check_api(game, mod, root):
    defined = set()
    for fn in os.listdir(root):
        if not fn.endswith('.js'):
            continue
        src = read_text(os.path.join(root, fn))
        defined |= set(re.findall(r'(?:fs|finalStar)\.([A-Za-z_]\w*)\s*=', src))
        defined |= set(re.findall(r'(?:fs|finalStar)\[([\'"])([A-Za-z_]\w*)\1\]\s*=', src) and [])
        defined |= set(m[1] for m in re.findall(r'(?:fs|finalStar)\[([\'"])([A-Za-z_]\w*)\1\]\s*=', src))
    builtin = {'version', 'modName', 'ready', '_pending'}
    undefined = set()
    for p in mod.values():
        for name in API_USE.findall(p.body):
            if name not in defined and name not in builtin:
                undefined.add((name, p.name))
    for fn in os.listdir(root):
        if fn.endswith('.js'):
            src = read_text(os.path.join(root, fn))
            for name in API_USE.findall(src):
                if name not in defined and name not in builtin:
                    undefined.add((name, fn))
    for name, where in sorted(undefined):
        fail('F API 引用', 'finalStar.%s 没有定义（首次出现在 %s）' % (name, where))
    info('F API 引用', '已定义 %d 个 API，未定义引用 %d 个' % (len(defined), len(undefined)))


# ---------------------------------------------------------------- G JS 语法
def check_js_syntax(root):
    bad = 0
    for fn in sorted(os.listdir(root)):
        if not fn.endswith('.js'):
            continue
        path = os.path.join(root, fn)
        r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
        if r.returncode != 0:
            bad += 1
            fail('G JS 语法', '%s: %s' % (fn, r.stderr.strip().split('\n')[-1][:120]))
    info('G JS 语法', 'node --check 全部通过' if bad == 0 else '%d 个文件语法错误' % bad)


# ---------------------------------------------------------------- H 宏配对
def check_macro_balance(mod):
    bad = 0
    for p in mod.values():
        depth = 0
        for line in p.body.split('\n'):
            # 逐个扫描 << 与 >>，允许跨行（跨行宏靠累计深度）
            i = 0
            while i < len(line):
                if line.startswith('<<', i):
                    depth += 1
                    i += 2
                elif line.startswith('>>', i):
                    depth -= 1
                    if depth < 0:
                        break
                    i += 2
                else:
                    i += 1
        if depth != 0:
            bad += 1
            fail('H 宏配对', '%s（%s）<< >> 不配对，净深 %d' % (p.name, os.path.basename(p.file), depth))
    info('H 宏配对', '未配对段落 %d 个' % bad)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--game', required=True, help='DoL 本体 game 目录（源码树）')
    ap.add_argument('--root', default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    args = ap.parse_args()
    global ROOT, game_root
    ROOT = args.root
    game_root = args.game
    boot = json.load(open(os.path.join(ROOT, 'boot.json'), encoding='utf-8'))
    game, game_dups, _ = load_tree(game_root)
    mod, mod_dups, mod_ordered = load_tree(os.path.join(ROOT, 'twee'))
    print('本体段落 %d（源码 %s），模组段落 %d' % (len(game), os.path.basename(game_root), len(mod)))
    for name, a, b in mod_dups:
        fail('B 段落唯一性', '模组内重名段落「%s」：%s 与 %s' % (name, a, b))
    info('B 段落唯一性', '模组重名 %d 个' % len(mod_dups))

    check_pack(ROOT, boot)
    check_twee_patches(ROOT, boot, game, mod)
    check_js_patches(ROOT, boot, game)
    check_links(game, mod)
    check_api(game, mod, ROOT)
    check_js_syntax(ROOT)
    check_macro_balance(mod)

    print('\n' + '=' * 60)
    for sec in sorted(set(s for s, _ in INFO)):
        for s, m in INFO:
            if s == sec:
                print('[i] %s' % m)
    print('-' * 60)
    for s, m in WARN:
        print('[!] %-12s %s' % (s, m))
    for s, m in FAIL:
        print('[X] %-12s %s' % (s, m))
    print('=' * 60)
    print('WARN %d 条 / FAIL %d 条' % (len(WARN), len(FAIL)))
    return 1 if FAIL else 0


if __name__ == '__main__':
    sys.exit(main())
