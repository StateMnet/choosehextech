import { useEffect, useRef, useState } from 'react';
import App from './App';

/**
 * 游戏内浮窗：游戏开始默认在屏幕左侧显示一个开关按钮，
 * 左键点击展开为与面板同款布局的浮窗；
 * 鼠标移出浮窗即自动收回为按钮（决策 #18 交互修订）。
 */
export default function OverlayApp() {
  const [expanded, setExpanded] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setMode = (next: 'collapsed' | 'expanded') => {
    setExpanded(next === 'expanded');
    window.choosehextech.setOverlayMode(next);
  };

  useEffect(() => {
    let mounted = true;
    const unsubscribe = window.choosehextech.onResetOverlayMode(() => {
      // 浮窗每次重新显示（如新开一局）都回到收起按钮状态
      setMode('collapsed');
    });
    return () => {
      mounted = false;
      unsubscribe();
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  if (!expanded) {
    return (
      <button
        className='overlay-collapsed'
        title='海克斯助手'
        onClick={() => setMode('expanded')}
      >
        ◀ 海克斯
      </button>
    );
  }

  return (
    <div
      className='overlay-shell'
      onMouseEnter={() => {
        if (leaveTimer.current) {
          clearTimeout(leaveTimer.current);
          leaveTimer.current = null;
        }
        window.choosehextech.setOverlayInteractive(true);
      }}
      onMouseLeave={() => {
        // 鼠标移出：恢复穿透，0.5 秒延迟后自动收回为左侧按钮（期间移回则取消）
        window.choosehextech.setOverlayInteractive(false);
        if (leaveTimer.current) clearTimeout(leaveTimer.current);
        leaveTimer.current = setTimeout(() => {
          leaveTimer.current = null;
          setMode('collapsed');
        }, 500);
      }}
    >
      <App variant='overlay' onCollapse={() => setMode('collapsed')} />
    </div>
  );
}
