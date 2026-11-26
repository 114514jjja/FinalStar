# -*- coding: utf-8 -*-
"""SugarCube twee 解析 + 段落索引（供离线自检脚本共用）。

设计要点：
  - 段落头判定与 SugarCube 一致：行首 `::` + 至少一个空格 + 名字，
    其后可跟 [tag tag] 与 {position}。
  - 同名段落跨文件出现时保留**第一份**并记重名（DoL 本体跨目录有少量同名，
    模组自己出现重名则是必须报的 bug）。
"""
import os
import re

_HEAD = re.compile(r'^::[ \t]+([^\[\{\n]+?)[ \t]*(?:\[([^\]]*)\])?[ \t]*(?:\{[^}\n]*\})?[ \t]*$')


class Passage(object):
    __slots__ = ('name', 'tags', 'body', 'file', 'line')

    def __init__(self, name, tags, body, file, line):
        self.name = name
        self.tags = tags
        self.body = body
        self.file = file
        self.line = line

    def __repr__(self):
        return '<Passage %r %s>' % (self.name, self.file)


def parse_twee_file(path):
    """返回该文件里的 Passage 列表（按出现顺序）。"""
    with open(path, encoding='utf-8') as f:
        text = f.read()
    lines = text.split('\n')
    out = []
    cur = None
    buf = []
    start_line = 0
    for i, line in enumerate(lines, 1):
        m = _HEAD.match(line)
        if m:
            if cur is not None:
                out.append(Passage(cur[0], cur[1], '\n'.join(buf), path, start_line))
            cur = (m.group(1).strip(), (m.group(2) or '').split())
            buf = []
            start_line = i
        elif cur is not None:
            buf.append(line)
    if cur is not None:
        out.append(Passage(cur[0], cur[1], '\n'.join(buf), path, start_line))
    return out


def load_tree(root, exts=('.twee',)):
    """递归加载目录下所有 twee，返回 (dict name->Passage, list 重名记录, list 全部段落)。"""
    passages = {}
    dups = []
    ordered = []
    for dirpath, _dirs, files in os.walk(root):
        for fn in sorted(files):
            if not fn.endswith(exts):
                continue
            for p in parse_twee_file(os.path.join(dirpath, fn)):
                ordered.append(p)
                if p.name in passages:
                    dups.append((p.name, passages[p.name].file, p.file))
                    continue
                passages[p.name] = p
    return passages, dups, ordered
