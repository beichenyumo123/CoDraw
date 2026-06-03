import { useState, useRef, useEffect } from 'react';
import { Button } from 'animal-island-ui';
import { useAppContext } from '../context/AppContext';
import useSound from '../hooks/useSound';

export default function ChatPanel() {
  const { chatMessages, userId, sendMessage } = useAppContext();
  const { playPop } = useSound();
  const [input, setInput] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [chatMessages]);

  function handleSend() {
    const text = input.trim();
    if (!text || text.length > 200) return;
    playPop();
    sendMessage({ type: 'chat_message', text });
    setInput('');
    inputRef.current?.focus();
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  return (
    <div className="mt-2 flex-shrink-0">
      <h4 className="text-[11px] font-extrabold text-[#7d5b3f] mb-1">💬 岛屿公屏聊天</h4>

      <div
        ref={listRef}
        className="overflow-y-auto no-scrollbar space-y-1.5 bg-[#EAE4C9] border-2 border-[#4A3728] rounded-xl p-2"
        style={{ height: 130 }}
      >
        {chatMessages.length === 0 && (
          <p className="text-[11px] text-[#7d5b3f]/50 text-center py-3">
            还没有人说话，快来打个招呼吧 👋
          </p>
        )}
        {chatMessages.map((msg, i) => {
          const isMe = msg.userId === userId;
          return (
            <div key={i} className={`flex gap-1.5 items-start ${isMe ? 'flex-row-reverse' : ''}`}>
              <span
                className="w-5 h-5 rounded-full border-2 border-[#4A3728] flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5"
                style={{ backgroundColor: msg.color || '#7BC7A5' }}
                title={msg.username}
              >
                {msg.avatar}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-extrabold text-[#6b5a3e] truncate">{msg.username}</span>
                  <span className="text-[9px] text-[#7d5b3f]/50 flex-shrink-0">{formatTime(msg.timestamp)}</span>
                </div>
                <div className={`text-[11px] leading-snug px-2.5 py-1 rounded-xl break-words ${
                  isMe ? 'bg-[#7BC7A5] text-white rounded-tr-md' : 'bg-white text-[#4A3728] rounded-tl-md'
                }`}>
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1.5 mt-1.5">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
          placeholder="说点什么..."
          maxLength={200}
          className="flex-1 px-2.5 py-1.5 bg-white border-2 border-[#4A3728] rounded-lg text-[11px] font-bold focus:outline-none focus:border-[#7BC7A5] placeholder-[#7d5b3f]/40 text-[#4A3728] min-w-0"
        />
        <Button
          type="primary"
          size="small"
          disabled={!input.trim()}
          onClick={handleSend}
          onMouseDown={(e) => e.preventDefault()}
        >
          发送
        </Button>
      </div>
    </div>
  );
}
