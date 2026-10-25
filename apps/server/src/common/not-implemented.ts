/**
 * 骨架期「未实现」的唯一标记异常（P3-012-01）。
 *
 * 为什么不在骨架里给个「返回空对象」的假实现：空实现会一路静默流到运行期，
 * 表现为「配置全是 undefined 但服务照跑」——这比启动即崩更难查。抛一个带名字的
 * 异常，则「谁先接线谁先发现」，且 `grep -r NotImplementedError` 能一眼列出全部待实现面。
 *
 * 与业务错误码（`src/common/errors/`）无关：这是**开发期占位**，不进 `{code,message,detail}`
 * 错误体，也不该被异常过滤器转成 9001（它只在开发期出现，生产期不应有调用点）。
 */
export class NotImplementedError extends Error {
  /** 待实现项的名字（用「文件路径#符号」形式，便于 grep 定位）。 */
  readonly subject: string;

  constructor(subject: string) {
    super(`未实现：${subject}（P3-012 骨架期占位，见 ANCHORS §4）`);
    this.name = 'NotImplementedError';
    this.subject = subject;
  }
}
