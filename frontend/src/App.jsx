import { useEffect, useCallback } from 'react';
import { useAppContext } from './context/AppContext';
import useWebSocket from './hooks/useWebSocket';
import useSound from './hooks/useSound';
import Banner from './components/Banner';
import JoinModal from './components/JoinModal';
import InfiniteCanvas from './components/InfiniteCanvas';
import NookPhone from './components/NookPhone';

export default function App() {
  const { isJoined, setIsJoined, togglePhone, toggleMute } = useAppContext();
  const { playChirp } = useSound();
  const { connect, sendMessage, wsRef } = useWebSocket();

  const handleJoin = useCallback((username, avatar) => {
    if (playChirp) playChirp();
    connect(username, avatar);
  }, [connect, playChirp]);

  return (
    <>
      {/* Background dots pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#4a3728_2px,transparent_2px)] [background-size:16px_16px]"></div>

      {!isJoined && <JoinModal onJoin={handleJoin} />}

      <Banner onTogglePhone={togglePhone} onToggleSound={toggleMute} />

      <main className="w-full max-w-[1680px] mx-auto px-4 flex-1 flex gap-6 overflow-hidden relative z-10 pb-4">
        <InfiniteCanvas
          sendMessage={sendMessage}
          wsRef={wsRef}
        />
        <NookPhone />
      </main>
    </>
  );
}
