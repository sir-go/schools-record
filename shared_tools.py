# -*-coding:utf-8-*-
import os
from subprocess import Popen, PIPE


def sysrun(cmd):
    try:
        return Popen(cmd, stdout=PIPE, shell=True).stdout.read().split(bytes(os.linesep, "utf-8"))[:-1]
    except OSError or IndexError:
        return None
