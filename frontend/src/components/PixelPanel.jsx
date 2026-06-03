import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import useSound from '../hooks/useSound';
import { getPixelState, setPixelState } from '../hooks/useWebSocket';

const GRID_SIZE = 16;
const PIXEL_COLORS = [
  '#4A3728', '#7BC7A5', '#F8D147', '#F38181',
  '#52734D', '#95E1D3', '#FFB3B3', '#A29BFE',
  '#FFFFFF', '#000000', '#FFD700', '#FF69B4',
];

// 构建完整的 pixelart shape（供 useCanvas 调用）
export function buildPixelShape(x, y) {
  const ps = getPixelState();
  let hex = '';
  for (let i = 0; i < ps.pixels.length; i++) {
    const val = ps.pixels[i] ? PIXEL_COLORS.indexOf(ps.pixels[i]) + 1 : 0;
    hex += val.toString(16).padStart(2, '0');
  }
  return {
    type: 'pixelart',
    pixels: hex,
    width: GRID_SIZE,
    height: GRID_SIZE,
    cellSize: 12,
    colors: PIXEL_COLORS,
    x, y,
    color: ps.color,
    width: 1,
  };
}

export default function PixelPanel() {
  const { sendMessage, updateAlert } = useAppContext();
  const { playPop } = useSound();
  const [pixels, setPixels] = useState(() => getPixelState().pixels);
  const [pixelColor, setPixelColor] = useState(() => getPixelState().color);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const eraseMode = useRef(false);

  const fillCell = useCallback((col, row, erase) => {
    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return;
    const idx = row * GRID_SIZE + col;
    // 同步更新 React state + 模块级 state
    setPixels(prev => {
      const next = [...prev];
      next[idx] = erase ? null : pixelColor;
      setPixelState({ pixels: next, color: pixelColor });
      return next;
    });
  }, [pixelColor]);

  // Canvas 渲染
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = 240;
    const cell = size / GRID_SIZE;
    canvas.width = size * 2; canvas.height = size * 2;
    canvas.style.width = `${size}px`; canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#FAF6EB';
    ctx.fillRect(0, 0, size, size);
    pixels.forEach((color, i) => {
      if (color) {
        const x = (i % GRID_SIZE) * cell;
        const y = Math.floor(i / GRID_SIZE) * cell;
        ctx.fillStyle = color;
        ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      }
    });
    ctx.strokeStyle = '#4A3728'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell); ctx.stroke();
    }
  }, [pixels]);

  function getCell(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cell = 240 / GRID_SIZE;
    return { col: Math.floor(x / cell), row: Math.floor(y / cell) };
  }

  function handleMouseDown(e) {
    e.preventDefault();
    isDrawing.current = true;
    eraseMode.current = e.button === 2 || e.ctrlKey;
    const { col, row } = getCell(e);
    fillCell(col, row, eraseMode.current);
    playPop();
  }
  function handleMouseMove(e) {
    if (!isDrawing.current) return;
    const { col, row } = getCell(e);
    fillCell(col, row, eraseMode.current);
  }
  function handleMouseUp() { isDrawing.current = false; }
  function handleContextMenu(e) { e.preventDefault(); }

  function changeColor(color) {
    setPixelColor(color);
    setPixelState({ pixels, color });
    playPop();
  }

  function handlePlace() {
    const shape = buildPixelShape(0, 0);
    if (sendMessage) {
      sendMessage({ type: 'add_shape', shape });
      updateAlert('🎨 像素画已放置到画布 (0,0)！');
      playPop();
    }
  }

  function handleClear() {
    const empty = Array(GRID_SIZE * GRID_SIZE).fill(null);
    setPixels(empty);
    setPixelState({ pixels: empty, color: pixelColor });
    playPop();
  }

  return (
    <div className="mt-2 flex-shrink-0">
      <div className="border-t-2 border-dashed border-[#4A3728]/20 pt-2">
        <h4 className="text-[10px] font-black text-[#7d5b3f] mb-1">🎨 像素画 ({GRID_SIZE}×{GRID_SIZE})</h4>
        <div className="flex justify-center mb-1.5">
          <canvas ref={canvasRef}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
            className="border-2 border-[#4A3728] rounded-lg cursor-crosshair"
          />
        </div>
        <div className="grid grid-cols-6 gap-1 mb-1.5">
          {PIXEL_COLORS.map((color) => (
            <button key={color} onClick={() => changeColor(color)}
              onMouseDown={(e) => e.preventDefault()}
              className={`w-7 h-7 rounded-lg border-2 transition-transform ${
                pixelColor === color ? 'border-[#4A3728] scale-110 ring-1 ring-[#4A3728]' : 'border-[#4A3728]/30'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={handleClear} onMouseDown={(e) => e.preventDefault()}
            className="flex-1 px-2 py-1 bg-white border-2 border-[#4A3728] rounded-lg text-[9px] font-black hover:bg-rose-50">
            🗑️ 清空
          </button>
          <button onClick={handlePlace} onMouseDown={(e) => e.preventDefault()}
            className="flex-1 px-2 py-1 bg-[#7BC7A5] border-2 border-[#4A3728] rounded-lg text-[9px] font-black text-white hover:bg-[#6ab392]">
            📍 放置
          </button>
        </div>
        <p className="text-[8px] text-[#7d5b3f]/50 mt-1 text-center">
          拖拽绘制 · 右键擦除
        </p>
      </div>
    </div>
  );
}
