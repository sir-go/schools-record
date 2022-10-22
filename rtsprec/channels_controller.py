# -*-coding:utf-8-*-
from app import db
from chan import Channel
from shared_tools import *
import conf
import logging
import os
from glob import glob
from threading import Lock


class ChController:
    def __init__(self):
        self.conf = dict(
            fname_fmt=conf.file_name_format,
            dst_root=conf.dst_root,
            date_format=conf.date_format,
            time_fmt=conf.time_format,
            cut_rule=conf.cut_record,
            log_lvl=getattr(logging, conf.channel_log_lvl),
        )
        self.storages = conf.storages
        self.channels = {}
        self.lck = Lock()
        for camera in db.Camera.select():
            ch = Channel(camera, self.conf, self.storages, self.lck)
            self.channels[camera.uid] = ch

    def ch_add(self, cam_uid):
        cam = db.Camera.select().where(db.Camera.uid == cam_uid)[0]
        ch = Channel(cam, self.conf, self.storages, self.lck)
        self.channels[cam_uid] = ch

    def ch_del(self, cam_uid):
        self.ch_act('quit', [cam_uid])
        del self.channels[cam_uid]

    def gen_ch_states(self, cam_uid=None):
        res = {}
        if cam_uid:
            res[cam_uid] = self.channels[cam_uid].state_report
        else:
            for cuid, channel in self.channels.iteritems():
                res[cuid] = channel.state_report
        return res

    def storages_update(self):
        df = sysrun('/bin/df')
        devs = glob('/dev/vd*')
        df_dict = {}
        for line in df[1:]:
            df_dev, df_size, df_used, df_avail, df_use_p, df_mp = line.split()
            df_dict[df_mp] = {
                'dev': df_dev,
                'size': int(df_size),
                'used': int(df_used),
                'used_p': df_use_p.strip('%'),
                'avail': int(df_avail),
                'mounted': True
            }
        for storage in self.storages:
            stor_mp = os.path.join(conf.dst_root, storage['mp'])
            if stor_mp in df_dict:
                storage.update(df_dict[stor_mp])
            else:
                storage.update(
                    {'size': None, 'used': None, 'used_p': None, 'avail': None, 'mounted': False}
                )
            storage['attached'] = storage['dev'] in devs

    def ch_act(self, action, ch_uids):
        res = {}
        for _ch in filter(lambda v: v.uid in ch_uids, self.channels.itervalues()):
            if _ch.cmd_q.empty() and _ch.cur_cmd != action:
                _ch.cmd_q.put(action)
                res[_ch.uid] = 'accepted: [{}]'.format(action)
            else:
                res[_ch.uid] = 'busy: state = [{}], command = [{}]'.format(_ch.cur_state, _ch.cur_cmd)
        return res
