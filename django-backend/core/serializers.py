from rest_framework import serializers


def snake_to_camel(s: str) -> str:
    """
    Convert snake_case -> camelCase
    Example: expected_return_days -> expectedReturnDays
    """
    parts = s.split("_")
    return parts[0] + "".join(p[:1].upper() + p[1:] for p in parts[1:])


class CamelCaseSerializerMixin:
    """
    Mixin for DRF serializers:
    - Outputs keys in camelCase (frontend-friendly)
    - Still accepts snake_case input normally (default DRF behavior)

    This is a lightweight utility used by other apps (e.g., borrow.serializers).
    """

    def to_representation(self, instance):
        data = super().to_representation(instance)

        # Convert output dict keys to camelCase
        if isinstance(data, dict):
            return {snake_to_camel(k): v for k, v in data.items()}

        # Convert list of dicts if any
        if isinstance(data, list):
            out = []
            for item in data:
                if isinstance(item, dict):
                    out.append({snake_to_camel(k): v for k, v in item.items()})
                else:
                    out.append(item)
            return out

        return data


class CamelCaseModelSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    """Convenience base class for ModelSerializer with camelCase output."""
    pass


class CamelCaseSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    """Convenience base class for Serializer with camelCase output."""
    pass
