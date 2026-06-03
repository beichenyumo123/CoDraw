import { useState, useRef } from 'react';
import { Button } from 'animal-island-ui';
import { useAppContext } from '../context/AppContext';
import useSound from '../hooks/useSound';

const QUICK_COLORS = ['#4A3728', '#7BC7A5', '#F8D147', '#F38181', '#52734D', '#A29BFE'];
const ALL_COLORS = [
  { hex: '#4A3728', label: '焦糖褐' },
  { hex: '#7BC7A5', label: '无人岛绿' },
  { hex: '#F8D147', label: '向日葵黄' },
  { hex: '#F38181', label: '西瓜红' },
  { hex: '#52734D', label: '苍翠松针' },
  { hex: '#95E1D3', label: '清透浅蓝' },
  { hex: '#FFB3B3', label: '樱花粉' },
  { hex: '#A29BFE', label: '风信子紫' },
];

export default function Banner({ onTogglePhone, onToggleSound }) {
  const {
    alertText, isMuted, phoneCollapsed,
    brushColor, setBrushColor,
    brushWidth, setBrushWidth,
    currentTool, setCurrentTool,
  } = useAppContext();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { playPop, playChirp } = useSound();

  function handleQuickColor(color) {
    playPop();
    setBrushColor(color);
    if (currentTool === 'eraser' || currentTool === 'hand') setCurrentTool('pencil');
  }

  // 笔触滚轮调节
  function handleBrushWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    setBrushWidth(Math.min(30, Math.max(2, brushWidth + delta)));
  }

  const paletteContent = (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
      <div className="sm:col-span-7">
        <div className="flex items-center space-x-2 mb-1">
          <span className="text-xs font-black text-[#7d5b3f]">全部涂料：</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
          {ALL_COLORS.map((color) => (
            <button
              key={color.hex}
              onClick={() => handleQuickColor(color.hex)}
              onMouseDown={(e) => e.preventDefault()}
              className={`h-8 rounded-xl border-3 transition-transform hover:scale-105 ${
                brushColor === color.hex
                  ? 'scale-105 border-[#4A3728] ring-2 ring-[#4A3728]'
                  : 'border-[#4A3728]/30'
              }`}
              style={{ backgroundColor: color.hex }}
              title={color.label}
            />
          ))}
        </div>
      </div>
      <div className="sm:col-span-5 space-y-1">
        <div className="flex justify-between items-center">
          <span className="font-black text-xs text-[#4A3728]">画笔粗细：{brushWidth} 级</span>
        </div>
        <input
          type="range" min="2" max="30" value={brushWidth}
          onChange={(e) => setBrushWidth(parseInt(e.target.value))}
          className="w-full accent-[#7BC7A5] h-2 bg-[#E3DEC3] rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[9px] text-[#7d5b3f] font-bold">
          <span>细 (2)</span><span>超粗 (30)</span>
        </div>
      </div>
    </div>
  );

  return (
    <header className="w-full max-w-[1680px] mx-auto px-4 pt-4 pb-2 relative flex-shrink-0" style={{ zIndex: 40 }}>
      <div className="bg-[#FAF6EB] border-[6px] border-[#4A3728] rounded-[2rem] shadow-[6px_6px_0px_0px_#4A3728] relative flex flex-col">

        {/* 内容区（裁剪渐变条圆角） */}
        <div className="relative overflow-hidden rounded-[1.7rem]">
          <div className="h-2 bg-gradient-to-r from-[#F8D147] via-[#7BC7A5] to-[#F38181]"></div>

          <div className="px-4 pt-2 pb-4 flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Logo + title */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-[#F8D147] border-4 border-[#4A3728] rounded-2xl flex items-center justify-center text-2xl shadow-md rotate-[-3deg] hover:rotate-[3deg] transition-transform flex-shrink-0">
                🐶
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-[#7BC7A5] text-white text-xs font-bold rounded-full border-2 border-[#4A3728] title-font">
                    岛屿广播站
                  </span>
                  <h1 className="text-lg md:text-xl font-black tracking-wider title-font truncate">
                    CoDraw 无限画布沙画板
                  </h1>
                </div>
                <p className="text-xs font-bold text-[#7d5b3f] mt-0.5 line-clamp-1">{alertText}</p>
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              {/* Quick color swatches */}
              <div className="hidden sm:flex items-center space-x-1 bg-[#E3DEC3] border-2 border-[#4A3728] rounded-xl px-2 py-1.5">
                {QUICK_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleQuickColor(color)}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`w-6 h-6 rounded-lg border-2 transition-transform hover:scale-110 ${
                      brushColor === color ? 'border-[#4A3728] scale-110 ring-2 ring-[#4A3728]' : 'border-[#4A3728]/30'
                    }`}
                    style={{ backgroundColor: color }}
                    title={ALL_COLORS.find(c => c.hex === color)?.label}
                  />
                ))}
                <span className="w-px h-5 bg-[#4A3728]/20 mx-0.5" />
                <button
                  onClick={() => { playPop(); setPaletteOpen(!paletteOpen); }}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-[10px] transition-all ${
                    paletteOpen ? 'bg-[#F8D147] border-[#4A3728] rotate-180' : 'bg-white border-[#4A3728]/40 hover:border-[#4A3728]'
                  }`}
                  title="展开调色板"
                >▼</button>
              </div>

              {/* Brush width mini indicator */}
              <div
                className="hidden sm:flex items-center space-x-1 bg-[#E3DEC3] border-2 border-[#4A3728] rounded-xl px-2 py-1.5 cursor-ns-resize select-none"
                onWheel={handleBrushWheel}
                title="滚轮调节笔触粗细"
              >
                <span className="text-[10px] font-black text-[#7d5b3f]">笔触</span>
                <span className="px-1.5 py-0.5 bg-white border-2 border-[#4A3728] rounded-md font-black text-[10px]">{brushWidth}</span>
              </div>

              {/* Sound toggle */}
              <Button
                type={isMuted ? 'default' : 'primary'}
                size="small"
                onClick={() => { playPop(); onToggleSound(); }}
                onMouseDown={(e) => e.preventDefault()}
                style={{ minWidth: 40 }}
              >
                {isMuted ? '🔇' : '🔊'}
              </Button>

              {/* Phone toggle */}
              <Button
                type="default"
                size="small"
                onClick={() => { playChirp(); onTogglePhone(); }}
                onMouseDown={(e) => e.preventDefault()}
                style={{ minWidth: 60 }}
              >
                📱 <span className="hidden sm:inline ml-1">{phoneCollapsed ? '拉出' : '收起'}</span>
              </Button>

              {/* Mobile palette toggle */}
              <button
                onClick={() => { playPop(); setPaletteOpen(!paletteOpen); }}
                onMouseDown={(e) => e.preventDefault()}
                className={`sm:hidden ac-btn p-2 flex items-center justify-center ${
                  paletteOpen ? 'bg-[#F8D147]' : 'bg-white'
                } text-[#4A3728]`}
              >
                <span className="text-lg">🎨</span>
              </button>
            </div>
          </div>
        </div>

        {/* 调色板展开面板 — 紧凑折叠 */}
        <div className="border-t-2 border-dashed border-[#4A3728]/20 mx-4"></div>

        {/* 折叠开关 — 极小一行 */}
        <button
          onClick={() => { playPop(); setPaletteOpen(!paletteOpen); }}
          onMouseDown={(e) => e.preventDefault()}
          className="flex items-center gap-1 px-4 py-1 text-[10px] font-black text-[#7d5b3f] hover:text-[#4A3728] transition-colors"
        >
          <span className={`transition-transform duration-300 ${paletteOpen ? 'rotate-90' : ''}`}>▶</span>
          <span>调色板{!paletteOpen && ' ···'}</span>
        </button>

        {/* 展开内容 — CSS 过渡 */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: paletteOpen ? '200px' : '0px',
            opacity: paletteOpen ? 1 : 0,
          }}
        >
          <div className="px-4 pb-3">
            {paletteContent}
          </div>
        </div>
      </div>
    </header>
  );
}
