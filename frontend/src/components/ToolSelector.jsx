import { useAppContext } from '../context/AppContext';
import useSound from '../hooks/useSound';
import { STAMPS } from '../data/stamps';

const TOOLS = [
  { id: 'pencil', icon: '✏️', label: '神奇铅笔' },
  { id: 'hand', icon: '🤚', label: '拖拽抓手' },
  { id: 'rect', icon: '📦', label: '完美木框' },
  { id: 'circle', icon: '⚪', label: '圆滚树洞' },
  { id: 'stamp', icon: '🏷️', label: '手帐印章' },
  { id: 'pixel', icon: '🎨', label: '像素画', colSpan: false },
  { id: 'eraser', icon: '🧽', label: '橡皮擦铲', colSpan: true },
];

export default function ToolSelector() {
  const { currentTool, setCurrentTool, currentStamp, setCurrentStamp } = useAppContext();
  const { playPop } = useSound();

  return (
    <div className="space-y-1 mt-2 flex-shrink-0">
      <h4 className="text-[10px] font-black text-[#7d5b3f]">切换手持道具：</h4>
      <div className="grid grid-cols-2 gap-1.5">
        {TOOLS.map((tool) => {
          const isActive = currentTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => { playPop(); setCurrentTool(tool.id); }}
              onMouseDown={(e) => e.preventDefault()}
              className={`p-2 rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform ${
                tool.colSpan ? 'col-span-2' : ''
              } ${
                isActive
                  ? 'bg-[#F8D147] border-4 border-[#4A3728]'
                  : 'bg-white border-4 border-[#4A3728]/30'
              }`}
              style={isActive ? { boxShadow: '2px 2px 0px 0px #4A3728' } : {}}
            >
              <span className="text-base">{tool.icon}</span>
              <span className="text-[9px] font-black">{tool.label}</span>
            </button>
          );
        })}
      </div>

      {/* 印章子选择器 — 选中 stamp 道具时显示 */}
      {currentTool === 'stamp' && (
        <div className="mt-1.5 pt-1.5 border-t-2 border-dashed border-[#4A3728]/20">
          <h4 className="text-[9px] font-black text-[#7d5b3f] mb-1">选择印章图案：</h4>
          <div className="grid grid-cols-4 gap-1">
            {STAMPS.map((s) => (
              <button
                key={s.id}
                onClick={() => { playPop(); setCurrentStamp(s.id); }}
                onMouseDown={(e) => e.preventDefault()}
                className={`p-1.5 rounded-xl border-2 flex flex-col items-center gap-0.5 transition-all ${
                  currentStamp === s.id
                    ? 'bg-[#7BC7A5] border-[#4A3728] text-white scale-105'
                    : 'bg-white border-[#4A3728]/30 hover:border-[#4A3728]/60'
                }`}
                title={s.label}
              >
                <span className="text-lg leading-none">{s.icon}</span>
                <span className="text-[7px] font-black truncate w-full text-center">{s.label.split(' ')[1]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
