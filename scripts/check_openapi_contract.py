# -*- coding: utf-8 -*-
"""openapi.yaml 契约自检：解析 + 孤儿/悬空引用 + 7xxx 段 + BadRequest 挂载面。"""
import os
import re
import sys

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "docs", "api", "openapi.yaml")
raw = open(P, encoding="utf-8").read()
d = yaml.safe_load(raw)

srefs = set(re.findall(r"#/components/schemas/([A-Za-z0-9_]+)", raw))
schemas = set(d["components"]["schemas"].keys())
rrefs = set(re.findall(r"#/components/responses/([A-Za-z0-9_]+)", raw))
responses = set(d["components"]["responses"].keys())

orphan_s = sorted(schemas - srefs)
dangling = sorted((srefs | rrefs) - schemas - responses)
orphan_r = sorted(responses - rrefs)

codes = d["x-error-code-registry"]["codes"]
c7 = [k for k in codes if k.startswith("7")]

ops400 = []
ops_total = 0
ops_no400 = []  # (方法, 路径, 参数形态) —— v1.1 2026-10-22 二轮挑刺：原脚本只统计不判定，且只读 op 级
for path, item in d["paths"].items():
    pparams = item.get("parameters") or []  # path 级共享参数（有 6 个操作定义在这一层）
    for m, op in item.items():
        if m not in ("get", "post", "put", "patch", "delete"):
            continue
        ops_total += 1
        oparams = op.get("parameters") or []
        if "requestBody" in op:
            shape = "body"
        elif oparams:
            shape = "op-param"
        elif pparams:
            shape = "path-param"
        else:
            shape = "no-param"
        if "400" in (op.get("responses") or {}):
            ops400.append("%s %s" % (m.upper(), path))
        else:
            ops_no400.append((m.upper(), path, shape))

no_addprops = []
for name in ["LoginRequest", "RefreshRequest", "UserCreateRequest", "UserUpdateRequest",
             "SsoCallbackRequest", "SsoConfig", "FileCreateRequest", "FileRenameRequest",
             "ShareCreateRequest"]:
    s = d["components"]["schemas"].get(name)
    if s is None:
        no_addprops.append("%s: MISSING" % name)
    elif s.get("additionalProperties") is not False:
        no_addprops.append("%s: additionalProperties=%r" % (name, s.get("additionalProperties")))

print("YAML 解析: OK")
print("paths=%d schemas=%d responses=%d" % (len(d["paths"]), len(schemas), len(responses)))
print("7xxx 段: %s" % c7)
print("孤儿 schema: %s" % (orphan_s or "无"))
print("悬空 $ref  : %s" % (dangling or "无"))
print("孤儿 response: %s" % (orphan_r or "无"))
print("Request schema 缺 additionalProperties:false: %s" % (no_addprops or "无"))
print("挂 400 的操作 %d / 总操作 %d" % (len(ops400), ops_total))
print("SnapshotSaveRequest 是否已删除: %s" % ("SnapshotSaveRequest" not in schemas))
print("未挂 400 的操作及参数形态（%d 个）：" % len(ops_no400))
for m, p, s in ops_no400:
    print("  %-6s %-45s %s" % (m, p, s))
# 带参（body/op-param/path-param）但未挂 400 = 契约覆盖缺口，按 7004 语义应 FAIL。
# 2026-10-22 用户裁决「补挂」后，4 个 path 级参数端点
# （GET /users/{id}、DELETE /files/{id}、GET/POST /files/{id}/snapshot）已补挂，
# 带参未挂 400 归零，断言由此启用（v1.2）。P3-037 仍负责把本脚本接入 CI。
ops_bad400 = [x for x in ops_no400 if x[2] in ("body", "op-param", "path-param")]

bad = bool(orphan_s or dangling or orphan_r or no_addprops or len(c7) != 4
           or "SnapshotSaveRequest" in schemas or ops_bad400)
if ops_bad400:
    print("\nFAIL 带参未挂 400（%d 个）：" % len(ops_bad400))
    for m, p, s in ops_bad400:
        print("  %-6s %-45s %s" % (m, p, s))
sys.exit(1 if bad else 0)
