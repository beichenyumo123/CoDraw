import { useState } from 'react';
import { Button } from 'animal-island-ui';
import { useAppContext } from '../context/AppContext';
import { VILLAGERS, getRandomName } from '../data/villagers';

export default function JoinModal({ onJoin }) {
  const { setUsername, setAvatar, setIsJoined, avatar: selectedAvatar } = useAppContext();
  const [nameInput, setNameInput] = useState(getRandomName());
  const [localAvatar, setLocalAvatar] = useState(selectedAvatar);

  function handleJoin() {
    const val = nameInput.trim();
    if (!val) {
      alert('请先写一个可爱的村民名称哦！');
      return;
    }
    setUsername(val);
    setAvatar(localAvatar);
    setIsJoined(true);
    if (onJoin) onJoin(val, localAvatar);
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-[#FAF6EB] border-[6px] border-[#4A3728] rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-[8px_8px_0px_0px_#4A3728] max-h-[90vh] overflow-y-auto">
        {/* 飞机 — 在 overflow-y-auto 容器里给足呼吸空间 */}
        <div className="text-center space-y-2 mb-6 pt-1">
          <div className="text-5xl animate-bounce leading-none" style={{ paddingTop: 4, paddingBottom: 8 }}>
            🛩️
          </div>
          <h2 className="text-xl font-black tracking-wider title-font text-[#4A3728]">
            渡渡航空 · 多人登岛申请书
          </h2>
          <p className="text-xs text-[#7d5b3f] font-bold">
            请选择自已的卡通分身和艺术昵称，即刻飞越蓝天起航协作！
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-black mb-1 text-[#4A3728]">您的村民绰号：</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="例如：爱钓鱼的大吉"
                maxLength={12}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                className="flex-1 px-4 py-2.5 bg-[#FAF6EB] border-4 border-[#4A3728] rounded-xl focus:outline-none font-bold placeholder-slate-400 text-[#4A3728]"
              />
              <Button
                type="default"
                onClick={() => setNameInput(getRandomName())}
                onMouseDown={(e) => e.preventDefault()}
              >
                🎲 随机
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black mb-2 text-[#4A3728]">选择一位您的虚拟村民化身：</label>
            <div className="grid grid-cols-4 gap-2">
              {VILLAGERS.map((v) => {
                const isSelected = localAvatar === v.avatar;
                return (
                  <button
                    key={v.avatar}
                    type="button"
                    onClick={() => setLocalAvatar(v.avatar)}
                    className={`p-2 border-4 rounded-xl text-center transition-all ${
                      isSelected
                        ? 'bg-[#7BC7A5] text-white border-[#4A3728] scale-105'
                        : 'bg-white border-[#4A3728]/30'
                    }`}
                  >
                    <div className="text-2xl">{v.avatar}</div>
                    <div className="text-[10px] font-black mt-0.5 truncate">{v.name.split(' ')[0]}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            type="primary"
            block
            size="large"
            onClick={handleJoin}
            onMouseDown={(e) => e.preventDefault()}
          >
            🛫 办理登机，立即登岛！
          </Button>
        </div>
      </div>
    </div>
  );
}
