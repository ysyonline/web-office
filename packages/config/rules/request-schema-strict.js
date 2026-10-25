/**
 * A-STRICT 判据 1 的 ESLint 规则（P3-011-05，D1-13 ④ A-STRICT 行）。
 *
 * 卡面原文：所有 request schema 为 `z.strictObject()` 或 `.strict()`；实现期以 ESLint
 * 自定义规则强制（request schema 裸 `z.object(` 即 error）。**本条是 strict 语义的
 * 唯一静态防线**——G1 对 strict 原理性盲区（toJSONSchema 产物字节级相同，见卡 ② 栏
 * 口径澄清表 strict 行）。
 *
 * 执法面（双面，规则内置 + preset files 圈定双重保证）：
 *  - `apps/**`——**任何**裸 `z.object(` 都报 error。派单断言原文「规则对 apps/ 内裸
 *    z.object( 报 error」；语义配合 V-S1（schema 单一落点）：apps 里复用 shared schema
 *    不受限，但新造 object schema 必须 strictObject（纵深防线，V-S1 本体归 P3-037）；
 *  - `packages/shared/src/schemas/**`（不含 `internal/`）——只在**变量名以 `Request`
 *    结尾的声明器内部**报 error（含嵌套 z.object：顶层 strictObject 挡不住嵌套层的
 *    静默剥离）。响应侧与 Error 域的裸 `z.object(` 不报——-03 裁决「响应侧收紧属契约
 *    变更」，13 处响应侧 + ErrorSchema 是合法存量，一刀切会全量误报。
 *
 * 不判的（防误伤）：
 *  - `.extend(` / `.pick(` / `.omit(` / `.partial(` 等派生链调用点——-03 实测 strictObject
 *    派生继承 strict 性，起点合法性由起点行保证；
 *  - `*.test.*` / `*.spec.*` 文件——测试夹具不在 strict 纪律内；
 *  - `internal/`——宽松度归 D1-13 ① 栏「目录即分类」；
 *  - 注释与字符串——AST 层判定天然豁免（字符串层面 grep 会误伤，这正是机检的意义）。
 */

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '契约 request schema 必须用 z.strictObject 起造（裸 z.object 静默剥离未知键，A-STRICT 唯一静态防线）',
    },
    schema: [],
    messages: {
      strict:
        '裸 z.object( 会静默剥离未知键（与契约 additionalProperties:false 语义不符，调用方无感知）——request schema（含嵌套层）必须用 z.strictObject( 起造（D1-13 A-STRICT）；非契约 schema 请放 schemas/internal/ 或改用 z.looseObject(。',
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(filename)) return {};

    // 统一成正斜杠再按段匹配；filename 可能是相对路径（RuleTester/Linter 直呼），
    // 不能要求 apps/ 前必须有分隔符。
    const norm = filename.replace(/\\/g, '/');
    const inSchemasDir =
      /(^|\/)packages\/shared\/src\/schemas\//.test(norm) && !/(^|\/)internal\//.test(norm);
    const inApps = /(^|\/)apps\//.test(norm);
    if (!inSchemasDir && !inApps) return {};

    /** callee 是否为裸 `z.object`（MemberExpression，object 标识符恰为 z）。 */
    function isBareZodObject(callee) {
      return (
        callee?.type === 'MemberExpression' &&
        !callee.computed &&
        callee.property?.name === 'object' &&
        callee.object?.type === 'Identifier' &&
        callee.object.name === 'z'
      );
    }

    /**
     * 调用点是否落在变量名以 `Request` 结尾的声明器内（含嵌套）。
     * schemas/ 面用命名约定区分请求侧与响应侧——22 个 schema 的请求侧全部 *Request
     * 命名（-03 机检名单），响应侧与 Error 域不以其结尾。
     */
    function insideRequestDeclarator(node) {
      for (let cur = node.parent; cur; cur = cur.parent) {
        if (
          cur.type === 'VariableDeclarator' &&
          cur.id?.type === 'Identifier' &&
          /Request$/.test(cur.id.name)
        ) {
          return true;
        }
      }
      return false;
    }

    return {
      CallExpression(node) {
        if (!isBareZodObject(node.callee)) return;
        // schemas/ 面只拦 *Request 声明器内（响应侧 z.object 是 -03 裁决的合法存量）；
        // apps/ 面任何裸起造都拦（schema 单一落点的纵深）。
        if (inSchemasDir && !insideRequestDeclarator(node)) return;
        context.report({ node, messageId: 'strict' });
      },
    };
  },
};

export default rule;
