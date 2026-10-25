import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './design/design-tokens.css';
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
