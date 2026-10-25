/**
 * Univer 表格引擎挂载（V1.2.1）。
 *
 * 只做「把一个空工作簿挂进给定 DOM 容器、并给出销毁手段」这一件事。
 * 不含 React——组件侧只负责在 effect 里调 `mountSheet`、cleanup 里调 `dispose`。
 *
 * 两条设计取舍（实测依据见任务卡 V1.2.1 §2 订正段）：
 *
 * 1. **不配 `workerURL`**：preset 内部按 `useWorker = !!workerURL` 分流，不传时公式引擎
 *    走主线程（`notExecuteFormula: false`），公式照常计算；一旦传了 `workerURL` 却没同时
 *    把 `UniverSheetsCoreWorkerPreset` 起在 worker 里，公式反而会静默不算。
 *    当前是单表演示量级，主线程足够；worker 化等数据量或协同需求出现再做（归 V3）。
 *
 * 2. **`container` 传 HTMLElement 而非 id 字符串**：`bootstrap` 里字符串分支走
 *    `document.getElementById`，查不到时会 `createElement` 出一个游离节点（不 append），
 *    表现为「实例建成功、界面不出现」。传元素可绕开这条静默失败路径。
 */
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import zhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';

/** 挂载句柄：仅暴露销毁，避免业务代码持有 engine 内部实例。 */
export interface SheetHandle {
  dispose: () => void;
}

/**
 * 在 `container` 内创建并挂载一个空工作簿。
 *
 * 不传工作簿数据：`Workbook` 构造函数在 `sheets` 为空时会自动补一张默认工作表
 * （`_parseWorksheetSnapshots` 的 `isEmptyObject(sheets)` 分支），因此 `{}` 即「一张空表」。
 */
export function mountSheet(container: HTMLElement): SheetHandle {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.ZH_CN,
    locales: {
      [LocaleType.ZH_CN]: mergeLocales(zhCN),
    },
    presets: [UniverSheetsCorePreset({ container })],
  });

  univerAPI.createWorkbook({});

  return {
    dispose: () => {
      univer.dispose();
    },
  };
}
