/**
 * 页面壳（SB-01）。结构只有两段：顶栏 + 表格占位区。
 *
 * 表格区现在是空 div，SB-02 把 Univer 实例挂进来；本文件不预埋任何引擎相关代码，
 * 以免 SB-02 变成「改壳」而不是「挂载」。
 */
export function App(): JSX.Element {
  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">协作表格</span>
        <span className="app-meta">本地演示</span>
      </header>
      <main className="app-main">
        <div className="sheet-slot">
          <p className="sheet-slot-hint">表格区域</p>
          <p className="sheet-slot-sub">SB-02 在此挂载引擎</p>
        </div>
      </main>
    </div>
  );
}
