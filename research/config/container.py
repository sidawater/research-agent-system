
class DictObject(dict):
    """
    将 dict 转换为 object, 方便调用
    """

    def __getattr__(self, item):
        return self.get(item)

    def __setattr__(self, key, value):
        self[key] = value

    # def __str__(self):    # debug 用
    #     old = super().__str__()
    #     return f'DictObject({old})'

    # def __repr__(self):    # debug 用
    #     old = super().__repr__()
    #     return f'DictObject({old})'

    @classmethod
    def trans_from_dict(cls, item: dict):
        """
        将 dict 循环转换为 DictObject
        :param item:
        :return:
        """
        dict_object = DictObject()
        for key, value in item.items():
            if isinstance(value, DictObject) or (not isinstance(value, dict)):
                dict_object[key] = value
            else:
                dict_object[key] = cls.trans_from_dict(value)

        return dict_object
