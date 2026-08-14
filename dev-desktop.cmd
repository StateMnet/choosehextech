@echo off
rem ChooseHextech 桌面端开发模式（无需 pnpm，直接用仓库内依赖启动）
rem 依赖已安装且 Electron 二进制已下载；数据包已生成于 dist\
cd /d "%~dp0apps\desktop"
node node_modules\electron-vite\bin\electron-vite.js dev %*
