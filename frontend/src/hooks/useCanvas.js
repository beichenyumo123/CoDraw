import { useRef, useEffect, useCallback } from 'react';
import { getHistoryList, getOtherDrawings, getCursors, getTypingUsers, getDreamShapes } from './useWebSocket';
import { drawStamp } from '../data/stamps';
import { buildPixelShape } from '../components/PixelPanel';
import { setViewportCenterGetter } from './viewportState';

// ==========================================
// 绘制单一世界坐标系下的图形
// ==========================================
function drawShape(targetCtx, shape) {
  if (!shape) return;
  targetCtx.beginPath();
  targetCtx.strokeStyle = shape.color;
  targetCtx.lineWidth = shape.width;
  targetCtx.lineCap = 'round';
  targetCtx.lineJoin = 'round';

  if (shape.type === 'pencil') {
    // 支持 delta 编码（压缩格式）
    if (shape.deltas && shape.start) {
      let cx = shape.start.x, cy = shape.start.y;
      targetCtx.moveTo(cx, cy);
      for (let i = 0; i < shape.deltas.length; i++) {
        cx += shape.deltas[i][0];
        cy += shape.deltas[i][1];
        targetCtx.lineTo(cx, cy);
      }
      targetCtx.stroke();
    } else if (shape.points && shape.points.length > 0) {
      targetCtx.moveTo(shape.points[0].x, shape.points[0].y);
      for (let i = 1; i < shape.points.length; i++) {
        targetCtx.lineTo(shape.points[i].x, shape.points[i].y);
      }
      targetCtx.stroke();
    } else {
      return;
    }
  } else if (shape.type === 'rect') {
    targetCtx.rect(shape.x, shape.y, shape.w, shape.h);
    targetCtx.stroke();
  } else if (shape.type === 'circle') {
    targetCtx.arc(shape.cx, shape.cy, shape.r, 0, 2 * Math.PI);
    targetCtx.stroke();
  } else if (shape.type === 'stamp') {
    drawStamp(targetCtx, shape.stampId, shape.x, shape.y, shape.scale || 1.0, shape.color);
  } else if (shape.type === 'pixelart') {
    // 像素画渲染：每像素 2 位 hex（00 = 透明，01-0c = 颜色索引）
    const pw = shape.width || 16;
    const ph = shape.height || 16;
    const cs = shape.cellSize || 12;
    const colors = shape.colors || [];
    const hex = shape.pixels || '';
    const total = pw * ph;
    for (let i = 0; i < total; i++) {
      const hi = i * 2;
      if (hi + 1 >= hex.length) break;
      const idx = parseInt(hex.substring(hi, hi + 2), 16);
      if (idx > 0 && idx <= colors.length) {
        const color = colors[idx - 1];
        const px = shape.x + (i % pw) * cs;
        const py = shape.y + Math.floor(i / pw) * cs;
        targetCtx.fillStyle = color;
        targetCtx.fillRect(px, py, cs, cs);
      }
    }
  } else if (shape.type === 'eraser') {
    if (!shape.points || shape.points.length === 0) return;
    // 用背景色覆盖（避免 destination-out 产生透明像素影响导出）
    targetCtx.strokeStyle = '#FAF6EB';
    targetCtx.lineWidth = shape.width * 2;
    targetCtx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) {
      targetCtx.lineTo(shape.points[i].x, shape.points[i].y);
    }
    targetCtx.stroke();
  }
}

function drawBubbleRect(drawingCtx, x, y, width, height, radius) {
  drawingCtx.beginPath();
  drawingCtx.moveTo(x + radius, y);
  drawingCtx.lineTo(x + width - radius, y);
  drawingCtx.quadraticCurveTo(x + width, y, x + width, y + radius);
  drawingCtx.lineTo(x + width, y + height - radius);
  drawingCtx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  drawingCtx.lineTo(x + radius, y + height);
  drawingCtx.quadraticCurveTo(x, y + height, x, y + height - radius);
  drawingCtx.lineTo(x, y + radius);
  drawingCtx.quadraticCurveTo(x, y, x + radius, y);
  drawingCtx.closePath();
  drawingCtx.fill();
}

