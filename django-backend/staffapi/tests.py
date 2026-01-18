from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from borrow.models import BorrowRequest, BorrowRequestStatus
from campaigns.models import Campaign, CampaignStatus


class StaffBorrowRequestTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.staff = User.objects.create_user(
            email="staff@example.com", password="StrongPass123", name="Staff", is_staff=True
        )
        self.user = User.objects.create_user(
            email="user@example.com", password="StrongPass123", name="User"
        )
        self.borrow_request = BorrowRequest.objects.create(
            requester=self.user,
            title="Borrow Request",
            category="medical",
            reason_detailed="Private",
            amount_requested_cents=7000,
            currency="EUR",
            expected_return_days=30,
            status=BorrowRequestStatus.SUBMITTED,
        )

    def test_staff_only_access(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/v1/admin/borrow-requests")
        self.assertEqual(response.status_code, 403)

    def test_list_and_detail(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.get("/api/v1/admin/borrow-requests?status=SUBMITTED")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertIn("id", response.data[0])
        self.assertTrue(response.data[0]["id"].startswith("br_"))

        response = self.client.get(f"/api/v1/admin/borrow-requests/br_{self.borrow_request.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], f"br_{self.borrow_request.id}")

    def test_decision_verify_and_reject(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(
            f"/api/v1/admin/borrow-requests/{self.borrow_request.id}/decision",
            {"decision": "VERIFY", "noteInternal": "OK"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.borrow_request.refresh_from_db()
        self.assertEqual(self.borrow_request.status, BorrowRequestStatus.VERIFIED)
        self.assertEqual(self.borrow_request.admin_note_internal, "OK")

        response = self.client.post(
            f"/api/v1/admin/borrow-requests/{self.borrow_request.id}/decision",
            {"decision": "REJECT", "noteInternal": "Nope"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.borrow_request.refresh_from_db()
        self.assertEqual(self.borrow_request.status, BorrowRequestStatus.REJECTED)
        self.assertEqual(self.borrow_request.admin_note_internal, "Nope")

    def test_create_campaign_flow(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(
            f"/api/v1/admin/borrow-requests/{self.borrow_request.id}/create-campaign",
            {
                "titlePublic": "Campaign Title",
                "storyPublic": "Story",
                "termsPublic": "Terms",
                "amountNeededCents": 7000,
                "expectedReturnDays": 30,
                "category": "medical",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        self.borrow_request.status = BorrowRequestStatus.VERIFIED
        self.borrow_request.save(update_fields=["status"])

        response = self.client.post(
            f"/api/v1/admin/borrow-requests/{self.borrow_request.id}/create-campaign",
            {
                "titlePublic": "Campaign Title",
                "storyPublic": "Story",
                "termsPublic": "Terms",
                "amountNeededCents": 7000,
                "expectedReturnDays": 30,
                "category": "medical",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.borrow_request.refresh_from_db()
        self.assertEqual(self.borrow_request.status, BorrowRequestStatus.CAMPAIGN_CREATED)
        campaign = Campaign.objects.get(borrow_request=self.borrow_request)
        self.assertEqual(campaign.status, CampaignStatus.RUNNING)
        self.assertTrue(campaign.verified)
