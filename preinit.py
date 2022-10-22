# !/usr/bin/env python
# -*-coding:utf-8-*-
from conf import *
from shared_tools import *
import fileinput
import sys
import os


def mk_udev_rules():
    # ext_stor_dev = next((stor['dev'] for stor in storages if stor['ext']), 'sd?[0-9]')
    with open(os.path.join(base_path, udev_file), 'w') as ur_file:
        ur_file.write(
            'SUBSYSTEM=="block", KERNEL=="sdc1", ACTION=="add", \\\n'
            'RUN+="/bin/mount -o noatime,user,rw,locale=ru_RU.UTF-8 /dev/%k {mp}", \\\n'
            'RUN+="/bin/mkdir -p {mp}/redistr", \\\n'
            'RUN+="/bin/cp {base_dir}/app/static/soft/to_ext_hdd/redistr/ffdshow_codec.exe {mp}/redistr", \\\n'
            'RUN+="/bin/cp {base_dir}/app/static/soft/to_ext_hdd/redistr/vlc-2.1.3-win32.exe {mp}/redistr", \\\n'
            'RUN+="/bin/cp {base_dir}/app/static/soft/to_ext_hdd/readme.txt {mp}/"\n'.format(
                mp='/var/video_records/storage_external', base_dir=base_path)
        )


def storages_init():
    for storage in storages:
        mp = os.path.join(dst_root, storage['mp'])
        sysrun('/bin/mkdir -p -m 0777 ' + mp)
        if storage['ext']:
            mk_udev_rules()
            sysrun(
                '/bin/ln -sfn {src} {dst}'.format(
                    src=os.path.join(base_path, udev_file),
                    dst=os.path.join('/etc/udev/rules.d/', udev_file)
                )
            )
            sysrun('/sbin/udevadm control --reload-rules')


def make_run_sh():
    for line in fileinput.input(os.path.join(base_path, "run.sh"), inplace=True):
        if line.startswith('DIR='):
            line = 'DIR={}/\n'.format(base_path)
        sys.stdout.write(line)


if __name__ == '__main__':
    storages_init()
    make_run_sh()
