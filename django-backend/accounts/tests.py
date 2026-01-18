from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase


class AuthEndpointsTests(APITestCase):
    def test_register_returns_user_and_token(self):
        response = self.client.post(
            "/api/v1/auth/register",
            {
                "email": "newuser@example.com",
                "password": "StrongPass123",
                "name": "New User",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn("user", response.data)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["email"], "newuser@example.com")
        self.assertEqual(response.data["user"]["name"], "New User")

    def test_login_returns_user_and_token(self):
        User = get_user_model()
        User.objects.create_user(email="login@example.com", password="StrongPass123", name="Login User")
        response = self.client.post(
            "/api/v1/auth/login",
            {"email": "login@example.com", "password": "StrongPass123"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("user", response.data)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["email"], "login@example.com")

    def test_me_requires_auth_and_returns_user(self):
        User = get_user_model()
        user = User.objects.create_user(email="me@example.com", password="StrongPass123", name="Me User")
        login_response = self.client.post(
            "/api/v1/auth/login",
            {"email": "me@example.com", "password": "StrongPass123"},
            format="json",
        )
        token = login_response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get("/api/v1/me")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], user.email)
        self.assertEqual(response.data["name"], user.name)

    def test_logout_returns_200(self):
        User = get_user_model()
        User.objects.create_user(email="logout@example.com", password="StrongPass123", name="Logout User")
        login_response = self.client.post(
            "/api/v1/auth/login",
            {"email": "logout@example.com", "password": "StrongPass123"},
            format="json",
        )
        token = login_response.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.post("/api/v1/auth/logout", {}, format="json")
        self.assertEqual(response.status_code, 200)
