from websockets.http11 import Request as WSRequest


class Request(object):

    def __init__(self, request: WSRequest, body: str):
        self.request = request
        self.body = body
        self.path = request.path
        self.headers = request.headers

    def __repr__(self):
        return f'Request<{self.path}>: body:({self.body}), header:({self.headers})'
