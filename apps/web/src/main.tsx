import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './design/design-tokens.css';
/**
 * Univer 聚合样式（V1.2.1）。
 *
 * 引的是 `preset-sheets-core` 的自包含聚合产物（design / ui / sheets-ui 等的样式已合入），
 * 不要再单独引 `@univerjs/design/lib/index.css`——同一批类会重复定义、后者覆盖前者。
 * 顺序：自有令牌 → 引擎样式 → `app.css`，让壳样式最后加载，可覆盖引擎的通用 reset。
 *
 * 不引这条的典型症状是「表格挤成一团、列标行号丢失」，任务卡 §2 已列为最常见假失败。
 */
import '@univerjs/preset-sheets-core/lib/index.css';
import './app.css';
import { App } from './App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('挂载点 #root 不存在：检查 index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
