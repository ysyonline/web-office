#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Phase 3 拆解计划表生成器。

输入：`docs/phase3/backlog.csv`（唯一事实源，788 包）
输出：`docs/phase3/PACKAGE-PLAN.html`（单文件，无外部依赖，数据内联）

统计口径（与 TASKS.md §1/§2 对齐，差异处见页面第 6 节注记）：
- 「已完成」= 状态为 已完成 或 已归并（归并包内容并入相邻包实施）
- 批次归属按 里程碑 + 需求域 + 工作项 ID 区段推断；D1 设计卡单列，不摊入 B0~B6
- 「可派」= 包状态为待派发 且 其 `依赖包` 字段全部已完成/已归并

用法：
    python -X utf8 scripts/gen_package_plan.py
"""

import csv
import html
import io
import json
import os
import re
from collections import Counter, OrderedDict, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs/phase3/backlog.csv')
OUT = os.path.join(ROOT, 'docs/phase3/PACKAGE-PLAN.html')

DONE_STATUS = ('已完成', '已归并')
BATCH_ORDER = ['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'D1']

BATCH_DESC = {
    'D1': ('设计卡（D1 十三卡）', '跨包共享决策的唯一载体，随批次前置，不集中成阶段'),
    'B0': ('M0 开工门禁', 'P3-001 基线评审 / P3-002 公式 spike / P3-003 金仓冒烟；全阻塞'),
    'B1': ('M1 基础三件套', 'monorepo / Nest 骨架 / 前端骨架；关键路径起点'),
    'B2': ('M1 其余', '实体·迁移·CI·镜像·组件库·token·离线源；BE 重活'),
    'B3': ('M2 账户与文件', '需 P3-003 金仓冒烟通过 + B2 主干通'),
    'B4': ('M3 协同与持久化', 'Yjs / oplog / write-through / 物化重建；与 B5 可并行'),
    'B5': ('M3 导入导出', 'P3-002 spike PASS 为前提；转换层 + 差分 + 迁移器'),
    'B6': ('M3 License + 导入导出 UI + 交付验收', '验签三层防线 / E2E AC-01~15 / 性能基线'),
}

# B6 承接的 R4 尾段（导入导出 UI 与 CI 门禁），其余 R4 归 B5
R4_TO_B6 = ('P3-113', 'P3-114', 'P3-115')
B1_ITEMS = ('P3-010', 'P3-011', 'P3-030')


def fh(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def load_rows():
    with io.open(SRC, encoding='utf-8') as f:
        return list(csv.DictReader(f))


def split_deps(raw):
    return [d.strip() for d in re.split(r'[|,]', raw or '') if d.strip()]


def batch_of(item_id, ms, dom):
    if item_id.startswith('D1'):
        return 'D1'
    if ms == 'M0':
        return 'B0'
    if ms == 'M1':
        return 'B1' if item_id in B1_ITEMS else 'B2'
    if ms == 'M2':
        return 'B3'
    if dom.startswith('R3'):
        return 'B4'
    if dom.startswith('R4'):
        return 'B6' if item_id in R4_TO_B6 else 'B5'
    if dom.startswith('R5'):
        return 'B6'
    return 'B6'


def build(rows):
    done = {r['包ID'] for r in rows if r['状态'] in DONE_STATUS}
    pkg_to_item = {r['包ID']: r['工作项ID'] for r in rows}

    items = OrderedDict()
    for r in rows:
        key = r['工作项ID']
        if key not in items:
            items[key] = dict(
                id=key,
                name=r['工作项'],
                ms=r['里程碑'],
                dom=r['需求域'],
                lane=r['泳道'],
                pkgs=[],
                h=0.0,
                deps=set(),
            )
        items[key]['pkgs'].append(r)
        items[key]['h'] += fh(r['工时h'])
        items[key]['deps'].update(split_deps(r['依赖包']))

    item_done = {k: all(p['状态'] in DONE_STATUS for p in v['pkgs']) for k, v in items.items()}
    item_done_pkgs = {
        k: sum(1 for p in v['pkgs'] if p['状态'] in DONE_STATUS) for k, v in items.items()
    }

    payload = []
    for key, v in items.items():
        blockers = sorted(
            {
                pkg_to_item[d]
                for d in v['deps']
                if d in pkg_to_item and pkg_to_item[d] != key and not item_done[pkg_to_item[d]]
            }
        )
        ready = [
            p['包ID']
            for p in v['pkgs']
            if p['状态'] == '待派发' and all(d in done for d in split_deps(p['依赖包']))
        ]
        payload.append(
            dict(
                id=key,
                name=v['name'],
                ms=v['ms'],
                dom=v['dom'],
                lane=v['lane'],
                n=len(v['pkgs']),
                h=round(v['h'], 2),
                done=item_done_pkgs[key],
                complete=item_done[key],
                status='已完成' if item_done[key] else ('进行中' if item_done_pkgs[key] else '待派发'),
                blockers=blockers,
                ready=ready,
                ready_n=len(ready),
                first=v['pkgs'][0]['包ID'],
                batch=batch_of(key, v['ms'], v['dom']),
            )
        )

    matrix = defaultdict(lambda: dict(n=0, h=0.0, dn=0, dh=0.0))
    for r in rows:
        cell = matrix[(r['里程碑'], r['需求域'])]
        cell['n'] += 1
        cell['h'] += fh(r['工时h'])
        if r['状态'] in DONE_STATUS:
            cell['dn'] += 1
            cell['dh'] += fh(r['工时h'])

    batches = OrderedDict()
    for b in BATCH_ORDER:
        sub = [x for x in payload if x['batch'] == b]
        batches[b] = dict(
            n=sum(x['n'] for x in sub),
            h=round(sum(x['h'] for x in sub), 2),
            dn=sum(x['done'] for x in sub),
            items=len(sub),
            complete=sum(1 for x in sub if x['complete']),
            ready_pkgs=sum(x['ready_n'] for x in sub),
        )

    lanes = Counter()
    for x in payload:
        lanes[x['lane']] += x['n']

    return dict(
        total=dict(
            pkgs=len(rows),
            h=round(sum(fh(r['工时h']) for r in rows), 2),
            items=len(payload),
            dn=sum(1 for r in rows if r['状态'] in DONE_STATUS),
            dh=round(sum(fh(r['工时h']) for r in rows if r['状态'] in DONE_STATUS), 2),
        ),
        items=payload,
        matrix=[dict(ms=k[0], dom=k[1], **v) for k, v in sorted(matrix.items())],
        batch=batches,
        lanes=dict(lanes),
        status=dict(Counter(r['状态'] for r in rows)),
    )


def render(data):
    total = data['total']
    items = data['items']
    batches = data['batch']

    rows_html = []
    for it in sorted(items, key=lambda x: (BATCH_ORDER.index(x['batch']), x['id'])):
        pct = round(100 * it['done'] / it['n']) if it['n'] else 0
        cls = 'ok' if it['status'] == '已完成' else ('' if it['status'] == '进行中' else 'none')
        rdy = '<span class="rdy">%d 包可派</span>' % it['ready_n'] if it['ready_n'] else '<span class="dim">—</span>'
        blk = (
            '、'.join(it['blockers'][:3]) + ('…' if len(it['blockers']) > 3 else '')
            if it['blockers']
            else '<span class="dim">无</span>'
        )
        name = it['name'] if len(it['name']) <= 34 else it['name'][:33] + '…'
        rows_html.append(
            '<tr data-b="%s" data-r="%d"><td class="c"><b>%s</b></td><td class="c dim">%s</td>'
            '<td class="c dim">%s</td><td class="nm">%s<div class="sid">%s</div></td>'
            '<td class="c dim">%s</td><td class="r">%d</td><td class="r">%.2f</td>'
            '<td class="r"><div class="pb"><i class="%s" style="width:%d%%"></i></div>'
            '<span class="pct">%d/%d</span></td><td class="c">%s</td><td class="c">%s</td>'
            '<td class="blk dim">%s</td></tr>'
            % (
                it['batch'],
                1 if it['ready_n'] else 0,
                it['batch'],
                it['ms'],
                (it['dom'] or '').split()[0],
                html.escape(name),
                it['id'],
                it['lane'],
                it['n'],
                it['h'],
                cls,
                pct,
                it['done'],
                it['n'],
                rdy,
                it['status'],
                blk,
            )
        )

    batch_rows = []
    for b in BATCH_ORDER:
        v = batches[b]
        nm, note = BATCH_DESC[b]
        pct = round(100 * v['dn'] / v['n']) if v['n'] else 0
        batch_rows.append(
            '<tr><td class="c"><b>%s</b></td><td>%s<div class="sid">%s</div></td>'
            '<td class="r">%d</td><td class="r">%.1f</td><td class="r">%.1f</td>'
            '<td class="r"><div class="pb"><i class="%s" style="width:%d%%"></i></div>'
            '<span class="pct">%d/%d 包</span></td><td class="r">%s</td></tr>'
            % (
                b,
                nm,
                html.escape(note),
                v['n'],
                v['h'],
                round(v['h'] / 8, 1),
                'ok' if pct == 100 else ('' if pct else 'none'),
                pct,
                v['dn'],
                v['n'],
                ('%d' % v['ready_pkgs']) if v['ready_pkgs'] else '<span class="dim">—</span>',
            )
        )

    doms = [
        'R0 门禁',
        'R1 工程基建',
        'R2 账户与文件',
        'R3 协同与持久化',
        'R4 导入导出',
        'R5 License',
        'R6 交付验收',
        'R7 设计层',
    ]
    cell = {(m['ms'], m['dom']): m for m in data['matrix']}
    head = ''.join('<th class="c">%s</th>' % d.split()[0] for d in doms)
    mrows = []
    for ms in ['M0', 'M1', 'M2', 'M3']:
        tds = []
        tot = dict(n=0, h=0.0, dn=0)
        for dm in doms:
            c = cell.get((ms, dm))
            if not c:
                tds.append('<td class="c dim">—</td>')
                continue
            tot['n'] += c['n']
            tot['h'] += c['h']
            tot['dn'] += c['dn']
            tds.append(
                '<td class="c %s"><b>%d</b><span class="sid">%.0fh · %d/%d</span></td>'
                % ('ok' if c['dn'] == c['n'] else '', c['n'], c['h'], c['dn'], c['n'])
            )
        mrows.append(
            '<tr><td class="c"><b>%s</b></td>%s<td class="c tot"><b>%d</b>'
            '<span class="sid">%.0fh · %d/%d</span></td></tr>'
            % (ms, ''.join(tds), tot['n'], tot['h'], tot['dn'], tot['n'])
        )

    total_pkgs = total['pkgs']
    lane_rows = ''.join(
        '<div class="lane"><span>%s</span><div class="pb"><i style="width:%d%%"></i></div>'
        '<b>%d 包</b></div>' % (lane, round(100.0 * n / total_pkgs), n)
        for lane, n in sorted(data['lanes'].items(), key=lambda kv: -kv[1])
    )

    ready_items = [x for x in items if x['ready_n']]
    ready_rows = ''.join(
        '<tr><td class="c"><b>%s</b></td><td>%s</td><td class="c dim">%s</td>'
        '<td class="r">%.2f</td><td class="r">%d</td><td class="mono">%s</td></tr>'
        % (
            x['id'],
            html.escape(x['name']),
            x['batch'],
            x['h'],
            x['ready_n'],
            html.escape(' / '.join(x['ready'])),
        )
        for x in ready_items
    )

    ready_pkgs_total = sum(x['ready_n'] for x in items)
    widone = sum(1 for x in items if x['complete'])
    pct = round(100 * total['dh'] / total['h'], 1)
    dev_pkgs = sum(v['n'] for k, v in batches.items() if k != 'D1')

    repl = {
        '__N__': str(total['pkgs']),
        '__WI__': str(total['items']),
        '__WIDONE__': str(widone),
        '__H__': '%.1f' % total['h'],
        '__PD__': '%.1f' % (total['h'] / 8),
        '__DN__': str(total['dn']),
        '__DH__': '%.2f' % total['dh'],
        '__PCT__': str(pct),
        '__LEFT__': str(total['pkgs'] - total['dn']),
        '__LH__': '%.2f' % (total['h'] - total['dh']),
        '__RDY__': str(ready_pkgs_total),
        '__RDYWI__': str(len(ready_items)),
        '__LANES__': lane_rows,
        '__BATCH__': '\n'.join(batch_rows),
        '__HEAD__': head,
        '__MROWS__': '\n'.join(mrows),
        '__RDYROWS__': ready_rows,
        '__ROWS__': '\n'.join(rows_html),
        '__DEV__': str(dev_pkgs),
        '__DATA__': json.dumps(data, ensure_ascii=False),
    }

    out = TEMPLATE
    for k, v in repl.items():
        out = out.replace(k, v)
    return out


TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Web Office · Phase 3 拆解计划表（788 包）</title>
<style>
:root{
  --bg:#0d1117; --bg2:#12181f; --bg3:#161d26; --line:#232c38; --line2:#2c3746;
  --fg:#e6edf3; --fg2:#9aa7b4; --fg3:#6b7785;
  --ok:#3fb950; --warn:#d29922; --bad:#f85149; --info:#58a6ff;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);
  font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",Roboto,sans-serif;
  font-size:13px;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:1600px;margin:0 auto;padding:22px 26px 60px}
header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;
  padding-bottom:14px;border-bottom:1px solid var(--line)}
h1{font-size:19px;margin:0 0 4px;font-weight:600;letter-spacing:.3px}
.sub{color:var(--fg3);font-size:12px}
.sub b{color:var(--fg2);font-weight:500}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0 6px}
.kpi{background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:11px 13px}
.kpi .l{color:var(--fg3);font-size:11px;letter-spacing:.4px}
.kpi .v{font-size:22px;font-weight:600;margin-top:3px;font-variant-numeric:tabular-nums}
.kpi .d{color:var(--fg3);font-size:11px;margin-top:2px}
.sect{margin-top:26px}
.sect h2{font-size:12.5px;font-weight:600;color:var(--fg2);margin:0 0 10px;letter-spacing:.6px;
  text-transform:uppercase}
.tblbox{border:1px solid var(--line);border-radius:8px;overflow:auto;background:var(--bg2)}
table{border-collapse:separate;border-spacing:0;width:100%;font-size:12px}
thead th{position:sticky;top:0;z-index:3;background:#151c25;color:var(--fg2);font-weight:500;
  font-size:11px;letter-spacing:.4px;text-align:left;padding:8px 10px;
  border-bottom:1px solid var(--line2);white-space:nowrap}
tbody td{padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
tbody tr:hover{background:var(--bg3)}
td.c{text-align:center;white-space:nowrap} td.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
th.c{text-align:center} th.r{text-align:right}
td.nm{min-width:280px}
.sid{display:block;color:var(--fg3);font-size:11px;margin-top:1px}
.dim{color:var(--fg3)}
.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;color:var(--fg2)}
.pb{height:5px;background:#1c242f;border-radius:3px;overflow:hidden;margin-bottom:3px;min-width:56px}
.pb i{display:block;height:100%;border-radius:3px;background:var(--warn)}
.pb i.ok{background:var(--ok)} .pb i.none{background:#28313d}
.pct{color:var(--fg3);font-size:10.5px;font-variant-numeric:tabular-nums}
.rdy{color:#cfe6ff;background:#17324d;border:1px solid #1f4a72;border-radius:999px;
  padding:1px 8px;font-size:10.5px;white-space:nowrap}
.toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 10px}
input[type=search]{background:var(--bg2);border:1px solid var(--line2);color:var(--fg);
  border-radius:6px;padding:6px 9px;font-size:12px;outline:none;min-width:240px;font-family:inherit}
input[type=search]:focus{border-color:var(--info)}
.chipbtn{background:#1b2430;border:1px solid var(--line2);color:var(--fg2);border-radius:999px;
  padding:4px 11px;font-size:11.5px;cursor:pointer;user-select:none;font-family:inherit}
.chipbtn:hover{color:var(--fg);border-color:var(--fg3)}
.chipbtn.on{background:#17324d;border-color:var(--info);color:#cfe6ff}
.cnt{color:var(--fg3);font-size:11px;margin-left:auto}
.legend{color:var(--fg3);font-size:11px;margin-top:8px;line-height:1.7}
.legend b{color:var(--fg2);font-weight:500}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}
.card{background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:13px 15px}
.card h3{margin:0 0 9px;font-size:12px;color:var(--fg2);font-weight:600;letter-spacing:.3px}
.card table{border:none}
.card td,.card th{border-bottom:1px solid var(--line);padding:6px 8px}
.lane{display:flex;align-items:center;gap:9px;margin:7px 0;font-size:11.5px}
.lane span{width:34px;color:var(--fg3)}
.lane .pb{flex:1;margin:0}
.lane b{width:64px;text-align:right;font-weight:500;color:var(--fg2);font-variant-numeric:tabular-nums}
.tot{background:#151c25}
td.ok b{color:var(--ok)}
.path{color:var(--fg2);font-size:11.5px;line-height:1.9;
  font-family:ui-monospace,Consolas,monospace;white-space:pre-wrap}
.note{color:var(--fg3);font-size:11.5px;line-height:1.85}
.note b{color:var(--warn);font-weight:500}
.note code{background:#1b2430;border:1px solid var(--line2);border-radius:4px;padding:1px 5px;font-size:10.5px}
</style>
</head>
<body>
<div class="wrap">
<header>
  <div>
    <h1>Phase 3 拆解计划表</h1>
    <div class="sub">生成源 <b>docs/phase3/backlog.csv</b>（<b>__N__ 行</b>） · 口径见 <b>TASKS.md v1.5</b> §1/§3/§5 · 包级锚点见 <b>ANCHORS.md</b></div>
  </div>
  <div class="sub">由 <b>scripts/gen_package_plan.py</b> 生成 · 已完成 <b>__DN__</b> 包 / __DH__h</div>
</header>

<div class="kpis">
  <div class="kpi"><div class="l">派发包</div><div class="v">__N__</div><div class="d">平均 1.12h/包</div></div>
  <div class="kpi"><div class="l">工作项</div><div class="v">__WI__</div><div class="d">__WI__ 项 · 已收官 __WIDONE__</div></div>
  <div class="kpi"><div class="l">总工时</div><div class="v">__H__h</div><div class="d">__PD__ 人日（8h/人日）</div></div>
  <div class="kpi"><div class="l">已完成</div><div class="v">__DN__</div><div class="d">包 · __DH__h · __PCT__%</div></div>
  <div class="kpi"><div class="l">剩余</div><div class="v">__LEFT__</div><div class="d">包 · __LH__h</div></div>
  <div class="kpi"><div class="l">可立即派发</div><div class="v">__RDY__</div><div class="d">包 · __RDYWI__ 个工作项</div></div>
</div>

<div class="sect">
  <h2>1 · 四层拆分口径</h2>
  <div class="grid">
    <div class="card">
      <h3>层与数量</h3>
      <table>
        <thead><tr><th>层</th><th class="r">数量</th><th>粒度 / 用途</th></tr></thead>
        <tbody>
          <tr><td>需求域 R0~R7</td><td class="r">8</td><td class="dim">里程碑规划、人力分配</td></tr>
          <tr><td>工作项</td><td class="r">__WI__</td><td class="dim">一人可独立验收（2.4~16h）</td></tr>
          <tr><td>派发包</td><td class="r"><b>__N__</b></td><td class="dim">1.0~1.2h，单次派发即完成</td></tr>
          <tr><td>设计卡 D1</td><td class="r">13</td><td class="dim">卡 35 包 / 42h，覆盖 417 包</td></tr>
        </tbody>
      </table>
      <div class="note">拆包规则（脚本强制）：<code>n = round(工时/1.1)</code>，且 工时/n 落在 [1.0,1.2]；包内固定五段。</div>
    </div>
    <div class="card">
      <h3>泳道分布（包数）</h3>
      __LANES__
      <div class="note">BE 占比约 55%——M3 是后端重活，BE 只上 1 人时 M3 单独约 309h（38.7 人日），是工期单点。</div>
    </div>
    <div class="card">
      <h3>关键路径（依赖主干）</h3>
      <div class="path">P3-001 → P3-010 → D1-13 → P3-011 → D1-05/11 → P3-012 → P3-014 → P3-015
P3-010 → P3-030 → P3-031 → P3-032 → P3-063
P3-002 → D1-04/03/02 → P3-100 → P3-101..105 → P3-109 → P3-110 → P3-111
P3-002 → D1-01 → P3-071 → P3-072 / P3-073 → P3-075 → P3-076 → P3-077
P3-041 → P3-070 → P3-071   ·   D1-10 → P3-122 → P3-123 → P3-124</div>
    </div>
  </div>
</div>

<div class="sect">
  <h2>2 · 批次计划（B0~B6 + D1 设计卡）</h2>
  <div class="tblbox">
    <table>
      <thead><tr><th class="c">批次</th><th>内容</th><th class="r">包数</th><th class="r">工时</th><th class="r">人日</th><th class="r">进度</th><th class="r">可派</th></tr></thead>
      <tbody>__BATCH__</tbody>
    </table>
  </div>
  <div class="legend">批次按 <b>门禁与依赖</b>切，不按人头切。B4（协同）与 B5（导入导出）依赖不同，<b>可并行</b>——这是缩短 M3 的唯一杠杆。D1 十三卡（35 包 / 42h）已全部完成，单列不计入 B0~B6。<br>本表 B0~B6 合计 <b>__DEV__ 包 + D1 35 包 = __N__</b>；TASKS §5 批次表合计 <b>721</b>，缺 67 包 = P3-033 由 9 包重估为 76 包后<b>未回填批次表</b>（v1.5 只改了 §1/§2 的总账）。</div>
</div>

<div class="sect">
  <h2>3 · 里程碑 × 需求域（包数 / 工时 / 已完成）</h2>
  <div class="tblbox">
    <table>
      <thead><tr><th class="c">里程碑</th>__HEAD__<th class="c">合计</th></tr></thead>
      <tbody>__MROWS__</tbody>
    </table>
  </div>
</div>

<div class="sect">
  <h2>4 · 可立即派发队列（依赖全绿）</h2>
  <div class="tblbox">
    <table>
      <thead><tr><th class="c">工作项</th><th>名称</th><th class="c">批次</th><th class="r">工时</th><th class="r">可派包</th><th>包 ID</th></tr></thead>
      <tbody>__RDYROWS__</tbody>
    </table>
  </div>
  <div class="legend">其余工作项均被上游未完成包阻塞；阻塞项见下方明细「前置未完成」列。派发前仍须核每包 <code>依赖包</code> 字段（依赖未完成不得派）。</div>
</div>

<div class="sect">
  <h2>5 · __WI__ 工作项明细</h2>
  <div class="toolbar">
    <input type="search" id="q" placeholder="搜索工作项 ID / 名称 / 里程碑…">
    <button class="chipbtn on" data-f="all">全部</button>
    <button class="chipbtn" data-f="B0">B0</button>
    <button class="chipbtn" data-f="B1">B1</button>
    <button class="chipbtn" data-f="B2">B2</button>
    <button class="chipbtn" data-f="B3">B3</button>
    <button class="chipbtn" data-f="B4">B4</button>
    <button class="chipbtn" data-f="B5">B5</button>
    <button class="chipbtn" data-f="B6">B6</button>
    <button class="chipbtn" data-f="D1">D1</button>
    <button class="chipbtn" data-f="ready">仅可派</button>
    <span class="cnt" id="cnt"></span>
  </div>
  <div class="tblbox" style="max-height:76vh">
    <table>
      <thead><tr><th class="c">批次</th><th class="c">里程碑</th><th class="c">域</th><th>工作项</th><th class="c">泳道</th><th class="r">包数</th><th class="r">工时</th><th class="r">完成</th><th class="c">可派</th><th class="c">状态</th><th>前置未完成</th></tr></thead>
      <tbody id="tb">__ROWS__</tbody>
    </table>
  </div>
</div>

<div class="sect">
  <h2>6 · 口径注记</h2>
  <div class="card">
    <div class="note">
      · 工时合计 <b>__H__h</b> 与工作项工时对账一致（TASKS §2 记 882.0h，差 0.1h 为逐包四舍五入）。<br>
      · 「已归并」8 包计入完成（内容并入相邻包实施），故完成数 = 已完成 + 已归并。<br>
      · <b>TASKS v1.5 变更记录写「722→789 包」，而正文 §1/§2 与台账均为 __N__</b>；本表以台账实测为准，789 属文档笔误（历史变更行不改，待收口轮订正）。<br>
      · <b>TASKS §5 批次表合计 721 包</b>（22+26+131+149+131+141+121），缺 67 包 = P3-033 重估增量；该表还把 D1 卡按批次重复计入，与「卡单列」口径不同。本表逐包归属唯一，按台账机器统计。<br>
      · 批次归属由里程碑 + 需求域 + 工作项 ID 区段推断，与 TASKS §5 的批次口径一致（B1 仅 P3-010/011/030 三件套）。<br>
      · 设计卡 D1 共 13 卡 35 包 42h，2026-10-22 全部完成，故 D1 批次进度 100%。
    </div>
  </div>
</div>
</div>

<script>
const rows = [...document.querySelectorAll('#tb tr')];
const q = document.getElementById('q');
const cnt = document.getElementById('cnt');
let filter = 'all';
function apply(){
  const kw = q.value.trim().toLowerCase();
  let n = 0;
  rows.forEach(r => {
    const okF = filter === 'all' || (filter === 'ready' ? r.dataset.r === '1' : r.dataset.b === filter);
    const okK = !kw || r.textContent.toLowerCase().includes(kw);
    const show = okF && okK;
    r.style.display = show ? '' : 'none';
    if (show) n++;
  });
  cnt.textContent = n + ' / ' + rows.length + ' 工作项';
}
q.addEventListener('input', apply);
document.querySelectorAll('.chipbtn').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.chipbtn').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  filter = b.dataset.f;
  apply();
}));
apply();
</script>
</body>
</html>
"""


def main():
    rows = load_rows()
    data = build(rows)
    out = render(data)
    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(out)
    t = data['total']
    print('wrote %s' % OUT)
    print(
        '包 %d / 工作项 %d / 工时 %.2fh / 已完成 %d 包 %.2fh (%.1f%%) / 可派 %d 包'
        % (
            t['pkgs'],
            t['items'],
            t['h'],
            t['dn'],
            t['dh'],
            100.0 * t['dh'] / t['h'],
            sum(x['ready_n'] for x in data['items']),
        )
    )
    dev = sum(v['n'] for k, v in data['batch'].items() if k != 'D1')
    print('批次合计校验：B0~B6 %d + D1 %d = %d' % (dev, data['batch']['D1']['n'], dev + data['batch']['D1']['n']))


if __name__ == '__main__':
    main()
