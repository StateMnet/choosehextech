import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import { join } from 'node:path';
import { AppSession } from './app-session';
import { clampOpacity, loadConfig, saveConfig, type AppConfig } from './config';
import { loadDataBundle } from './data-loader';
import { windowVisibilityFor } from './policy';
import { HEXTECH_ARAM_QUEUE_IDS, type SessionState } from '@choosehextech/game-session';
import type { DataBundle } from '@choosehextech/data-core';

let panel: BrowserWindow | null = null;
let overlay: BrowserWindow | null = null;
let loadedBundle: DataBundle | null = null;
let session: AppSession | null = null;
let lastState: SessionState | null = null;
let manualPanelOpen = true;
let lastPanelVisible: boolean | null = null;
let manualOverlayVisible = false;
let lastOverlayVisible: boolean | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let config: AppConfig = { overlay: { opacity: 0.88 } };
const overlayEnabled = true; // M2：游戏内浮窗启用

const OVERLAY_TOGGLE_HOTKEY = 'Ctrl+Shift+H';
const OVERLAY_EXPANDED_SIZE = { width: 390, height: 640 };
const OVERLAY_COLLAPSED_SIZE = { width: 56, height: 150 };

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    manualPanelOpen = true;
    applyWindowPolicy();
  });

  app.whenReady().then(() => {
    config = loadConfig(join(app.getPath('appData'), 'ChooseHextech'));
    loadedBundle = resolveBundle();
    createPanel();
    createOverlay();
    createTray();
    registerIpc();
    registerHotkeys();
    session = new AppSession({ targetQueueIds: [...HEXTECH_ARAM_QUEUE_IDS], onState: handleSessionState });
    session.start();
    applyWindowPolicy();
  });
}

app.on('window-all-closed', () => {
  // 有托盘时常驻后台；无托盘（图标缺失）时退出
  if (!tray) app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  session?.stop();
});

function resolveBundle(): DataBundle | null {
  const appPath = app.getAppPath();
  const candidates = [
    process.env['CHOOSEHEXTECH_DATA_DIR'],
    join(appPath, 'dist'),
    join(appPath, '..', 'dist'),
    join(appPath, '..', '..', 'dist'),
    join(appPath, '..', '..', '..', 'dist'),
  ].filter((dir): dir is string => dir !== undefined && dir.length > 0);
  const loaded = loadDataBundle(candidates);
  if (loaded) console.log('[ChooseHextech] data bundle loaded: ' + loaded.path);
  else console.warn('[ChooseHextech] data bundle not found, run pnpm build:data first');
  return loaded?.bundle ?? null;
}

function createPanel(): void {
  panel = new BrowserWindow({
    width: 380,
    height: 620,
    show: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: '#0f1220',
    title: 'ChooseHextech 海克斯大乱斗助手',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    },
  });
  panel.on('close', (event) => {
    // 有托盘时关闭 = 隐藏到托盘；无托盘时直接退出
    if (tray && !isQuitting) {
      event.preventDefault();
      manualPanelOpen = false;
      applyWindowPolicy();
    }
  });
  panel.on('closed', () => {
    panel = null;
  });
  loadRendererInto(panel, '');
}

function createOverlay(): void {
  const workArea = screen.getPrimaryDisplay().workArea;
  const position = {
    x: config.overlay.x ?? 8,
    y: config.overlay.y ?? Math.round(workArea.y + (workArea.height - OVERLAY_COLLAPSED_SIZE.height) / 2),
  };
  overlay = new BrowserWindow({
    width: OVERLAY_COLLAPSED_SIZE.width,
    height: OVERLAY_COLLAPSED_SIZE.height,
    x: position.x,
    y: position.y,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(false, { forward: true }); // 收起状态：按钮可点击
  overlay.setOpacity(clampOpacity(config.overlay.opacity));
  overlay.on('moved', () => {
    if (!overlay || isQuitting) return;
    const [x, y] = overlay.getPosition();
    config.overlay.x = x;
    config.overlay.y = y;
    saveConfig(join(app.getPath('appData'), 'ChooseHextech'), config);
  });
  overlay.on('closed', () => {
    overlay = null;
  });
  loadRendererInto(overlay, '?overlay=1');
}

function loadRendererInto(target: BrowserWindow, search: string): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    void target.loadURL(process.env['ELECTRON_RENDERER_URL'] + search);
  } else {
    void target.loadFile(join(__dirname, '../renderer/index.html'), search ? { search } : undefined);
  }
}

