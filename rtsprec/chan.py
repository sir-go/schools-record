# -*-coding:utf-8-*-
from time import sleep, strftime
import datetime
import os
import signal
from logging import DEBUG, INFO, WARNING, ERROR, CRITICAL

# from gevent import monkey, sleep
# monkey.patch_all()
# import threading


from threading import Thread
from Queue import Queue
import thread
from subprocess import Popen, PIPE
import fcntl
import re

from logger import log


def mk_dst(root, mpoint, cur_date, cam_alias, file_name):
    dst_folder = os.path.join(root, mpoint, cur_date, cam_alias)
    if not os.path.exists(dst_folder):
        os.makedirs(dst_folder)
    return os.path.join(dst_folder, file_name)


def _non_block_read(output):
    # noinspection PyBroadException
    try:
        fd = output.fileno()
        fl = fcntl.fcntl(fd, fcntl.F_GETFL)
        fcntl.fcntl(fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)
        return output.read().strip()
    except Exception:
        return ''


class Channel:
    def __init__(self, camera, conf, storages, lck):
        self.lck = lck
        self._storages = storages
        self.camera = camera
        self.conf = conf
        self.uid = camera.uid
        self._gst_process = None
        self._control_state = 'ready'
        self._state_info = u'готов'
        self.cur_state = 'stopped'
        self.cmd_q = Queue(1)
        self.cur_cmd = None
        self._dst_files = []
        self._cur_record_time = None
        self._cut_time = None
        self._last_error = None

        self.state_report = {}

        self.make_state_report('_init_')

        self.watcher_thread = Thread(target=self._channel_watcher)
        self.watcher_thread.daemon = True
        self.watcher_thread.start()

    def make_state_report(self, codepart=None):
        self.state_report = {
            'uid': self.uid,
            'codepart': codepart,
            'control_state': self._control_state,
            'state_info': self._state_info,
            'state': self.cur_state,
            'error': self._last_error,
            'current_command': self.cur_cmd,
            'destinations': self._dst_files,
            'started_time': self._cur_record_time,
            'cut_time': self._cut_time.strftime('%H:%M') if self._cut_time else None,
        }

    def _log(self, lvl, msg):
        # self.lck.acquire()
        if lvl >= self.conf['log_lvl']:
            log.log(lvl, '[ch: {}] {}'.format(self.uid, str(msg)))
        # self.lck.release()

    def _gen_pipeline(self):

        cur_date = strftime(self.conf['date_format'])
        cur_time = datetime.datetime.now()

        file_name = unicode(self.conf['fname_fmt']).format(
            alias=self.camera.alias,
            date=cur_date,
            time=cur_time.strftime(self.conf['time_fmt'])
        )

        # external
        self._dst_files = [mk_dst(
            self.conf['dst_root'],
            s['mp'],
            cur_date,
            self.camera.alias,
            file_name
        ) for s in filter(lambda stor: stor['mounted'] and stor['ext'], self._storages)]

        # internal (min by pref of not ext and > 250 MB)
        mounted_big_internal = filter(
            lambda stor: stor['mounted'] and not stor['ext'] and stor['avail'] > 256000,
            self._storages
        )
        if mounted_big_internal:
            best_internal = min(mounted_big_internal, key=lambda st: st['pref'])
            if best_internal:
                self._dst_files.append(
                    mk_dst(self.conf['dst_root'], best_internal['mp'], cur_date, self.camera.alias, file_name)
                )

        if len(self._dst_files):
            s = "-i 'rtsp://{user}:{pwd}@{ip}{uri}' -vcodec copy -acodec libmp3lame -ar 44100 -threads 4 " \
                "-f tee -map 0:v -map 0:a '{targets}'".format(targets='|'.join((
                    '[f=mpeg]{}'.format(dp.encode("utf8")) for dp in self._dst_files
                )), **self.camera.to_dict())
            self._cur_record_time = cur_time.strftime('%H:%M')
            return s
        else:
            return False

    def _set_state(self, state, from_code=None):
        self.cur_state = state
        self._log(INFO, 'state: {}, from_code: {}'.format(state, from_code))

    def _calc_cut_time(self):
        if self.conf['cut_rule'] is None:
            return
        cut_rule = {}
        try:
            mode, nums = self.conf['cut_rule'].lower().split(':')
            ['at', 'every'].index(mode)
            cut_rule['mode'] = mode
            cut_rule['nums'] = sorted(map(int, nums.split()))
            cut_rule['nums'][0] += 0
        except ValueError or IndexError:
            self._set_state('error')
            err_txt = 'config.cut_record syntax error - expected "at|every: <num>"'
            self._log(CRITICAL, err_txt)
            self._error_handler(err_txt)
            return
        cut_after = None
        now = datetime.datetime.now()
        if cut_rule['mode'] == 'every':
            cut_after = cut_rule['nums'][0] * 60
        else:
            for point in cut_rule['nums']:
                if now.minute < point:
                    cut_after = 60 * (point - now.minute) - now.second
                    break
            if cut_after is None:
                cut_after = 60 * (60 - now.minute + cut_rule['nums'][0]) - now.second
        self._cut_time = now + datetime.timedelta(seconds=cut_after)
        # self._cut_time = now + datetime.timedelta(seconds=(cut_after + randint(0, 60)))

    def _error_handler(self, error_out):
        known_errors = (
            'no space left on the resource',
            'no such file or directory',
            'no route to host',
            'loose the flow',
        )
        err_alias = None
        for match in known_errors:
            if error_out.find(match) > -1:
                err_alias = match
        self._log(ERROR, err_alias or error_out)
        self._last_error = {'tm': strftime('%H:%M:%S'), 'txt': err_alias or error_out}

    def _channel_watcher(self):
        self._log(DEBUG, 'watcher is started')
        size0 = 0
        zero_size_counter = 0
        while True:
            sleep(0.05)

            # ----------- log streams
            if self._gst_process is not None:

                dmn_out = _non_block_read(self._gst_process.stdout)
                if dmn_out:
                    self._log(DEBUG, dmn_out)

                dmn_err = _non_block_read(self._gst_process.stderr)
                if dmn_err:
                    self._set_state('error')
                    self._error_handler(dmn_err.lower())

            # -------------------------------

            if not self.cmd_q.empty():
                self.cur_cmd = self.cmd_q.get()
                self._log(DEBUG, 'get command: ' + self.cur_cmd)

                if self.cur_cmd == 'run':
                    self._control_state = 'busy'
                    self._state_info = u'старт записи...'
                    self.make_state_report('cmd_run')

                    m_res = self._run()

                    if m_res is not None:
                        self._log(DEBUG, m_res)

                elif self.cur_cmd == 'stop':
                    self._state_info = u'остановка записи...'
                    self.make_state_report('cmd_stop')
                    m_res = self._stop()
                    if m_res is not None:
                        self._log(DEBUG, m_res)
                    self._control_state = 'ready' if self.cur_state == 'stopped' else 'busy'
                    self._state_info = u'готов'
                    self.make_state_report('cmd_stop')

                elif self.cur_cmd == 'new_file':
                    m_res = self._new_file()
                    if m_res is not None:
                        self._log(DEBUG, m_res)

                elif self.cur_cmd == 'quit':
                    self._stop()
                    thread.exit()
            else:
                self.cur_cmd = None

            if self.cur_state == 'running':
                if not self._dst_files:
                    self._set_state('error', 'if_no_dst_files')
                    self._error_handler('no destination files')
                    continue
                main_file = self._dst_files[0] if os.path.exists(self._dst_files[0]) else None
                size_delta = None
                if main_file is not None:
                    size1 = os.path.getsize(main_file)
                    size_delta = size1 - size0
                    size0 = size1
                if (size_delta is None) or (size_delta < 1):
                    zero_size_counter += 1
                    if zero_size_counter > 60:
                        zero_size_counter = 0
                        self._set_state('error', 'if_zero_size_counter_bigger_60')
                        self._error_handler('loose the flow')
                else:
                    # if zero_size_counter:
                    #     self.make_state_report('zero_size_counter')
                    zero_size_counter = 0
                    self._last_error = None
                    _cut_time_prety = self._cut_time.strftime('%H:%M') if self._cut_time else ''
                    # self._log(WARNING, 'nonzero srep:{}|cut:{}|sinf:{}|stat:{}'.format(
                    #     self.state_report['cut_time'],
                    #     _cut_time_prety,
                    #     self._state_info,
                    #     self.cur_state
                    # ))
                    if (self.state_report['cut_time'] != _cut_time_prety) or \
                            self._state_info in [u'старт записи...', u'ошибка, рестарт записи...']:
                        self._state_info = u'{0} запись до {1}'.format(
                            self._cur_record_time,
                            _cut_time_prety
                        )
                        # self._log(WARNING, 'UPDATE STAT')
                    self.make_state_report('non-zero')
                if datetime.datetime.now() > self._cut_time:
                    self._new_file()
            elif self.cur_state == 'error':
                self._new_file()
            elif self.cur_state == 'stopped':
                size0 = 0
                zero_size_counter = 0

        # self._log(WARNING, u'watcher is stopped')
        # thread.exit()

    def _del_zerofiles(self):
        for fl in self._dst_files:
            folder = os.path.dirname(fl)
            try:
                if os.path.isfile(fl) and os.path.getsize(fl) < 1024:
                    os.remove(fl)
                for f in os.listdir(folder):
                    if re.search('fuse_hidden', f):
                        os.remove(os.path.join(folder, f))
            except OSError, e:
                self._log(WARNING, 'del_zerofiles: {0}: "{1}"'.format(e.strerror, e.filename))
            try:
                os.rmdir(folder)
            except OSError:
                pass

    def _run(self):
        if self.cur_state in ('running', 'launch'):
            return 'cant do "{}" cuz state is "{}"'.format('run', self.cur_state)
        self._set_state('launch', 'run.before_Popen_pipeline')
        pipeline = self._gen_pipeline()
        if pipeline:
            self.lck.acquire()  # lock
            # self._calc_cut_time()
            self._gst_process = Popen(
                ['ffmpeg -y -loglevel error ' + pipeline], shell=True,
                stdout=PIPE, stderr=PIPE,
                preexec_fn=os.setsid
            )
            self._calc_cut_time()
            sleep(0.10)
            self.lck.release()  # unlock
            self._set_state('running', 'run.after_Popen_pipeline')
        else:
            err = 'no available storage devices'
            self._set_state('error')
            self._error_handler(err)
            return err

    def _stop(self):
        if self.cur_state not in ('running', 'launch', 'error'):
            return 'cant do "{}" cuz state is "{}"'.format('stop', self.cur_state)
        self._set_state('stopping', 'stop.before_kill')
        if self._gst_process:
            os.killpg(self._gst_process.pid, signal.SIGTERM)
        self._gst_process = None
        sleep(0.10)
        self._del_zerofiles()
        self._set_state('stopped', 'stop.after_kill_and_del_zerofiles')

    def _new_file(self):
        if self.cur_state not in ('running', 'launch', 'error'):
            return 'cant do "{}" cuz state is "{}"'.format('new_file', self.cur_state)
        enter_state = self.cur_state
        self._stop()
        if enter_state == 'error':
            self._state_info = u'ошибка, рестарт записи...'
            self.make_state_report('_new_file')
            sleep(2)
        self._run()
