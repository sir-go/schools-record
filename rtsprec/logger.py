# -*-coding:utf-8-*-
import logging

LOG_FORMAT = "%(asctime)s [%(levelname)s\t] : %(message)s"
log = logging.getLogger('channels')
log.setLevel(logging.DEBUG)
formatter = logging.Formatter(LOG_FORMAT)

# # log to console
ch = logging.StreamHandler()
ch.setFormatter(formatter)
log.addHandler(ch)
