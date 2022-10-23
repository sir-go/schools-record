# -*-coding:utf-8-*-

base_path = '/opt/sch'
dst_root = '/var/video_records'

db_file = base_path + '/sr.db'
udev_file = '71-usb-auto.rules'

flask_debug = True
server_port = 80

storages = [
    {
        'mp': 'storage_main',
        'dev': '/dev/vdc1',
        'ext': False,
        'pref': 0,
        'attached': False, 'mounted': False, 'size': None, 'used': None, 'used_p': None, 'avail': None
    },
    {
        'mp': 'storage_external',
        'dev': '/dev/vdb1',
        'ext': True,
        'pref': 0,
        'attached': False, 'mounted': False, 'size': None, 'used': None, 'used_p': None, 'avail': None
    }
]

file_name_format = '{alias} [ {date}_{time} ].mpg'
date_format = '%Y-%m-%d'
time_format = '%H-%M-%S'
cut_record = 'at: 0 30'

app_debug = True
gst_debug = True
channel_log_lvl = 'DEBUG'
