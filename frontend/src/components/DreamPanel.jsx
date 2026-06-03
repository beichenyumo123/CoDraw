import { useState } from 'react';
import { Button } from 'animal-island-ui';
import { useAppContext } from '../context/AppContext';
import { setDreamShapes } from '../hooks/useWebSocket';
import useSound from '../hooks/useSound';

const API = `http://${window.location.hostname}:8000`;

export default function DreamPanel() {
  const { username, updateAlert } = useAppContext();
  const { playChirp, playPop } = useSound();
  const [dreamCode, setDreamCode] = useState('');
  const [savedCode, setSavedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [dreamActive, setDreamActive] = useState(false);
  const [dreamInfo, setDreamInfo] = useState(null);

  async function handleSave() {
    playChirp();
    setLoading(true);
    try {
      const res = await fetch(`${API}/dream/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creator: username || '匿名村民' }),
      });
      const data = await res.json();
      if (data.code) {
        setSavedCode(data.code);
        updateAlert(`💤 梦境已保存！番地码：${data.code}`);
      }
    } catch {
      updateAlert('🚨 保存梦境失败');
    }
    setLoading(false);
  }

  async function handleLoad() {
    const code = dreamCode.trim().toUpperCase();
    if (!code || code.length !== 8) {
      updateAlert('⚠️ 请输入 8 位梦境番地码');
      return;
    }
    playChirp();
    setLoading(true);
    try {
      const res = await fetch(`${API}/dream/${code}`);
      if (!res.ok) { updateAlert('🔍 找不到这个梦境番地...'); setLoading(false); return; }
      const dream = await res.json();
      // 叠加到当前画布上（不影响共享内容）
      setDreamShapes(dream.shapes || []);
      setDreamActive(true);
      setDreamInfo(dream);
      updateAlert(`💤 ${dream.creator} 的梦境已叠加到画布（半透明），可正常绘画/平移`);
    } catch {
      updateAlert('🚨 加载梦境失败');
    }
    setLoading(false);
  }

  function handleExitDream() {
    playChirp();
    setDreamShapes([]);
    setDreamActive(false);
    setDreamInfo(null);
    updateAlert('🌳 梦境叠加层已移除');
  }

  function copyCode() {
    if (savedCode) {
      navigator.clipboard?.writeText(savedCode);
      playPop();
      updateAlert('📋 番地码已复制！');
    }
  }

  return (
    <div className="mt-2 flex-shrink-0">
      <div className="border-t-2 border-dashed border-[#4A3728]/20 pt-2">
        <h4 className="text-[10px] font-black text-[#7d5b3f] mb-1.5">💤 梦境番地</h4>

        {dreamActive ? (
          <div>
            <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-2 mb-1.5">
              <p className="text-[9px] font-black text-purple-700">
                🌙 {dreamInfo?.creator || '未知'} 的梦境
              </p>
              <p className="text-[8px] text-purple-500">
                {dreamInfo?.shapeCount || 0} 个图形 · 叠加层（半透明）
              </p>
            </div>
            <Button type="primary" size="small" block onClick={handleExitDream}
              onMouseDown={(e) => e.preventDefault()}>
              🚪 移除梦境
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-1.5">
              <Button type="primary" size="small" block onClick={handleSave} disabled={loading}
                onMouseDown={(e) => e.preventDefault()}>
                💾 保存当前梦境
              </Button>
              {savedCode && (
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-[10px] font-black text-[#7BC7A5] bg-[#EAE4C9] px-2 py-0.5 rounded-lg border border-[#4A3728]">
                    {savedCode}
                  </span>
                  <button onClick={copyCode} onMouseDown={(e) => e.preventDefault()}
                    className="text-[9px] font-black text-[#7d5b3f] underline">
                    复制
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <input
                type="text" value={dreamCode}
                onChange={(e) => setDreamCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
                placeholder="输入 8 位番地码" maxLength={8}
                className="flex-1 px-2 py-1 bg-white border-2 border-[#4A3728] rounded-lg text-[10px] font-bold focus:outline-none focus:border-[#7BC7A5] placeholder-[#7d5b3f]/40 text-[#4A3728] uppercase"
              />
              <Button type="default" size="small" onClick={handleLoad} disabled={loading}
                onMouseDown={(e) => e.preventDefault()}>
                🌙 进入
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
