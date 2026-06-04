import { useAppContext } from '../context/AppContext';
import useSound from '../hooks/useSound';
import ToolSelector from './ToolSelector';
import ChatPanel from './ChatPanel';
import PixelPanel from './PixelPanel';
import DreamPanel from './DreamPanel';
import TimelapsePanel from './TimelapsePanel';
import UserList from './UserList';

export default function NookPhone() {
  const { updateAlert, currentTool } = useAppContext();
  const { playChirp } = useSound();

  function handleHomeClick() {
    playChirp();
    updateAlert('🌳 广播：多使用 Space 空格快捷键 + 鼠标拖拽，它能让你的沙滩探索速度提升 3 倍！');
  }

  return (
    <div className="nook-phone p-4 flex flex-col h-full">
      {/* Phone hardware top */}
      <div className="flex justify-center space-x-2 mb-2 flex-shrink-0">
        <span className="w-12 h-1.5 bg-[#4A3728] rounded-full"></span>
        <span className="w-2.5 h-2.5 bg-[#4A3728] rounded-full"></span>
      </div>

      {/* 外层装饰框（纯装饰，不参与滚动） */}
      <div className="flex-1 min-h-0 bg-[#FAF6EB] border-4 border-[#4A3728] rounded-[2rem] overflow-hidden">
        {/* 内层滚动容器（裁剪在圆角内，滚动条也在圆角内） */}
        <div className="h-full overflow-y-auto p-3 no-scrollbar">
          {/* Status bar */}
          <div className="flex items-center justify-between border-b border-[#4A3728]/10 pb-1.5 text-[9px] font-bold text-[#7d5b3f]">
            <span>📶 NookNet 5G</span>
            <span>下午 13:32</span>
            <span>🔋 100%</span>
          </div>

          {/* Title */}
          <div className="flex items-center space-x-1 bg-[#EAE4C9] border-2 border-[#4A3728] p-1.5 rounded-xl mt-2">
            <span className="text-sm">📱</span>
            <h2 className="font-black text-[10px] text-[#4A3728]">村民画友对讲机</h2>
          </div>

          {/* 道具选择 */}
          <ToolSelector />

          {/* 聊天区 */}
          <ChatPanel />

          {/* 像素画编辑器 */}
          {currentTool === 'pixel' && <PixelPanel />}

          {/* 分隔线 */}
          <div className="border-t-2 border-dashed border-[#4A3728]/20 my-2" />

          {/* 时间胶囊 */}
          <TimelapsePanel />

          {/* 分隔线 */}
          <div className="border-t-2 border-dashed border-[#4A3728]/20 my-2" />

          {/* 梦境番地 */}
          <DreamPanel />

          {/* 分隔线 */}
          <div className="border-t-2 border-dashed border-[#4A3728]/20 my-2" />

          {/* 在线村民列表 */}
          <div>
            <UserList />
          </div>
        </div>
      </div>

      {/* Home button */}
      <button
        onClick={handleHomeClick}
        className="mt-2.5 mx-auto w-10 h-10 rounded-full border-4 border-[#4A3728] bg-white hover:bg-slate-100 flex items-center justify-center shadow-md active:scale-95 transition-all flex-shrink-0"
      >
        <div className="w-2.5 h-2.5 rounded-sm bg-[#4A3728] rotate-45"></div>
      </button>
    </div>
  );
}
