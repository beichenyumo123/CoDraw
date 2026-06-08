#!/usr/bin/env python3
"""
CoDraw 性能压测工具 — 模拟 N 个用户并发绘图

用法:
    # 基本测试 (10 用户, 30 秒)
    python tests/benchmark_client.py

    # 中负载测试 (50 用户, 60 秒)
    python tests/benchmark_client.py --users 50 --duration 60

    # 高负载测试 (200 用户, 60 秒)
    python tests/benchmark_client.py --users 200 --duration 60

    # 指定服务端地址
    python tests/benchmark_client.py --host 192.168.1.100 --port 8000

    # 只测试延迟 (ping/pong，不发送图形)
    python tests/benchmark_client.py --ping-only
"""
import asyncio
import json
import random
import sys
import time
import statistics
import argparse
import os
from urllib.parse import urlencode

# 确保能找到 websockets
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

AVATARS = ["cat", "dog", "rabbit", "bear", "fox", "owl", "frog", "mouse"]
COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"]


class Stats:
    """线程安全的统计收集器（asyncio 单线程，直接用 list）"""
    def __init__(self):
        self.latencies = []   # 消息 RTT (ms)
        self.ping_rtts = []   # WebSocket ping RTT (ms)
        self.errors = 0
        self.connected = 0
        self.sent = 0
        self.received = 0
        self._start = time.monotonic()

    def elapsed(self):
        return time.monotonic() - self._start


stats = Stats()
AVATAR_COLORS = {}  # uid → color


async def simulate_user(uid: int, args):
    """单个模拟用户：连接 → 循环发送图形 → 接收广播 → 断开"""
    name = f"bot_{uid:04d}"
    avatar = random.choice(AVATARS)
    color = random.choice(COLORS)
    AVATAR_COLORS[uid] = color

    import websockets

    if args.host:
        host = args.host
        port = args.port
    else:
        host = "localhost"
        port = 8000

    query = urlencode({"username": name, "avatar": avatar, "color": color})
    url = f"ws://{host}:{port}/ws/{uid}?{query}"

    try:
        async with websockets.connect(url, ping_interval=10, ping_timeout=5) as ws:
            stats.connected += 1

            # 跳过 init + user_list
            await asyncio.wait_for(ws.recv(), timeout=10)
            await asyncio.wait_for(ws.recv(), timeout=10)

            end_time = time.monotonic() + args.duration

            while time.monotonic() < end_time:

                if args.ping_only:
                    # 纯延迟测试：使用 WebSocket ping/pong
                    start = time.monotonic()
                    pong_waiter = await ws.ping()
                    await asyncio.wait_for(pong_waiter, timeout=10)
                    rtt = (time.monotonic() - start) * 1000
                    stats.ping_rtts.append(rtt)
                    stats.sent += 1
                    await asyncio.sleep(random.uniform(0.5, 2.0))
                    continue

                # 模拟绘图：发送一条 add_shape
                shape_type = random.choices(
                    ["pencil", "circle", "rect", "stamp"],
                    weights=[5, 2, 2, 1],
                )[0]

                if shape_type == "pencil":
                    start_x = random.uniform(-500, 500)
                    start_y = random.uniform(-500, 500)
                    num_deltas = random.randint(5, 30)
                    deltas = []
                    cx, cy = 0, 0
                    for _ in range(num_deltas):
                        dx = random.randint(-15, 15)
                        dy = random.randint(-15, 15)
                        deltas.append([dx, dy])
                        cx += dx
                        cy += dy
                    shape = {
                        "type": "pencil",
                        "start": {"x": start_x, "y": start_y},
                        "deltas": deltas,
                        "color": color,
                        "width": random.uniform(2, 6),
                    }
                elif shape_type == "circle":
                    shape = {
                        "type": "circle",
                        "cx": random.uniform(-500, 500),
                        "cy": random.uniform(-500, 500),
                        "r": random.randint(10, 80),
                        "color": color,
                        "width": random.uniform(2, 6),
                    }
                elif shape_type == "rect":
                    x = random.uniform(-500, 500)
                    y = random.uniform(-500, 500)
                    shape = {
                        "type": "rect",
                        "x": x, "y": y,
                        "w": random.uniform(20, 150),
                        "h": random.uniform(20, 150),
                        "color": color,
                        "width": random.uniform(2, 6),
                    }
                else:  # stamp
                    shape = {
                        "type": "stamp",
                        "stampId": random.choice(["leaf", "flower", "shell", "fish", "fruit", "snow", "star", "moon"]),
                        "x": random.uniform(-500, 500),
                        "y": random.uniform(-500, 500),
                        "scale": random.uniform(0.5, 1.5),
                        "color": color,
                        "width": 4,
                    }

                msg = {"type": "add_shape", "shape": shape}
                start = time.monotonic()

                try:
                    await asyncio.wait_for(ws.send(json.dumps(msg)), timeout=5)
                except asyncio.TimeoutError:
                    stats.errors += 1
                    continue

                stats.sent += 1

                # 等待广播（验证服务端响应的延迟）
                try:
                    resp = await asyncio.wait_for(ws.recv(), timeout=5)
                    stats.received += 1
                    rtt = (time.monotonic() - start) * 1000
                    stats.latencies.append(rtt)
                except asyncio.TimeoutError:
                    stats.errors += 1

                # 随机间隔：100ms ~ 1s
                await asyncio.sleep(random.uniform(0.1, 1.0))

    except Exception as e:
        stats.errors += 1
        if args.verbose:
            print(f"  ✗ User {uid:04d}: {e}")


