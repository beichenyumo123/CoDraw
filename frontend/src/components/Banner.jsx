import { useState, useRef, useEffect } from 'react';
import { Button } from 'animal-island-ui';
import { useAppContext } from '../context/AppContext';
import useSound from '../hooks/useSound';

const PRESET_COLORS = [
  { hex: '#4A3728', label: '焦糖褐' },
  { hex: '#7BC7A5', label: '无人岛绿' },
  { hex: '#F8D147', label: '向日葵黄' },
  { hex: '#F38181', label: '西瓜红' },
  { hex: '#52734D', label: '苍翠松针' },
  { hex: '#95E1D3', label: '清透浅蓝' },
  { hex: '#FFB3B3', label: '樱花粉' },
  { hex: '#A29BFE', label: '风信子紫' },
  { hex: '#FF8C42', label: '蜜柑橙' },
  { hex: '#2C5F7C', label: '深海蓝' },
  { hex: '#E8D5B7', label: '沙滩米' },
  { hex: '#C9B1FF', label: '薰衣草' },
  { hex: '#FF6B6B', label: '珊瑚红' },
  { hex: '#4ECDC4', label: '薄荷绿' },
  { hex: '#FFD93D', label: '蜂蜜金' },
  { hex: '#6C5CE7', label: '蓝莓紫' },
];

const PRESET_SET = new Set(PRESET_COLORS.map((c) => c.hex));
const STORAGE_KEY = 'codraw_recent_colors';
const MAX_RECENT = 10;

function loadRecent() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : PRESET_COLORS.slice(0, 6).map((c) => c.hex);
  } catch { return PRESET_COLORS.slice(0, 6).map((c) => c.hex); }
}

function saveRecent(colors) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(colors)); } catch {}
}

