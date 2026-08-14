@echo off
rem ChooseHextech 桌面端构建（无需 pnpm）
cd /d "%~dp0apps\desktop"
node node_modules\electron-vite\bin\electron-vite.js build %*
