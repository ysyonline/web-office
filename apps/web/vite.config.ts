import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * 前端构建配置（SB-01 立前端）。
 *
 * 只做三件事：挂 React 插件、固定端口、产出 sourcemap。
 * V3.2 起多一件：把协同 WebSocket 代理到本地服务端（3100），让浏览器用同源相对地址
 * `/ws/collab/<docId>`——客户端代码里因此不需要写死主机端口。
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/ws/collab': {
        target: 'http://127.0.0.1:3100',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
