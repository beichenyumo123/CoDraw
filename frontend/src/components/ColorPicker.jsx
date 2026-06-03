import { useAppContext } from '../context/AppContext';

const COLORS = [
  '#4A3728', '#7BC7A5', '#F8D147', '#F38181',
  '#52734D', '#95E1D3', '#FFB3B3', '#A29BFE',
];

export default function ColorPicker() {
  const { brushColor, setBrushColor, currentTool, setCurrentTool } = useAppContext();

  function handleColorChange(color) {
    setBrushColor(color);
    // Auto-switch to pencil if on eraser or hand
    if (currentTool === 'eraser' || currentTool === 'hand') {
      setCurrentTool('pencil');
    }
  }

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
            onClick={() => handleColorChange(color)}
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