function createTray(): void {
  try {
    const iconPath = join(__dirname, '../../resources/tray.png');
    const image = nativeImage.createFromPath(iconPath);
    if (image.isEmpty()) {
      console.warn('[ChooseHextech] tray icon not found: ' + iconPath + ' (run scripts/dev/gen-tray-icon.ts)');
      return;
    }
    const toggle = () => {
      manualPanelOpen = !manualPanelOpen;
      applyWindowPolicy();
    };
    tray = new Tray(image);
    tray.setToolTip('ChooseHextech 海克斯大乱斗助手');
    tray.on('click', toggle);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '显示/隐藏面板', click: toggle },
        { type: 'separator' },
        { label: '退出', click: () => app.quit() },
      ]),
    );
    console.log('[ChooseHextech] tray ready');
  } catch (error) {
    console.warn('[ChooseHextech] tray init failed:', error);
  }
}

function registerHotkeys(): void {
  const registered = globalShortcut.register(OVERLAY_TOGGLE_HOTKEY, () => {
    manualOverlayVisible = !manualOverlayVisible;
    applyWindowPolicy();
  });
  if (!registered) console.warn('[ChooseHextech] hotkey register failed (可能被占用): ' + OVERLAY_TOGGLE_HOTKEY);
  console.log('[ChooseHextech] hotkey: ' + OVERLAY_TOGGLE_HOTKEY + ' 完全隐藏/显示浮窗');
}

function applyWindowPolicy(): void {
  const visibility = windowVisibilityFor(lastState, {
    overlayEnabled,
    panelManuallyOpen: manualPanelOpen,
    overlayManuallyOpen: manualOverlayVisible,
  });
  if (panel && !panel.isDestroyed()) {
    if (visibility.panel && !panel.isVisible()) panel.show();
    else if (!visibility.panel && panel.isVisible()) panel.hide();
    if (lastPanelVisible !== visibility.panel) {
      lastPanelVisible = visibility.panel;
      console.log('[ChooseHextech] panel ' + (visibility.panel ? 'shown' : 'hidden'));
    }
  }
  if (overlay && !overlay.isDestroyed()) {
    if (visibility.overlay && !overlay.isVisible()) {
      overlay.showInactive();
      overlay.webContents.send('overlay:reset-mode'); // 每次重新显示都回到左侧按钮
    } else if (!visibility.overlay && overlay.isVisible()) overlay.hide();
    if (lastOverlayVisible !== visibility.overlay) {
      lastOverlayVisible = visibility.overlay;
      console.log('[ChooseHextech] overlay ' + (visibility.overlay ? 'shown' : 'hidden'));
    }
  }
}

function handleSessionState(state: SessionState | null): void {
  const wasInGame = lastState?.phase === 'InProgress';
  const nowInGame = state?.phase === 'InProgress';
  if (nowInGame !== wasInGame) {
    if (nowInGame) {
      // 进入游戏：主面板自动隐藏（决策 #22），浮窗接管；游戏结束后恢复显示
      manualPanelOpen = false;
    } else {
      // 游戏结束（或客户端断开）：恢复面板显示
      manualPanelOpen = true;
    }
  }
  lastState = state;
  applyWindowPolicy();
  for (const target of [panel, overlay]) {
    if (target && !target.isDestroyed()) {
      target.webContents.send('session-state', state);
    }
  }
}

function registerIpc(): void {
  ipcMain.handle('bundle:get', () => loadedBundle);
  ipcMain.handle('state:get', () => lastState);
  ipcMain.on('overlay:set-interactive', (_event, enabled: boolean) => {
    if (!overlay || overlay.isDestroyed()) return;
    overlay.setIgnoreMouseEvents(!enabled, { forward: true });
    overlay.setFocusable(Boolean(enabled));
  });
  ipcMain.on('overlay:set-mode', (_event, mode: string) => {
    if (!overlay || overlay.isDestroyed()) return;
    const [x, y] = overlay.getPosition();
    const workArea = screen.getDisplayMatching(overlay.getBounds()).workArea;
    const size = mode === 'expanded' ? OVERLAY_EXPANDED_SIZE : OVERLAY_COLLAPSED_SIZE;
    const clampedX = Math.min(Math.max(workArea.x, x), workArea.x + workArea.width - size.width);
    const clampedY = Math.min(Math.max(workArea.y, y), workArea.y + workArea.height - size.height);
    overlay.setBounds({ x: clampedX, y: clampedY, ...size });
    if (mode === 'expanded') {
      overlay.setIgnoreMouseEvents(true, { forward: true }); // 展开：默认穿透，悬停可交互
      overlay.setFocusable(false);
    } else {
      overlay.setIgnoreMouseEvents(false, { forward: true }); // 收起：按钮可点击
      overlay.setFocusable(false);
    }
  });
}
