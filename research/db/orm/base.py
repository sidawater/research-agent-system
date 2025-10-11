#!/usr/bin/env python
# coding=utf-8
"""
base ORM model
"""

import json
import datetime


class ClassEncoder(json.JSONEncoder):

    def default(self, obj):
        if isinstance(obj, datetime.date):
            return obj.strftime('%Y%m%d')
        if isinstance(obj, set):
            return list(obj)
        return json.JSONEncoder.default(self, obj)


class BaseModel(object):
    __models_classes = None

    def __init__(self, *args, **kwargs):
        super(BaseModel, self).__init__(*args, **kwargs)
        current_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        self.create_time = current_time
        self.last_update = current_time

    def as_dict(self):
        """
        used as python dict
        :return:
        """
        table = getattr(self, '__table__', [])
        return {col.name: getattr(self, col.name) for col in table.columns}

    def as_json(self, ensure_ascii=False, cls=ClassEncoder, **kwargs):
        """
        json string
        :param ensure_ascii: json dumps ensure_ascii param, default False
        :param cls: json dumps cls param, default ClassEncoder
        :param kwargs: other json dumps params
        :return:
        """
        return json.dumps(self.as_dict(), ensure_ascii=ensure_ascii, cls=cls, **kwargs)


class AgentModel(BaseModel):
    __bind_key__ = 'db_agent'
