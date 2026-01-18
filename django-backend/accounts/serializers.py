from django.contrib.auth import authenticate
from rest_framework import serializers

from core.serializers import CamelCaseSerializerMixin

from .models import User


class RegisterSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "email", "name", "password", "created_at"]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
        )


class LoginSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            self.context.get("request"),
            email=attrs.get("email"),
            password=attrs.get("password"),
        )
        if not user:
            raise serializers.ValidationError("Invalid credentials")
        attrs["user"] = user
        return attrs


class MeSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "name", "created_at"]


class UserPublicSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "name"]


class AuthResponseSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    user = UserPublicSerializer()
    token = serializers.CharField()
