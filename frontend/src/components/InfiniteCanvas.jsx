import { useState, useCallback, useEffect } from 'react';
import { Button } from 'animal-island-ui';
import { useAppContext } from '../context/AppContext';
import useCanvas from '../hooks/useCanvas';
import useSound from '../hooks/useSound';
import ZoomControls from './ZoomControls';

export default function InfiniteCanvas({ sendMessage, wsRef }) {
  const { currentTool, brushColor, brushWidth, username, updateAlert } = useAppContext();
  const { playPop, playChirp, playSplat } = useSound();
  const [zoomDisplay, setZoomDisplay] = useState('100%');

  const handleZoomChange = useCallback((z) => {
    setZoomDisplay(`${Math.round(z * 100)}%`);
  }, []);

  const {
    canvasRef, containerRef,
    zoomIn, zoomOut, zoomReset,
    downloadImage, updateCursor,
  } = useCanvas({
    currentTool, brushColor, brushWidth, sendMessage,
    playPop, playChirp, playSplat,
    onZoomChange: handleZoomChange,
  });

  useEffect(() => {
    updateCursor(currentTool);
  }, [currentTool, updateCursor]);

  function handleUndo() {
    if (sendMessage) sendMessage({ type: 'undo' });
  }

  function handleClear() {
    if (playChirp) playChirp();
    if (confirm('🌳 狸克警告：确定要清空所有人画的内容吗？这会抹除整张无限沙地！')) {
      if (sendMessage) sendMessage({ type: 'clear' });
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
    <div className="bg-[#EAE4C9] border-[6px] border-[#4A3728] rounded-[2.5rem] p-4 shadow-[8px_8px_0px_0px_#4A3728] relative flex-1 flex flex-col justify-between overflow-hidden">
      <div className="bg-[#FAF6EB] border-4 border-[#4A3728] rounded-[1.8rem] overflow-hidden relative flex-1 w-full min-h-[380px]"
        ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full bg-[#FAF6EB]"
          style={{ cursor: currentTool === 'hand' ? 'grab' : 'crosshair' }}
        />
        <ZoomControls
          zoomDisplay={zoomDisplay}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={handleReset}
        />
        <div className="absolute top-4 right-4 z-20 hidden md:block">
          <div className="kbd-tip px-3 py-1.5 rounded-xl font-bold text-[10px] flex items-center space-x-2 opacity-80 hover:opacity-100 transition-opacity text-[#4A3728]">
            <span>按住 <kbd className="px-1.5 py-0.5 bg-white border border-[#4A3728] rounded">Space</kbd> + 拖拽平移</span>
            <span className="text-[#7d5b3f]">|</span>
            <span>滚轮缩放</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div className="flex gap-2">
          <Button type="default" size="small" onClick={handleUndo}
            onMouseDown={(e) => e.preventDefault()}>
            ↩️ 撤销画笔
          </Button>
          <Button type="default" size="small" danger onClick={handleClear}
            onMouseDown={(e) => e.preventDefault()}>
            🧹 铲平画纸
          </Button>
        </div>
        <Button type="primary" size="small" onClick={handleDownload}
          onMouseDown={(e) => e.preventDefault()}>
          📸 一键照相全景图
        </Button>
      </div>
    </div>
  );
}
