import { useRef, useEffect, useCallback } from 'react';
import { getHistoryList, getOtherDrawings, getCursors } from './useWebSocket';
import { drawStamp } from '../data/stamps';

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
    if (!shape.points || shape.points.length === 0) return;
    targetCtx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) {
      targetCtx.lineTo(shape.points[i].x, shape.points[i].y);
    }
    targetCtx.stroke();
  } else if (shape.type === 'rect') {
    targetCtx.rect(shape.x, shape.y, shape.w, shape.h);
    targetCtx.stroke();
  } else if (shape.type === 'circle') {
    targetCtx.arc(shape.cx, shape.cy, shape.r, 0, 2 * Math.PI);
    targetCtx.stroke();
  } else if (shape.type === 'stamp') {
    drawStamp(targetCtx, shape.stampId, shape.x, shape.y, shape.scale || 1.0, shape.color);
  } else if (shape.type === 'eraser') {
    if (!shape.points || shape.points.length === 0) return;
    targetCtx.save();
    targetCtx.globalCompositeOperation = 'destination-out';
    targetCtx.lineWidth = shape.width * 2;
    targetCtx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) {
      targetCtx.lineTo(shape.points[i].x, shape.points[i].y);
    }
    targetCtx.stroke();
    targetCtx.restore();
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
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Viewport state (mutable refs for 60fps render loop)
  const panX = useRef(0);
  const panY = useRef(0);
  const zoom = useRef(1.0);

  // Tool/brush refs (kept fresh via props)
  const currentToolRef = useRef(currentTool);
  const currentStampRef = useRef(currentStamp);
  const userIdRef = useRef(userId);
  const brushColorRef = useRef(brushColor);
  const brushWidthRef = useRef(brushWidth);
  const sendMessageRef = useRef(sendMessage);

  useEffect(() => { currentToolRef.current = currentTool; }, [currentTool]);
  useEffect(() => { currentStampRef.current = currentStamp; }, [currentStamp]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
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
    const sendMsg = sendMessageRef.current;
    if (!sendMsg) return;
    if (e.cancelable) e.preventDefault();

    const screenCoords = getCanvasCoords(e);
    lastMouseX.current = screenCoords.x;
    lastMouseY.current = screenCoords.y;

    const tool = currentToolRef.current;
    if (tool === 'hand' || isSpacePressed.current || e.button === 2) {
      isPanning.current = true;
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
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
    }
  }, [getCanvasCoords, screenToWorld, playPop, playSplat]);

  const onDrawMove = useCallback((e) => {
    if (e.cancelable) e.preventDefault();
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

    if (sendMsg && tool !== 'stamp') {
      sendMsg({ type: 'drawing', shape: activeDrawing.current });
    }
  }, [getCanvasCoords, screenToWorld]);

  const onDrawEnd = useCallback(() => {
    if (isPanning.current) {
      isPanning.current = false;
      if (canvasRef.current) {
        canvasRef.current.style.cursor =
          (currentToolRef.current === 'hand' || isSpacePressed.current) ? 'grab' : 'crosshair';
      }
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    // 印章在 mousedown/mousemove 时已即时发送，这里只收尾
    if (currentToolRef.current === 'stamp') {
      activeDrawing.current = null;
      return;
    }

    const sendMsg = sendMessageRef.current;
    const ad = activeDrawing.current;
    if (sendMsg && ad) {
      sendMsg({ type: 'add_shape', shape: ad });
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
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    }
  }, []);

  const onKeyUp = useCallback((e) => {
    if (e.code === 'Space') {
      isSpacePressed.current = false;
      if (canvasRef.current) {
        const tool = currentToolRef.current;
        canvasRef.current.style.cursor = tool === 'hand' ? 'grab' : 'crosshair';
      }
    }
  }, []);

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
    if (tool === 'hand') {
      canvasRef.current.style.cursor = 'grab';
    } else {
      canvasRef.current.style.cursor = isSpacePressed.current ? 'grab' : 'crosshair';
    }
  }, []);

  // Download image
  const downloadImage = useCallback((username) => {
    const history = getHistoryList();
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1920;
    tempCanvas.height = 1080;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.fillStyle = '#FAF6EB';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    tempCtx.fillStyle = '#cbd5e1';
    for (let x = 12; x < tempCanvas.width; x += 24) {
      for (let y = 12; y < tempCanvas.height; y += 24) {
        tempCtx.beginPath();
        tempCtx.arc(x, y, 1.5, 0, 2 * Math.PI);
        tempCtx.fill();
      }
    }

    tempCtx.save();
    tempCtx.translate(960, 540);
    history.forEach((entry) => {
      if (!entry.deleted && entry.shape) drawShape(tempCtx, entry.shape);
    });
    tempCtx.restore();

    tempCtx.fillStyle = '#4A3728';
    tempCtx.font = 'bold 32px sans-serif';
    tempCtx.fillText('🏡 CoDraw 无人岛无限全景沙画', 50, tempCanvas.height - 100);
    tempCtx.font = '24px sans-serif';
    tempCtx.fillText(`艺术家：${username}`, 50, tempCanvas.height - 50);

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

  return {
    canvasRef,
    containerRef,
    zoomIn,
    zoomOut,
    zoomReset,
    downloadImage,
    updateCursor,
  };
}
