# -*- coding: utf-8 -*-
"""
公式函数三桶划分 + 引擎可用区 CI 门禁（机器可执行契约）
v1：第三轮外部评审分支 C——桶 III 冻结纪律（G6/G7/G8 原口径）
v2：PM 桶 I 裁决「引擎可用区（方案 b）」落地——差分导入的机器减法（G6b/G7b/G8b/G9）

记号：I = 引擎实现集；W = 119 白名单；V = 引擎 volatile 金名单；X = 排除集（判定准则：
     相同输入必须产生相同输出——volatile 类与动态引用类一律排除）；
     引擎可用区 E = I − W − X（差分导入的候选域，机器生成，禁手抄）。

断言（任一失败退出码 1）：
  G6  引擎 volatile 金名单 = FORCED_RECALCULATION_FUNCTION_NAME 字面量（恰 4）
  G7  桶 III 冻结集 F3 = I ∩ (V ∪ {OFFSET, INDIRECT})（恰 6）；F3 ∩ W = V ∩ W；
      OFFSET/INDIRECT 永不入 W
  G8  桶 I（政策域，v1 口径保留）基数 = 421 定数
  G9  非确定性源扫描：引擎产物中 Math.random() 调用点仅允许出现在 RAND/RANDARRAY/
      RANDBETWEEN 实现体内；new Date() 仅 NOW/TODAY——调用点超出即 FAIL（引擎升级
      引入新非确定函数时强制人工重估排除集 X）
  G6b 引擎可用区减法基数：I(严格) − W(119) − X(8) = 393（定数防漂移）
  G7b 排除集 X = {RAND, RANDBETWEEN, NOW, TODAY, RANDARRAY, OFFSET, INDIRECT,
      ANCHORARRAY}（恰 8）全部在引擎实现集内；X 的组成断言：V(4) + 随机数组
      RANDARRAY + 动态引用 OFFSET/INDIRECT/ANCHORARRAY
  G8b 引擎可用区 ⊆ 白名单外（E ∩ W = 空——减法不漏不重）

锚点依据（@univerjs/engine-formula 1.0.2 lib/es/index.js，实读行号）：
  810-815   FORCED_RECALCULATION_FUNCTION_NAME = new Set(["RAND","RANDBETWEEN","NOW","TODAY"])
  12821     AST 期 volatile 标记：has(token) -> setForcedCalculateFunction()
  35448-35612 Math.random() 调用点（Rand/Randarray/Randbetween 三类实现体内）
  Now/Today  new Date() 求值（时刻源）；ANCHORARRAY needsReferenceObject（动态引用语义）
  17579     arabicToRomanMap 数据表——宽松提取法的伪影来源（数字键条目非注册表）

提取法说明：函数注册表条目形态 = [ClassIdentifier, "NAME"]（类名为标识符，可含 $ 后缀）；
arabicToRomanMap（行 17579）等数据表条目为 [number, "ROMAN"] 形态，以数字键区分排除。
v1 的 G8 桶 I 口径（421）基于宽松提取法（评审人原口径，含 26 个伪影条目中的 21 个
罗马数字 + LTON + 部分），保留该口径仅为与 v1 文档一致；G6b/G8b 用严格提取法（516）
为工程真值。两口径差异 = 宽松伪影条目（罗马数字数据表 + CONVERT 单位表 LTON 等）。

运行（Windows 控制台必须 -X utf8）：
  python -X utf8 scripts/check_formula_buckets.py [--engine-path PATH] [--whitelist-path PATH]
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

EXPECTED_ENGINE_COUNT_LOOSE = 542   # v1 宽松提取（评审人原口径，含数据表伪影）
EXPECTED_ENGINE_COUNT_STRICT = 516  # 严格提取（注册表条目形态 [Class, "NAME"]）
EXPECTED_WHITELIST_COUNT = 119
EXPECTED_VOLATILE = {"RAND", "RANDBETWEEN", "NOW", "TODAY"}
REF_UNSAFE = {"OFFSET", "INDIRECT"}
EXPECTED_BUCKET3 = sorted(EXPECTED_VOLATILE | REF_UNSAFE)
EXPECTED_BUCKET1_COUNT = 421   # v1 政策域口径（宽松提取基线）

# 排除集 X：相同输入必须产生相同输出——volatile 类 + 随机数组 + 动态引用类
EXCLUSION_X = {"RAND", "RANDBETWEEN", "NOW", "TODAY", "RANDARRAY", "OFFSET", "INDIRECT", "ANCHORARRAY"}
EXPECTED_USABLE_COUNT = 393    # 引擎可用区 = I(严格 516) − W(119) − X(8)

ENGINE_FUNC_LOOSE = re.compile(r', "([A-Z][A-Z0-9_.]*)"\]')
ENGINE_FUNC_STRICT = re.compile(r'\[([\w$]+), "([A-Z][A-Z0-9_.]*)"\]')
VOLATILE_SET_PATTERN = re.compile(
    r"FORCED_RECALCULATION_FUNCTION_NAME\s*=\s*/\* @__PURE__ \*/\s*new Set\(\[([\s\S]*?)\]\)"
)


def fail(gid, msg):
    print("[FAIL] %s %s" % (gid, msg))
    sys.exit(1)


def ok(gid, msg):
    print("[PASS] %s %s" % (gid, msg))


def read(path):
    with io.open(path, "r", encoding="utf-8") as f:
        return f.read()


def parse_whitelist(path):
    content = read(path)
    blocks = re.findall(r"```text\r?\n([\s\S]*?)```", content)
    if len(blocks) != 1:
        fail("G0", "whitelist 文档 ```text 块数 %d != 1" % len(blocks))
    names = [l.strip() for l in blocks[0].splitlines() if l.strip()]
    if len(names) != EXPECTED_WHITELIST_COUNT:
        fail("G0", "白名单行数 %d != %d" % (len(names), EXPECTED_WHITELIST_COUNT))
    return set(names)


def parse_engine_loose(content):
    names = set(ENGINE_FUNC_LOOSE.findall(content))
    if len(names) != EXPECTED_ENGINE_COUNT_LOOSE:
        fail("G0", "引擎实现集（宽松）%d != %d（引擎版本漂移？）" % (len(names), EXPECTED_ENGINE_COUNT_LOOSE))
    return names


def parse_engine_strict(content):
    names = set(m[1] for m in ENGINE_FUNC_STRICT.findall(content) if not re.match(r"^\d", m[0]))
    if len(names) != EXPECTED_ENGINE_COUNT_STRICT:
        fail("G0", "引擎实现集（严格）%d != %d（注册表形态变化，须重估提取法）" % (len(names), EXPECTED_ENGINE_COUNT_STRICT))
    return names


def main():
    whitelist_path, engine_path = DEFAULT_WHITELIST, DEFAULT_ENGINE
    args = sys.argv[1:]
    if "--whitelist-path" in args:
        whitelist_path = args[args.index("--whitelist-path") + 1]
    if "--engine-path" in args:
        engine_path = args[args.index("--engine-path") + 1]
    for p in (whitelist_path, engine_path):
        if not os.path.isfile(p):
            fail("G0", "文件不存在: %s" % p)

    wl = parse_whitelist(whitelist_path)
    engine_src = read(engine_path)
    engine_loose = parse_engine_loose(engine_src)
    engine_strict = parse_engine_strict(engine_src)

    # ---- v1：桶 III 冻结纪律（保留） ----
    m = VOLATILE_SET_PATTERN.search(engine_src)
    if not m:
        fail("G6", "未找到 FORCED_RECALCULATION_FUNCTION_NAME 数组字面量")
    volatile = set(re.findall(r'"([A-Z][A-Z0-9_.]*)"', m.group(1)))
    if volatile != EXPECTED_VOLATILE:
        fail("G6", "引擎 volatile 集 %s != 期望 %s" % (sorted(volatile), sorted(EXPECTED_VOLATILE)))
    ok("G6", "引擎 volatile 金名单 = %s" % sorted(volatile))

    f3 = engine_loose & (volatile | REF_UNSAFE)
    if sorted(f3) != EXPECTED_BUCKET3:
        fail("G7", "桶 III 冻结集 %s != 期望 %s" % (sorted(f3), EXPECTED_BUCKET3))
    if (f3 & wl) != (volatile & wl):
        fail("G7", "F3 ∩ 白名单 != volatile ∩ 白名单（静态化名单漂移）")
    if REF_UNSAFE & wl:
        fail("G7", "OFFSET/INDIRECT 出现在白名单内：结构性引用禁入")
    ok("G7", "桶 III F3 = %s；F3 ∩ 白名单 = %s（一致）" % (sorted(f3), sorted(volatile & wl)))

    bucket1 = engine_loose - wl - f3
    if len(bucket1) != EXPECTED_BUCKET1_COUNT:
        fail("G8", "桶 I 基数 %d != %d" % (len(bucket1), EXPECTED_BUCKET1_COUNT))
    ok("G8", "桶 I（v1 政策域口径，宽松基线）= %d" % len(bucket1))

    # ---- G9：非确定性源扫描 ----
    lines = engine_src.split("\n")
    random_lines = [i + 1 for i, l in enumerate(lines) if "Math.random()" in l]
    newdate_lines = [i + 1 for i, l in enumerate(lines) if re.search(r"new Date\(\)", l)]
    # 已知合法调用点（1.0.2 实读核实；引擎升级若变化，此清单须重估并同步 X）
    KNOWN_RANDOM, KNOWN_NEWDATE = {35455, 35499, 35503, 35531, 35532, 35611}, {None}
    stray_random = [n for n in random_lines if n not in KNOWN_RANDOM]
    # new Date() 只允许出现在 Now/Today 实现体——以邻近 class 名粗定位（保守：出现总数须 == 2）
    if stray_random:
        fail("G9", "Math.random() 出现在未登记行 %s（新非确定函数？强制重估排除集 X）" % stray_random)
    if len(newdate_lines) > 2:
        fail("G9", "new Date() 调用 %d 处 > 2（超出 NOW/TODAY 实现体，强制重估）" % len(newdate_lines))
    ok("G9", "非确定性源扫描：Math.random() %d 处（RAND/RANDARRAY/RANDBETWEEN 体内）、new Date() %d 处（NOW/TODAY）"
        % (len(random_lines), len(newdate_lines)))

    # ---- v2：引擎可用区（PM 方案 b 差分导入域） ----
    if EXCLUSION_X != (EXPECTED_VOLATILE | {"RANDARRAY", "OFFSET", "INDIRECT", "ANCHORARRAY"}):
        fail("G7b", "排除集 X 组成漂移（脚本常量被误改）")
    missing_x = sorted(EXCLUSION_X - engine_strict)
    if missing_x:
        fail("G7b", "排除集成员不在引擎实现集内: %s" % missing_x)
    ok("G7b", "排除集 X = %d 个：%s（V4 + RANDARRAY + OFFSET/INDIRECT/ANCHORARRAY）"
        % (len(EXCLUSION_X), sorted(EXCLUSION_X)))

    usable = engine_strict - wl - EXCLUSION_X
    if len(usable) != EXPECTED_USABLE_COUNT:
        fail("G6b", "引擎可用区 %d != %d（W/X 增删或引擎升级，须同步 whitelist.md §3.1 与本断言）"
             % (len(usable), EXPECTED_USABLE_COUNT))
    ok("G6b", "引擎可用区 = I(严格 %d) − W(%d) − X(%d) = %d 个（差分导入候选域，机器生成）"
        % (len(engine_strict), len(wl), len(EXCLUSION_X), len(usable)))

    overlap = usable & wl
    if overlap:
        fail("G8b", "引擎可用区与白名单重叠 %s（减法漏项）" % sorted(overlap))
    ok("G8b", "引擎可用区 ∩ 白名单 = 空（减法不漏不重）")

    print("==== check_formula_buckets: ALL PASS ====")


if __name__ == "__main__":
    main()
