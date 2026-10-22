# -*- coding: utf-8 -*-
"""
公式白名单 CI 门禁（机器可执行契约）

作用：把外部评审人验证过的「119 白名单 ⊆ Univer 引擎 542 实现」关系固化为 CI 断言，
     防止白名单文档漂移（新增函数引擎未实现 -> 编辑侧可输入但运行时 #NAME?）。

断言（任一失败即退出码 1，CI FAIL）：
  G1 whitelist 数组清单恰 119 行、全大写、无重复
  G2 引擎实现集提取数恰 542（评审人提取法：', "NAME"]' 模式 + sort -u 等价实现）
  G3 白名单 ⊆ 引擎实现集（缺失清单必须为空）
  G4 名单外范例锚点：OFFSET / INDIRECT / AGGREGATE 在引擎集内且不在白名单内
     （文档示例函数的事实前提；若未来白名单收录三者，须同步改 whitelist.md 的范例行）
  G5 白名单文档正文与数组清单一致性：正文八组计数 20+19+7+19+20+13+15+6 = 119

运行（Windows 控制台编码教训：必须 -X utf8，否则 cp936 下中文路径/内容读取假阴性）：
  python -X utf8 scripts/check_formula_whitelist.py [--engine-path PATH] [--whitelist-path PATH]

默认路径相对仓库根：docs/formula/function-whitelist.md 与
  spike/collab-spike/node_modules/@univerjs/engine-formula/lib/es/index.js
"""
import io
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_WHITELIST = os.path.join(REPO_ROOT, "docs", "formula", "function-whitelist.md")
DEFAULT_ENGINE = os.path.join(
    REPO_ROOT, "spike", "collab-spike", "node_modules",
    "@univerjs", "engine-formula", "lib", "es", "index.js",
)

EXPECTED_WHITELIST_COUNT = 119
EXPECTED_ENGINE_COUNT = 542
EXPECTED_GROUP_COUNTS = [20, 19, 7, 19, 20, 13, 15, 6]  # 数学/统计/逻辑/文本/日期/查找/财务/信息

# 引擎数组条目形态（rollup 产物）：[ClassName, "NAME"] —— 提取引号内全大写函数名
ENGINE_FUNC_PATTERN = re.compile(r', "([A-Z][A-Z0-9_.]*)"\]')


def parse_whitelist(path):
    """解析 function-whitelist.md 的 ```text 规范化数组清单（唯一生成源）。"""
    with io.open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    names, in_block, block_seen = [], False, 0
    for raw in lines:
        line = raw.strip()
        if line == "```text" and not in_block:
            in_block, block_seen = True, block_seen + 1
            continue
        if in_block and line == "```":
            in_block = False
            continue
        if in_block and line:
            names.append(line)
    if block_seen != 1:
        fail("G1", "规范化数组清单代码块数量 != 1（发现 %d 个 ```text 块）" % block_seen)
    if len(names) != EXPECTED_WHITELIST_COUNT:
        fail("G1", "清单行数 %d != %d" % (len(names), EXPECTED_WHITELIST_COUNT))
    bad = [n for n in names if not re.fullmatch(r"[A-Z][A-Z0-9_.]*", n)]
    if bad:
        fail("G1", "存在非全大写/非法函数名条目: %s" % bad[:5])
    if len(set(names)) != len(names):
        dupes = sorted({n for n in names if names.count(n) > 1})
        fail("G1", "存在重复条目: %s" % dupes)
    ok("G1", "清单 %d 行、全大写、无重复" % len(names))
    return names


def parse_engine(path):
    """评审人提取法的 python 等价实现：从 engine-formula es 产物提取函数名集。"""
    with io.open(path, "r", encoding="utf-8") as f:
        content = f.read()
    names = sorted(set(ENGINE_FUNC_PATTERN.findall(content)))
    if len(names) != EXPECTED_ENGINE_COUNT:
        fail("G2", "引擎实现集提取数 %d != %d（引擎版本漂移？核实 @univerjs/engine-formula 是否仍为 1.0.2）"
             % (len(names), EXPECTED_ENGINE_COUNT))
    ok("G2", "引擎实现集 %d 个（提取法与评审人 grep -o ', \"[A-Z][A-Z0-9_.]*\"]' | sort -u 等价）" % len(names))
    return set(names)


def check_subset(whitelist, engine):
    missing = sorted(set(whitelist) - engine)
    if missing:
        fail("G3", "白名单函数引擎未实现（编辑侧可输入、运行时必 #NAME?）: %s" % missing)
    ok("G3", "白名单 %d ⊆ 引擎 %d，缺失 0" % (len(set(whitelist)), len(engine)))


def check_examples(whitelist, engine):
    anchors = ["OFFSET", "INDIRECT", "AGGREGATE"]
    wl = set(whitelist)
    for fn in anchors:
        if fn not in engine:
            fail("G4", "范例锚点 %s 不在引擎实现集内（引擎版本变化，须重选名单外范例）" % fn)
        if fn in wl:
            fail("G4", "范例锚点 %s 已进白名单（whitelist.md §5 范例行须同步替换，防 IRR 类举例失实复发）" % fn)
    ok("G4", "名单外范例锚点 %s：引擎已实现、白名单未收录" % anchors)


def check_groups(path):
    """正文八组计数与数组清单总数一致性。"""
    with io.open(path, "r", encoding="utf-8") as f:
        content = f.read()
    header = re.search(r"计数核对：([\d+]+)\s*=\s*\*?\*?119", content)
    if not header:
        # 宽松匹配：正文含「计数核对：20+19+...=119」字样
        header_text = re.search(r"计数核对：([0-9+]+)={1,2}\s*\**119", content.replace(" ", ""))
        if not header_text:
            fail("G5", "未找到「计数核对」行（文档结构漂移）")
        parts = [int(x) for x in header_text.group(1).split("+")]
    else:
        parts = [int(x) for x in re.findall(r"\d+", header.group(1))]
    if parts != EXPECTED_GROUP_COUNTS:
        fail("G5", "八组计数 %s != 期望 %s" % (parts, EXPECTED_GROUP_COUNTS))
    ok("G5", "正文八组计数 %s 与 119 总数一致" % "+".join(str(x) for x in parts))


def ok(gid, msg):
    print("[PASS] %s %s" % (gid, msg))


def fail(gid, msg):
    print("[FAIL] %s %s" % (gid, msg))
    sys.exit(1)


def main():
    whitelist_path = DEFAULT_WHITELIST
    engine_path = DEFAULT_ENGINE
    args = sys.argv[1:]
    if "--whitelist-path" in args:
        whitelist_path = args[args.index("--whitelist-path") + 1]
    if "--engine-path" in args:
        engine_path = args[args.index("--engine-path") + 1]
    if not os.path.isfile(whitelist_path):
        fail("G0", "白名单文档不存在: %s" % whitelist_path)
    if not os.path.isfile(engine_path):
        fail("G0", "引擎产物不存在: %s（先安装 spike/collab-spike 依赖）" % engine_path)

    whitelist = parse_whitelist(whitelist_path)
    engine = parse_engine(engine_path)
    check_subset(whitelist, engine)
    check_examples(whitelist, engine)
    check_groups(whitelist_path)
    print("==== check_formula_whitelist: ALL PASS ====")


if __name__ == "__main__":
    main()