def print_report(elapsed):
    """打印测试报告"""
    print(f"\n{'='*55}")
    print(f"📊 CoDraw 性能测试报告")
    print(f"{'='*55}")
    print(f"   测试时长:       {elapsed:.1f}s")
    print(f"   成功连接:       {stats.connected}")
    print(f"   错误数:         {stats.errors}")
    print(f"   发送消息:       {stats.sent}")
    print(f"   收到响应:       {stats.received}")
    print(f"   吞吐量:         {stats.sent/elapsed:.1f} msg/s")

    if stats.latencies:
        sorted_lat = sorted(stats.latencies)
        print(f"\n   📨 图形广播延迟 (ms):")
        print(f"     平均:       {statistics.mean(stats.latencies):.1f}")
        print(f"     中位数:     {statistics.median(stats.latencies):.1f}")
        print(f"     最小值:     {min(stats.latencies):.1f}")
        print(f"     最大值:     {max(stats.latencies):.1f}")
        print(f"     P95:        {sorted_lat[int(len(sorted_lat)*0.95)]:.1f}")
        print(f"     P99:        {sorted_lat[int(len(sorted_lat)*0.99)]:.1f}")

    if stats.ping_rtts:
        sorted_ping = sorted(stats.ping_rtts)
        print(f"\n   🏓 裸 WebSocket 延迟 (ms):")
        print(f"     平均:       {statistics.mean(stats.ping_rtts):.1f}")
        print(f"     中位数:     {statistics.median(stats.ping_rtts):.1f}")
        print(f"     最小:       {min(stats.ping_rtts):.1f}")
        print(f"     最大:       {max(stats.ping_rtts):.1f}")
        print(f"     P95:        {sorted_ping[int(len(sorted_ping)*0.95)]:.1f}")
        print(f"     P99:        {sorted_ping[int(len(sorted_ping)*0.99)]:.1f}")

    print(f"\n{'='*55}")

    # 健康评分
    if stats.errors == 0:
        print("🏆 健康状态: ✅ 完美 (零错误)")
    elif stats.errors / max(stats.sent, 1) < 0.01:
        print(f"🏆 健康状态: ⚠️  轻微 (错误率 {stats.errors/max(stats.sent,1)*100:.1f}%)")
    else:
        print(f"🏆 健康状态: ❌ 严重 (错误率 {stats.errors/max(stats.sent,1)*100:.1f}%)")


async def main():
    parser = argparse.ArgumentParser(
        description="CoDraw 性能压测工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--users", type=int, default=10, help="并发用户数 (默认 10)")
    parser.add_argument("--duration", type=int, default=30, help="测试时长秒 (默认 30)")
    parser.add_argument("--host", type=str, default=None, help="服务端主机地址")
    parser.add_argument("--port", type=int, default=8000, help="服务端端口 (默认 8000)")
    parser.add_argument("--ping-only", action="store_true", help="只测试 WebSocket ping/pong 延迟")
    parser.add_argument("--verbose", "-v", action="store_true", help="显示详细错误")
    args = parser.parse_args()

    host_str = args.host or "localhost"
    print(f"🏝️  CoDraw 性能压测")
    print(f"{'='*55}")
    print(f"   服务端:         ws://{host_str}:{args.port}")
    print(f"   并发用户数:     {args.users}")
    print(f"   测试时长:       {args.duration}s")
    print(f"   测试模式:       {'纯 Ping' if args.ping_only else '模拟绘图'}")
    print(f"{'='*55}")
    print(f"   正在启动 {args.users} 个模拟用户...")
    print()

    # 分批启动，避免同时创建大量连接导致 SYN 队列溢出
    BATCH_SIZE = 50
    all_tasks = []

    for batch_start in range(0, args.users, BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, args.users)
        batch_tasks = [simulate_user(i, args) for i in range(batch_start, batch_end)]
        batch_results = await asyncio.gather(*batch_tasks)
        all_tasks.extend(batch_results)
        if args.verbose:
            print(f"  ✓ 已启动 {batch_end}/{args.users} 用户")

    elapsed = stats.elapsed()
    print(f"\n   所有用户已完成，汇总统计...")
    print_report(elapsed)

    # 返回 exit code
    error_rate = stats.errors / max(stats.sent, 1)
    return 0 if error_rate < 0.05 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
