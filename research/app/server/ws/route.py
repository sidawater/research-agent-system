"""
路由管理
"""
import typing
from .request import Request


async def api_not_found(*args, **kwargs):
    yield '404, not found'


class Route(object):
    _route_map: typing.Dict[str, typing.Callable[[Request, ], typing.AsyncGenerator]] = {}
    _default_route: typing.Callable = api_not_found

    @classmethod
    def get(cls, path: str) -> typing.Callable[[Request, ], typing.AsyncGenerator]:
        _func = cls._route_map.get(cls._clean_path(path), cls._default_route)

        if _func is None:
            raise KeyError(f'can not find route: {cls._clean_path(path)}')
        return _func

    @classmethod
    def set_default(cls, function: typing.Callable):
        cls._default_route = function

    @classmethod
    def register(cls, path: str, func: typing.Callable[[Request, ], typing.AsyncGenerator]):
        """
        TODO: path -> re.Pattern
        :param path:
        :param func:
        :return:
        """
        cls._route_map[cls._clean_path(path)] = func

    @classmethod
    def _clean_path(cls, path: str):
        """
        格式化路由
        :param path:
        """
        return path.rstrip('/')
