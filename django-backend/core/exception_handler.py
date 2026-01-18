from rest_framework.views import exception_handler as drf_exception_handler


def _to_camel_case(value):
    if "_" not in value:
        return value
    parts = value.split("_")
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:])


def _transform_keys(data):
    if isinstance(data, list):
        return [_transform_keys(item) for item in data]
    if isinstance(data, dict):
        return {_to_camel_case(key): _transform_keys(value) for key, value in data.items()}
    return data


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return response

    message = "Request failed"
    details = _transform_keys(response.data)
    if isinstance(response.data, dict):
        message = response.data.get("detail", message)

    response.data = {
        "error": {
            "code": response.status_code,
            "message": message,
            "details": details,
        }
    }
    return response
