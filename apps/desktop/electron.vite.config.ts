import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        // 工作区包以源码形式打入主进程 bundle（它们以 .ts 源码发布，不能运行时 require）
        exclude: ['@choosehextech/data-core', '@choosehextech/game-session', '@choosehextech/lcu-client'],
      }),
    ],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
  },
});
