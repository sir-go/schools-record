# -*-coding:utf-8-*-

base_path = '/opt/sch'
dst_root = '/var/video_records'

db_file = base_path + '/sr.db'
udev_file = '71-usb-auto.rules'
# log_file = '/var/log/srec_app.log'

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
# cut_record = 'every: 2'
cut_record = 'at: 0 30'
# cut_record = 'at: 0 2 4 6 8 10 12 14 16 18 20 22 24 26 28 30 32 34 36 38 40 42 44 46 48 50 52 54 56 58'

app_debug = True
gst_debug = True
# channel_log_lvl = 'CRITICAL'
# channel_log_lvl = 'ERROR'
# channel_log_lvl = 'WARNING'
# channel_log_lvl = 'INFO'
channel_log_lvl = 'DEBUG'
