import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * 前端构建配置（SB-01 立前端）。
 *
 * 只做三件事：挂 React 插件、固定端口、产出 sourcemap。
 * 代理、分包、环境变量注入都要等到有后端联调需求时再加（S3 起）。
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
