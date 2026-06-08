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

# 快照增量：新用户只同步最近 N 条图形（避免超大 init JSON）
MAX_INIT_HISTORY = 300

# 绘图历史上限：防止无限增长导致内存泄漏
MAX_DRAWING_HISTORY = 10000


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
        # AOI 视口缓存：{ websocket: { xmin, ymin, xmax, ymax } }
        self.viewports: Dict[WebSocket, Dict[str, float]] = {}
        # 并发广播信号量：限制同时进行中的广播任务数，防止洪峰积压
        self._broadcast_sem = asyncio.Semaphore(100)

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
        if websocket in self.viewports:
            del self.viewports[websocket]

    def get_online_users(self) -> List[Dict[str, str]]:
        """获取当前所有在线用户的信息列表"""
        return list(self.user_info.values())

    def _shape_in_viewport(self, shape: Dict, viewport: Dict) -> bool:
        """检查图形是否在视口内（含 50% 缓冲区）"""
        if not viewport:
            return True  # 无 viewport → 全量广播
        vw = viewport["xmax"] - viewport["xmin"]
        vh = viewport["ymax"] - viewport["ymin"]
        buf_x = vw * 0.5
        buf_y = vh * 0.5
        vx0 = viewport["xmin"] - buf_x
        vx1 = viewport["xmax"] + buf_x
        vy0 = viewport["ymin"] - buf_y
        vy1 = viewport["ymax"] + buf_y

        def _overlap(sx, sy):
            return vx0 <= sx <= vx1 and vy0 <= sy <= vy1

        st = shape.get("type", "")
        if st in ("pencil", "eraser"):
            pts = shape.get("points", [])
            if not pts:
                return False
            # 检查是否有任意点在视口内
            return any(_overlap(p["x"], p["y"]) for p in pts)
        elif st == "stamp":
            return _overlap(shape.get("x", 0), shape.get("y", 0))
        elif st == "rect":
            return _overlap(shape.get("x", 0), shape.get("y", 0))
        elif st == "circle":
            return _overlap(shape.get("cx", 0), shape.get("cy", 0))
        return True  # 未知类型全量广播

    def _cursor_in_viewport(self, x: float, y: float, viewport: Dict) -> bool:
        """检查光标是否在视口内（含缓冲区）"""
        if not viewport:
            return True
        vw = viewport["xmax"] - viewport["xmin"]
        vh = viewport["ymax"] - viewport["ymin"]
        buf_x = vw * 0.5
        buf_y = vh * 0.5
        return (viewport["xmin"] - buf_x <= x <= viewport["xmax"] + buf_x and
                viewport["ymin"] - buf_y <= y <= viewport["ymax"] + buf_y)

    async def broadcast(self, message: Dict[str, Any], exclude: WebSocket = None):
        """并发广播（全局消息），带信号量背压防止洪峰"""
        async with self._broadcast_sem:
            tasks = []
            for connection in self.active_connections:
                if connection != exclude:
                    tasks.append(connection.send_json(message))
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_aoi_shape(self, shape: Dict, exclude: WebSocket = None):
        """按视口广播图形（仅推送给看得见的用户），带信号量背压"""
        async with self._broadcast_sem:
            tasks = []
            for conn in self.active_connections:
                if conn == exclude:
                    continue
                vp = self.viewports.get(conn)
                if self._shape_in_viewport(shape, vp):
                    tasks.append(conn.send_json({"type": "broadcast_shape", "entry": shape}))
            # 始终推送给无 viewport 的客户端（刚连接未同步）
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_aoi_cursor(self, user_id: str, x: float, y: float,
                                    username: str, avatar: str, color: str,
                                    exclude: WebSocket = None):
        """按视口广播光标，带信号量背压"""
        async with self._broadcast_sem:
            tasks = []
            msg = {"type": "broadcast_cursor", "userId": user_id,
                   "username": username, "avatar": avatar, "color": color, "x": x, "y": y}
            for conn in self.active_connections:
                if conn == exclude:
                    continue
                vp = self.viewports.get(conn)
                if self._cursor_in_viewport(x, y, vp):
                    tasks.append(conn.send_json(msg))
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
        # 1. 建立连接后，向该客户端同步画板（截断历史）、在线人员、聊天记录
        recent_history = DRAWING_HISTORY[-MAX_INIT_HISTORY:] if len(DRAWING_HISTORY) > MAX_INIT_HISTORY else DRAWING_HISTORY
        await websocket.send_json(
            {
                "type": "init",
                "history": recent_history,
                "truncated": len(DRAWING_HISTORY) > MAX_INIT_HISTORY,
                "totalShapes": len(DRAWING_HISTORY),
                "chatHistory": CHAT_HISTORY,
                "users": manager.get_online_users(),
                "yourId": user_id,
                "yourColor": avatar_color,
                "yourAvatar": avatar,
            }
        )

        # 2. 并发广播新村民加入的消息（后台任务，不阻塞接收循环）
        asyncio.create_task(
            manager.broadcast({"type": "user_list", "users": manager.get_online_users()})
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
                    # 限制绘图历史上限，防止内存泄漏
                    if len(DRAWING_HISTORY) > MAX_DRAWING_HISTORY:
                        DRAWING_HISTORY[:] = DRAWING_HISTORY[-MAX_DRAWING_HISTORY:]
                    asyncio.create_task(manager.broadcast_aoi_shape(entry))

            elif msg_type == "drawing":
                shape = message.get("shape")
                asyncio.create_task(
                    manager.broadcast(
                        {
                            "type": "broadcast_drawing",
                            "userId": user_id,
                            "username": username,
                            "avatar": avatar,
                            "shape": shape,
                        },
                        exclude=websocket,
                    )
                )

            elif msg_type == "cursor_move":
                x = message.get("x")
                y = message.get("y")
                asyncio.create_task(
                    manager.broadcast_aoi_cursor(
                        user_id, x, y, username, avatar, avatar_color, exclude=websocket
                    )
                )

            elif msg_type == "viewport_update":
                # AOI：客户端同步视口范围
                manager.viewports[websocket] = {
                    "xmin": message.get("xmin", -5000),
                    "ymin": message.get("ymin", -5000),
                    "xmax": message.get("xmax", 5000),
                    "ymax": message.get("ymax", 5000),
                }

            elif msg_type == "sfx":
                # 音效协同广播
                sound = message.get("sound", "pop")
                asyncio.create_task(
                    manager.broadcast(
                        {
                            "type": "broadcast_sfx",
                            "sound": sound,
                            "userId": user_id,
                        },
                        exclude=websocket,
                    )
                )

            elif msg_type == "typing":
                # 打字状态广播（气泡提示）
                active = message.get("active", False)
                asyncio.create_task(
                    manager.broadcast(
                        {
                            "type": "broadcast_typing",
                            "userId": user_id,
                            "username": username,
                            "active": active,
                        },
                        exclude=websocket,
                    )
                )

            elif msg_type == "undo":
                # 用户专属撤销：只撤销当前用户创建的最后一个未删除图形
                undone = False
                for entry in reversed(DRAWING_HISTORY):
                    if entry["userId"] == user_id and not entry.get("deleted", False):
                        entry["deleted"] = True
                        undone = True
                        asyncio.create_task(
                            manager.broadcast(
                                {"type": "broadcast_undo", "shapeId": entry["shapeId"]}
                            )
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
                    asyncio.create_task(
                        manager.broadcast(
                            {"type": "broadcast_chat", "message": chat_msg}
                        )
                    )

            elif msg_type == "clear":
                # 标记全部为已删除（保留历史用于可能的恢复）
                for entry in DRAWING_HISTORY:
                    entry["deleted"] = True
                asyncio.create_task(manager.broadcast({"type": "broadcast_clear"}))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        asyncio.create_task(
            manager.broadcast(
                {"type": "user_list", "users": manager.get_online_users()}
            )
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


# ----------------- 梦境番地 (Dream Address) -----------------

import string as _string
import random as _random

# 梦境存档存储 { code: { shapes, chat, creator, created_at } }
DREAMS: Dict[str, Dict[str, Any]] = {}

def _gen_dream_code() -> str:
    """生成 8 位梦境番地码（大写字母+数字）"""
    chars = _string.ascii_uppercase + _string.digits
    return ''.join(_random.choices(chars, k=8))


@app.post("/dream/save")
async def dream_save(data: Dict[str, Any]):
    """保存当前画布为梦境番地，返回 8 位访问码"""
    code = _gen_dream_code()
    # 确保不重复
    while code in DREAMS:
        code = _gen_dream_code()
    DREAMS[code] = {
        "shapes": [e for e in DRAWING_HISTORY if not e.get("deleted", False)],
        "chat": list(CHAT_HISTORY),
        "creator": data.get("creator", "匿名村民"),
        "created_at": int(asyncio.get_event_loop().time() * 1000),
        "shapeCount": len([e for e in DRAWING_HISTORY if not e.get("deleted", False)]),
    }
    return {"code": code, "url": f"/dream/{code}"}


@app.get("/dream/{code}")
async def dream_load(code: str):
    """加载梦境番地（只读）"""
    dream = DREAMS.get(code)
    if not dream:
        return {"error": "梦境番地不存在", "code": code}, 404
    return {
        "code": code,
        "creator": dream["creator"],
        "created_at": dream["created_at"],
        "shapeCount": dream["shapeCount"],
        "shapes": dream["shapes"],
        "chat": dream["chat"],
        "readonly": True,
    }


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
        frontend_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=str(FRONTEND_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def cleanup(signum=None, frame=None):
        if frontend_proc and frontend_proc.poll() is None:
            frontend_proc.terminate()
            try:
                frontend_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                frontend_proc.kill()

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    print("🏝️  CoDraw 已启动  http://localhost:5173  |  Ctrl+C 退出")

    try:
        uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
    finally:
        cleanup()
