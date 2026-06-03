import { useAppContext } from '../context/AppContext';

export default function Banner({ onTogglePhone, onToggleSound }) {
  const { alertText, isMuted, phoneCollapsed } = useAppContext();

  return (
    <header className="w-full max-w-[1680px] mx-auto px-4 pt-4 pb-2 relative z-10 flex-shrink-0">
      <div className="bg-[#FAF6EB] border-[6px] border-[#4A3728] rounded-[2rem] shadow-[6px_6px_0px_0px_#4A3728] p-4 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#F8D147] via-[#7BC7A5] to-[#F38181]"></div>

        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-[#F8D147] border-4 border-[#4A3728] rounded-2xl flex items-center justify-center text-3xl shadow-md rotate-[-3deg] hover:rotate-[3deg] transition-transform">
            🐶
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-[#7BC7A5] text-white text-xs font-bold rounded-full border-2 border-[#4A3728] title-font">
                岛屿广播站
              </span>
              <h1 className="text-xl font-black tracking-wider title-font">
                CoDraw 无限画布沙画板
              </h1>
            </div>
            <p className="text-xs font-bold text-[#7d5b3f] mt-0.5">
              {alertText}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleSound}
            className={`ac-btn p-2.5 flex items-center justify-center ${isMuted ? 'bg-rose-100' : 'bg-[#7BC7A5] hover:bg-[#6ab392]'} text-[#4A3728]`}
          >
            <span className="text-lg">{isMuted ? '🔇' : '🔊'}</span>
          </button>
          <button
            onClick={onTogglePhone}
            className="ac-btn px-4 py-2.5 bg-[#f3d15a] font-black text-xs flex items-center space-x-1"
          >
            <span className="text-base">📱</span>
            <span>{phoneCollapsed ? '拉出手机' : '收起手机'}</span>
          </button>
          <div className="hidden lg:block bg-[#E3DEC3] px-4 py-1.5 rounded-2xl border-4 border-[#4A3728] font-bold text-center text-xs">
            <div className="font-black">Figma 级投影变换</div>
          </div>
        </div>
      </div>
    </header>
  );
}
