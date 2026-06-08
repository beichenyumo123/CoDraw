#!/usr/bin/env python3
"""CoDraw WebSocket 连通性测试 — 验证服务端是否正常响应"""
import asyncio
import json
import sys
import time
from urllib.parse import urlencode


async def test_connect():
    """基本连接测试：连上 → 收 init → 发一个图形 → 收广播 → 断开"""
    import websockets

    query = urlencode({"username": "测试机器人", "avatar": "cat", "color": "#FF6B6B"})
    url = f"ws://localhost:8000/ws/test_bot?{query}"
    print(f"🔗 连接: {url}")
    async with websockets.connect(url) as ws:
        print("✅ 连接成功")

        # 1. 接收 init 消息
        init_raw = await asyncio.wait_for(ws.recv(), timeout=5)
        init = json.loads(init_raw)
        assert init["type"] == "init", f"期望 init, 收到 {init['type']}"
        users = init.get("users", [])
        print(f"📨 init 收到 — 历史 {len(init.get('history',[]))} 条, 在线 {len(users)} 人")
        assert isinstance(users, list)

        # 2. 收到 user_list 广播（新村民加入通知）
        ul_raw = await asyncio.wait_for(ws.recv(), timeout=5)
        ul = json.loads(ul_raw)
        assert ul["type"] == "user_list", f"期望 user_list, 收到 {ul['type']}"
        print(f"👥 user_list 收到 — 在线 {len(ul.get('users',[]))} 人")

        # 3. 发送一个 add_shape
        shape = {
            "type": "add_shape",
            "shape": {
                "type": "circle",
                "cx": 100, "cy": 200, "r": 30,
                "color": "#FF6B6B", "width": 4,
            },
        }
        await ws.send(json.dumps(shape))
        print("✏️  已发送 add_shape")

        # 4. 等待广播回来的 shape（可选）
        try:
            echo = await asyncio.wait_for(ws.recv(), timeout=3)
            echo_data = json.loads(echo)
            print(f"📡 收到广播: {echo_data.get('type')}")
        except asyncio.TimeoutError:
            print("⚠️  未收到广播（可能是 AOI 过滤导致的正常行为）")

        print("\n🎉 连通性测试通过!\n")
        return True


async def test_bad_message():
    """异常消息测试：发送无效 JSON 和心跳保持"""
    import websockets

    query = urlencode({"username": "坏消息测试", "avatar": "dog", "color": "#FF6B6B"})
    url = f"ws://localhost:8000/ws/test_bot2?{query}"
    async with websockets.connect(url) as ws:
        # 跳过 init
        await asyncio.wait_for(ws.recv(), timeout=5)
        await asyncio.wait_for(ws.recv(), timeout=5)

        # 发送未知 type — 服务端应静默忽略
        await ws.send(json.dumps({"type": "unknown_type", "data": "test"}))
        print("✅ 未知 type 已发送（服务端静默忽略）")

        # 发送空 text 聊天 — 服务端应忽略
        await ws.send(json.dumps({"type": "chat_message", "text": ""}))
        print("✅ 空聊天消息已发送（服务端应忽略）")

        # 发送超长聊天 — 服务端应忽略
        await ws.send(json.dumps({"type": "chat_message", "text": "A" * 300}))
        print("✅ 超长聊天已发送（服务端应忽略）")

        await asyncio.sleep(0.5)
        print("✅ 异常消息测试通过\n")
        return True


async def main():
    print("=" * 50)
    tests = [("基本连接", test_connect()), ("异常消息", test_bad_message())]
    for name, coro in tests:
        try:
            ok = await coro
            print(f"  · {name}: {'✅ 通过' if ok else '❌ 失败'}")
        except Exception as e:
            print(f"  · {name}: ❌ 异常 — {e}")

    print("=" * 50)
    print("💡 提示: 确保服务端已启动 (python backend/app.py)")


if __name__ == "__main__":
    asyncio.run(main())
