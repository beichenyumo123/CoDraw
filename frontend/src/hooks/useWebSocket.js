import { useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';

// 独立的模块级变量，不在 React state 中频繁更新，避免触发的 re-render 影响 canvas 性能
let historyList = [];
let otherDrawings = {};
let cursors = {};
let chatMessages = [];
let typingUsers = {};
let pendingSfx = []; // 音效协同队列 // { userId: { username, expiresAt } }
let dreamShapes = []; // 梦境番地叠加层（仅本地渲染，不广播）
let pixelState = { pixels: Array(256).fill(null), color: '#4A3728' }; // 像素画状态持久化

export function getHistoryList() { return historyList; }
export function setHistoryList(arr) { historyList = arr; }
export function getOtherDrawings() { return otherDrawings; }
export function getCursors() { return cursors; }
export function getTypingUsers() { return typingUsers; }
export function getDreamShapes() { return dreamShapes; }
export function setDreamShapes(arr) { dreamShapes = arr; }
export function consumePendingSfx() { const s = pendingSfx; pendingSfx = []; return s; }
export function getPixelState() { return pixelState; }
export function setPixelState(s) { pixelState = s; }

export default function useWebSocket() {
  const {
    userId, setMyColor, setOnlineUsers,
    updateAlert, setWsRef, setChatMessages, setSendMessage,
  } = useAppContext();

  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(1000); // 指数退避：1s → 2s → 4s → 8s → 16s

  const connect = useCallback((username, avatar) => {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const apiHost = import.meta.env.VITE_API_HOST || window.location.hostname;
    const apiPort = import.meta.env.VITE_API_PORT || '8000';
    const wsUrl = `${protocol}${apiHost}:${apiPort}/ws/${userId}?username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatar)}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      reconnectDelay.current = 1000; // 连接成功，重置退避
      updateAlert('🌳 成功抵达无人岛！按住空格键拖拽，或使用抓手工具拖拽，尽情平移吧！');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const type = message.type;

      if (type === 'init') {
        historyList = message.history;
        chatMessages = message.chatHistory || [];
        setChatMessages([...chatMessages]);
        setMyColor(message.yourColor);
        setOnlineUsers(message.users);
      } else if (type === 'user_list') {
        setOnlineUsers(message.users);
      } else if (type === 'broadcast_shape') {
        // 新格式：entry { shapeId, userId, shape, deleted }
        historyList.push(message.entry || { shape: message.shape, deleted: false });
      } else if (type === 'broadcast_drawing') {
        if (message.shape === null) {
          delete otherDrawings[message.userId];
        } else {
          otherDrawings[message.userId] = {
            username: message.username,
            avatar: message.avatar,
            shape: message.shape,
          };
        }
      } else if (type === 'broadcast_cursor') {
        cursors[message.userId] = {
          username: message.username,
          color: message.color,
          avatar: message.avatar,
          x: message.x,
          y: message.y,
          lastUpdate: Date.now(),
        };
      } else if (type === 'broadcast_undo') {
        // 按 shapeId 软删除（用户专属撤销）
        const entry = historyList.find(e => e.shapeId === message.shapeId);
        if (entry) entry.deleted = true;
      } else if (type === 'broadcast_clear') {
        // 全量标记删除（不再清空数组）
        historyList.forEach(e => { e.deleted = true; });
        otherDrawings = {};
      } else if (type === 'broadcast_sfx') {
        pendingSfx.push(message.sound);
      } else if (type === 'broadcast_typing') {
        if (message.active) {
          typingUsers[message.userId] = {
            username: message.username,
            expiresAt: Date.now() + 4000, // 4s 后自动过期
          };
        } else {
          delete typingUsers[message.userId];
        }
      } else if (type === 'broadcast_chat') {
        chatMessages.push(message.message);
        if (chatMessages.length > 100) {
          chatMessages = chatMessages.slice(-100);
        }
        setChatMessages([...chatMessages]);
        // 收到聊天消息 → 清除该用户的打字状态
        delete typingUsers[message.message.userId];
      }
    };

    ws.onclose = () => {
      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(delay * 2, 16000); // 指数退避，上限 16s
      updateAlert(`🚨 网络离线，${Math.round(delay / 1000)}s 后重连...`);
      reconnectTimer.current = setTimeout(() => connect(username, avatar), delay);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
    setWsRef(ws);
    // 把 sendMessage 写入 context，供 ChatPanel 等子组件使用
    const send = (msg) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
        return true;
      }
      return false;
    };
    setSendMessage(() => send);
  }, [userId, setMyColor, setOnlineUsers, updateAlert, setWsRef, setChatMessages]);

  const sendMessage = useCallback((msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setWsRef(null);
    }
  }, [setWsRef]);

  return { connect, sendMessage, disconnect, wsRef };
}