export default function Banner({ onTogglePhone, onToggleSound }) {
  const {
    alertText, isMuted, phoneCollapsed,
    brushColor, setBrushColor,
    brushWidth, setBrushWidth,
    currentTool, setCurrentTool,
  } = useAppContext();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [recentColors, setRecentColors] = useState(loadRecent);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, right: 0 });
  const pickerBtnRef = useRef(null);
  const pickerRef = useRef(null);
  const pendingColorRef = useRef(null);
  const { playPop, playChirp } = useSound();

  /** 选色（所有入口统一走这里） */
  function selectColor(hex) {
    playPop();
    setBrushColor(hex);
    if (currentTool === 'eraser' || currentTool === 'hand') setCurrentTool('pencil');
    setRecentColors((prev) => {
      if (prev.includes(hex)) return prev; // 已在列表中，不改变顺序
      const next = [hex, ...prev].slice(0, MAX_RECENT);
      saveRecent(next);
      return next;
    });
  }

  // 取色器关闭时保存
  function closePicker() {
    const hex = pendingColorRef.current;
    pendingColorRef.current = null;
    if (hex) selectColor(hex);
    setPickerOpen(false);
  }

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target) &&
          pickerBtnRef.current && !pickerBtnRef.current.contains(e.target)) {
        closePicker();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  function togglePicker() {
    playPop();
    if (!pickerOpen && pickerBtnRef.current) {
      const rect = pickerBtnRef.current.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
      pendingColorRef.current = null;
    } else if (pickerOpen) {
      closePicker();
    }
    setPickerOpen(!pickerOpen);
  }

  function handleBrushWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -1 : 1;
    setBrushWidth(Math.min(30, Math.max(2, brushWidth + delta)));
  }

  // 取色器弹窗
  const pickerPopover = pickerOpen && (
    <div
      ref={pickerRef}
      className="fixed bg-[#FAF6EB] border-4 border-[#4A3728] rounded-xl shadow-lg p-3 z-[999] w-52"
      style={{ top: pickerPos.top, right: pickerPos.right }}
    >
      <div className="text-[10px] font-black text-[#7d5b3f] mb-2">选择颜色</div>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="color"
          value={brushColor}
          onInput={(e) => { pendingColorRef.current = e.target.value; setBrushColor(e.target.value); }}
          className="w-10 h-10 rounded-lg border-2 border-[#4A3728] cursor-pointer p-0"
        />
        <div className="flex-1">
          <div className="text-[11px] font-black text-[#4A3728]">{brushColor}</div>
          <div className="text-[9px] text-[#7d5b3f]">选中后自动保存</div>
        </div>
      </div>
      <div className="border-t border-[#4A3728]/10 pt-2">
        <div className="text-[9px] font-black text-[#7d5b3f] mb-1.5">预设色板</div>
        <div className="grid grid-cols-8 gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.hex}
              onClick={() => { selectColor(c.hex); pendingColorRef.current = null; setPickerOpen(false); }}
              onMouseDown={(e) => e.preventDefault()}
              className={`w-5 h-5 rounded border-2 transition-transform hover:scale-110 ${
                brushColor === c.hex ? 'border-[#4A3728] scale-110' : 'border-[#4A3728]/20'
              }`}
              style={{ backgroundColor: c.hex }}
              title={c.label}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // 顶栏快捷色块（LRU 顺序）
  const quickBar = (
    <div className="hidden sm:flex items-center space-x-1 bg-[#E3DEC3] border-2 border-[#4A3728] rounded-xl px-2 py-1.5">
      {recentColors.map((hex) => (
        <button
          key={hex}
          onClick={() => selectColor(hex)}
          onMouseDown={(e) => e.preventDefault()}
          className={`w-6 h-6 rounded-lg border-2 transition-transform hover:scale-110 ${
            brushColor === hex ? 'border-[#4A3728] scale-110 ring-2 ring-[#4A3728]' : 'border-[#4A3728]/30'
          }`}
          style={{ backgroundColor: hex }}
          title={PRESET_COLORS.find((c) => c.hex === hex)?.label || hex}
        />
      ))}
      <button
        ref={pickerBtnRef}
        onClick={togglePicker}
        onMouseDown={(e) => e.preventDefault()}
        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-[10px] transition-all ${
          pickerOpen ? 'bg-[#F8D147] border-[#4A3728]' : 'bg-white border-[#4A3728]/40 hover:border-[#4A3728]'
        }`}
        title="自定义颜色"
      >+</button>
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
  );

  // 折叠面板
  const paletteContent = (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] font-black text-[#7d5b3f] mb-1.5">全部涂料</div>
        <div className="grid grid-cols-8 sm:grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.hex}
              onClick={() => selectColor(c.hex)}
              onMouseDown={(e) => e.preventDefault()}
              className={`w-6 h-6 rounded border-2 transition-transform hover:scale-110 ${
                brushColor === c.hex
                  ? 'border-[#4A3728] scale-110 ring-1 ring-[#4A3728]'
                  : 'border-[#4A3728]/20'
              }`}
              style={{ backgroundColor: c.hex }}
              title={c.label}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[10px] font-black text-[#4A3728] flex-shrink-0">笔触：{brushWidth} 级</span>
        <input
          type="range" min="2" max="30" value={brushWidth}
          onChange={(e) => setBrushWidth(parseInt(e.target.value))}
          className="flex-1 accent-[#7BC7A5] h-2 bg-[#E3DEC3] rounded-lg cursor-pointer"
        />
        <div className="flex text-[9px] text-[#7d5b3f] font-bold gap-2 flex-shrink-0">
          <span>细</span><span>粗</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {pickerPopover}
      <header className="w-full max-w-[1680px] mx-auto px-4 pt-4 pb-2 relative flex-shrink-0" style={{ zIndex: 40 }}>
        <div className="bg-[#FAF6EB] border-[6px] border-[#4A3728] rounded-[2rem] shadow-[6px_6px_0px_0px_#4A3728] relative flex flex-col">

          <div className="relative overflow-hidden rounded-[1.7rem]">
            <div className="h-2 bg-gradient-to-r from-[#F8D147] via-[#7BC7A5] to-[#F38181]"></div>

            <div className="px-4 pt-2 pb-4 flex flex-col md:flex-row items-center justify-between gap-3">
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

              <div className="flex items-center space-x-2 flex-shrink-0">
                {quickBar}

                <div
                  className="hidden sm:flex items-center space-x-1 bg-[#E3DEC3] border-2 border-[#4A3728] rounded-xl px-2 py-1.5 cursor-ns-resize select-none"
                  onWheel={handleBrushWheel}
                  title="滚轮调节笔触粗细"
                >
                  <span className="text-[10px] font-black text-[#7d5b3f]">笔触</span>
                  <span className="px-1.5 py-0.5 bg-white border-2 border-[#4A3728] rounded-md font-black text-[10px]">{brushWidth}</span>
                </div>

                <Button
                  type={isMuted ? 'default' : 'primary'}
                  size="small"
                  onClick={() => { playPop(); onToggleSound(); }}
                  onMouseDown={(e) => e.preventDefault()}
                  style={{ minWidth: 40 }}
                >
                  {isMuted ? '🔇' : '🔊'}
                </Button>

                <Button
                  type="default"
                  size="small"
                  onClick={() => { playChirp(); onTogglePhone(); }}
                  onMouseDown={(e) => e.preventDefault()}
                  style={{ minWidth: 60 }}
                >
                  📱 <span className="hidden sm:inline ml-1">{phoneCollapsed ? '拉出' : '收起'}</span>
                </Button>

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

          <div className="border-t-2 border-dashed border-[#4A3728]/20 mx-4"></div>

          <button
            onClick={() => { playPop(); setPaletteOpen(!paletteOpen); }}
            onMouseDown={(e) => e.preventDefault()}
            className="flex items-center gap-1 px-4 py-1 text-[10px] font-black text-[#7d5b3f] hover:text-[#4A3728] transition-colors"
          >
            <span className={`transition-transform duration-300 ${paletteOpen ? 'rotate-90' : ''}`}>▶</span>
            <span>调色板{!paletteOpen && ' ···'}</span>
          </button>

          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              maxHeight: paletteOpen ? '300px' : '0px',
              opacity: paletteOpen ? 1 : 0,
            }}
          >
            <div className="px-4 pb-3">
              {paletteContent}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
