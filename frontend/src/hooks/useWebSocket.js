import { useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';

// 独立的模块级变量，不在 React state 中频繁更新，避免触发的 re-render 影响 canvas 性能
let historyList = [];
let otherDrawings = {};
let cursors = {};

export function getHistoryList() { return historyList; }
export function getOtherDrawings() { return otherDrawings; }
export function getCursors() { return cursors; }

export default function useWebSocket() {
  const {
    userId, setMyColor, setOnlineUsers,
    updateAlert, setWsRef,
  } = useAppContext();

  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback((username, avatar) => {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    // 开发时后端在 8000 端口
    const apiHost = import.meta.env.VITE_API_HOST || window.location.hostname;
    const apiPort = import.meta.env.VITE_API_PORT || '8000';
    const wsUrl = `${protocol}${apiHost}:${apiPort}/ws/${userId}?username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatar)}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      updateAlert('🌳 成功抵达无人岛！按住空格键拖拽，或使用抓手工具拖拽，尽情平移吧！');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const type = message.type;

      if (type === 'init') {
        historyList = message.history;
        setMyColor(message.yourColor);
        setOnlineUsers(message.users);
      } else if (type === 'user_list') {
        setOnlineUsers(message.users);
      } else if (type === 'broadcast_shape') {
        historyList.push(message.shape);
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
        historyList = message.history;
      } else if (type === 'broadcast_clear') {
        historyList = [];
        otherDrawings = {};
      }
    };

    ws.onclose = () => {
      updateAlert('🚨 渡渡航空航班网络离线，正在重新呼叫服务器中...');
      reconnectTimer.current = setTimeout(() => connect(username, avatar), 4000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
    setWsRef(ws);
  }, [userId, setMyColor, setOnlineUsers, updateAlert, setWsRef]);

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
