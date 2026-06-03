import { useState, useCallback, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import useCanvas from '../hooks/useCanvas';
import useSound from '../hooks/useSound';
import ZoomControls from './ZoomControls';

export default function InfiniteCanvas({ sendMessage, wsRef }) {
  const {
    currentTool, setCurrentTool,
    brushColor, brushWidth,
    username, updateAlert,
  } = useAppContext();

  const { playPop, playChirp, playSplat } = useSound();
  const [zoomDisplay, setZoomDisplay] = useState('100%');

  const handleZoomChange = useCallback((z) => {
    setZoomDisplay(`${Math.round(z * 100)}%`);
  }, []);

  const {
    canvasRef,
    containerRef,
    zoomIn,
    zoomOut,
    zoomReset,
    downloadImage,
    updateCursor,
  } = useCanvas({
    currentTool,
    brushColor,
    brushWidth,
    sendMessage,
    playPop,
    playChirp,
    playSplat,
    onZoomChange: handleZoomChange,
  });

  // Keep cursor in sync with tool changes
  useEffect(() => {
    updateCursor(currentTool);
  }, [currentTool, updateCursor]);

  function handleUndo() {
    if (sendMessage) {
      sendMessage({ type: 'undo' });
    }
  }

  function handleClear() {
    if (playChirp) playChirp();
    if (confirm('🌳 狸克警告：确定要清空所有人画的内容吗？这会抹除整张无限沙地！')) {
      if (sendMessage) {
        sendMessage({ type: 'clear' });
      }
    }
  }

  function handleDownload() {
    downloadImage(username);
  }

  function handleReset() {
    zoomReset();
    updateAlert('🌳 哔！已一键平移回无人岛中心坐标 (0,0) 的 1:1 视角！');
  }

  return (
    <section className="flex-1 flex flex-col gap-4 transition-all duration-300">
      <div className="bg-[#EAE4C9] border-[6px] border-[#4A3728] rounded-[2.5rem] p-4 shadow-[8px_8px_0px_0px_#4A3728] relative flex-1 flex flex-col justify-between">
        <div className="absolute -top-4 left-8 bg-[#FAF6EB] border-4 border-[#4A3728] px-4 py-1 rounded-xl font-bold text-xs shadow">
          🎨 Figma级 · 无限滚动沙画布
        </div>

        {/* Canvas container */}
        <div
          ref={containerRef}
          className="bg-[#FAF6EB] border-4 border-[#4A3728] rounded-[1.8rem] overflow-hidden relative flex-1 w-full min-h-[380px]"
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: currentTool === 'hand' ? 'grab' : 'crosshair' }}
          />

          <ZoomControls
            zoomDisplay={zoomDisplay}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomReset={handleReset}
          />

          {/* Keyboard shortcut tip */}
          <div className="absolute top-4 right-4 z-20 hidden md:block">
            <div className="kbd-tip px-3 py-1.5 rounded-xl font-bold text-[10px] flex items-center space-x-2 opacity-80 hover:opacity-100 transition-opacity">
              <span>按住 <kbd className="px-1.5 py-0.5 bg-white border border-[#4A3728] rounded">Space 空格键</kbd> + 鼠标左键拖拽平移</span>
              <span className="text-[#7d5b3f]">|</span>
              <span>鼠标滚轮缩放</span>
            </div>
          </div>
        </div>

        {/* Bottom action buttons */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex gap-2">
            <button
              onClick={handleUndo}
              className="ac-btn px-4 py-2 bg-white text-xs font-bold flex items-center space-x-1"
            >
              <span>↩️</span> <span>撤销画笔</span>
            </button>
            <button
              onClick={handleClear}
              className="ac-btn px-4 py-2 bg-rose-100 text-xs font-bold flex items-center space-x-1"
            >
              <span>🧹</span> <span>铲平画纸</span>
            </button>
          </div>
          <button
            onClick={handleDownload}
            className="ac-btn px-4 py-2.5 bg-[#F8D147] hover:bg-[#ebd05d] font-black text-xs flex items-center space-x-1"
          >
            <span>📸</span> <span>一键照相全景图 (以(0,0)为中心)</span>
          </button>
        </div>
      </div>

      {/* Color picker + brush width */}
      <div className="bg-[#FAF6EB] border-[6px] border-[#4A3728] rounded-[2rem] p-4 shadow-[6px_6px_0px_0px_#4A3728] grid grid-cols-1 md:grid-cols-12 gap-4 items-center flex-shrink-0">
        {/* ColorPicker inline for simplicity */}
        <ColorPickerSection />
        <BrushWidthSection />
      </div>
    </section>
  );
}

// Inline sub-components for the color picker and brush width sections
function ColorPickerSection() {
  const { brushColor, setBrushColor, currentTool, setCurrentTool } = useAppContext();
  const COLORS = [
    '#4A3728', '#7BC7A5', '#F8D147', '#F38181',
    '#52734D', '#95E1D3', '#FFB3B3', '#A29BFE',
  ];

  return (
    <div className="md:col-span-8 space-y-1">
      <div className="flex items-center space-x-2">
        <span className="text-lg">🎨</span>
        <h3 className="font-black text-xs">选择大自然涂料：</h3>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => {
              setBrushColor(color);
              if (currentTool === 'eraser' || currentTool === 'hand') setCurrentTool('pencil');
            }}
            className={`h-9 rounded-xl border-4 relative transition-all ${
              brushColor === color
                ? 'border-[#4A3728] scale-105'
                : 'border-[#4A3728]/30'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

function BrushWidthSection() {
  const { brushWidth, setBrushWidth } = useAppContext();

  return (
    <div className="md:col-span-4 space-y-1 border-t md:border-t-0 md:border-l border-[#4A3728]/10 pt-2 md:pt-0 md:pl-4">
      <div className="flex justify-between items-center">
        <span className="font-black text-xs">画笔粗细厚度：</span>
        <span className="px-2 py-0.5 bg-[#FAF6EB] border-2 border-[#4A3728] rounded-md font-black text-[10px]">
          {brushWidth} 级
        </span>
      </div>
      <input
        type="range"
        min="2"
        max="30"
        value={brushWidth}
        onChange={(e) => setBrushWidth(parseInt(e.target.value))}
        className="w-full accent-[#7BC7A5] h-2 bg-[#E3DEC3] rounded-lg cursor-pointer"
      />
      <div className="flex justify-between text-[9px] text-[#7d5b3f] font-bold">
        <span>细 (2)</span>
        <span>超粗 (30)</span>
      </div>
    </div>
  );
}
