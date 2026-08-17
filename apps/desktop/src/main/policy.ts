import type { SessionState } from '@choosehextech/game-session';

export interface WindowPolicyInput {
  /** 游戏内浮窗功能是否启用 */
  overlayEnabled: boolean;
  /** 用户是否手动要求打开面板 */
  panelManuallyOpen: boolean;
  /** 用户是否手动要求显示浮窗（热键开关） */
  overlayManuallyOpen: boolean;
}

export interface WindowVisibility {
  panel: boolean;
  overlay: boolean;
}

/**
 * 按 DESIGN.md FR1/FR2 决定各窗口显隐（决策 #7/#17/#22）。
 * 面板：显隐完全跟随用户手动开关（默认显示；点关闭/托盘切换即隐藏，任意阶段一致），
 *      游戏开始/结束不再自动改变面板状态。
 * 浮窗：目标队列游戏中自动显示，或手动开关（热键）强制显示/隐藏；离开游戏自动隐藏。
 */
export function windowVisibilityFor(state: SessionState | null, input: WindowPolicyInput): WindowVisibility {
  const inGame = state?.phase === 'InProgress';
  return {
    panel: input.panelManuallyOpen,
    overlay: input.overlayManuallyOpen || (input.overlayEnabled && Boolean(state?.isTargetMode) && inGame),
  };
}
