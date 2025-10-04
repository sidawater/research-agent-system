#!/usr/bin/env python
# coding=utf-8
import asyncio
import dataclasses
import logging
import traceback
import typing

from .route import Route
from .request import Request

logger = logging.getLogger('request_logger')


def switch_route(request):
    """
    TODO: 添加正则模式
    :param request: 路由
    :returns view: 返回接收Request参数的函数
    """
    _func = Route.get(path=request.path)
    return _func(request)


async def handle_connection(websocket):
    """
    处理websocket数据
    :param websocket: websocket对象
    """
    client_ip, client_port = websocket.remote_address
    client = f'{client_ip}:{client_port}'
    logger.info(f'connection: client[{client}]')

    try:
        message = await websocket.recv()
        request = Request(request=websocket.request, body=message)
        if message:
            async for chunk in switch_route(request=request):
                await websocket.send(chunk)
                await asyncio.sleep(0)
    except SQLAlchemyError:
        db.session.remove()
        await websocket.send(Escape.error)
    except Exception as e:
        logger.error(f'WebSocket消息处理出现异常：{e} {traceback.format_exc()}')
        await websocket.send(Escape.error)
    finally:
        await websocket.send(Escape.done)
        logger.info(f'connection closed: client [{client}]')


def start_websocket_server(host: str, port: int, debug: bool = False):
    logger.info(f'start server: ws://{host}:{port}')
    if debug:
        from app.common.flame import Flame
        wrap_handle_connection = Flame.with_profile_async(handle_connection)
    else:
        wrap_handle_connection = handle_connection

    try:
        from websockets.asyncio.server import serve

        async def _async_run():
            async with serve(wrap_handle_connection, host, port):
                await asyncio.get_running_loop().create_future()

        asyncio.run(_async_run())

    except ImportError:
        import websockets.server
        logger.warning('start with old version websockets package')

        @dataclasses.dataclass
        class MockRequest:
            path: str
            headers: typing.Any = None

        async def _handle(websocket, _path):
            logger.info(f'{dir(websocket)}')
            websocket.request = MockRequest(path=_path)
            websocket.request.path = _path
            return await wrap_handle_connection(websocket)

        start_server = websockets.server.serve(_handle, host, port)
        """
        {request, remote_address, recv, send},
                  _path: Any) -> Coroutine[Any, Any, None]
        """
        asyncio.get_event_loop().run_until_complete(start_server)
        asyncio.get_event_loop().run_forever()


def init_from_config():
    import os
    from config import current_config
    from app.common.flame import Flame
    path = os.path.join(current_config.logging.base_dir, 'flame')
    Flame.set_flame_path(path)


if __name__ == '__main__':
    _host = '0.0.0.0'
    _port = 8000
    start_websocket_server(_host, _port)
