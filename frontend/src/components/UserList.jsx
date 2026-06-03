import { useAppContext } from '../context/AppContext';

export default function UserList() {
  const { onlineUsers, userId } = useAppContext();

  return (
    <div className="space-y-1 mt-3 flex-1 flex flex-col overflow-hidden">
      <h4 className="text-[10px] font-black text-[#7d5b3f] flex justify-between items-center flex-shrink-0">
        <span>在线登岛村民：</span>
        <span className="px-2 py-0.5 bg-[#7BC7A5] text-white rounded-full text-[9px]">
          {onlineUsers.length} 人
        </span>
      </h4>
      <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
        {onlineUsers.map((u) => {
          const isMe = u.userId === userId;
          return (
            <div
              key={u.userId}
              className="bg-white border-2 border-[#4A3728] p-1.5 rounded-xl flex items-center justify-between gap-2 shadow-sm scale-95 hover:scale-100 transition-transform duration-200"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <span
                  className="w-7 h-7 rounded-full border-2 border-[#4A3728] flex items-center justify-center text-sm"
                  style={{ backgroundColor: u.color }}
                >
                  {u.avatar}
                </span>
                <div className="truncate">
                  <p className="text-[10px] font-black truncate">
                    {u.username} {isMe ? '(我)' : ''}
                  </p>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 border-2 border-[#4A3728] flex-shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
