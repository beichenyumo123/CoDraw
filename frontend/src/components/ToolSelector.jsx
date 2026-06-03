import { useAppContext } from '../context/AppContext';
import useSound from '../hooks/useSound';

const TOOLS = [
  { id: 'pencil', icon: '✏️', label: '神奇铅笔' },
  { id: 'hand', icon: '🤚', label: '拖拽抓手' },
  { id: 'rect', icon: '📦', label: '完美木框' },
  { id: 'circle', icon: '⚪', label: '圆滚树洞' },
  { id: 'eraser', icon: '🧽', label: '橡皮擦铲', colSpan: true },
];

export default function ToolSelector() {
  const { currentTool, setCurrentTool } = useAppContext();
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
    </div>
  );
}
