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
 * 按 DESIGN.md FR1/FR2 决定各窗口显隐（决策 #7/#17）。
 * 面板：客户端连接后即显示（选人阶段自动定位当前英雄，其他阶段供搜索查询）；客户端未运行时仅可手动打开。
 * 浮窗：目标队列游戏中自动显示，或手动开关（热键）强制显示/隐藏；离开游戏自动隐藏。
 */
export function windowVisibilityFor(state: SessionState | null, input: WindowPolicyInput): WindowVisibility {
  if (!state) {
    return { panel: input.panelManuallyOpen, overlay: input.overlayManuallyOpen };
  }
  return {
    panel: true,
    overlay: input.overlayManuallyOpen || (input.overlayEnabled && state.isTargetMode && state.phase === 'InProgress'),
  };
}
