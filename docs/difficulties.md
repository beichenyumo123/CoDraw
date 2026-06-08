# 八、遇到的难点与解决方案

## 1. WebSocket 断线重连

**问题**：在 iPad 或弱网环境下，网络抖动会导致 WebSocket 连接短暂断开。原代码中 `onclose` 只触发状态更新，没有自动重连机制，用户必须手动刷新页面才能恢复协同。

**解决方案**：实现指数退避（Exponential Backoff）自动重连：
- 断开后间隔 1s → 2s → 4s → 8s → 10s（上限）逐次重连
- 最多尝试 5 次，超过后提示用户刷新页面
- 正常关闭（code 1000）不触发重连，避免用户主动退出时误连
- 连接成功后重置退避计数和间隔

```python
# 后端 app.py — disconnect 时不主动触发
# 前端 useWebSocket.js
ws.onclose = (event) => {
  if (event.code === 1000 || reconnectCount.current >= 5) return;
  const delay = reconnectDelay.current;
  reconnectDelay.current = Math.min(delay * 2, 10000);
  reconnectCount.current += 1;
  reconnectTimer.current = setTimeout(() => connect(), delay);
};
```

## 2. 广播阻塞接收循环

**问题**：WebSocket 接收循环中，每条消息都 `await manager.broadcast(...)`，广播要等所有 N-1 个 `send_json` 完成后才返回。当在线用户达到 200+ 时，一次广播耗时近百毫秒，接收循环在这期间无法处理新消息。多个用户的发送请求在系统缓冲区堆积，形成恶性循环。

**解决方案**：用 `asyncio.create_task` 将广播调度到后台，接收循环立即回到 `receive_text()`。同时引入 `asyncio.Semaphore(100)` 限制并发广播数，防止洪峰时无限积压：

```python
class ConnectionManager:
    def __init__(self):
        self._broadcast_sem = asyncio.Semaphore(100)

    async def broadcast(self, message, exclude=None):
        async with self._broadcast_sem:    # ← 背压保护
            tasks = [conn.send_json(message)
                     for conn in self.active_connections
                     if conn != exclude]
            await asyncio.gather(*tasks, return_exceptions=True)

# 接收循环中用 create_task 替代 await
asyncio.create_task(manager.broadcast(message, exclude=websocket))
```

## 3. 画笔高频消息洪峰

**问题**：铅笔工具在 `mousemove` 事件中每次移动都向服务端发送 `drawing` 消息。快速划线时一帧内可能触发十几次 mousemove，产生大量冗余 WS 消息，浪费带宽且增大后端广播压力。

**解决方案**：对画笔 WS 广播施加 50ms 节流（Throttle）。本地 `points.push` 不节流（保证手感跟手），仅限制 WebSocket 发送频率：

```javascript
// useCanvas.js
const lastDrawingSend = useRef(0);

// onDrawMove 中：
const now = Date.now();
if (sendMsg && tool !== 'stamp' && tool !== 'pixel' && now - lastDrawingSend.current > 50) {
  sendMsg({ type: 'drawing', shape: activeDrawing.current });
  lastDrawingSend.current = now;
}
```

鼠标抬起（`mouseup`）时通过 `add_shape` 发送完整的折线数据，中间丢失的中间帧不会影响最终绘图效果。

## 4. Retina 屏幕画布模糊

**问题**：在 MacBook Pro（DPR=2）和 iPhone（DPR=3）上，Canvas 尺寸硬编码为 CSS 像素的 2 倍，当设备像素比超过 2 时，绘制出的线条和印章明显模糊。普通 DPR=1 的显示器则白白做了 2 倍像素的无效渲染。

**解决方案**：将硬编码的 `* 2` 替换为 `window.devicePixelRatio || 1`：

```javascript
// useCanvas.js — resizeCanvas
const dpr = window.devicePixelRatio || 1;
canvas.width = rect.width * dpr;
canvas.height = rect.height * dpr;
canvas.style.width = `${rect.width}px`;
canvas.style.height = `${rect.height}px`;
const ctx = canvas.getContext('2d');
ctx.scale(dpr, dpr);
```

同步修复了 `PixelPanel.jsx` 中像素画编辑器 Canvas 的相同问题。

## 5. 绘图历史无限增长导致内存泄漏

**问题**：`DRAWING_HISTORY` 列表每收到一个 `add_shape` 就无条件 `append`，从未清理。连续使用数小时后，服务器内存被数万乃至数十万个图形对象占满，新用户的 `init` 消息也越来越大。

**解决方案**：设定 `MAX_DRAWING_HISTORY = 10000`，超出时裁剪为最近 10000 条。新用户同步的快照仍限制为 `MAX_INIT_HISTORY = 300`：

