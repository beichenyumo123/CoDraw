// 模块级视口中心获取器（供 PixelPanel 等外部组件使用）
// 独立文件避免 useCanvas ↔ PixelPanel 循环依赖
let _getViewportCenter = null;

export function setViewportCenterGetter(getter) {
  _getViewportCenter = getter;
}

export function getViewportCenter() {
  return _getViewportCenter ? _getViewportCenter() : { x: 0, y: 0 };
}
