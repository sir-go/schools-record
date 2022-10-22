# -*-coding:utf-8-*-
import json
from app.api import api_call
from geventwebsocket import WebSocketError


def handle_websocket(ws):
    while True:
        message = ws.receive()
        if message is None:
            break
        else:
            message = json.loads(message)
            result = error = er_obj = None
            try:
                result = api_call(message['method'], message['params'] if 'params' in message else None)
            except Exception, e:
                er_obj = e
                error = u'{}: {}'.format(type(e).__name__, e.args)
            if 'params' in message:
                del message['params']
            if error:
                message['error'] = error
            else:
                message['result'] = result
            try:
                ws.send(json.dumps(message))
            except WebSocketError:
                pass
            if er_obj:
                raise er_obj
