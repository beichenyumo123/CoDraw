import { useAppContext } from '../context/AppContext';

export default function UserList() {
  const { onlineUsers, userId } = useAppContext();

  return (
    <div>
      <h4 className="text-[10px] font-black text-[#7d5b3f] flex justify-between items-center mb-1">
        <span>在线登岛村民：</span>
        <span className="px-2 py-0.5 bg-[#7BC7A5] text-white rounded-full text-[9px]">
          {onlineUsers.length} 人
        </span>
      </h4>
      <div className="space-y-1">
        {onlineUsers.length === 0 && (
          <p className="text-[9px] text-[#7d5b3f]/50 text-center py-2">等待村民登岛中...</p>
        )}
        {onlineUsers.map((u) => {
          const isMe = u.userId === userId;
          return (
            <div
              key={u.userId}
              className="bg-white border-2 border-[#4A3728] p-1 rounded-lg flex items-center gap-1.5 shadow-sm hover:scale-[1.02] transition-transform duration-200"
            >
              <span
                className="w-6 h-6 rounded-full border-2 border-[#4A3728] flex items-center justify-center text-xs flex-shrink-0"
                style={{ backgroundColor: u.color }}
              >
                {u.avatar}
              </span>
              <span className="text-[9px] font-black truncate flex-1">{u.username}{isMe ? ' (我)' : ''}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 border border-[#4A3728] flex-shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
