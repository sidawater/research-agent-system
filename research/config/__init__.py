#!/usr/bin/env python
# coding=utf-8
import os
import toml

from .container import DictObject

# set Default config
Default: DictObject = DictObject()
Default.config_file = 'resource/conf/ai-glasses-server.toml'
Default.host = '0.0.0.0'
Default.port = 8866
Default.websocket_port = 8867
Default.logging = DictObject({'base_dir': '/data/logs'})
mongo_config = {
    'MONGO_HOST': os.environ.get('MONGO_HOST', 'localhost'),
    'MONGO_PORT': int(os.environ.get('MONGO_PORT', 27017)),
    'MONGO_DATABASE': os.environ.get('MONGO_DATABASE', 'research-messages')
}
Default.mongo = DictObject(mongo_config)


class ConfigMeta(type):
    def __init__(cls, *args, **kwargs):
        super(ConfigMeta, cls).__init__(*args, **kwargs)
        cls._config: DictObject = DictObject()
        for key, value in Default.items():
            cls._config[key] = value

    @property
    def config(cls):
        return cls._config

    @config.setter
    def config(cls, value):
        cls._config = value


class BaseConfig(metaclass=ConfigMeta):
    _config: DictObject = DictObject()

    @classmethod
    def load_from_toml(cls, filepath: str):
        if not os.path.isfile(filepath):
            raise FileNotFoundError(f'can not find config file: {filepath}')
        with open(filepath, 'r', encoding='utf-8') as f:
            res = toml.load(f)

        cls.config.update(DictObject.trans_from_dict(res))


try:
    from urllib.parse import quote_plus
    from flask import Flask


    class FlaskMixin:

        @classmethod
        def init_flask_app(cls, app: Flask):

            # json response config
            app.json.ensure_ascii = False

            # mysql connect binds build
            cls.config.SQLALCHEMY_POOL_SIZE = 30
            cls.config.SQLALCHEMY_DATABASE_MAX_OVERFLOW = 20
            cls.config.SQLALCHEMY_DATABASE_TIMEOUT = 180
            cls.config.SQLALCHEMY_DATABASE_POOL_RECYCLE = 3600
            cls.config.SQLALCHEMY_TRACK_MODIFICATIONS = False

            binds = {}
            bind_keys = []
            for key, values in cls.config.items():
                if not key.startswith('db_'):
                    continue
                bind_name = key.replace('db_', '')
                host, port = values.get('host'), values.get('port')
                user, pwd, db = values.get('username'), values.get('password'), values.get('database_name')

                uri = f'mysql+pymysql://{user}:{quote_plus(pwd)}@{host}:{port}/{db}?charset=utf8'
                binds[bind_name] = uri
                bind_keys.append(bind_name)

            if not binds:
                raise AttributeError('can not find any mysql connect connect information!')

            # base_uri = binds.pop(bind_keys[0])
            # cls.config.SQLALCHEMY_DATABASE_URI = base_uri
            cls.config.SQLALCHEMY_BINDS = binds

            # logging
            cls.config.LOGGING_DIR = cls.config.logging.base_dir

            upper_config = {k.upper(): v for k, v in cls.config.items()}
            app.config.from_mapping(upper_config)

except ImportError:
    FlaskMixin = type('FlaskMixin', (object,), {})


class Config(BaseConfig, FlaskMixin):
    pass


current_config = Config.config