export default function useCanvas({
  currentTool,
  currentStamp,
  userId,
  brushColor,
  brushWidth,
  sendMessage,
  playPop,
  playChirp,
  playSplat,
  onZoomChange,
  onAreaExport,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Viewport state (mutable refs for 60fps render loop)
  const panX = useRef(0);
  const panY = useRef(0);
  const zoom = useRef(1.0);

  // 暴露视口中心获取器供外部组件使用
  useEffect(() => {
    setViewportCenterGetter(() => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const w = canvas.width;
      const h = canvas.height;
      return {
        x: (w / 2 - panX.current) / zoom.current,
        y: (h / 2 - panY.current) / zoom.current,
      };
    });
    return () => { setViewportCenterGetter(null); };
  }, []);

  // Tool/brush refs (kept fresh via props)
  const currentToolRef = useRef(currentTool);
  const currentStampRef = useRef(currentStamp);
  const userIdRef = useRef(userId);
  const brushColorRef = useRef(brushColor);
  const brushWidthRef = useRef(brushWidth);
  const sendMessageRef = useRef(sendMessage);
  const onAreaExportRef = useRef(onAreaExport);

  useEffect(() => { currentToolRef.current = currentTool; }, [currentTool]);
  useEffect(() => { currentStampRef.current = currentStamp; }, [currentStamp]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { onAreaExportRef.current = onAreaExport; }, [onAreaExport]);
  useEffect(() => { brushColorRef.current = brushColor; }, [brushColor]);
  useEffect(() => { brushWidthRef.current = brushWidth; }, [brushWidth]);
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  // Drawing state
  const isSpacePressed = useRef(false);
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const activeDrawing = useRef(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const lastMouseX = useRef(0);
  const lastMouseY = useRef(0);
  const lastCursorSend = useRef(0);
  const lastStampX = useRef(0);
  const lastStampY = useRef(0);
  const lastViewportSend = useRef(0);
  const selectingArea = useRef(false); // 框选导出模式
  const areaStart = useRef({ x: 0, y: 0 });
  const areaEnd = useRef({ x: 0, y: 0 });

  // Get canvas-relative coordinates
  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  // Coordinate transforms
  const screenToWorld = useCallback((sx, sy) => ({
    x: (sx - panX.current) / zoom.current,
    y: (sy - panY.current) / zoom.current,
  }), []);

  const worldToScreen = useCallback((wx, wy) => ({
    x: wx * zoom.current + panX.current,
    y: wy * zoom.current + panY.current,
  }), []);

  // Resize canvas for Retina
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  // ========== Event Handlers ==========

  const onDrawStart = useCallback((e) => {
    if (e.cancelable) e.preventDefault();

    // 框选导出模式
    if (selectingArea.current) {
      const worldCoords = screenToWorld(getCanvasCoords(e).x, getCanvasCoords(e).y);
      areaStart.current = worldCoords;
      areaEnd.current = worldCoords;
      isDrawing.current = true; // 复用 isDrawing 标记
      return;
    }

    const sendMsg = sendMessageRef.current;
    if (!sendMsg) return;

    const screenCoords = getCanvasCoords(e);
    lastMouseX.current = screenCoords.x;
    lastMouseY.current = screenCoords.y;

    const tool = currentToolRef.current;
    if (tool === 'hand' || isSpacePressed.current || e.button === 2) {
      isPanning.current = true;
      if (canvasRef.current) canvasRef.current.style.cursor = 'var(--ac-grabbing)';
      if (playPop) playPop();
      return;
    }

    isDrawing.current = true;
    const worldCoords = screenToWorld(screenCoords.x, screenCoords.y);
    startX.current = worldCoords.x;
    startY.current = worldCoords.y;

    if (playSplat) playSplat();

    if (tool === 'pencil' || tool === 'eraser') {
      activeDrawing.current = {
        type: tool,
        points: [{ x: startX.current, y: startY.current }],
        color: tool === 'eraser' ? '#FAF6EB' : brushColorRef.current,
        width: brushWidthRef.current,
      };
    } else if (tool === 'rect') {
      activeDrawing.current = {
        type: 'rect',
        x: startX.current, y: startY.current,
        w: 0, h: 0,
        color: brushColorRef.current,
        width: brushWidthRef.current,
      };
    } else if (tool === 'circle') {
      activeDrawing.current = {
        type: 'circle',
        cx: startX.current, cy: startY.current,
        r: 0,
        color: brushColorRef.current,
        width: brushWidthRef.current,
      };
    } else if (tool === 'stamp') {
      // 印章 — 点击 + 拖拽均可连续放置
      const stampId = currentStampRef.current || 'leaf';
      activeDrawing.current = {
        type: 'stamp',
        stampId,
        x: startX.current,
        y: startY.current,
        scale: 1.0,
        color: brushColorRef.current,
        width: brushWidthRef.current,
      };
      // 发送第一枚
      const sendMsg = sendMessageRef.current;
      if (sendMsg) {
        sendMsg({ type: 'add_shape', shape: activeDrawing.current });
      }
      // 记录最后放置位置，用于拖拽时控制间隔
      lastStampX.current = startX.current;
      lastStampY.current = startY.current;
    } else if (tool === 'pixel') {
      // 像素画 — 点击即放置，使用 PixelPanel 的统一编码
      const shape = buildPixelShape(startX.current, startY.current);
      const sendMsg = sendMessageRef.current;
      if (sendMsg) {
        sendMsg({ type: 'add_shape', shape });
      }
      isDrawing.current = false;
    }
  }, [getCanvasCoords, screenToWorld, playPop, playSplat]);

  const onDrawMove = useCallback((e) => {
    if (e.cancelable) e.preventDefault();

    // 框选导出：更新选区终点
    if (selectingArea.current && isDrawing.current) {
      const worldCoords = screenToWorld(getCanvasCoords(e).x, getCanvasCoords(e).y);
      areaEnd.current = worldCoords;
      return;
    }

    const screenCoords = getCanvasCoords(e);

    // Panning
    if (isPanning.current) {
      const dx = screenCoords.x - lastMouseX.current;
      const dy = screenCoords.y - lastMouseY.current;
      panX.current += dx;
      panY.current += dy;
      lastMouseX.current = screenCoords.x;
      lastMouseY.current = screenCoords.y;
      return;
    }

    const worldCoords = screenToWorld(screenCoords.x, screenCoords.y);

    // Cursor broadcast (50ms throttle)
    const now = Date.now();
    const sendMsg = sendMessageRef.current;
    if (sendMsg && now - lastCursorSend.current > 50) {
      sendMsg({
        type: 'cursor_move',
        x: worldCoords.x,
        y: worldCoords.y,
      });
      lastCursorSend.current = now;
    }

    if (!isDrawing.current || !activeDrawing.current) return;

    const tool = currentToolRef.current;
    if (tool === 'pencil' || tool === 'eraser') {
      activeDrawing.current.points.push(worldCoords);
    } else if (tool === 'rect') {
      activeDrawing.current.w = worldCoords.x - startX.current;
      activeDrawing.current.h = worldCoords.y - startY.current;
    } else if (tool === 'circle') {
      const r = Math.sqrt(
        Math.pow(worldCoords.x - startX.current, 2) +
        Math.pow(worldCoords.y - startY.current, 2)
      );
      activeDrawing.current.cx = startX.current;
      activeDrawing.current.cy = startY.current;
      activeDrawing.current.r = Math.round(r);
    } else if (tool === 'stamp') {
      // 长按拖拽连续放置印章，间隔 35 世界单位
      const dx = worldCoords.x - lastStampX.current;
      const dy = worldCoords.y - lastStampY.current;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= 35 && sendMsg) {
        lastStampX.current = worldCoords.x;
        lastStampY.current = worldCoords.y;
        const stamp = {
          type: 'stamp',
          stampId: currentStampRef.current || 'leaf',
          x: worldCoords.x,
          y: worldCoords.y,
          scale: 1.0,
          color: brushColorRef.current,
          width: brushWidthRef.current,
        };
        sendMsg({ type: 'add_shape', shape: stamp });
        // 更新 activeDrawing 用于本地预览
        activeDrawing.current = stamp;
      }
    }

    if (sendMsg && tool !== 'stamp' && tool !== 'pixel') {
      sendMsg({ type: 'drawing', shape: activeDrawing.current });
    }
  }, [getCanvasCoords, screenToWorld]);

  const onDrawEnd = useCallback(() => {
    // 框选导出完成
    if (selectingArea.current && isDrawing.current) {
      isDrawing.current = false;
      selectingArea.current = false;
      if (canvasRef.current) canvasRef.current.style.cursor = 'var(--ac-scissors)';
      const selW = Math.abs(areaEnd.current.x - areaStart.current.x);
      const selH = Math.abs(areaEnd.current.y - areaStart.current.y);
      if (selW > 5 && selH > 5) {
        if (onAreaExportRef.current) onAreaExportRef.current();
      }
      return;
    }

    if (isPanning.current) {
      isPanning.current = false;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = isSpacePressed.current ? 'var(--ac-hand)' : getToolCursor(currentToolRef.current);
      }
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    // 印章/像素画在 mousedown 时已发送，这里只收尾
    if (currentToolRef.current === 'stamp' || currentToolRef.current === 'pixel') {
      activeDrawing.current = null;
      return;
    }

    const sendMsg = sendMessageRef.current;
    const ad = activeDrawing.current;
    if (sendMsg && ad) {
      // Delta 编码：铅笔笔画压缩（第一点绝对坐标，后续为相对偏移）
      if (ad.type === 'pencil' && ad.points && ad.points.length > 1) {
        const start = ad.points[0];
        const deltas = [];
        for (let i = 1; i < ad.points.length; i++) {
          deltas.push([
            Math.round(ad.points[i].x - ad.points[i - 1].x),
            Math.round(ad.points[i].y - ad.points[i - 1].y),
          ]);
        }
        sendMsg({
          type: 'add_shape',
          shape: { type: 'pencil', start, deltas, color: ad.color, width: ad.width },
        });
      } else {
        sendMsg({ type: 'add_shape', shape: ad });
      }
      sendMsg({ type: 'drawing', shape: null });
    }
    activeDrawing.current = null;
  }, []);

  // Wheel zoom (Figma-style, anchored to cursor)
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const screenCoords = getCanvasCoords(e);

    const mouseWorldX = (screenCoords.x - panX.current) / zoom.current;
    const mouseWorldY = (screenCoords.y - panY.current) / zoom.current;

    if (e.deltaY < 0) {
      zoom.current = Math.min(zoom.current * zoomFactor, 8.0);
    } else {
      zoom.current = Math.max(zoom.current / zoomFactor, 0.15);
    }

    panX.current = screenCoords.x - mouseWorldX * zoom.current;
    panY.current = screenCoords.y - mouseWorldY * zoom.current;

    if (playSplat) playSplat();
    if (onZoomChange) onZoomChange(zoom.current);
  }, [getCanvasCoords, playSplat, onZoomChange]);

  // Keyboard handlers
  const onKeyDown = useCallback((e) => {
    if (e.code === 'Space') {
      // 防止触发已聚焦按钮的 click 事件
      e.preventDefault();
      e.stopPropagation();
      // 移除任意按钮的焦点，避免后续空格误触
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
        document.activeElement.blur();
      }
      isSpacePressed.current = true;
      if (canvasRef.current) canvasRef.current.style.cursor = 'var(--ac-hand)';
    }
  }, []);

  // 获取工具对应的 cursor 样式（必须在 onKeyUp 之前定义，避免 TDZ）
  const getToolCursor = useCallback((tool) => {
    const map = {
      pencil: 'var(--ac-pencil)',
      eraser: 'var(--ac-eraser)',
      hand: 'var(--ac-hand)',
      stamp: 'var(--ac-stamp)',
      pixel: 'var(--ac-pixel)',
      rect: 'var(--ac-crosshair)',
      circle: 'var(--ac-crosshair)',
    };
    return map[tool] || 'var(--ac-crosshair)';
  }, []);

  const onKeyUp = useCallback((e) => {
    if (e.code === 'Space') {
      isSpacePressed.current = false;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = getToolCursor(currentToolRef.current);
      }
    }
  }, [getToolCursor]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    zoom.current = Math.min(zoom.current * 1.2, 8.0);
    if (onZoomChange) onZoomChange(zoom.current);
    if (playPop) playPop();
  }, [onZoomChange, playPop]);

  const zoomOut = useCallback(() => {
    zoom.current = Math.max(zoom.current / 1.2, 0.15);
    if (onZoomChange) onZoomChange(zoom.current);
    if (playPop) playPop();
  }, [onZoomChange, playPop]);

  const zoomReset = useCallback(() => {
    panX.current = 0;
    panY.current = 0;
    zoom.current = 1.0;
    if (onZoomChange) onZoomChange(1.0);
    if (playChirp) playChirp();
  }, [onZoomChange, playChirp]);

  // Update cursor when tool changes
  const updateCursor = useCallback((tool) => {
    if (!canvasRef.current) return;
    if (isSpacePressed.current) {
      canvasRef.current.style.cursor = 'var(--ac-hand)';
    } else {
      canvasRef.current.style.cursor = getToolCursor(tool);
    }
  }, [getToolCursor]);

  // 动森风格相框 — 3 种风格，style: 0=经典 1=海洋 2=森林
  // 动森相框 — 只画边框+装饰，不填充内容区（内容已先画好）
  function drawFrame(ctx, w, h, username, style) {
    const FW = 48;
    const outerColors = ['#4A3728', '#2c5f7c', '#52734D'];

    // 四边外框条
    ctx.fillStyle = outerColors[style];
    ctx.fillRect(0, 0, w, FW);               // 上
    ctx.fillRect(0, h - FW, w, FW);           // 下
    ctx.fillRect(0, FW, FW, h - FW * 2);      // 左
    ctx.fillRect(w - FW, FW, FW, h - FW * 2); // 右

    // 内边细线
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(FW, FW, w - FW * 2, h - FW * 2);

    // 顶部装饰（画在边框区域内）
    if (style === 0) {
      const grad = ctx.createLinearGradient(FW, 0, w - FW, FW);
      grad.addColorStop(0, '#F8D147');
      grad.addColorStop(0.5, '#7BC7A5');
      grad.addColorStop(1, '#F38181');
      ctx.fillStyle = grad;
      ctx.fillRect(FW, FW - 10, w - FW * 2, 10);
    } else if (style === 1) {
      ctx.fillStyle = '#7BC7A5';
      for (let wx = FW; wx < w - FW; wx += 40) {
        ctx.beginPath();
        ctx.arc(wx + 20, FW - 2, 12, Math.PI, 0);
        ctx.fill();
      }
    } else {
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      for (let lx = FW + 40; lx < w - FW; lx += 60) {
        ctx.fillText('🌿', lx, FW - 6);
      }
    }

    // 四角铆钉
    [
      [FW + 20, FW + 20], [w - FW - 20, FW + 20],
      [FW + 20, h - FW - 20], [w - FW - 20, h - FW - 20],
    ].forEach(([dx, dy]) => {
      ctx.fillStyle = outerColors[style];
      ctx.beginPath();
      ctx.arc(dx, dy, 5.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(dx - 1.5, dy - 1.5, 2, 0, 2 * Math.PI);
      ctx.fill();
    });

    // 底部签名（在边框区域）
    const sigY = h - FW + 20;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "ZCOOL KuaiLe", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    const titles = ['🏡 CoDraw 无人岛沙画', '🌊 CoDraw 海洋奇缘', '🌲 CoDraw 森林密语'];
    ctx.fillText(titles[style], w / 2, sigY);
    ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(`艺术家：${username}  ·  ${new Date().toLocaleDateString('zh-CN')}`, w / 2, sigY + 20);

    // 角落小装饰
    const corners = [['🍃', '🍃'], ['🐚', '🦀'], ['🍄', '🌰']];
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(corners[style][0], FW + 12, FW + 40);
    ctx.textAlign = 'right';
    ctx.fillText(corners[style][1], w - FW - 12, h - FW - 6);
  }

  // Download image — 全景：内容缩放到相框内部，不遮挡
  const downloadImage = useCallback((username, frameStyle = 0) => {
    const FW = 48; // 相框宽度
    const history = getHistoryList();
    const activeShapes = history.filter(e => !e.deleted && e.shape);

    // 计算包围盒
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    activeShapes.forEach(({ shape }) => {
      const pts = [];
      if (shape.type === 'pencil' || shape.type === 'eraser') {
        if (shape.points) shape.points.forEach(p => pts.push(p));
      } else if (shape.type === 'stamp') {
        pts.push({ x: shape.x, y: shape.y });
      } else if (shape.type === 'rect') {
        pts.push({ x: shape.x, y: shape.y });
        pts.push({ x: shape.x + shape.w, y: shape.y + shape.h });
      } else if (shape.type === 'circle') {
        pts.push({ x: shape.cx - shape.r, y: shape.cy - shape.r });
        pts.push({ x: shape.cx + shape.r, y: shape.cy + shape.r });
      }
      pts.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });

    if (!isFinite(minX)) { minX = -960; minY = -540; maxX = 960; maxY = 540; }
    const pad = 60;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const worldW = maxX - minX;
    const worldH = maxY - minY;

    const outW = 1920;
    const outH = 1080;
    // 内容区域（相框内部）
    const innerW = outW - FW * 2;
    const innerH = outH - FW * 2;
    const scale = Math.min(innerW / worldW, innerH / worldH);
    const offsetX = FW + (innerW - worldW * scale) / 2;
    const offsetY = FW + (innerH - worldH * scale) / 2;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = outW;
    tempCanvas.height = outH;
    const tempCtx = tempCanvas.getContext('2d');

    // 1. 整画布背景（外框色）
    const frameColors = ['#4A3728', '#2c5f7c', '#52734D'];
    tempCtx.fillStyle = frameColors[frameStyle];
    tempCtx.fillRect(0, 0, outW, outH);

    // 2. 内容区背景
    tempCtx.fillStyle = '#FAF6EB';
    tempCtx.fillRect(FW, FW, innerW, innerH);

    // 3. 网格点
    const gridSpacing = 30;
    tempCtx.fillStyle = '#cbd5e1';
    const gx0 = Math.floor(minX / gridSpacing) * gridSpacing;
    const gy0 = Math.floor(minY / gridSpacing) * gridSpacing;
    for (let gx = gx0; gx <= maxX; gx += gridSpacing) {
      for (let gy = gy0; gy <= maxY; gy += gridSpacing) {
        tempCtx.beginPath();
        tempCtx.arc(offsetX + (gx - minX) * scale, offsetY + (gy - minY) * scale, 1.5, 0, 2 * Math.PI);
        tempCtx.fill();
      }
    }

    // 4. 图形
    tempCtx.save();
    tempCtx.translate(offsetX - minX * scale, offsetY - minY * scale);
    tempCtx.scale(scale, scale);
    activeShapes.forEach(({ shape }) => drawShape(tempCtx, shape));
    tempCtx.restore();

    // 5. 相框装饰（边框条 + 铆钉 + 签名，只画边缘不覆盖内容）
    drawFrame(tempCtx, outW, outH, username, frameStyle);

    if (playPop) playPop();
    const dataUrl = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `CoDraw_全景沙画展_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [playPop]);

  // ===== Render Loop =====
  useEffect(() => {
    let animFrameId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function renderLoop() {
      const w = canvas.width / 2;
      const h = canvas.height / 2;

      ctx.clearRect(0, 0, w, h);

      // Grid dots
      const gridSpacing = 30;
      ctx.save();
      ctx.fillStyle = '#cbd5e1';

      const leftWorld = -panX.current / zoom.current;
      const topWorld = -panY.current / zoom.current;
      const rightWorld = (w - panX.current) / zoom.current;
      const bottomWorld = (h - panY.current) / zoom.current;

      const startGridX = Math.floor(leftWorld / gridSpacing) * gridSpacing;
      const endGridX = Math.ceil(rightWorld / gridSpacing) * gridSpacing;
      const startGridY = Math.floor(topWorld / gridSpacing) * gridSpacing;
      const endGridY = Math.ceil(bottomWorld / gridSpacing) * gridSpacing;

      ctx.save();
      ctx.translate(panX.current, panY.current);
      ctx.scale(zoom.current, zoom.current);

      if (zoom.current > 0.15) {
        for (let x = startGridX; x <= endGridX; x += gridSpacing) {
          for (let y = startGridY; y <= endGridY; y += gridSpacing) {
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      }

      // History shapes — skip deleted (user-specific undo)
      const history = getHistoryList();
      history.forEach((entry) => {
        if (!entry.deleted && entry.shape) drawShape(ctx, entry.shape);
      });

      // Other users' in-progress drawings (dashed)
      const drawings = getOtherDrawings();
      Object.values(drawings).forEach((d) => {
        if (d && d.shape) {
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.setLineDash([5, 5]);
          drawShape(ctx, d.shape);
          ctx.restore();
        }
      });

      // My active drawing
      if (activeDrawing.current) {
        drawShape(ctx, activeDrawing.current);
      }

      // Dream shapes overlay (梦境叠加层 — 半透明紫色调)
      const dreams = getDreamShapes();
      if (dreams.length > 0) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        dreams.forEach(({ shape }) => {
          if (shape) drawShape(ctx, shape);
        });
        ctx.restore();
        // 梦境边界提示
        ctx.save();
        ctx.setLineDash([15, 10]);
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
        ctx.lineWidth = 3 / zoom.current;
        ctx.strokeRect(-5000, -5000, 10000, 10000);
        ctx.restore();
      }

      // 框选导出：绘制选区矩形
      if (selectingArea.current && isDrawing.current) {
        const ax = Math.min(areaStart.current.x, areaEnd.current.x);
        const ay = Math.min(areaStart.current.y, areaEnd.current.y);
        const aw = Math.abs(areaEnd.current.x - areaStart.current.x);
        const ah = Math.abs(areaEnd.current.y - areaStart.current.y);
        ctx.save();
        ctx.setLineDash([8, 4]);
        ctx.strokeStyle = '#4A3728';
        ctx.lineWidth = 2 / zoom.current;
        ctx.strokeRect(ax, ay, aw, ah);
        ctx.fillStyle = 'rgba(123, 199, 165, 0.15)';
        ctx.fillRect(ax, ay, aw, ah);
        ctx.restore();
      }

      ctx.restore(); // undo translate+scale
      ctx.restore();

      // Other users' cursors (screen-space) — skip own
      const cursorsMap = getCursors();
      const myId = userIdRef.current;
      Object.values(cursorsMap).forEach((cursor) => {
        if (cursor.userId === myId) return;
        if (Date.now() - cursor.lastUpdate > 5000) return;

        const sp = {
          x: cursor.x * zoom.current + panX.current,
          y: cursor.y * zoom.current + panY.current,
        };

        ctx.save();
        ctx.fillStyle = cursor.color;
        ctx.strokeStyle = '#4A3728';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 16, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cursor.avatar, sp.x, sp.y);

        ctx.font = 'bold 11px sans-serif';
        const textWidth = ctx.measureText(cursor.username).width;
        const rx = sp.x - (textWidth + 12) / 2;
        const ry = sp.y + 20;
        const rw = textWidth + 12;
        const rh = 20;

        ctx.fillStyle = '#4A3728';
        drawBubbleRect(ctx, rx, ry, rw, rh, 6);

        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(cursor.username, rx + 6, ry + 13);
        ctx.restore();
      });

      // Typing bubbles — show "..." above typing users' cursors
      const typingMap = getTypingUsers();
      const now = Date.now();
      Object.entries(typingMap).forEach(([uid, info]) => {
        if (now > info.expiresAt) return; // expired
        const cursor = cursorsMap[uid];
        if (!cursor) return; // no recent cursor position
        const sp = {
          x: cursor.x * zoom.current + panX.current,
          y: cursor.y * zoom.current + panY.current,
        };
        ctx.save();
        // Bubble background
        const bubbleW = 28;
        const bubbleH = 16;
        const bx = sp.x - bubbleW / 2;
        const by = sp.y - 40;
        ctx.fillStyle = '#FAF6EB';
        ctx.strokeStyle = '#4A3728';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + 6, by);
        ctx.lineTo(bx + bubbleW - 6, by);
        ctx.quadraticCurveTo(bx + bubbleW, by, bx + bubbleW, by + 6);
        ctx.lineTo(bx + bubbleW, by + bubbleH - 6);
        ctx.quadraticCurveTo(bx + bubbleW, by + bubbleH, bx + bubbleW - 6, by + bubbleH);
        ctx.lineTo(bx + 6, by + bubbleH);
        ctx.quadraticCurveTo(bx, by + bubbleH, bx, by + bubbleH - 6);
        ctx.lineTo(bx, by + 6);
        ctx.quadraticCurveTo(bx, by, bx + 6, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // "..." text
        ctx.fillStyle = '#4A3728';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('...', sp.x, by + bubbleH / 2);
        ctx.restore();
      });

      // AOI viewport sync (every 2s)
      const sendMsg = sendMessageRef.current;
      if (sendMsg && Date.now() - lastViewportSend.current > 2000) {
        const w = canvas.width / 2;
        const h = canvas.height / 2;
        const leftWorld = -panX.current / zoom.current;
        const topWorld = -panY.current / zoom.current;
        const rightWorld = (w - panX.current) / zoom.current;
        const bottomWorld = (h - panY.current) / zoom.current;
        sendMsg({
          type: 'viewport_update',
          xmin: leftWorld, ymin: topWorld,
          xmax: rightWorld, ymax: bottomWorld,
        });
        lastViewportSend.current = now;
      }

      animFrameId = requestAnimationFrame(renderLoop);
    }

    animFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animFrameId);
  }, []); // runs once, reads mutable refs

  // Attach event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', onDrawStart);
    canvas.addEventListener('mousemove', onDrawMove);
    window.addEventListener('mouseup', onDrawEnd);
    canvas.addEventListener('touchstart', onDrawStart, { passive: false });
    canvas.addEventListener('touchmove', onDrawMove, { passive: false });
    window.addEventListener('touchend', onDrawEnd);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', resizeCanvas);

    resizeCanvas();

    return () => {
      canvas.removeEventListener('mousedown', onDrawStart);
      canvas.removeEventListener('mousemove', onDrawMove);
      window.removeEventListener('mouseup', onDrawEnd);
      canvas.removeEventListener('touchstart', onDrawStart);
      canvas.removeEventListener('touchmove', onDrawMove);
      window.removeEventListener('touchend', onDrawEnd);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [onDrawStart, onDrawMove, onDrawEnd, onWheel, onKeyDown, onKeyUp, resizeCanvas]);

  // Observe container size changes — debounce to avoid canvas flicker
  // during CSS transitions (e.g. phone collapse 300ms animation).
  // Each canvas.width/height assignment CLEARS the canvas, so we must
  // only resize once at the END of the transition, not every frame.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let debounceTimer = null;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        resizeCanvas();
        debounceTimer = null;
      }, 80);
    });
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      if (debounceTimer !== null) clearTimeout(debounceTimer);
    };
  }, [resizeCanvas]);

  // 框选导出：进入选择模式
  const startAreaExport = useCallback(() => {
    selectingArea.current = true;
    if (canvasRef.current) canvasRef.current.style.cursor = 'var(--ac-scissors)';
    if (playPop) playPop();
  }, [playPop]);

  // 框选导出：渲染选中区域
  const exportArea = useCallback((username, frameStyle = 0) => {
    const FW = 48;
    const history = getHistoryList();
    const x1 = Math.min(areaStart.current.x, areaEnd.current.x);
    const y1 = Math.min(areaStart.current.y, areaEnd.current.y);
    const x2 = Math.max(areaStart.current.x, areaEnd.current.x);
    const y2 = Math.max(areaStart.current.y, areaEnd.current.y);
    const selW = x2 - x1;
    const selH = y2 - y1;
    if (selW < 5 || selH < 5) return;

    const maxW = 1920 - FW * 2;
    const maxH = 1080 - FW * 2;
    const scale = Math.min(maxW / selW, maxH / selH, 4);
    const innerW = Math.round(selW * scale);
    const innerH = Math.round(selH * scale);
    const outW = innerW + FW * 2;
    const outH = innerH + FW * 2;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = outW;
    tempCanvas.height = outH;
    const tempCtx = tempCanvas.getContext('2d');

    // 1. 外框背景
    const frameColors = ['#4A3728', '#2c5f7c', '#52734D'];
    tempCtx.fillStyle = frameColors[frameStyle];
    tempCtx.fillRect(0, 0, outW, outH);

    // 2. 内容区背景
    tempCtx.fillStyle = '#FAF6EB';
    tempCtx.fillRect(FW, FW, innerW, innerH);

    // 3. 网格点
    const gridSpacing = 30;
    tempCtx.fillStyle = '#cbd5e1';
    const gx0 = Math.floor(x1 / gridSpacing) * gridSpacing;
    const gy0 = Math.floor(y1 / gridSpacing) * gridSpacing;
    for (let gx = gx0; gx <= x2; gx += gridSpacing) {
      for (let gy = gy0; gy <= y2; gy += gridSpacing) {
        tempCtx.beginPath();
        tempCtx.arc(FW + (gx - x1) * scale, FW + (gy - y1) * scale, 1, 0, 2 * Math.PI);
        tempCtx.fill();
      }
    }

    // 4. 图形
    tempCtx.save();
    tempCtx.translate(FW - x1 * scale, FW - y1 * scale);
    tempCtx.scale(scale, scale);
    history.forEach((entry) => {
      if (!entry.deleted && entry.shape) drawShape(tempCtx, entry.shape);
    });
    tempCtx.restore();

    // 5. 相框装饰
    drawFrame(tempCtx, outW, outH, username, frameStyle);

    if (playPop) playPop();
    const dataUrl = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `CoDraw_框选沙画_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [playPop]);

  return {
    canvasRef,
    containerRef,
    zoomIn,
    zoomOut,
    zoomReset,
    downloadImage,
    startAreaExport,
    exportArea,
    updateCursor,
  };
}
