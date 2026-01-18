import re


def _to_camel_case(value):
    if "_" not in value:
        return value
    parts = value.split("_")
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:])


def _to_snake_case(value):
    return re.sub(r"(?<!^)([A-Z])", r"_\1", value).lower()


def _transform_keys(data, key_transform):
    if isinstance(data, list):
        return [_transform_keys(item, key_transform) for item in data]
    if isinstance(data, dict):
        return {
            key_transform(key): _transform_keys(value, key_transform)
            for key, value in data.items()
        }
    return data


class CamelCaseSerializerMixin:
    def to_representation(self, instance):
        data = super().to_representation(instance)
        return _transform_keys(data, _to_camel_case)

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = _transform_keys(data, _to_snake_case)
        return super().to_internal_value(data)
