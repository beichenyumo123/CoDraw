import { useCallback } from 'react';
import { useAppContext } from './context/AppContext';
import useWebSocket from './hooks/useWebSocket';
import useSound from './hooks/useSound';
import Banner from './components/Banner';
import JoinModal from './components/JoinModal';
import InfiniteCanvas from './components/InfiniteCanvas';
import NookPhone from './components/NookPhone';

export default function App() {
  const { isJoined, togglePhone, toggleMute, phoneCollapsed } = useAppContext();
  const { playChirp } = useSound();
  const { connect, sendMessage, wsRef } = useWebSocket();

  const handleJoin = useCallback(
    (username, avatar) => {
      if (playChirp) playChirp();
      connect(username, avatar);
    },
    [connect, playChirp],
  );

  return (
    <div className="h-screen flex flex-col relative select-none bg-[#F0E6D2] text-[#4A3728] overflow-hidden">
      {/* Background dots pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#4a3728_2px,transparent_2px)] [background-size:16px_16px]"></div>

      {!isJoined && <JoinModal onJoin={handleJoin} />}

      <Banner onTogglePhone={togglePhone} onToggleSound={toggleMute} />

      <main className="w-full max-w-[1680px] mx-auto px-4 flex-1 flex gap-6 overflow-hidden relative z-0 pb-4">
        {/* 左侧：经典木框大画板 */}
        <section className="flex-1 flex flex-col transition-all duration-300 overflow-hidden">
          <InfiniteCanvas sendMessage={sendMessage} wsRef={wsRef} />
        </section>

        {/* 右侧：Nook Phone (丝滑滑动侧拉动画) */}
        <section
          className={`transition-all duration-300 flex flex-col flex-shrink-0 overflow-hidden ${
            phoneCollapsed
              ? 'w-0 opacity-0 pointer-events-none -mr-6'
              : 'w-80 opacity-100'
          }`}
        >
          <NookPhone />
        </section>
      </main>
    </div>
  );
}
