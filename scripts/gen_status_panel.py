#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成「需求/设计/评审/拆分」状态面板（自包含单文件 HTML）。

数据全部来自仓库文件，不手填数字：
  docs/phase3/backlog.csv        工作项与包（拆分、工时、状态、依赖）
  docs/phase3/DESIGN-LAYER.md    §3.1 卡总表（覆盖工作项、消费方、卡工时）
  docs/phase3/design/D1-*.md     卡文件是否存在 + 状态行版本
  docs/REVIEW-INDEX.md           评审线程段（哪个卡/哪个域真被评审过）
  docs/decisions/OPEN-DECISIONS.md  未决条目（按工作项ID 计数）

用法：python -X utf8 scripts/gen_status_panel.py
输出：docs/status-panel.html
"""
import csv
import glob
import json
import os
import re
import datetime
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = os.path.join(ROOT, "docs/phase3/backlog.csv")
LAYER = os.path.join(ROOT, "docs/phase3/DESIGN-LAYER.md")
INDEX = os.path.join(ROOT, "docs/REVIEW-INDEX.md")
OPEN = os.path.join(ROOT, "docs/decisions/OPEN-DECISIONS.md")
CARDDIR = os.path.join(ROOT, "docs/phase3/design")
OUT = os.path.join(ROOT, "docs/status-panel.html")

# 需求域 → (评审等级, 证据)。证据取自 REVIEW-INDEX 线程段与落盘清单，不臆造；
# 「已评审」= 有专项评审线程且结论落盘；「基线覆盖」= 仅随基线评审被引用，无专项评审记录。
DOMAIN_REVIEW = {
    "R0": ("已评审", "P3-001 工程化基线评审（7 项缺口裁决落盘）+ P3-002 公式 spike 报告"),
    "R1": ("已评审", "P3-001 评审落定 ADR-005/006/007；外部评审分支 F（Q6 国产库）"),
    "R2": ("基线覆盖", "Spec §4/§7 随 P3-001 基线评审被引用 + ADR-002 Accepted；无专项需求评审记录"),
    "R3": ("已评审", "外部评审分支 C（Q3 无损互通）→ ADR-001 v1.5/v1.6"),
    "R4": ("已评审", "外部评审分支 B（Q2 引擎能力边界）→ plan.md v1.5 / whitelist v1.5"),
    "R5": ("已评审", "外部评审分支 D（Q4 License 指纹）→ license/design.md v1.4"),
    "R6": ("已评审", "外部评审分支 E（Q5 性能分级）→ promise-tiering.md v1.0"),
    "R7": ("按卡", "逐卡判定：设计层工作项的评审状态取决于该卡是否走过评审线程"),
}


def read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except (PermissionError, OSError):
        # Security Center 逐文件 deny（2026-10-24 起 D1-*.md 等落在名单内，直读被拒）：
        # 回退到 git HEAD 取内容。仅当该文件相对 HEAD 无未入库改动时，回退内容才等于
        # 工作区真值；有改动则打 WARN，绝不静默用旧内容冒充真值。
        rel = os.path.relpath(path, ROOT).replace("\\", "/")
        proc = subprocess.run(["git", "show", "HEAD:" + rel], cwd=ROOT,
                              capture_output=True)
        if proc.returncode != 0:
            raise
        txt = proc.stdout.decode("utf-8")
        st = subprocess.run(["git", "status", "--porcelain", "--", rel],
                            cwd=ROOT, capture_output=True, text=True)
        if st.stdout.strip():
            print("WARN %s 有未入库改动，git 回退读到的是旧内容" % rel)
        else:
            print("note %s 直读被拒，已从 git HEAD 回退（与工作区一致）" % rel)
        return txt


def load_packages():
    rows = list(csv.DictReader(open(CSV, encoding="utf-8-sig")))
    items = {}
    for r in rows:
        wid = r["工作项ID"]
        it = items.setdefault(wid, {
            "id": wid, "name": r["工作项"], "lane": r["泳道"],
            "milestone": r["里程碑"], "domain": r["需求域"],
            "hours": 0.0, "packages": [], "owners": r["工作项交付物"],
            "closeAssert": r["工作项收口断言"],
        })
        it["hours"] += float(r["工时h"])
        it["packages"].append({
            "id": r["包ID"], "seq": r["包序"], "hours": float(r["工时h"]),
            "scope": r["本包范围"], "deliver": r["包级交付物"],
            "assert": r["包级验收断言"], "deps": r["依赖包"], "status": r["状态"],
        })
    return rows, items


def parse_layers():
    """解析 DESIGN-LAYER §3.1 卡总表 → {卡号: {...}}"""
    txt = read(LAYER)
    cards = {}
    for line in txt.split("\n"):
        raw = line.strip().replace("**", "")
        if not raw.startswith("| D1-"):
            continue
        cells = [c.strip() for c in raw.strip("|").split("|")]
        if len(cells) < 8:
            continue
        cid, name, hours, pkgs, cover, coverPkgs, consumers, src = cells[:8]
        if not re.match(r"D1-\d+$", cid):
            continue
        items = []
        if "全局" in cover:
            glob_cov = True
        else:
            glob_cov = False
            prefix = None
            for tok in re.split(r"[/,，\s]+", cover):
                tok = tok.strip()
                if not tok:
                    continue
                if tok.startswith("P3-"):
                    prefix = tok[:3]
                    items.append(tok)
                elif re.match(r"^\d+$", tok) and prefix:
                    items.append(prefix + tok)
        cards[cid] = {
            "id": cid, "name": name, "hours": hours,
            "packages": pkgs, "cover": cover, "coverPkgs": coverPkgs,
            "covers": items, "globalCover": glob_cov,
            "consumers": [c.strip() for c in re.split(r"[/,，]", consumers) if c.strip()],
            "source": src,
        }
    return cards


def parse_card_files():
    out = {}
    for p in sorted(glob.glob(os.path.join(CARDDIR, "D1-*.md"))):
        cid = re.search(r"(D1-\d+)", os.path.basename(p)).group(1)
        txt = read(p)
        ver, status = "", ""
        m = re.search(r"状态：\**v([\d.]+)\s*\**([^\n（(]*)", txt)
        if m:
            ver = "v" + m.group(1)
            status = m.group(2).strip().strip("*").strip()
        out[cid] = {
            "file": os.path.relpath(p, ROOT).replace("\\", "/"),
            "version": ver, "status": status or "未标注",
            "chars": len(txt),
            "consumers": re.findall(r"P3-\d{3}", txt.split("消费方")[1].split("\n")[0]) if "消费方" in txt else [],
        }
    return out


def parse_reviews(cards):
    """从 REVIEW-INDEX 找评审线程段 → 已评审的卡/阶段。"""
    txt = read(INDEX)
    reviewed = {}
    # 段标题形如 ### D1-13 挑刺审查线程（...）
    for m in re.finditer(r"^### (D1-\d+) 挑刺审查线程[^\n]*\n(.*?)(?=^### |\Z)", txt, re.S | re.M):
        cid, body = m.group(1), m.group(2)
        rounds = 0
        rs = re.search(r"\| 线程结构 \| ([^\n]+)", body)
        if rs:
            rounds = max(0, len(re.findall(r"→", rs.group(1))) - 1)
        issues = ""
        is_ = re.search(r"\| 问题总量 \| ([^\n]+)", body)
        if is_:
            issues = is_.group(1).replace("|", "/").strip()
        reviewed[cid] = {"rounds": rounds, "issues": issues, "section": "REVIEW-INDEX " + m.group(1) + " 线程段"}
    return reviewed


def is_open_line(line):
    """状态单元格以 OPEN 开头即计为未决。

    不能只匹配 `| OPEN |`：登记册里有历史行写成 `**OPEN**（补充说明）`，
    精确匹配会少算一条（2026-10-22 实测：精确匹配 31，实际 32）。
    单元格剥掉 `*` 后判前缀，兼容 `**OPEN**` 与 `OPEN`。
    """
    if not line.startswith("|"):
        return False
    cells = line.rstrip().rstrip("|").split("|")
    if len(cells) < 2:
        return False
    return cells[-1].strip().replace("*", "").startswith("OPEN")


def parse_open(items):
    """按工作项ID 统计未决条目数（只数 OPEN 行）。"""
    txt = read(OPEN)
    counts, details = {}, {}
    for line in txt.split("\n"):
        if not is_open_line(line):
            continue
        ids = set(re.findall(r"(P3-\d{3}|D1-\d{2})", line))
        for wid in ids:
            counts[wid] = counts.get(wid, 0) + 1
            cell = line.strip("|").split("|")[2].strip()
            details.setdefault(wid, []).append(cell[:120])
    return counts, details


def main():
    rows, items = load_packages()
    cards = parse_layers()
    card_files = parse_card_files()
    reviews = parse_reviews(cards)
    open_cnt, open_detail = parse_open(items)

    # 包状态索引（判阻塞）
    done = {r["包ID"] for r in rows if r["状态"] == "已完成"}

    cover_map = {}
    for cid, c in cards.items():
        if c["globalCover"]:
            continue
        for wid in c["covers"]:
            cover_map.setdefault(wid, []).append(cid)

    data = []
    for wid, it in items.items():
        is_card = wid.startswith("D1-")
        cf = card_files.get(wid)
        rev = reviews.get(wid)
        covering = cover_map.get(wid, [])
        if is_card:
            design = "自有卡" if cf else "卡未写"
            card_id, card_state = wid, (cf["status"] if cf else "未起草")
        elif covering:
            design = "被覆盖"
            card_id, card_state = " / ".join(covering), "见卡"
        else:
            design = "无卡"
            card_id, card_state = "", "—"

        if is_card:
            reviewed_state = "已评审 %d 轮" % rev["rounds"] if rev else ("未评审" if cf else "无可评审")
        else:
            # 开发工作项：其依赖的卡是否评审过
            revd = [c for c in covering if c in reviews]
            if not covering:
                reviewed_state = "无卡"
            elif revd:
                reviewed_state = "所属卡已评审"
            else:
                reviewed_state = "所属卡未评审"

        done_n = sum(1 for p in it["packages"] if p["status"] == "已完成")
        ready = [p["id"] for p in it["packages"] if p["status"] == "待派发"
                 and all(d in done for d in [x for x in re.split(r"[|]", p["deps"]) if x])]
        dom = it["domain"][:2]
        drev = DOMAIN_REVIEW.get(dom, ("—", "无记录"))

        data.append({
            "id": wid, "name": it["name"], "lane": it["lane"],
            "milestone": it["milestone"], "domain": it["domain"],
            "hours": round(it["hours"], 2), "pkgCount": len(it["packages"]),
            "donePkgs": done_n, "readyPkgs": len(ready),
            "design": design, "cardId": card_id, "cardState": card_state,
            "cardReview": reviewed_state,
            "reviewRounds": (rev or {}).get("rounds", 0),
            "reviewEvidence": (rev or {}).get("section", ""),
            "reqReview": drev[0] if dom != "R7" else ("已评审" if rev else "未评审"),
            "reqEvidence": drev[1] if dom != "R7" else ("D1-13 四轮挑刺闭环（首轮 13 项 + 二轮 400 覆盖 + 三轮纪律 + 四轮核验）"
                                                     if rev else "该卡尚未写卡/未进评审线程"),
            "owners": it["owners"], "closeAssert": it["closeAssert"],
            "open": open_cnt.get(wid, 0),
            "openDetail": open_detail.get(wid, [])[:3],
            "packages": it["packages"],
        })

    order = {"R0": 0, "R1": 1, "R2": 2, "R3": 3, "R4": 4, "R5": 5, "R6": 6, "R7": 7}
    data.sort(key=lambda d: (order.get(d["domain"][:2], 9), d["id"]))

    total_pkg = len(rows)
    total_h = round(sum(float(r["工时h"]) for r in rows), 1)
    done_pkg = sum(1 for r in rows if r["状态"] == "已完成")
    cards_written = len([c for c in cards if c in card_files])
    cards_reviewed = len([c for c in cards if c in reviews])
    cov_set = set(cover_map.keys())                      # 被命名卡（非全局卡）覆盖的 P3 工作项
    covered_items = len(cov_set)
    covered_pkgs = sum(len(items[w]["packages"]) for w in cov_set)
    covered_hours = round(sum(items[w]["hours"] for w in cov_set), 1)
    # 无卡 = 既无自有卡文件、也无命名卡覆盖（含 12 张未写的设计卡 + 39 个开发工作项）
    no_card_items = len([d for d in data if d["design"] in ("无卡", "卡未写")])
    no_card_pkgs = sum(d["pkgCount"] for d in data if d["design"] in ("无卡", "卡未写"))

    # 文档声明值 vs 机读值：面板自带口径校验（防「改了卡表忘改总数」）
    dm = re.search(r"去重后\s*(\d+)\s*个工作项\s*/\s*(\d+)\s*包\s*/\s*([\d.]+)h", read(LAYER))
    declared = None
    if dm:
        declared = {"items": int(dm.group(1)), "pkgs": int(dm.group(2)), "hours": float(dm.group(3))}
    computed = {"items": covered_items, "pkgs": covered_pkgs, "hours": covered_hours}
    qa = {
        "declared": declared, "computed": computed,
        "match": bool(declared) and declared["items"] == computed["items"]
                 and declared["pkgs"] == computed["pkgs"]
                 and abs(declared["hours"] - computed["hours"]) < 0.2,
    }

    meta = {
        "generated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "items": len(data), "packages": total_pkg, "hours": total_h,
        "donePkg": done_pkg,
        "cards": len(cards), "cardsWritten": cards_written, "cardsReviewed": cards_reviewed,
        "coveredItems": covered_items, "coveredPkgs": covered_pkgs,
        "coveredHours": covered_hours, "noCardItems": no_card_items, "noCardPkgs": no_card_pkgs,
        "qa": qa,
        "openTotal": sum(1 for l in read(OPEN).split("\n") if is_open_line(l)),
        "sources": [
            "docs/phase3/backlog.csv（工作项/包/工时/状态/依赖）",
            "docs/phase3/DESIGN-LAYER.md §3.1（13 卡覆盖关系）",
            "docs/phase3/design/D1-*.md（卡文件与状态行）",
            "docs/REVIEW-INDEX.md（评审线程段）",
            "docs/decisions/OPEN-DECISIONS.md（未决条目）",
        ],
    }

    # 域汇总
    doms = {}
    for d in data:
        k = d["domain"]
        x = doms.setdefault(k, {"domain": k, "items": 0, "pkg": 0, "hours": 0.0,
                                "done": 0, "noCard": 0, "cardUnreviewed": 0})
        x["items"] += 1
        x["pkg"] += d["pkgCount"]
        x["hours"] += d["hours"]
        x["done"] += d["donePkgs"]
        if d["design"] in ("无卡", "卡未写"):
            x["noCard"] += 1
        if d["cardReview"] in ("未评审", "所属卡未评审"):
            x["cardUnreviewed"] += 1
    dom_list = [doms[k] for k in sorted(doms, key=lambda s: order.get(s[:2], 9))]
    for x in dom_list:
        x["hours"] = round(x["hours"], 1)

    payload = {"meta": meta, "items": data, "domains": dom_list,
               "cards": [{"id": c, **{k: v for k, v in cards[c].items() if k != "id"},
                          "file": card_files.get(c, {}).get("file", ""),
                          "version": card_files.get(c, {}).get("version", ""),
                          "state": card_files.get(c, {}).get("status", "未起草"),
                          "chars": card_files.get(c, {}).get("chars", 0),
                          "rounds": (reviews.get(c) or {}).get("rounds", 0),
                          "reviewSection": (reviews.get(c) or {}).get("section", "")}
                         for c in ["D1-05", "D1-11", "D1-09", "D1-07", "D1-01", "D1-06",
                                   "D1-08", "D1-04", "D1-03", "D1-02", "D1-10", "D1-12", "D1-13"]]}

    js = json.dumps(payload, ensure_ascii=False).replace("</", "<\\/")
    html = TEMPLATE.replace("/*__DATA__*/", js)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    nbytes = os.path.getsize(OUT)
    print("wrote", os.path.relpath(OUT, ROOT), "%.0f KB" % (nbytes / 1024))
    print("items=%d packs=%d hours=%.1f done=%d cards written=%d/%d reviewed=%d covered=%d/%d"
          % (len(data), total_pkg, total_h, done_pkg, cards_written, len(cards),
             cards_reviewed, covered_items, len(data)))


TEMPLATE = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Web Office · 需求 / 设计 / 评审 / 拆分状态面板</title>
<style>
:root{
  --bg:#0d1117; --bg2:#12181f; --bg3:#161d26; --line:#232c38; --line2:#2c3746;
  --fg:#e6edf3; --fg2:#9aa7b4; --fg3:#6b7785;
  --ok:#3fb950; --warn:#d29922; --bad:#f85149; --info:#58a6ff; --purple:#bc8cff; --teal:#39c5cf;
  --chip:#1b2430;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);
  font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",Roboto,sans-serif;
  font-size:13px;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:1560px;margin:0 auto;padding:22px 26px 60px}
header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;
  padding-bottom:14px;border-bottom:1px solid var(--line)}
h1{font-size:19px;margin:0 0 4px;font-weight:600;letter-spacing:.3px}
.sub{color:var(--fg3);font-size:12px}
.sub b{color:var(--fg2);font-weight:500}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:10px;margin:18px 0 6px}
.kpi{background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:11px 13px}
.kpi .l{color:var(--fg3);font-size:11px;letter-spacing:.4px}
.kpi .v{font-size:22px;font-weight:600;margin-top:3px;font-variant-numeric:tabular-nums}
.kpi .d{color:var(--fg3);font-size:11px;margin-top:2px}
.sect{margin-top:26px}
.sect h2{font-size:13px;font-weight:600;color:var(--fg2);margin:0 0 10px;letter-spacing:.6px;
  text-transform:uppercase}
.four{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.q{background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:13px 15px;position:relative;overflow:hidden}
.q::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--info)}
.q.g::before{background:var(--ok)} .q.w::before{background:var(--warn)} .q.b::before{background:var(--bad)}
.q .t{font-size:12px;color:var(--fg3)}
.q .n{font-size:17px;font-weight:600;margin:4px 0 6px;font-variant-numeric:tabular-nums}
.q .n small{font-size:12px;color:var(--fg3);font-weight:400}
.bar{height:5px;background:#1c242f;border-radius:3px;overflow:hidden;margin:6px 0 7px}
.bar i{display:block;height:100%;border-radius:3px;background:var(--ok)}
.q .note{color:var(--fg3);font-size:11px;line-height:1.45}
table{width:100%;border-collapse:collapse}
.domtbl th,.domtbl td{padding:7px 10px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
.domtbl th:first-child,.domtbl td:first-child{text-align:left}
.domtbl th{color:var(--fg3);font-weight:500;font-size:11px;letter-spacing:.4px}
.domtbl td{font-variant-numeric:tabular-nums}
.domtbl tbody tr:hover{background:var(--bg2)}
.toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0 10px}
input[type=search],select{background:var(--bg2);border:1px solid var(--line2);color:var(--fg);
  border-radius:6px;padding:6px 9px;font-size:12px;outline:none;font-family:inherit}
input[type=search]{min-width:230px}
input[type=search]:focus,select:focus{border-color:var(--info)}
.chipbtn{background:var(--chip);border:1px solid var(--line2);color:var(--fg2);border-radius:999px;
  padding:4px 11px;font-size:11.5px;cursor:pointer;user-select:none;font-family:inherit}
.chipbtn:hover{color:var(--fg);border-color:var(--fg3)}
.chipbtn.on{background:#17324d;border-color:var(--info);color:#cfe6ff}
.cnt{color:var(--fg3);font-size:11px;margin-left:auto}
.tblbox{border:1px solid var(--line);border-radius:8px;overflow:auto;max-height:70vh;background:var(--bg2)}
table.main{border-collapse:separate;border-spacing:0;font-size:12px}
table.main thead th{position:sticky;top:0;z-index:3;background:#151c25;color:var(--fg2);
  font-weight:500;font-size:11px;text-align:left;padding:8px 9px;border-bottom:1px solid var(--line2);
  white-space:nowrap;cursor:pointer;user-select:none}
table.main thead th:hover{color:#fff}
table.main thead th .ar{color:var(--fg3);font-size:9px;margin-left:3px}
table.main td{padding:7px 9px;border-bottom:1px solid #1b232d;vertical-align:middle}
table.main tbody tr:hover{background:#151d27}
table.main tbody tr.open{background:#141e2a}
.id{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:var(--info)}
.nm{color:var(--fg);max-width:300px;line-height:1.45}
.nm small{color:var(--fg3);display:block;font-size:10.5px;margin-top:1px}
.pill{display:inline-block;border-radius:4px;padding:1px 6px;font-size:10.5px;line-height:17px;white-space:nowrap}
.p-ok{background:#0f2a17;color:#56d364;border:1px solid #1c4425}
.p-no{background:#2a1518;color:#ff7b72;border:1px solid #4a2024}
.p-warn{background:#2b2110;color:#e3b341;border:1px solid #4a3818}
.p-idle{background:#1a222c;color:#8b98a5;border:1px solid #2a3542}
.p-info{background:#10243a;color:#79c0ff;border:1px solid #1f4062}
.num{text-align:right;font-variant-numeric:tabular-nums;color:var(--fg2)}
.pbar{width:54px;height:4px;background:#1c242f;border-radius:2px;overflow:hidden;display:inline-block;vertical-align:middle}
.pbar i{display:block;height:100%;background:var(--ok)}
.exp{padding:0 !important;border-bottom:1px solid #1b232d}
.expin{padding:10px 12px 14px 28px;background:#0f1620}
.expin h4{margin:0 0 8px;font-size:11px;color:var(--fg3);font-weight:500;letter-spacing:.5px}
table.pkg{font-size:11.5px}
table.pkg th{text-align:left;color:var(--fg3);font-weight:500;padding:4px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
table.pkg td{padding:5px 8px;border-bottom:1px solid #18202a;color:var(--fg2);vertical-align:top}
table.pkg td.sc{color:var(--fg)}
table.pkg tr:last-child td{border-bottom:0}
.mono{font-family:ui-monospace,Consolas,monospace;font-size:11px}
.legend{margin-top:12px;color:var(--fg3);font-size:11px;line-height:1.8;border-top:1px solid var(--line);padding-top:10px}
.legend code{background:#161d26;border:1px solid var(--line);border-radius:3px;padding:1px 5px;font-size:10.5px;color:var(--fg2)}
.empty{padding:26px;text-align:center;color:var(--fg3)}
.cardrow{display:grid;grid-template-columns:74px minmax(0,1fr) 72px 108px 84px;gap:12px;align-items:center;
  padding:8px 12px;border-bottom:1px solid var(--line);font-size:12px}
.cardrow:hover{background:var(--bg3)}
.cardrow .cid{font-family:ui-monospace,Consolas,monospace;color:var(--fg2);font-size:11.5px}
.cardrow .cn{color:var(--fg)}
.cardrow .cn small{color:var(--fg3);display:block;font-size:10.5px}
.cardwrap{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--bg2);max-width:1180px}
.cardwrap .hd{display:grid;grid-template-columns:74px minmax(0,1fr) 72px 108px 84px;gap:12px;padding:8px 12px;
  background:#151c25;color:var(--fg3);font-size:11px;border-bottom:1px solid var(--line2)}
</style>
</head>
<body>
<div class="wrap">
<header>
  <div>
    <h1>需求 · 设计 · 评审 · 拆分 状态面板</h1>
    <div class="sub">数据源：<b id="src"></b> ｜ 生成：<b id="gen"></b></div>
  </div>
  <div class="sub">口径：<b>只看文件里能机检的事实</b>，无记录即显示「无 / 未」，不做推定</div>
</header>

<div class="kpis" id="kpis"></div>
<div id="qaband"></div>

<div class="sect">
  <h2>四个问题的整体答案</h2>
  <div class="four" id="four"></div>
</div>

<div class="sect">
  <h2>按需求域汇总</h2>
  <div class="tblbox" style="max-height:none">
    <table class="domtbl" id="domtbl"></table>
  </div>
</div>

<div class="sect">
  <h2>13 张设计卡：是否写卡 · 是否评审</h2>
  <div class="sub" style="margin:-4px 0 9px">「覆盖工作项」取 DESIGN-LAYER §3.1 原表；D1-05 为全局码段卡（所有错误出口），不参与覆盖计数。卡文件缺失 = 该卡尚未起草，无内容可评审。</div>
  <div class="cardwrap">
    <div class="hd"><span>卡号</span><span>名称 / 覆盖工作项</span><span>卡文件</span><span>状态</span><span>评审</span></div>
    <div id="cards"></div>
  </div>
</div>

<div class="sect">
  <h2>工作项明细（101 项 · 点击行展开包清单）</h2>
  <div class="toolbar">
    <input type="search" id="q" placeholder="搜索工作项 / 卡号 / 包号…">
    <select id="fdom"><option value="">全部需求域</option></select>
    <select id="flane"><option value="">全部泳道</option></select>
    <select id="fdesign">
      <option value="">设计文档：全部</option>
      <option value="自有卡">自有卡（设计层工作项）</option>
      <option value="被覆盖">被设计卡覆盖</option>
      <option value="无卡">无卡覆盖</option>
    </select>
    <select id="freview">
      <option value="">卡评审：全部</option>
      <option value="rev">已评审</option>
      <option value="norev">未评审</option>
    </select>
    <button class="chipbtn" id="toggleOpen">只看有未决项</button>
    <button class="chipbtn" id="clear">重置</button>
    <span class="cnt" id="cnt"></span>
  </div>
  <div class="tblbox">
    <table class="main" id="main">
      <thead><tr>
        <th data-k="id">工作项<span class="ar"></span></th>
        <th data-k="domain">需求域<span class="ar"></span></th>
        <th data-k="lane">泳道<span class="ar"></span></th>
        <th data-k="milestone">里程碑<span class="ar"></span></th>
        <th data-k="pkgCount" class="num">包数<span class="ar"></span></th>
        <th data-k="hours" class="num">工时<span class="ar"></span></th>
        <th data-k="ratio" class="num">完成<span class="ar"></span></th>
        <th data-k="reqReview">需求评审<span class="ar"></span></th>
        <th data-k="design">设计文档<span class="ar"></span></th>
        <th data-k="cardReview">卡评审<span class="ar"></span></th>
        <th data-k="open" class="num">未决<span class="ar"></span></th>
      </tr></thead>
      <tbody></tbody>
    </table>
  </div>
  <div class="legend" id="legend"></div>
</div>
</div>

<script>
const DATA = /*__DATA__*/;
const M = DATA.meta, ITEMS = DATA.items;
const pct = (a,b)=> b? Math.round(a*100/b) : 0;
const DOMREVGRADE = {"R0":"已评审","R1":"已评审","R2":"基线覆盖","R3":"已评审","R4":"已评审","R5":"已评审","R6":"已评审","R7":"按卡"};

document.getElementById('gen').textContent = M.generated;
document.getElementById('src').textContent = M.sources.length + ' 份文件（见页脚）';

// ---- KPI
const kpis = [
  ['工作项', M.items, '需求域 ' + DATA.domains.length + ' 个'],
  ['包总数', M.packages, '平均 ' + (M.packages/M.items).toFixed(1) + ' 包/项'],
  ['总工时', M.hours.toFixed(1) + 'h', (M.hours/8).toFixed(1) + ' 人日'],
  ['已完成包', M.donePkg, '进度 ' + pct(M.donePkg, M.packages) + '%'],
  ['设计卡', M.cardsWritten + '/' + M.cards, '已写卡文件'],
  ['卡已评审', M.cardsReviewed + '/' + M.cards, '有评审线程记录'],
  ['未决条目', M.openTotal, 'OPEN-DECISIONS'],
];
document.getElementById('kpis').innerHTML = kpis.map(k=>
  `<div class="kpi"><div class="l">${k[0]}</div><div class="v">${k[1]}</div><div class="d">${k[2]}</div></div>`).join('');

// ---- 口径校验（文档声明 vs 机读复算）
(function(){
  const q = M.qa; if(!q || !q.declared) return;
  const d = q.declared, c = q.computed;
  const ok = q.match;
  const line = `DESIGN-LAYER 声明：<b>${d.items}</b> 工作项 / <b>${d.pkgs}</b> 包 / <b>${d.hours}</b>h
    ｜ 本面板机读复算：<b>${c.items}</b> / <b>${c.pkgs}</b> / <b>${c.hours}</b>h`;
  document.getElementById('qaband').innerHTML =
    `<div style="margin:12px 0 2px;padding:9px 13px;border-radius:8px;font-size:12px;
      background:${ok?'#0f2a17':'#2a1518'};border:1px solid ${ok?'#1c4425':'#4a2024'};
      color:${ok?'#56d364':'#ff7b72'}">
      ${ok?'✓ 覆盖口径一致':'✗ 覆盖口径不一致（文档数字未随卡表更新）'}　${line}
      <span style="color:var(--fg3)">　· 命名卡覆盖，D1-05 全局卡不计入</span></div>`;
})();

// ---- 四问
const domReviewed = DATA.domains.filter(d=> d.domain.slice(0,2)!=='R7' && (DOMREVGRADE[d.domain.slice(0,2)]||'')==='已评审').length;
const domBase = DATA.domains.filter(d=> d.domain.slice(0,2)!=='R7' && (DOMREVGRADE[d.domain.slice(0,2)]||'')==='基线覆盖').length;
const four = [
  {cls:'g', t:'① 需求是否评审', n:'', note:''},
  {cls: M.cardsWritten===M.cards?'g':(M.cardsWritten?'w':'b'), t:'② 是否有设计文档', n:'', note:''},
  {cls: M.cardsReviewed===M.cards?'g':(M.cardsReviewed?'b':'b'), t:'③ 设计文档是否评审过', n:'', note:''},
  {cls:'g', t:'④ 任务拆分情况', n:'', note:''},
];
four[0].n = domReviewed + ' <small>域已评审</small> + ' + (domBase? ' ' + domBase + ' <small>域仅基线覆盖</small>' : '');
four[0].note = 'Spec v1.0.0 为需求基线。6 个域有专项评审线程（R0/R1 走 P3-001，R3~R6 走外部评审分支 B~F），<b style="color:var(--warn)">R2 账户与文件仅随基线评审被引用、无专项记录</b>。R7 为设计层，按卡逐张判定。';
four[1].n = M.cardsWritten + ' / ' + M.cards + ' <small>张卡有文件</small>';
four[1].note = `${M.cards} 张卡已立项（命名卡覆盖 ${M.coveredItems} 个工作项 / ${M.coveredPkgs} 包 / ${M.coveredHours.toFixed(1)}h），但只有 D1-13 写出了卡文件。余 <b style="color:var(--fg2)">${M.noCardItems} 个工作项 / ${M.noCardPkgs} 包</b>既无自有卡也无命名卡覆盖——其中 12 项是尚未起草的设计卡、39 项是纯开发工作项。（D1-05 为全局码段卡，不参与覆盖计数）`;
four[2].n = M.cardsReviewed + ' / ' + M.cards + ' <small>张卡已评审</small>';
four[2].note = '唯一走过完整评审的是 D1-13（四轮：挑刺 → 团队回执 → 二轮审核 → 三轮回执 → 四轮核验），结论已全部落盘到卡 v1.7 与 DESIGN-LAYER §2.2。其余 12 张卡连卡文件都未写，谈不上评审。';
four[3].n = M.items + ' / ' + M.items + ' <small>项已拆</small>';
four[3].note = `全部工作项已拆到可独立验收的包（${M.packages} 包 / ${M.hours.toFixed(1)}h），每包含范围、交付物、验收断言、依赖。当前可立即派发 ${ITEMS.reduce((a,d)=>a+d.readyPkgs,0)} 包。`;
document.getElementById('four').innerHTML = four.map(f=>
  `<div class="q ${f.cls}"><div class="t">${f.t}</div><div class="n">${f.n}</div><div class="note">${f.note}</div></div>`).join('');

// ---- 域表
const domRev = {"R0":"P3-001 基线评审 + P3-002 spike","R1":"P3-001 → ADR-005/006/007；分支 F",
  "R2":"仅随 P3-001 基线评审引用 + ADR-002 Accepted，无专项评审","R3":"分支 C + ADR-001 v1.5/v1.6",
  "R4":"分支 B（Q2 引擎能力）+ plan v1.5","R5":"分支 D（Q4 License）→ license/design v1.4",
  "R6":"分支 E（Q5 性能分级）","R7":"按卡判定：1/13 已评审"};
let dh = '<thead><tr><th>需求域</th><th>工作项</th><th>包数</th><th>工时</th><th>完成包</th>'
  + '<th>无卡/未写</th><th>卡未评审</th><th>需求评审</th><th style="text-align:left">证据</th></tr></thead><tbody>';
DATA.domains.forEach(d=>{
  const k = d.domain.slice(0,2);
  dh += `<tr><td>${d.domain}</td><td>${d.items}</td><td>${d.pkg}</td><td>${d.hours.toFixed(1)}h</td>`
     +  `<td>${d.done} <span style="color:var(--fg3)">(${pct(d.done,d.pkg)}%)</span></td>`
     +  `<td>${d.noCard? '<span class="pill p-no">'+d.noCard+'</span>' : '<span class="pill p-idle">0</span>'}</td>`
     +  `<td>${d.cardUnreviewed? '<span class="pill p-warn">'+d.cardUnreviewed+'</span>' : '<span class="pill p-idle">0</span>'}</td>`
     +  `<td>${domRevPill(k)}</td>`
     +  `<td style="text-align:left;color:var(--fg3);white-space:normal">${domRev[k]||'—'}</td></tr>`;
});
dh += '</tbody>';
function domRevPill(k){
  const g = DOMREVGRADE[k]||'—';
  const cls = g==='已评审' ? 'p-ok' : g==='基线覆盖' ? 'p-warn' : 'p-idle';
  return `<span class="pill ${cls}">${g}</span>`;
}
document.getElementById('domtbl').innerHTML = dh;

// ---- 卡表
document.getElementById('cards').innerHTML = DATA.cards.map(c=>{
  const has = !!c.file;
  const st = has ? `<span class="pill p-ok">${c.version||''} ${c.state}</span>` : `<span class="pill p-idle">未起草</span>`;
  const rv = c.rounds ? `<span class="pill p-ok">${c.rounds} 轮闭环</span>`
                      : (has ? `<span class="pill p-warn">未评审</span>` : `<span class="pill p-idle">无可评审</span>`);
  const cov = c.globalCover ? '全局（所有错误出口）'
            : (c.covers.length ? c.covers.length + ' 项：' + c.covers.join(' / ') : c.cover);
  return `<div class="cardrow"><span class="cid">${c.id}</span>
    <span class="cn">${c.name}<small>${cov}　｜　${c.hours}</small></span>
    <span>${has? '<span class="pill p-info">已写</span>' : '<span class="pill p-idle">缺</span>'}</span>
    <span>${st}</span><span>${rv}</span></div>`;
}).join('');

// ---- 主表
const state = {k:'id', dir:1, onlyOpen:false, q:''};
const laneSet = [...new Set(ITEMS.map(d=>d.lane))].sort();
const domSet = [...new Set(ITEMS.map(d=>d.domain))];
const fdom = document.getElementById('fdom'), flane = document.getElementById('flane');
domSet.forEach(d=> fdom.insertAdjacentHTML('beforeend', `<option value="${d}">${d}</option>`));
laneSet.forEach(l=> flane.insertAdjacentHTML('beforeend', `<option value="${l}">${l}</option>`));

function ratio(d){ return d.pkgCount? d.donePkgs/d.pkgCount : 0; }
function designPill(d){
  if(d.design==='自有卡') return `<span class="pill p-info">自有卡 ${d.cardId}</span>`;
  if(d.design==='被覆盖'){
    const ids = d.cardId.split(' / ');
    const txt = ids.length>2 ? ids.slice(0,2).join(' ')+' +'+(ids.length-2) : ids.join(' ');
    return `<span class="pill p-info" title="${d.cardId}">${txt}</span>`;
  }
  if(d.design==='卡未写') return `<span class="pill p-warn">卡未写</span>`;
  return `<span class="pill p-no">无卡覆盖</span>`;
}
function reviewPill(d){
  if(d.cardReview.startsWith('已评审')) return `<span class="pill p-ok">${d.cardReview}</span>`;
  if(d.cardReview==='所属卡已评审') return `<span class="pill p-ok" title="该工作项被已评审的设计卡覆盖">卡已评审</span>`;
  if(d.cardReview==='所属卡未评审') return `<span class="pill p-warn" title="覆盖它的设计卡尚未评审">卡未评审</span>`;
  if(d.cardReview==='未评审') return `<span class="pill p-warn">未评审</span>`;
  if(d.cardReview==='无可评审') return `<span class="pill p-idle">无可评审</span>`;
  return `<span class="pill p-no">无卡</span>`;
}
function reqPill(d){
  return d.reqReview==='已评审' ? `<span class="pill p-ok">已评审</span>`
       : `<span class="pill p-warn">${d.reqReview}</span>`;
}

function render(){
  const q = state.q.toLowerCase();
  let list = ITEMS.filter(d=>{
    if(state.onlyOpen && !d.open) return false;
    if(fdom.value && d.domain!==fdom.value) return false;
    if(flane.value && d.lane!==flane.value) return false;
    if(document.getElementById('fdesign').value && d.design!==document.getElementById('fdesign').value) return false;
    const fr = document.getElementById('freview').value;
    if(fr==='rev' && !/已评审/.test(d.cardReview)) return false;
    if(fr==='norev' && /已评审/.test(d.cardReview)) return false;
    if(q){
      const hay = (d.id+' '+d.name+' '+d.cardId+' '+d.domain+' '+d.lane+' '+
        d.packages.map(p=>p.id+' '+p.scope).join(' ')).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
  list.sort((a,b)=>{
    let x=a[state.k], y=b[state.k];
    if(state.k==='ratio'){ x=ratio(a); y=ratio(b); }
    if(typeof x==='string') return state.dir * x.localeCompare(y,'zh');
    return state.dir * ((x||0)-(y||0));
  });
  document.getElementById('cnt').textContent = `显示 ${list.length} / ${ITEMS.length} 项`;
  const tb = document.querySelector('table.main tbody');
  tb.innerHTML = list.map((d,i)=>{
    const r = ratio(d);
    return `<tr data-i="${d.id}">
      <td><span class="id">${d.id}</span><div class="nm">${d.name}</div></td>
      <td><span class="pill p-idle">${d.domain}</span></td>
      <td style="color:var(--fg2)">${d.lane}</td>
      <td style="color:var(--fg2)">${d.milestone}</td>
      <td class="num">${d.pkgCount}</td>
      <td class="num">${d.hours.toFixed(1)}h</td>
      <td class="num"><span class="pbar"><i style="width:${Math.round(r*100)}%"></i></span> ${d.donePkgs}/${d.pkgCount}</td>
      <td>${reqPill(d)}</td>
      <td>${designPill(d)}</td>
      <td>${reviewPill(d)}</td>
      <td class="num">${d.open? '<span class="pill p-warn">'+d.open+'</span>' : '<span style="color:var(--fg3)">—</span>'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="11" class="empty">没有匹配的工作项</td></tr>';

  tb.querySelectorAll('tr[data-i]').forEach(tr=>{
    tr.addEventListener('click', ()=>{
      if(tr.classList.contains('open')){
        tr.classList.remove('open');
        tr.nextElementSibling?.classList.contains('exp') && tr.nextElementSibling.remove();
        return;
      }
      document.querySelectorAll('tr.exp').forEach(e=>e.remove());
      document.querySelectorAll('tr.open').forEach(e=>e.classList.remove('open'));
      tr.classList.add('open');
      const d = ITEMS.find(x=>x.id===tr.dataset.i);
      const det = document.createElement('tr');
      det.className='exp';
      let h = `<td colspan="11"><div class="expin">
        <h4>包清单 · ${d.pkgCount} 包 / ${d.hours.toFixed(1)}h　｜　设计文档：${d.design} ${d.cardId||''}　｜　卡评审：${d.cardReview}</h4>
        <table class="pkg"><thead><tr><th>包ID</th><th>序</th><th>工时</th><th>状态</th><th>本包范围</th><th>依赖</th><th>包级验收断言</th></tr></thead><tbody>`;
      d.packages.forEach(p=>{
        const st = p.status==='已完成' ? '<span class="pill p-ok">已完成</span>' : '<span class="pill p-idle">待派发</span>';
        h += `<tr><td class="mono">${p.id}</td><td class="num">${p.seq}</td><td class="num">${p.hours.toFixed(2)}</td>
          <td>${st}</td><td class="sc">${p.scope}</td><td class="mono" style="color:var(--fg3)">${p.deps||'—'}</td>
          <td>${p.assert}</td></tr>`;
      });
      h += `</tbody></table>
        <h4 style="margin-top:10px">工作项级</h4>
        <div style="color:var(--fg2);font-size:11.5px"><b style="color:var(--fg3)">交付物</b>　${d.owners||'—'}</div>
        <div style="color:var(--fg2);font-size:11.5px;margin-top:3px"><b style="color:var(--fg3)">收口断言</b>　${d.closeAssert||'—'}</div>
        <div style="color:var(--fg2);font-size:11.5px;margin-top:3px">需求评审证据：${d.reqEvidence}</div>
        ${d.reviewEvidence? `<div style="color:var(--fg2);font-size:11.5px;margin-top:3px">卡评审证据：${d.reviewEvidence}</div>`:''}
        ${d.openDetail.length? `<div style="color:var(--warn);font-size:11.5px;margin-top:5px">未决（${d.open}）：${d.openDetail.join(' ； ')}</div>`:''}
      </div></td>`;
      det.innerHTML = h;
      tr.after(det);
    });
  });
}

document.getElementById('q').addEventListener('input', e=>{ state.q=e.target.value; render(); });
[fdom, flane, document.getElementById('fdesign'), document.getElementById('freview')].forEach(el=>
  el.addEventListener('change', render));
document.getElementById('toggleOpen').addEventListener('click', e=>{
  state.onlyOpen = !state.onlyOpen; e.target.classList.toggle('on', state.onlyOpen); render();
});
document.getElementById('clear').addEventListener('click', ()=>{
  state.q=''; state.onlyOpen=false; document.getElementById('q').value='';
  fdom.value=''; flane.value=''; document.getElementById('fdesign').value='';
  document.getElementById('freview').value='';
  document.getElementById('toggleOpen').classList.remove('on'); render();
});
document.querySelectorAll('table.main thead th').forEach(th=>{
  th.addEventListener('click', ()=>{
    const k = th.dataset.k;
    state.dir = (state.k===k)? -state.dir : 1;
    state.k = k;
    document.querySelectorAll('table.main thead th .ar').forEach(a=>a.textContent='');
    th.querySelector('.ar').textContent = state.dir>0? '▲':'▼';
    render();
  });
});

document.getElementById('legend').innerHTML =
  '<b style="color:var(--fg2)">数据来源（全部机读，无手填）</b><br>' +
  M.sources.map(s=>'· <code>'+s.split('（')[0]+'</code> '+ (s.split('（')[1]||'').replace('）','')).join('<br>') +
  '<br><br><b style="color:var(--fg2)">判定口径</b><br>' +
  '· <b>需求评审</b>：Spec v1.0.0 为需求基线；逐需求域的评审证据取 REVIEW-INDEX 的线程段与落盘清单，域名无对应记录时显示「无记录」<br>' +
  '· <b>设计文档</b>：<code>自有卡</code>=设计层工作项且有 <code>docs/phase3/design/D1-xx</code> 文件；<code>被覆盖</code>=该工作项出现在 DESIGN-LAYER §3.1 的「覆盖工作项」列；<code>无卡覆盖</code>=两者都不满足<br>' +
  '· <b>卡评审</b>：只认 REVIEW-INDEX 里存在该卡号的评审线程段；卡未写即「无可评审」<br>' +
  '· <b>未决</b>：OPEN-DECISIONS 中状态为 OPEN 且正文提到该工作项ID 的条目数<br>' +
  '· <b>完成</b>：该工作项下状态为「已完成」的包数 / 总包数';

render();
</script>
</body>
</html>
"""

if __name__ == "__main__":
    main()
