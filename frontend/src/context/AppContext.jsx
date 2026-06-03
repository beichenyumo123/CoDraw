import { createContext, useContext, useState, useCallback } from 'react';
import { VILLAGERS } from '../data/villagers';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // 用户身份
  const [userId] = useState('user_' + Math.random().toString(36).substr(2, 9));
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState(VILLAGERS[2].avatar);
  const [myColor, setMyColor] = useState('#7BC7A5');
  const [isJoined, setIsJoined] = useState(false);

  // 绘画状态
  const [currentTool, setCurrentTool] = useState('pencil');
  const [currentStamp, setCurrentStamp] = useState('leaf');
  const [brushColor, setBrushColor] = useState('#4A3728');
  const [brushWidth, setBrushWidth] = useState(6);

  // 协作数据
  const [historyList, setHistoryList] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [alertText, setAlertText] = useState(
    '✨ 新技术：使用【抓手工具】或【按住空格键】可无限拖拽/滚动沙滩！使用【鼠标滚轮】即可自由缩放视角！'
  );

  // UI 状态
  const [isMuted, setIsMuted] = useState(false);
  const [phoneCollapsed, setPhoneCollapsed] = useState(false);

  // WebSocket 实例引用 + 发送函数（供子组件如 ChatPanel 使用）
  const [wsRef, setWsRef] = useState(null);
  const [sendMessage, setSendMessage] = useState(() => () => false);

  const updateAlert = useCallback((text) => {
    setAlertText(text);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const togglePhone = useCallback(() => {
    setPhoneCollapsed((prev) => !prev);
  }, []);

  const value = {
    // 用户
    userId, username, setUsername,
    avatar, setAvatar,
    myColor, setMyColor,
    isJoined, setIsJoined,

    // 绘画
    currentTool, setCurrentTool,
    currentStamp, setCurrentStamp,
    brushColor, setBrushColor,
    brushWidth, setBrushWidth,

    // 协作
    historyList, setHistoryList,
    onlineUsers, setOnlineUsers,
    chatMessages, setChatMessages,
    alertText, updateAlert,

    // UI
    isMuted, toggleMute,
    phoneCollapsed, togglePhone,

    // WebSocket
    wsRef, setWsRef,
    sendMessage, setSendMessage,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
