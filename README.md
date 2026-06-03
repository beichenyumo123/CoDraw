# 🏝️ CoDraw — 无人岛无限画布协同画板

> 集合啦！基于 **React + FastAPI + WebSocket** 的实时多人协作画板，  
> UI 采用 [animal-island-ui](https://github.com/guokaigdg/animal-island-ui.git) 动森组件库 + Tailwind 手写风格。

![screenshot](/asserts/image.png)

```
   🛩️ 渡渡航空 · 多人登岛申请书
   ┌──────────────────────────────────────────────┐
   │  🐶 岛屿广播站  CoDraw 无限画布沙画板         │ ← Banner
   │  [🎨色块] [笔触6] [🔊] [📱收起]              │   顶栏调色板 + 快选
   ├──────────────────────────┬───────────────────┤
   │                          │  📱 NookPhone     │
   │   🎨 Figma级·无限画布    │  ┌──────────────┐ │
   │   ┌──────────────────┐   │  │ ✏️ 🤚 📦 ⚪  │ │ ← 道具
   │   │  · · · · · · · · │   │  │    🧽        │ │
   │   │  ·  ∞ 网格 · · · │   │  ├──────────────┤ │
   │   │  · · · · · · · · │   │  │ 💬 岛屿公屏  │ │ ← 聊天
   │   └──────────────────┘   │  │ 🐱 hi ~      │ │
   │   [↩️撤销] [🧹清空] [📸] │  ├──────────────┤ │
   │                          │  │ 🐱 小润 (我)  │ │ ← 在线村民
   │                          │  │ 🦝 狸克       │ │
   └──────────────────────────┴───────────────────┘
```

---

## 🏗 项目架构

```
code/
├── backend/                  # Python FastAPI 后端
│   ├── app.py                # WebSocket 协同 + REST + 聊天历史 + 自启前端
│   └── requirements.txt      # fastapi, uvicorn
│
└── frontend/                 # React + Vite 前端
    ├── index.html            # 入口 (Tailwind CDN + 动森滚动条)
    ├── vite.config.js
    └── src/
        ├── main.jsx          # 入口 + animal-island-ui 样式
        ├── App.jsx           # 根布局
        ├── context/
        │   └── AppContext.jsx    # 全局状态 (用户/工具/聊天/sendMessage)
        ├── hooks/
        │   ├── useSound.js       # Web Audio 音效
        │   ├── useWebSocket.js   # WS 连接 + 消息路由 + 聊天
        │   └── useCanvas.js      # 无限画布 60fps 引擎
        ├── components/
        │   ├── Banner.jsx        # 顶栏 + 折叠调色板 + 快捷色块 + 滚轮笔触
        │   ├── JoinModal.jsx     # 登岛注册
        │   ├── InfiniteCanvas.jsx# 核心画布
        │   ├── NookPhone.jsx     # 手机面板 (双层结构, 隐藏滚动条)
        │   ├── ChatPanel.jsx     # 💬 公屏聊天
        │   ├── ToolSelector.jsx  # 5 种绘图道具
        │   ├── UserList.jsx      # 在线村民
        │   └── ZoomControls.jsx  # 缩放控制
        └── data/
            └── villagers.js      # 8 位角色 + 随机名字
```

---

## ✨ 功能特性

### 🎨 绘图工具

| 工具 | 说明 |
|------|------|
| ✏️ 神奇铅笔 | 自由手绘 |
| 🤚 拖拽抓手 | 平移无限画布 |
| 📦 完美木框 | 绘制矩形 |
| ⚪ 圆滚树洞 | 绘制圆形 |
| 🧽 橡皮擦铲 | 擦除 |

- **8 色调色板** — 焦糖褐 / 无人岛绿 / 向日葵黄 / 西瓜红 / 苍翠松针 / 清透浅蓝 / 樱花粉 / 风信子紫
- **笔触 2~30 级** — 顶栏徽章悬停滚轮快捷调节
- **折叠调色板** — 顶栏常驻 6 个快捷色块，点击 ▶ 丝滑展开/收起

### 🗺 无限画布

- Figma 级视口变换（滚轮锚定指针缩放 + Space 拖拽平移）
- Retina 2x 高清渲染
- 60fps `requestAnimationFrame` 驱动
- `ResizeObserver` + debounce 自适应，折叠手机不闪烁
- 一键导出 1920×1080 全景 PNG

### 👥 多人协同

- WebSocket 毫秒级双向广播
- 光标追踪（世界坐标，任意缩放比精准可见）
- 他人绘制轨迹虚线实时显示
- 撤销 / 清空全岛广播
- 4s 断线自动重连

### 💬 公屏聊天

- NookPhone 内嵌，消息气泡（自己绿底靠右 / 他人白底靠左）
- 新消息自动滚底，Enter 发送
- 服务端保留最近 100 条历史，新用户登岛自动同步

### 🎵 动森音效

- `pop` — 按钮点击 · `chirp` — 登岛/重置 · `splat` — 绘制/缩放
- AudioContext 自动 resume，🔊/🔇 一键切换

### 🐾 UI

- [animal-island-ui](https://github.com/guokaigdg/animal-island-ui.git) v0.9.7 Button 组件
- `#F0E6D2` 沙滩背景 + `#4A3728` 焦糖褐粗边框
- `ac-btn` 拟物按钮 3D 按下反馈
- 动森风格滚动条（绿底褐边圆角）
- 8 位经典角色化身（🐶西施惠 🦝狸克 🐿️小润 🐑茶茶丸 🐱杰克 🦊莫妮卡 🐰仰韶 🦅阿波罗）

---

## 🚀 快速启动

**环境**：Python ≥ 3.8 · Node.js ≥ 18

### 一键启动

```bash
cd backend
python app.py
```

自动启动前端 Vite + 后端 Uvicorn。`Ctrl+C` 同时关闭。

```
   🎨 前端：http://localhost:5173
   ⚙️  API：http://127.0.0.1:8000
   🔌  WS：ws://127.0.0.1:8000/ws/{user_id}
```

### 分别启动

```bash
# 后端
cd backend && pip install -r requirements.txt && python app.py

# 前端
cd frontend && npm install && npm run dev
```

---

## 🔌 API

### WebSocket `ws://host:8000/ws/{user_id}?username=昵称&avatar=🐱`

**客户端 → 服务端**

| type | 字段 | 说明 |
|------|------|------|
| `add_shape` | `shape` | 提交完成的图形 |
| `drawing` | `shape` | 绘制草稿 (`null`=结束) |
| `cursor_move` | `x, y` | 光标世界坐标 |
| `undo` | — | 撤销 |
| `clear` | — | 清空 |
| `chat_message` | `text` | 聊天 (≤200 字符) |

**服务端 → 客户端**

| type | 字段 | 说明 |
|------|------|------|
| `init` | `history, chatHistory, users, yourId, yourColor` | 初始化 |
| `user_list` | `users` | 在线用户变更 |
| `broadcast_shape` | `shape` | 新图形 |
| `broadcast_drawing` | `userId, shape` | 他人草稿 |
| `broadcast_cursor` | `userId, x, y, color` | 光标 |
| `broadcast_undo` | `history` | 撤销 |
| `broadcast_clear` | — | 清空 |
| `broadcast_chat` | `message` | 聊天 |

### 数据格式

```json
// Shape
{ "type": "pencil", "points": [{"x":100,"y":200}], "color": "#4A3728", "width": 6 }
{ "type": "rect",   "x":100,"y":200,"w":150,"h":100, "color": "#7BC7A5", "width": 4 }
{ "type": "circle", "cx":300,"cy":400,"r":80, "color": "#F38181", "width": 5 }

// Chat
{ "userId":"abc", "username":"小润", "avatar":"🐱", "color":"#7BC7A5", "text":"hi!", "timestamp":1717400000000 }
```

---

## 🧩 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19 (Hooks + Context) |
| UI 库 | animal-island-ui v0.9.7 (Button) |
| 样式 | Tailwind CSS CDN + 自定义 CSS |
| 画布 | HTML5 Canvas 2D (Retina 2x + 世界坐标变换) |
| 后端 | FastAPI + Uvicorn |
| 实时 | WebSocket |
| 音效 | Web Audio API |

---

## 🎮 操作

| 操作 | 方式 |
|------|------|
| 绘画 | 选择道具 → 左键拖拽 |
| 平移 | **Space** + 拖拽 / 抓手工具 / 右键 |
| 缩放 | 鼠标滚轮 (指针锚定) |
| 换色 | 顶栏色块 / ▶ 展开调色板 |
| 笔触 | 悬停「笔触」滚轮 / 滑块 |
| 撤销/清空/导出 | 画布底部按钮 |
| 收起手机 | 顶栏 📱 |
| 聊天 | 手机内输入 → Enter/发送 |
| 静音 | 顶栏 🔊/🔇 |

---

## 📄 License

MIT 🏝️
