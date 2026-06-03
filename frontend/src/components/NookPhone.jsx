import { useAppContext } from '../context/AppContext';
import ToolSelector from './ToolSelector';
import UserList from './UserList';

export default function NookPhone() {
  const { phoneCollapsed, updateAlert } = useAppContext();

  function handleHomeClick() {
    updateAlert('🌳 广播：多使用 Space 空格快捷键 + 鼠标拖拽，它能让你的沙滩探索速度提升 3 倍！');
  }

  return (
    <section
      className="w-80 flex-shrink-0 flex flex-col transition-all duration-300"
      style={{
        width: phoneCollapsed ? '0px' : '20rem',
        opacity: phoneCollapsed ? 0 : 1,
        pointerEvents: phoneCollapsed ? 'none' : 'auto',
        marginRight: phoneCollapsed ? '-24px' : '0px',
      }}
    >
      <div className="nook-phone p-4 flex flex-col h-full">
        {/* Phone hardware top */}
        <div className="flex justify-center space-x-2 mb-2 flex-shrink-0">
          <span className="w-12 h-1.5 bg-[#4A3728] rounded-full"></span>
          <span className="w-2.5 h-2.5 bg-[#4A3728] rounded-full"></span>
        </div>

        {/* Phone screen */}
        <div className="bg-[#FAF6EB] border-4 border-[#4A3728] rounded-[2rem] p-3 flex-1 flex flex-col overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between border-b border-[#4A3728]/10 pb-1.5 text-[9px] font-bold text-[#7d5b3f] flex-shrink-0">
            <span>📶 NookNet 5G</span>
            <span>下午 13:32</span>
            <span>🔋 100%</span>
          </div>

          {/* Title */}
          <div className="flex items-center space-x-1 bg-[#EAE4C9] border-2 border-[#4A3728] p-1.5 rounded-xl flex-shrink-0 mt-2">
            <span className="text-sm">📱</span>
            <h2 className="font-black text-[10px]">村民画友对讲机</h2>
          </div>

          <ToolSelector />
          <UserList />
        </div>

        {/* Home button */}
        <button
          onClick={handleHomeClick}
          className="mt-2.5 mx-auto w-10 h-10 rounded-full border-4 border-[#4A3728] bg-white hover:bg-slate-100 flex items-center justify-center shadow-md active:scale-95 transition-all flex-shrink-0"
        >
          <div className="w-2.5 h-2.5 rounded-sm bg-[#4A3728] rotate-45"></div>
        </button>
      </div>
    </section>
  );
}
