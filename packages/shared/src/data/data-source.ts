/**
 * 文档数据源接口（V2.1，D5 必做）。
 *
 * 定位：**业务层与存储层之间唯一的缝**。业务代码（React 组件、装配层）只认这个接口，
 * 不认 IndexedDB、不认 HTTP、不认 Univer 的快照类型。V2.2 换 IndexedDB、V3 换服务端
 * 或 Yjs，都只替换实现，接口签名不动。
 *
 * ## 为什么是泛型 `TDoc`
 *
 * 规则 H（`scripts/check-workspace-deps.mjs`）禁止 `@wo/shared` 源码引用 Univer——
 * **连 `import type` 都命中**，无豁免。因此本包**不可能**知道快照的具体形状；
 * 一旦把 `Partial<IWorkbookData>` 写进签名，规则 H 与规则 D 双双变红。
 *
 * 泛型化之后：shared 只描述「存取一份不透明文档」这件事，由消费方填实类型参数
 * （web 侧写 `DataSource<Partial<IWorkbookData>>`）。V3 服务端存同一份快照时，
 * 复用同一个接口而不必另立一套。
 *
 * 注：本段刻意不用代码块写出那条被禁的 import 原文——规则 H 扫的是**原始文本**，
 * 注释里的示例同样会命中（V2.1 落地时实测撞过一次）。
 *
 * ## 三个方法的语义边界（每条都有「不做什么」）
 *
 * - `load`：**只读不快照**。返回 `null` 表示「这份文档不存在」，与「读失败」严格区分——
 *   前者应降级为空白表（新文档的正常路径），后者应报错（数据可能损坏）。
 *   实现**不得**返回默认文档来掩盖缺失，否则「新文档」与「读失败」在调用方看来一样。
 * - `save`：**整体覆盖写**，不做字段级 merge。理由：合并语义需要知道文档结构，
 *   而接口刻意不知道（见上）。V3 的并发冲突必须靠版本号在更上层解决，不能靠这里猜。
 * - `subscribe`：**只通知「文档被改动」这一事实**，不描述改了什么。增量差异属于协同层
 *   （V3 的 Yjs update），硬塞进这个接口会让 V2 的 IndexedDB 实现承担它做不到的语义。
 *
 * ## 时间口径
 *
 * 所有时间戳都是 **epoch 毫秒（number）**，不是 `Date` 对象。理由：这个值要穿过
 * IndexedDB、JSON、HTTP 三种边界，`Date` 在 JSON 往返里会变字符串，是类型与运行时
 * 不一致的经典来源。用 number 则三处同形。
 */

/** 一次成功写入的结果。`savedAt` 供上层显示「已保存 hh:mm」与做节流判据。 */
export interface DataSourceWriteResult {
  /** 写入完成时刻（epoch ms） */
  savedAt: number;
  /** 本次写入的文档字节数估算，供上层显示体积；实现无法估算时省略 */
  bytes?: number;
}

/**
 * `subscribe` 推给监听方的事件。
 *
 * 刻意只有「整份文档 + 来源」两件事：见文件头「三个方法的语义边界」。
 */
export interface DataSourceChange<TDoc> {
  docId: string;
  /** 变更后的完整文档（已落盘形态，不是编辑中的草稿） */
  doc: TDoc;
  /**
   * 变更来源，供上层决定「要不要回灌编辑器」：
   * - `'local-save'`：本端刚保存成功——编辑器里已是新内容，**不要回灌**（回灌会打断输入）；
   * - `'remote'`：他端改动（V3 起才有）——需要回灌；
   * - `'external'`：非同标签页的外部写入（V2.2 IndexedDB 跨标签页场景）。
   */
  origin: 'local-save' | 'remote' | 'external';
  /** 变更时刻（epoch ms） */
  changedAt: number;
}

/** 取消订阅。返回值必须是幂等的——重复调用不得抛错。 */
export type DataSourceUnsubscribe = () => void;

/**
 * 文档数据源。实现方负责序列化，调用方只搬运 `TDoc`。
 *
 * @typeParam TDoc 文档快照类型。由消费方填实，shared 内不出现任何具体文档类型。
 */
export interface DataSource<TDoc> {
  /**
   * 读取文档。
   *
   * @returns 文档存在时返回快照；**不存在返回 `null`**（不是抛错、不是空文档）。
   * @throws 存储层故障（配额耗尽、反序列化失败、网络错误）时应抛出，由调用方降级。
   */
  load(docId: string): Promise<TDoc | null>;

  /**
   * 覆盖写入文档。
   *
   * 实现应保证「同一 docId 的并发 save 不会交错写坏」——最简单的做法是内部串行化
   * （V2.2 用单条 Promise 链）。接口不要求原子性跨多个 docId。
   */
  save(docId: string, doc: TDoc): Promise<DataSourceWriteResult>;

  /**
   * 订阅文档变更。
   *
   * 约定：
   * 1. 只推送 `save` 成功之后的变更，不推送「编辑中」的中间态；
   * 2. 本端 `save` 引起的事件也会推（`origin: 'local-save'`），由监听方按 origin 过滤——
   *    这样监听方不必自己记账「哪些是我写的」，代价小且不易漏。
   */
  subscribe(listener: (change: DataSourceChange<TDoc>) => void): DataSourceUnsubscribe;
}
