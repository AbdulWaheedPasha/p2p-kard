import json

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from borrow.models import BorrowRequest, BorrowRequestStatus
from campaigns.models import Campaign, CampaignStatus


class PrivacyGuardrailTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.borrower = User.objects.create_user(
            email="borrower@example.com", password="StrongPass123", name="Borrower"
        )
        self.lender = User.objects.create_user(
            email="lender@example.com", password="StrongPass123", name="Lender"
        )
        self.borrow_request = BorrowRequest.objects.create(
            requester=self.borrower,
            title="Borrow request",
            category="medical",
            reason_detailed="Private",
            amount_requested_cents=10000,
            currency="EUR",
            expected_return_days=30,
            status=BorrowRequestStatus.SUBMITTED,
        )
        self.campaign = Campaign.objects.create(
            borrow_request=self.borrow_request,
            title_public="Campaign",
            story_public="Story",
            terms_public="Terms",
            category="medical",
            amount_needed_cents=10000,
            amount_pooled_cents=5000,
            expected_return_days=30,
            status=CampaignStatus.RUNNING,
            verified=True,
        )

    def _assert_no_private_keys(self, payload):
        disallowed = [
            "requester",
            "user",
            "email",
            "name",
            "borrowRequest",
            "reasonDetailed",
            "documents",
            "requesterId",
            "requesterEmail",
        ]
        payload_text = json.dumps(payload)
        for key in disallowed:
            self.assertNotIn(f"\"{key}\"", payload_text)

    def test_home_and_campaign_privacy(self):
        response = self.client.get("/api/v1/home")
        self.assertEqual(response.status_code, 200)
        self._assert_no_private_keys(response.data)

        response = self.client.get(f"/api/v1/campaigns/c_{self.campaign.id}")
        self.assertEqual(response.status_code, 200)
        self._assert_no_private_keys(response.data)
