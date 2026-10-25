/**
 * RuleTester 用例：request-schema-strict（P3-011-05）。
 *
 * 断言方向双向（同 no-emoji.test.mjs 纪律）：
 *  - valid 段证明「合法写法不报错」——防规则恒真误伤响应侧/派生链/internal/测试文件；
 *  - invalid 段证明「裸 z.object( 确实逐处报 error」——apps 面与 schemas/ 面各覆盖。
 *
 * filename 模拟执法面：规则按文件路径分流（apps/** 全拦；schemas/** 只拦 *Request
 * 声明器内），RuleTester 的 flat 形态允许每条用例带 filename。
 */
import { RuleTester } from 'eslint';
import rule from './request-schema-strict.js';

const ruleTester = new RuleTester({
  // 两个坑（实测）：① flat config 无 files 段时默认只匹配 *.js/mjs/cjs，.ts 用例文件名
  // 落空「No matching configuration」；② files 写 '**/*' 会被 ESLint 9 当目录语义同样落空——
  // 必须写带扩展名的显式模式。
  files: ['**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}'],
  languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
});

ruleTester.run('request-schema-strict', rule, {
  valid: [
    // ── schemas/ 面 ──────────────────────────────────────────────────────────
    // 响应侧裸 z.object 合法（-03 裁决：响应侧收紧属契约变更）
    {
      filename: 'packages/shared/src/schemas/auth.ts',
      code: 'export const LoginResponse = z.object({ accessToken: z.string().optional() });',
    },
    // Error 域裸 z.object 合法（ErrorSchema 是响应侧存量）
    {
      filename: 'packages/shared/src/schemas/error.ts',
      code: 'export const ErrorSchema = z.object({ code: z.number().int() });',
    },
    // 请求侧 strictObject 起造（-03 的 22 个契约 schema 的请求侧写法）
    {
      filename: 'packages/shared/src/schemas/auth.ts',
      code: 'export const LoginRequest = z.strictObject({ username: z.string() });',
    },
    // 派生链调用点不报：strictObject 派生继承 strict 性（卡 v1.8 补）
    {
      filename: 'packages/shared/src/schemas/users.ts',
      code:
        'const Base = z.strictObject({ a: z.string() });\n' +
        'export const UserUpdateRequest = Base.extend({ b: z.number() });\n' +
        'export const Picked = Base.pick({ a: true });\n' +
        'export const Partialized = Base.partial();',
    },
    // internal/ 豁免（目录即分类，宽松度归 D1-13 ① 栏）
    {
      filename: 'packages/shared/src/schemas/internal/helper.ts',
      code: 'export const Loose = z.object({});',
    },
    // 注释与字符串不误伤（AST 判定 vs 字符串 grep 的差异）
    {
      filename: 'packages/shared/src/schemas/auth.ts',
      code: "// z.object( 出现在注释里不报\nconst hint = '请改用 z.strictObject(';",
    },
    // ── apps/ 面 ─────────────────────────────────────────────────────────────
    // apps 内 strictObject 起造合法
    {
      filename: 'apps/server/src/common/local-schema.ts',
      code: 'export const LocalDto = z.strictObject({ name: z.string() });',
    },
    // 测试文件豁免（规则内部豁免 + preset ignores 双重保证）
    {
      filename: 'apps/server/src/common/local-schema.spec.ts',
      code: 'const A = z.object({});',
    },
    // 规则启用面之外（packages/web 等非 apps/ 非 schemas/ 路径）不报
    {
      filename: 'packages/config/eslint-preset.js',
      code: 'const A = z.object({});',
    },
  ],

  invalid: [
    // apps 面裸 z.object 起造 → error（派单断言原文）
    {
      filename: 'apps/server/src/common/local-schema.ts',
      code: 'export const LocalDto = z.object({ name: z.string() });',
      errors: [{ messageId: 'strict' }],
    },
    // 逐处报：两处裸起造报两次（防「只报首处」的偷懒实现）
    {
      filename: 'apps/server/src/common/local-schema.ts',
      code: 'const A = z.object({ a: z.string() });\nconst B = z.object({ b: z.number() });',
      errors: [{ messageId: 'strict' }, { messageId: 'strict' }],
    },
    // schemas/ 面：*Request 声明器内裸起造 → error（A-STRICT 主判据）
    {
      filename: 'packages/shared/src/schemas/auth.ts',
      code: 'export const LoginRequest = z.object({ username: z.string() });',
      errors: [{ messageId: 'strict' }],
    },
    // schemas/ 面：请求 schema 内嵌裸 z.object → error（顶层 strict 挡不住嵌套层剥离）
    {
      filename: 'packages/shared/src/schemas/sso.ts',
      code: 'export const SsoCallbackRequest = z.strictObject({ meta: z.object({ a: z.string() }) });',
      errors: [{ messageId: 'strict' }],
    },
  ],
});
