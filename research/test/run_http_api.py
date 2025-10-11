import json
import uuid
import asyncio
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from urllib.parse import quote

BASE_HTTP = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/chat"


def http_get(path: str):
    url = BASE_HTTP + path
    req = Request(url, method="GET")
    with urlopen(req) as resp:
        return resp.status, resp.read().decode()


def http_post(path: str, data: dict):
    url = BASE_HTTP + path
    body = json.dumps(data).encode("utf-8")
    req = Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    with urlopen(req) as resp:
        return resp.status, resp.read().decode()


def test_health():
    status, body = http_get("/api/v1/health")
    print("GET /api/v1/health ->", status, body)


def test_history(session_id: str):
    # list
    status, body = http_get("/api/v1/history")
    print("GET /api/v1/history ->", status, body)
    # update
    document = {
        "session_id": session_id,
        "messages": [{"role": "user", "content": "hello"}],
        "user_id": "tester",
    }
    status, body = http_post(f"/api/v1/history/{session_id}", document)
    print(f"POST /api/v1/history/{session_id} ->", status, body)
    # get
    status, body = http_get(f"/api/v1/history/{session_id}")
    print(f"GET /api/v1/history/{session_id} ->", status, body)


def test_prompts():
    # all
    status, body = http_get("/api/v1/prompts")
    print("GET /api/v1/prompts ->", status, body)
    # get key
    key = "deepseek"
    status, body = http_get(f"/api/v1/prompts/{key}")
    print(f"GET /api/v1/prompts/{key} ->", status, body)
    # set key
    payload = {}
    status, body = http_post(f"/api/v1/prompts/{key}?prompt=" + quote("自定义提示词示例"), payload)
    print(f"POST /api/v1/prompts/{key} ->", status, body)


async def test_ws_chat():
    import websockets
    sid = str(uuid.uuid4())
    async with websockets.connect(WS_URL) as ws:
        # init & search
        await ws.send(json.dumps({
            "session_id": sid,
            "query": "广东省各地市的人口分布",
            "search_results_satisfactory": False,
            "report_satisfactory": False
        }))
        for _ in range(10):
            msg = await ws.recv()
            print("WS recv:", msg)
        # confirm search, write report
        await ws.send(json.dumps({"session_id": sid, "search_results_satisfactory": True}))
        for _ in range(10):
            msg = await ws.recv()
            print("WS recv:", msg)
        # confirm report, end
        await ws.send(json.dumps({"session_id": sid, "report_satisfactory": True}))
        try:
            for _ in range(3):
                msg = await ws.recv()
                print("WS recv:", msg)
        except Exception:
            pass


def main():
    try:
        test_health()
    except (URLError, HTTPError) as e:
        print("Health error:", e)
    sid = str(uuid.uuid4())
    try:
        test_history(sid)
    except (URLError, HTTPError) as e:
        print("History error:", e)
    try:
        test_prompts()
    except (URLError, HTTPError) as e:
        print("Prompts error:", e)
    try:
        asyncio.run(test_ws_chat())
    except Exception as e:
        print("WebSocket error:", e)


if __name__ == "__main__":
    main()