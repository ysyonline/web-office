# ADR-002: 数据层采用 TypeORM + KingbaseES/openGauss（信创兼容优先）

## Status: Accepted (2026-10-21)

## Background

产品定位信创政企私有化，数据库必须在信创目录内。Prisma 官方不支持达梦/人大金仓/openGauss/OceanBase 且无计划支持。

## Decision

1. ORM 由初始倾向的 Prisma 改为 **TypeORM 0.3.x**——信创唯一可行路线（社区已有 dmdb/opengauss 方言适配）
2. 数据库主推 **KingbaseES V8 R6 / openGauss 5.x**（PG 血统，node-postgres 协议大部分可用，迁移成本最低）；达梦 DM8 次优先适配（dmdb 驱动已实证纯 JS、无原生编译链——npm v1.0.52452 实查，2026-10-21；PoC 一周验证，见 docs/db/dameng-poc-plan.md）；开发期可用本地 PostgreSQL 16 提速
3. **数据层硬约束**：禁用 PG 专有特性——JSON 一律 text 存字符串、无数组字段、无 JSONB/pgvector、禁用 ON CONFLICT/RETURNING、不建数据库层 FK、UUID 应用层生成降级 varchar(36)
4. CI 必须双跑 PostgreSQL 16 + KingbaseES 兼容用例
5. **国产库真机验证锚点（2026-10-21 外部评审分支 F 增补）**：CI 的 openGauss 替代不能替代金仓真机验证（PG 基线版本不同，绿不传递）——冻结 schema 分两层真机锚定：Phase 3 M1 脚手架期契约冒烟（10 表 DDL + repository CRUD + information_schema 反查，断言清单见 schema.md §7），Phase 4 交付前金仓全量回归；冒烟失败触发契约回溯（schema → Spec §6 → openapi → 本 ADR）。金仓进 CI 否决（license 人工获取不满足自动化前提）。TypeORM 0.3.x version() 解析静态核对结论：金仓版本串致 isGeneratedColumnsSupported 误判 false，但该 flag 零消费方、项目未用 generated columns/identity，无影响；TypeORM 自动 RETURNING 路径（@CreateDateColumn 触发）留 M1 真机断言。达梦 PoC 排金仓冒烟之后（主库契约验证优先于次优先适配）

## Consequences

- 正面：直接满足信创采购硬门槛，不需要后期痛苦迁移；KingbaseES 与 openGauss 双主推给客户留了选择
- 负面：TypeORM 迁移工具弱于 Prisma Migrate（需自建迁移脚本纪律）；工期 +1~2 周数据层适配；金仓 license 人工获取（3-5 工作日流程）构成 M1 冒烟排期外部依赖，申请须提前发起
- 开发体验妥协：无 pgvector 等 PG 高级特性（本项目不需要，影响可控）

## Related ADRs

ADR-001（协同架构）、ADR-003（Univer OSS 选型）
