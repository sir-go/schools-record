# -*-coding:utf-8-*-
from playhouse.shortcuts import model_to_dict

from conf import *
from peewee import *

db = SqliteDatabase(db_file, True, check_same_thread=False)


class BaseModel(Model):
    def to_dict(self):
        return model_to_dict(self)

    class Meta:
        database = db


class Camera(BaseModel):
    uid = CharField(primary_key=True)
    ip = CharField(15)
    user = CharField(null=True)
    pwd = CharField(null=True)
    alias = TextField(index=True, unique=True)
    uri = TextField()
    mass_start = BooleanField(null=True)


def make_fake_cams(count):
    for i in range(count):
        Camera.create(
            uid='fcam_%d' % i,
            ip='192.168.254.%d' % (i + 10),
            user='admin', pwd='admin', alias=u'тестовая камера %d' % i,
            uri='/live/h264_ulaw/SXGA',
            mass_start=True
        )


def db_init():
    db.connect()

    Camera.drop_table()
    Camera.create_table()

    make_fake_cams(70)

    db.close()


if __name__ == '__main__':
    db_init()
