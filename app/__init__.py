# -*-coding:utf-8-*-
import os
from rtsprec.channels_controller import ChController
from db import *
import conf

channels_controller = ChController()

from flask import Flask, render_template
from flask.blueprints import Blueprint
from flask_autoindex import AutoIndex
from websocket import handle_websocket

app = Flask(__name__, static_folder='static')
app.secret_key = os.urandom(24)
app.port = conf.server_port
app.debug = conf.app_debug

records_files = Blueprint('records_files', __name__)
records_ai = AutoIndex(records_files, browse_root=conf.dst_root)
app.register_blueprint(records_files, url_prefix='/records')

soft_files = Blueprint('soft_files', __name__)
AutoIndex(soft_files, browse_root=os.path.join(app.static_folder, 'soft'))
app.register_blueprint(soft_files, url_prefix='/soft')

from threading import Thread
from time import sleep


def storages_hook():
    while True:
        channels_controller.storages_update()
        sleep(0.5)


thr_storages = Thread(target=storages_hook)
thr_storages.daemon = True
thr_storages.start()


def ws_app(environ, start_response):
    path = environ["PATH_INFO"]
    try:
        if path == "/ws":
            ws = environ["wsgi.websocket"]
            handle_websocket(ws)
        else:
            return app(environ, start_response)
    except KeyboardInterrupt:
        pass


@app.route('/')
def index():
    return render_template('index.html', app_port=app.port)


@app.route('/help')
def help_page():
    return render_template('help.html')
