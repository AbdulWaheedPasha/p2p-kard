from django.conf import settings
from django.contrib.auth import login, logout
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    AuthResponseSerializer,
    LoginSerializer,
    MeSerializer,
    RegisterSerializer,
)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(request=RegisterSerializer, responses=AuthResponseSerializer)
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token = RefreshToken.for_user(user).access_token
        response_serializer = AuthResponseSerializer(
            {"user": user, "token": str(token)}
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(request=LoginSerializer, responses=AuthResponseSerializer)
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        login(request, user)
        token = RefreshToken.for_user(user).access_token
        response_serializer = AuthResponseSerializer(
            {"user": user, "token": str(token)}
        )
        return Response(response_serializer.data)


class LogoutView(APIView):
    @extend_schema(request=None, responses=None)
    def post(self, request):
        refresh_token = request.data.get("refreshToken") or request.data.get("refresh_token")
        blacklist_enabled = "rest_framework_simplejwt.token_blacklist" in settings.INSTALLED_APPS
        if blacklist_enabled and refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                return Response({"detail": "Invalid refresh token."}, status=status.HTTP_400_BAD_REQUEST)
        logout(request)
        return Response(status=status.HTTP_200_OK)


class MeView(APIView):
    @extend_schema(responses=MeSerializer)
    def get(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)
