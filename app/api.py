# -*-coding:utf-8-*-
from app import channels_controller
from app.db import Camera
from shared_tools import sysrun
from rtsprec.logger import log


def edit_cams(changes):
    if changes['del']:
        Camera.delete().where(Camera.uid << changes['del']).execute()
        for cam_uid in changes['del']:
            channels_controller.ch_del(cam_uid)

    for new_cam in changes['add']:
        ip_parts = new_cam['ip'].split('.')[-2:]
        if len(ip_parts) > 1:
            new_cam['uid'] = 'cam_{0}_{1}'.format(ip_parts[0], ip_parts[1])
        else:
            new_cam['uid'] = 'cam_{0}'.format(new_cam['ip'])
        Camera.create(**new_cam)
        channels_controller.ch_add(new_cam['uid'])

    if changes['change']:
        for cam_uid, cam_values in changes['change'].iteritems():
            channels_controller.ch_del(cam_uid)
            Camera.update(**cam_values).where(Camera.uid == cam_uid).execute()
            channels_controller.ch_add(cam_uid)


def cams_action(action, ch_uids):
    return channels_controller.ch_act(action, ch_uids)


def get_state():

    def in_ch_ctrl(cam):
        return cam.uid in channels_controller.channels.keys()

    known_cameras = {cam.uid: cam.to_dict() for cam in filter(in_ch_ctrl, Camera.select().order_by(Camera.alias))}
    return {
        'storages': channels_controller.storages,
        'cameras': known_cameras,
        'cam_states': {cam_uid: cam_obj.state_report for cam_uid, cam_obj in channels_controller.channels.iteritems()}
    }


def storage_detach(mp):
    log.info('api call: storage_detach')
    for storage in channels_controller.storages:
        if storage['mp'] == mp:
            cmd_umount = '/usr/bin/sudo /bin/umount {}'.format(storage['dev'])
            cmd_detach = '/usr/bin/sudo /usr/bin/udisksctl power-off -b {}'.format(storage['dev'][:-1])
            if storage['mounted']:
                cmd = "{} && {}".format(cmd_umount, cmd_detach)
                log.info(cmd)
                sysrun(cmd)
            elif storage['attached']:
                log.info(cmd_detach)
                sysrun(cmd_detach)


def echo(msg=None):
    return u'echo: "{}"'.format(msg or '')


def ping():
    return 'pong!'


methods = {
    'echo': echo,
    'ping': ping,
    'get_state': get_state,
    'storage_detach': storage_detach,
    'cams_action': cams_action,
    'edit_cams': edit_cams
}


def api_call(method, params=None):
    return methods[method](**params) if params else methods[method]()
