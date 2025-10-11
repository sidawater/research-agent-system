import asyncio
import traceback

import websockets
import json
import uuid

value = {}
query = """
轴承故障诊断方法"""


async def connect_and_listen():
    uri = "ws://127.0.0.1:18000/chat"

    # 构造请求数据
    payload = {
        "session_id": str(uuid.uuid4()),
        "query": query,
        "search_results_satisfactory": False,
        "report_satisfactory": False,
        "mode": "semantic",
    }

    try:
        async with websockets.connect(uri) as websocket:
            # 发送请求
            await websocket.send(json.dumps(payload))
            print("✅ 已发送请求到服务器")

            tp = ''
            value = ''
            async for message in websocket:
                data = json.loads( message)
                if tp != data.get('type'):
                    print(f'{tp}: {value}')
                    tp = data.get('type')
                    value = data.get('data')
                else:
                    value += data.get('data')
                print(message)
            print(f'total: {tp}: {value}')

    except websockets.exceptions.ConnectionClosedOK:
        print("🔌 连接正常关闭")
    except Exception as e:
        print(f"❌ 发生错误: {e}\n {traceback.format_exc()}")

# 运行异步函数
if __name__ == "__main__":
    asyncio.run(connect_and_listen())