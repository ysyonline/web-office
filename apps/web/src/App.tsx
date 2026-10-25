/**
 * 页面壳。结构两段：顶栏 + 表格宿主。
 *
 * V1.2.1 起表格区不再是占位 div，而是 Univer 的真实宿主（`SheetHost`）。
 * 本文件仍不感知引擎细节——挂载逻辑全在 `sheet/` 下，壳只负责布局。
 */
import { SheetHost } from './sheet/SheetHost';

export function App(): JSX.Element {
  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">协作表格</span>
        <span className="app-meta">本地演示</span>
      </header>
      <main className="app-main">
        <SheetHost />
      </main>
    </div>
  );
}
