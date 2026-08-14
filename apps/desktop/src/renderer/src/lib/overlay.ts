/** 渲染入口是否属于浮窗窗口（URL 带 overlay=1） */
export function isOverlayWindow(search: string): boolean {
  return search.includes('overlay=1');
}
