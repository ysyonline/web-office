# -*- coding: utf-8 -*-
"""会话录像工时测量（k 系数回填用，2026-10-22 建立）

口径（三条，缺一不可）：
1. 证据源 = ~/.workbuddy/projects/<项目目录>/*.jsonl 的毫秒级 timestamp，
   不采信回忆估时、不采信消息条数折算。
2. 跨会话并行区间取**并集**——多个窗口同时活跃只计一次（同一人不可能同时干两份活）。
3. 相邻消息间隔 > GAP_MIN 视为中断不计。注意：中断空档内往往另一个窗口在活跃，
   所以并集必须覆盖全部相关会话，否则会低估。

局限（诚实标注）：
- 度量的是「人+工具」共同占用的墙钟时间，不是纯人时；若估时口径是纯人时，
  两者不同源，k 只能当量级校准，不能当精确比值。
- 会话归属靠关键词提及次数近似，跨主题共享的会话（如 D1-13 与 P3-001 同段）需要
  显式给定归属比例，本脚本只报提及数与占比，不替人做归属裁决。

用法：
  python -X utf8 scripts/session-effort.py --kw D1-13 --kw P3-001 \
      --session 7599b883:0.30 --session 1fa4bcd4:1.0 \
      --session bd4dff1e:1.0 --session 07bcee24:1.0 --estimate 2.4
  --session <前缀>:<归属比例>  可重复；不给 --session 则自动纳入提及 kw 的全部会话（归属比例 1.0）。
"""
import argparse
import glob
import hashlib
import json
import os
import sys
from datetime import datetime, timedelta, timezone

TZ = timezone(timedelta(hours=8))
ROOT = os.path.expanduser("~/.workbuddy/projects")


def find_project_dir(name: str) -> str:
    cands = [p for p in glob.glob(os.path.join(ROOT, "*")) if name in os.path.basename(p)]
    if not cands:
        sys.exit("未找到包含 %r 的项目目录（%s）" % (name, ROOT))
    return max(cands, key=os.path.getmtime)


def load(path: str):
    ts, kw = [], {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                d = json.loads(line)
            except Exception:
                continue
            t = d.get("timestamp")
            if isinstance(t, int):
                ts.append(t)
            if d.get("type") == "message":
                s = json.dumps(d.get("content"), ensure_ascii=False)
                for k in KW:
                    kw[k] = kw.get(k, 0) + s.count(k)
    ts.sort()
    return ts, kw


def intervals(ts, gap_min: int):
    out, cur = [], [ts[0]]
    for a, b in zip(ts, ts[1:]):
        if (b - a) / 1000.0 > gap_min * 60:
            out.append((cur[0], cur[-1]))
            cur = [b]
        else:
            cur.append(b)
    out.append((cur[0], cur[-1]))
    return out


def main():
    global KW
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default="d-code-web-office")
    ap.add_argument("--kw", action="append", default=[])
    ap.add_argument("--session", action="append", default=[],
                    help="会话前缀:归属比例，可重复")
    ap.add_argument("--gap", type=int, default=20, help="中断阈值（分钟）")
    ap.add_argument("--estimate", type=float, default=None, help="原估算工时，用于算 k")
    a = ap.parse_args()
    KW = a.kw or ["D1-"]
    pdir = find_project_dir(a.project)

    fixed = {}
    for spec in a.session:
        pre, _, ratio = spec.partition(":")
        fixed[pre[:8]] = float(ratio or 1.0)

    files, seen = [], set()
    for f in sorted(glob.glob(os.path.join(pdir, "*.jsonl"))):
        h = hashlib.md5(open(f, "rb").read()).hexdigest()
        body = open(f, "rb").read()
        sig = hashlib.md5(body.replace(b'"sessionId"', b"")).hexdigest()
        if sig in seen:
            continue  # 同内容的派生会话（仅 sessionId 不同）只取一份
        seen.add(sig)
        files.append(f)

    picked, allints = [], []
    for f in files:
        sid = os.path.basename(f)[:8]
        ts, kw = load(f)
        if not ts:
            continue
        total_kw = sum(kw.get(k, 0) for k in KW)
        if fixed:
            ratio = fixed.get(sid)
            if ratio is None:
                continue
        else:
            if total_kw == 0:
                continue
            ratio = 1.0
        iv = intervals(ts, a.gap)
        span = sum((e - s) / 3.6e6 for s, e in iv)
        picked.append((sid, ts[0], ts[-1], span, ratio, span * ratio, kw))
        allints += [(s, e, sid) for s, e in iv]

    allints.sort()
    merged = []
    for s, e, sid in allints:
        if merged and s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
            merged[-1][2].add(sid)
        else:
            merged.append([s, e, {sid}])
    union = sum((e - s) / 3.6e6 for s, e, _ in merged)

    print("项目目录: %s" % pdir)
    print("%-9s %-13s %-13s %8s %6s %8s  %s" % ("会话", "起", "止", "活跃h", "归属", "计入h", "关键词提及"))
    for sid, t0, t1, span, ratio, eff, kw in picked:
        print("%-9s %-13s %-13s %8.2f %6.2f %8.2f  %s" % (
            sid, datetime.fromtimestamp(t0 / 1000, TZ).strftime("%m-%d %H:%M"),
            datetime.fromtimestamp(t1 / 1000, TZ).strftime("%H:%M"),
            span, ratio, eff,
            " ".join("%s=%d" % (k, v) for k, v in kw.items() if v)))
    eff_sum = sum(p[5] for p in picked)
    print("\n并集活跃（跨会话并行去重）: %.2fh" % union)
    print("归属合计（按显式比例）    : %.2fh" % eff_sum)
    if a.estimate:
        print("k = %.2f / %.2f = %.2f" % (eff_sum, a.estimate, eff_sum / a.estimate))
    print("\n注意：归属比例是人的裁决，不是脚本结论；共享会话请显式给比例并留依据。")


if __name__ == "__main__":
    main()
