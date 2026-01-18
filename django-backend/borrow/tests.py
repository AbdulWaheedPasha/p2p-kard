from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from borrow.models import BorrowDocument, BorrowDocumentStatus, BorrowRequest, BorrowRequestStatus


class BorrowerFlowTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            email="borrower@example.com", password="StrongPass123", name="Borrower"
        )
        self.other_user = User.objects.create_user(
            email="other@example.com", password="StrongPass123", name="Other"
        )
        self.borrow_request = BorrowRequest.objects.create(
            requester=self.user,
            title="Borrow A",
            category="medical",
            reason_detailed="Private",
            amount_requested_cents=5000,
            currency="EUR",
            expected_return_days=30,
            status=BorrowRequestStatus.SUBMITTED,
        )

    def test_owner_only_presign(self):
        self.client.force_authenticate(user=self.other_user)
        response = self.client.post(
            f"/api/v1/borrow-requests/{self.borrow_request.id}/documents/presign",
            {"files": [{"fileName": "doc.pdf", "contentType": "application/pdf"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_create_borrow_request_returns_shape(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/v1/borrow-requests",
            {
                "title": "New Borrow",
                "category": "rent",
                "reasonDetailed": "Details",
                "amountRequestedCents": 12000,
                "currency": "EUR",
                "expectedReturnDays": 60,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn("borrowRequest", response.data)
        self.assertTrue(response.data["borrowRequest"]["id"].startswith("br_"))
        self.assertEqual(response.data["borrowRequest"]["status"], "SUBMITTED")

    @patch("borrow.views.boto3.client")
    def test_presign_returns_shape(self, mock_client):
        mock_client.return_value.generate_presigned_url.return_value = "https://presigned.example/url"
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f"/api/v1/borrow-requests/{self.borrow_request.id}/documents/presign",
            {"files": [{"fileName": "doc.pdf", "contentType": "application/pdf"}]},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn("uploads", response.data)
        upload = response.data["uploads"][0]
        self.assertIn("documentId", upload)
        self.assertTrue(upload["documentId"].startswith("doc_"))
        self.assertEqual(upload["uploadUrl"], "https://presigned.example/url")
        self.assertEqual(upload["fileName"], "doc.pdf")

    def test_confirm_updates_status(self):
        self.client.force_authenticate(user=self.user)
        document = BorrowDocument.objects.create(
            borrow_request=self.borrow_request,
            file_name="doc.pdf",
            content_type="application/pdf",
            storage_key="key/doc.pdf",
            status=BorrowDocumentStatus.PENDING_UPLOAD,
        )
        response = self.client.post(
            f"/api/v1/borrow-requests/{self.borrow_request.id}/documents/confirm",
            {"documentIds": [f"doc_{document.id}"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        document.refresh_from_db()
        self.assertEqual(document.status, BorrowDocumentStatus.CONFIRMED)