```python
DRAWING_HISTORY.append(entry)
if len(DRAWING_HISTORY) > MAX_DRAWING_HISTORY:
    DRAWING_HISTORY[:] = DRAWING_HISTORY[-MAX_DRAWING_HISTORY:]
```

聊天记录同理，上限 100 条。

## 6. 用户专属撤销的协同冲突

**问题**：初始版本中撤销功能直接删除图形列表的最后一条记录。在多人协同场景下，用户 A 的撤销可能会误删用户 B 刚画的图形，导致"把别人的画给撤了"的协同 Bug。

**解决方案**：改为**软删除** + **按用户过滤**：

```python
# 只撤销当前用户创建的最后一个未删除图形
for entry in reversed(DRAWING_HISTORY):
    if entry["userId"] == user_id and not entry.get("deleted", False):
        entry["deleted"] = True    # ← 软删除，保留历史
        break
```

每个图形添加 `shapeId`（UUID）和 `deleted` 字段。撤销时标记 `deleted = True` 而非删除对象，保留回滚可能性。广播 `broadcast_undo` 消息通知其他客户端更新本地渲染。

## 7. 像素画放置坐标偏移

**问题**：像素画拖拽到画布上时，放置位置与实际鼠标落点不符，出现偏移。原因是像素画的网格（GRID_SIZE=16）与画布世界坐标的换算关系未正确处理缩放比例。

**解决方案**：重构 `PixelPanel.jsx` 中的坐标计算：

```javascript
// 将像素网格坐标转换为世界坐标
const worldX = screenToWorld(mouseX - gridOffsetX, mouseY - gridOffsetY).x;
const worldY = screenToWorld(mouseX - gridOffsetX, mouseY - gridOffsetY).y;

// 构造像素画 shape 时传入正确的世界坐标
const pixelShape = buildPixelShape(pixels, worldX, worldY, GRID_SIZE);
```

同时修复了像素画数据的二进制压缩传输格式避免 JSON 序列化带来的精度丢失。

## 8. AOI 视口广播的性能优化

**问题**：初始版本中，所有图形和光标更新都全量广播给所有在线用户。当用户分布在不同区域（视口不相交）时，浪费了大量带宽广播不可见的内容。

**解决方案**：实现基于视口（Area of Interest）的广播过滤：

- 客户端在平移/缩放时发送 `viewport_update` 上报当前视口范围
- 服务端缓存每个 WebSocket 的视口数据
- 广播时只推送给视口与图形有交集的客户端
- 视口范围外扩 50% 缓冲，避免视口边界"闪烁"

```python
def _shape_in_viewport(self, shape, viewport):
    # 检查图形是否在视口内（含 50% 缓冲区）
    buf_x = (viewport["xmax"] - viewport["xmin"]) * 0.5
    # ... 按图形类型做粗粒度碰撞检测
    return any(point_in_viewport(p) for p in points)
```

## 9. 手机面板收起状态未同步

**问题**：NookPhone（手机面板）的收起/展开状态在各组件间不一致。点击收起按钮后，面板隐藏但顶栏的按钮状态未更新，导致下一个点击行为异常。

**解决方案**：将 `phoneCollapsed` 状态提升到 `AppContext` 全局状态，所有组件通过 Context 读取和修改同一份状态：

```javascript
// AppContext.jsx
const [phoneCollapsed, setPhoneCollapsed] = useState(true);
const togglePhone = useCallback(() => setPhoneCollapsed(p => !p), []);
```

## 10. 实时打字气泡闪烁

**问题**：多人聊天输入时，打字状态（`typing`）消息以高频广播，导致气泡在短时间内频繁出现和消失，UI 闪烁严重。

**解决方案**：服务端不做节流（保证实时性），由客户端做延迟过期处理：

```javascript
// 收到 typing 消息时，设置 4s 过期时间
typingUsers[message.userId] = {
  username: message.username,
  expiresAt: Date.now() + 4000,  // 4s 后自动过期
};

// 收到 chat_message 时，立即清除该用户的打字状态
delete typingUsers[message.message.userId];
```

渲染时每帧检查 `expiresAt` 是否过期，过期则不显示。这样即便网络有轻微抖动，气泡也不会闪烁。

---

### 总结

每个问题的解决都围绕三个核心原则：

1. **非阻塞**：所有 I/O 操作（广播、数据库）都不阻塞主接收循环
2. **有界资源**：所有列表（历史、聊天）和并发（广播）都设有上限
3. **状态一致性**：协同场景下的状态变更（撤销、收起/展开）通过唯一 ID 和软删除保证不冲突
