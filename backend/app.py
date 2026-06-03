import asyncio
import json
import random
import uuid
from typing import Dict, List, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

# 初始化 FastAPI 应用
app = FastAPI(title="CoDraw 无人岛无限画布协同画板")

# ----------------- CORS 中间件 (前后端分离) -----------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发阶段允许所有来源，生产环境应限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- 服务端状态管理 -----------------

# 全局存储所有已提交的历史图形列表 (所有点和坐标采用世界坐标系存储，确保在不同客户端的缩放/平移视图下完美同步)
DRAWING_HISTORY: List[Dict[str, Any]] = []

# 公屏聊天历史（保留最近 100 条）
CHAT_HISTORY: List[Dict[str, Any]] = []
MAX_CHAT_HISTORY = 100


class ConnectionManager:
    """
    WebSocket 连接管理器：维护当前在线的客户端连接，分配随机属性，
    并实现并发广播机制。
    """

    def __init__(self):
        # 存储处于连接状态的 WebSocket 实例
        self.active_connections: List[WebSocket] = []
        # 映射 WebSocket 连接到其对应的用户信息 { "userId": str, "username": str, "color": str, "avatar": str }
        self.user_info: Dict[WebSocket, Dict[str, str]] = {}

    async def connect(
        self, websocket: WebSocket, user_id: str, username: str, color: str, avatar: str
    ):
        """客户端建立连接并注册"""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.user_info[websocket] = {
            "userId": user_id,
            "username": username,
            "color": color,
            "avatar": avatar,
        }

    def disconnect(self, websocket: WebSocket):
        """客户端断开连接"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.user_info:
            del self.user_info[websocket]

    def get_online_users(self) -> List[Dict[str, str]]:
        """获取当前所有在线用户的信息列表"""
        return list(self.user_info.values())

    async def broadcast(self, message: Dict[str, Any], exclude: WebSocket = None):
        """
        并发广播消息：确保消息分发独立进行，实现真正的毫秒级超低延迟同步。
        """
        tasks = []
        for connection in self.active_connections:
            if connection != exclude:
                tasks.append(connection.send_json(message))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)


# 实例化连接管理器
manager = ConnectionManager()


# ----------------- WebSocket 端点 -----------------


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    username: str = Query("小蜜蜂"),
    avatar: str = Query("🐱"),
):
    # 为当前新用户生成一个好看的随机颜色
    avatar_color = random.choice(
        [
            "#7BC7A5",
            "#F8D147",
            "#F38181",
            "#A29BFE",
            "#0ea5e9",
            "#8b5cf6",
            "#ec4899",
            "#14b8a6",
        ]
    )

    # 建立 WebSocket 连接
    await manager.connect(websocket, user_id, username, avatar_color, avatar)

    try:
        # 1. 建立连接后，向该客户端同步当前画板的历史图形、在线人员、聊天记录
        await websocket.send_json(
            {
                "type": "init",
                "history": DRAWING_HISTORY,
                "chatHistory": CHAT_HISTORY,
                "users": manager.get_online_users(),
                "yourId": user_id,
                "yourColor": avatar_color,
                "yourAvatar": avatar,
            }
        )

        # 2. 并发广播新村民加入的消息
        await manager.broadcast(
            {"type": "user_list", "users": manager.get_online_users()}
        )

        # 3. 循环监听客户端指令
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")

            if msg_type == "add_shape":
                shape = message.get("shape")
                if shape:
                    entry = {
                        "shapeId": str(uuid.uuid4()),
                        "userId": user_id,
                        "shape": shape,
                        "deleted": False,
                    }
                    DRAWING_HISTORY.append(entry)
                    await manager.broadcast({"type": "broadcast_shape", "entry": entry})

            elif msg_type == "drawing":
                shape = message.get("shape")
                await manager.broadcast(
                    {
                        "type": "broadcast_drawing",
                        "userId": user_id,
                        "username": username,
                        "avatar": avatar,
                        "shape": shape,
                    },
                    exclude=websocket,
                )

            elif msg_type == "cursor_move":
                # 收到客户端的世界坐标光标，广播给其他人
                x = message.get("x")
                y = message.get("y")
                await manager.broadcast(
                    {
                        "type": "broadcast_cursor",
                        "userId": user_id,
                        "username": username,
                        "avatar": avatar,
                        "color": avatar_color,
                        "x": x,
                        "y": y,
                    },
                    exclude=websocket,
                )

            elif msg_type == "undo":
                # 用户专属撤销：只撤销当前用户创建的最后一个未删除图形
                undone = False
                for entry in reversed(DRAWING_HISTORY):
                    if entry["userId"] == user_id and not entry.get("deleted", False):
                        entry["deleted"] = True
                        undone = True
                        await manager.broadcast(
                            {"type": "broadcast_undo", "shapeId": entry["shapeId"]}
                        )
                        break
                if not undone:
                    # 没有可撤销的 → 告诉该客户端（静默忽略）
                    pass

            elif msg_type == "chat_message":
                text = message.get("text", "").strip()
                if text and len(text) <= 200:
                    chat_msg = {
                        "userId": user_id,
                        "username": username,
                        "avatar": avatar,
                        "color": avatar_color,
                        "text": text,
                        "timestamp": int(asyncio.get_event_loop().time() * 1000),
                    }
                    CHAT_HISTORY.append(chat_msg)
                    # 限制聊天记录数量（slice 赋值，不创建局部变量）
                    if len(CHAT_HISTORY) > MAX_CHAT_HISTORY:
                        CHAT_HISTORY[:] = CHAT_HISTORY[-MAX_CHAT_HISTORY:]
                    await manager.broadcast(
                        {"type": "broadcast_chat", "message": chat_msg}
                    )

            elif msg_type == "clear":
                # 标记全部为已删除（保留历史用于可能的恢复）
                for entry in DRAWING_HISTORY:
                    entry["deleted"] = True
                await manager.broadcast({"type": "broadcast_clear"})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(
            {"type": "user_list", "users": manager.get_online_users()}
        )


# ----------------- HTTP API 端点 -----------------


@app.get("/")
async def root():
    """API 根路径，返回服务状态"""
    return {
        "status": "ok",
        "service": "CoDraw 无人岛无限画布协同画板 API",
        "online_users": len(manager.active_connections),
        "drawings": len(DRAWING_HISTORY),
    }


@app.get("/health")
async def health():
    """健康检查端点"""
    return {"status": "healthy"}


# ----------------- 启动入口 -----------------

if __name__ == "__main__":
    import uvicorn
    import subprocess
    import signal
    import time
    from pathlib import Path

    # 前端项目路径（相对于 backend/ 的上一级目录下的 frontend/）
    FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

    frontend_proc = None

    if FRONTEND_DIR.exists():
        print("🚀 正在启动前端 Vite 开发服务器...")
        frontend_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=str(FRONTEND_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        # 等 Vite 启动完成（最长等 15 秒）
        deadline = time.time() + 15
        started = False
        if frontend_proc.stdout:
            for line in frontend_proc.stdout:
                print(f"  [vite] {line.rstrip()}")
                if "Local:" in line or "localhost" in line:
                    started = True
                    break
                if time.time() > deadline:
                    break
        if not started:
            print("  ⚠️ Vite 可能还在启动中，请稍候...")

    def cleanup(signum=None, frame=None):
        if frontend_proc and frontend_proc.poll() is None:
            print("\n🛬 正在关闭前端开发服务器...")
            frontend_proc.terminate()
            try:
                frontend_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                frontend_proc.kill()
        print("👋 再见！")

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print("=" * 60)
    print("🖼️  CoDraw 实时多人【无限画布】协同服务器已全景启动！")
    print("=" * 60)
    print(f"   🎨 前端画布：http://localhost:5173")
    print(f"   ⚙️  API 服务：http://127.0.0.1:8000")
    print(f"   🔌 WebSocket：ws://127.0.0.1:8000/ws/{{user_id}}")
    print("=" * 60)
    print("按住空格键 + 拖拽即可在画布平移，滚轮自由缩放！")
    print("按 Ctrl+C 同时关闭前端和后端。")
    print("=" * 60)

    try:
        uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
    finally:
        cleanup()
