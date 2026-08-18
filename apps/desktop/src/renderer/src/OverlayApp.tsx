import { useEffect, useRef, useState } from 'react';
import App from './App';

/**
 * 游戏内浮窗：游戏开始默认在屏幕右侧显示一个开关按钮，
 * 左键点击展开为与面板同款布局的浮窗；
 * 鼠标移出浮窗即自动收回为按钮（0.15 秒，期间移回则取消）。
 *
 * 展开态始终保留顶部表头（含「收回」按钮），内容区独立滚动；
 * App 组件常驻挂载（仅切换显隐），从而保留已选套路等内部状态。
 */
export default function OverlayApp() {
  const [expanded, setExpanded] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragState = useRef<{ lastX: number; lastY: number; moved: number } | null>(null);

  const setMode = (next: 'collapsed' | 'expanded') => {
    setExpanded(next === 'expanded');
    window.choosehextech.setOverlayMode(next);
  };

  // 收起按钮：按住拖动可自由移动窗口；移动量很小则视为点击展开
  const startCollapsedDrag = (event: React.MouseEvent<HTMLButtonElement>) => {
    dragState.current = { lastX: event.screenX, lastY: event.screenY, moved: 0 };
    const handleMove = (moveEvent: MouseEvent) => {
      const state = dragState.current;
      if (!state) return;
      const dx = moveEvent.screenX - state.lastX;
      const dy = moveEvent.screenY - state.lastY;
      state.moved += Math.abs(dx) + Math.abs(dy);
      state.lastX = moveEvent.screenX;
      state.lastY = moveEvent.screenY;
      if (dx !== 0 || dy !== 0) {
        window.choosehextech.dragOverlay(dx, dy);
      }
    };
    const handleUp = () => {
      const state = dragState.current;
      dragState.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      if (state && state.moved < 4) {
        setMode('expanded');
      }
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  useEffect(() => {
    const unsubscribe = window.choosehextech.onResetOverlayMode(() => {
      // 浮窗每次重新显示（如新开一局）都回到收起按钮状态
      setMode('collapsed');
    });
    return () => {
      unsubscribe();
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  return (
    <>
      <button
        className="overlay-collapsed"
        style={{ display: expanded ? 'none' : 'flex' }}
        title="按住可拖动，点击展开"
        onMouseDown={startCollapsedDrag}
      >
        ◀ 海克斯
      </button>

      <div
        className="overlay-shell"
        style={{ display: expanded ? 'flex' : 'none' }}
        onMouseEnter={() => {
          if (leaveTimer.current) {
            clearTimeout(leaveTimer.current);
            leaveTimer.current = null;
          }
          window.choosehextech.setOverlayInteractive(true);
        }}
        onMouseLeave={() => {
          // 鼠标移出：恢复穿透，0.15 秒延迟后自动收回为按钮（期间移回则取消）
          window.choosehextech.setOverlayInteractive(false);
          if (leaveTimer.current) clearTimeout(leaveTimer.current);
          leaveTimer.current = setTimeout(() => {
            leaveTimer.current = null;
            setMode('collapsed');
          }, 150);
        }}
      >
        <div className="overlay-header">
          <div className="overlay-title">
            <span className="overlay-drag">◇ 海克斯浮窗</span>
            <span className="overlay-subtitle">如果无法点击此窗口 切屏到此应用即可恢复</span>
          </div>
          <button className="overlay-btn" onClick={() => setMode('collapsed')}>
            ◀ 收回
          </button>
        </div>
        <div className="overlay-body">
          <App variant="overlay" />
        </div>
      </div>
    </>
  );
}
