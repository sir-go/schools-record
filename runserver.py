# coding: utf-8

from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler

from app import ws_app, app

if __name__ == '__main__':
    try:
        http_server = WSGIServer(('', app.port), ws_app, handler_class=WebSocketHandler)
        http_server.serve_forever()
    except KeyboardInterrupt:
        pass
