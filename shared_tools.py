# -*-coding:utf-8-*-
import os
from subprocess import Popen, PIPE


def sysrun(cmd):
    try:
        return Popen(cmd, stdout=PIPE, shell=True).stdout.read().split(os.linesep)[:-1]
    except OSError or IndexError:
        return None
