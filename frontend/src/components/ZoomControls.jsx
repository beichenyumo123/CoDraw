export default function ZoomControls({ zoomDisplay, onZoomIn, onZoomOut, onZoomReset }) {
  return (
    <div className="absolute bottom-4 left-4 flex items-center space-x-2 z-20">
      <div className="bg-[#FAF6EB] border-4 border-[#4A3728] rounded-xl shadow-md p-1 flex items-center space-x-2">
        <button
          onClick={onZoomOut}
          className="w-8 h-8 rounded-lg bg-white border-2 border-[#4A3728] hover:bg-slate-50 font-black text-sm flex items-center justify-center active:scale-95 transition-all"
        >
          ➖
        </button>
        <span className="font-black text-xs min-w-[50px] text-center text-[#4A3728]">
          {zoomDisplay}
        </span>
        <button
          onClick={onZoomIn}
          className="w-8 h-8 rounded-lg bg-white border-2 border-[#4A3728] hover:bg-slate-50 font-black text-sm flex items-center justify-center active:scale-95 transition-all"
        >
          ➕
        </button>
        <button
          onClick={onZoomReset}
          className="px-2.5 h-8 rounded-lg bg-[#7BC7A5] hover:bg-[#6ab392] text-white border-2 border-[#4A3728] font-black text-[10px] flex items-center justify-center active:scale-95 transition-all"
        >
          重置中心
        </button>
      </div>
    </div>
  );
}
