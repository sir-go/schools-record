# -*-coding:utf-8-*-
import logging
# from conf import log_file
# from os import path

LOG_FORMAT = "%(asctime)s [%(levelname)s\t] : %(message)s"
log = logging.getLogger('channels')
log.setLevel(logging.DEBUG)
formatter = logging.Formatter(LOG_FORMAT)

# # log to file
# fh = logging.FileHandler(log_file)
# fh.setFormatter(formatter)
# log.addHandler(fh)

# # log to console
ch = logging.StreamHandler()
ch.setFormatter(formatter)
log.addHandler(ch)
