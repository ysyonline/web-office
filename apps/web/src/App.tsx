/**
 * 页面壳。结构两段：顶栏 + 表格宿主。
 *
 * V1.2.1 起表格区不再是占位 div，而是 Univer 的真实宿主（`SheetHost`）。
 * V3.2 起 `?collab=<docId>` 切到协同宿主（`CollabHost`）；不带参数时**仍是原来的 V2 路径**。
 * 本文件仍不感知引擎细节——挂载逻辑全在 `sheet/` 与 `collab/` 下，壳只负责布局。
 */
import { CollabHost, readCollabDocId } from './collab/CollabHost';
import { SheetHost } from './sheet/SheetHost';

export function App(): JSX.Element {
  const collabDocId = readCollabDocId();

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">协作表格</span>
        <span className="app-meta">
          {collabDocId === null ? '本地演示' : `协同 ${collabDocId}`}
        </span>
      </header>
      <main className="app-main">
        {collabDocId === null ? <SheetHost /> : <CollabHost docId={collabDocId} />}
      </main>
    </div>
  );
}
