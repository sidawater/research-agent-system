import typing
from .request import Request


class MiddleWare(object):

    # _request_middleware_map: typing.List[re.Pattern, typing.Callable] = {}
    _request_middleware_list: typing.List[typing.Callable] = []

    @classmethod
    def preprocessing(cls, request: Request):
        for md in cls._request_middleware_list:
            md(request)
