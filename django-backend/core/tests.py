from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from borrow.models import BorrowRequest, BorrowRequestStatus
from campaigns.models import Campaign, CampaignStatus
from payments.models import Contribution, ContributionStatus, PaymentProvider


class HomeAndCampaignEndpointsTests(APITestCase):
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
        self.running_campaign = Campaign.objects.create(
            borrow_request=self.borrow_request,
            title_public="Running",
            story_public="Story",
            terms_public="Terms",
            category="medical",
            amount_needed_cents=10000,
            amount_pooled_cents=2500,
            expected_return_days=30,
            status=CampaignStatus.RUNNING,
            verified=True,
        )
        self.completed_campaign = Campaign.objects.create(
            borrow_request=self.borrow_request,
            title_public="Completed",
            story_public="Story",
            terms_public="Terms",
            category="education",
            amount_needed_cents=10000,
            amount_pooled_cents=10000,
            expected_return_days=30,
            status=CampaignStatus.COMPLETED,
            verified=True,
        )
        Contribution.objects.create(
            contributor=self.lender,
            campaign=self.completed_campaign,
            amount_cents=5000,
            currency="EUR",
            status=ContributionStatus.RETURNED,
            provider=PaymentProvider.STRIPE,
            provider_session_id="sess_returned",
        )
        Contribution.objects.create(
            contributor=self.lender,
            campaign=self.completed_campaign,
            amount_cents=1000,
            currency="EUR",
            status=ContributionStatus.DEFAULT_COVERED,
            provider=PaymentProvider.STRIPE,
            provider_session_id="sess_default",
        )

    def test_home_lists_only_running_and_completed(self):
        response = self.client.get("/api/v1/home")
        self.assertEqual(response.status_code, 200)
        self.assertIn("stats", response.data)
        self.assertIn("runningCampaigns", response.data)
        self.assertIn("completedCampaigns", response.data)
        self.assertEqual(len(response.data["runningCampaigns"]), 1)
        self.assertEqual(len(response.data["completedCampaigns"]), 1)

        stats = response.data["stats"]
        self.assertEqual(stats["totalPooledCents"], 12500)
        self.assertEqual(stats["totalReturnedCents"], 6000)
        self.assertEqual(stats["activeCampaignCount"], 1)

    def test_home_does_not_expose_borrower_identity(self):
        response = self.client.get("/api/v1/home")
        self.assertEqual(response.status_code, 200)
        for campaign in response.data["runningCampaigns"]:
            self.assertNotIn("borrowRequest", campaign)
            self.assertNotIn("requester", campaign)
            self.assertNotIn("requesterId", campaign)

    def test_campaign_detail_no_borrower_identity_and_progress_clamped(self):
        Campaign.objects.filter(id=self.running_campaign.id).update(amount_pooled_cents=25000)
        response = self.client.get(f"/api/v1/campaigns/c_{self.running_campaign.id}")
        self.assertEqual(response.status_code, 200)
        self.assertIn("campaign", response.data)
        campaign = response.data["campaign"]
        self.assertNotIn("borrowRequest", campaign)
        self.assertNotIn("requester", campaign)
        self.assertEqual(campaign["fundingProgressPct"], 100)


class HealthEndpointTests(APITestCase):
    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["ok"])
        self.assertEqual(response.data["version"], "v1")


from privacy_tests import PrivacyGuardrailTests  # noqa: F401,E402


class DashboardEndpointTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            email="dash@example.com", password="StrongPass123", name="Dash User"
        )
        self.other_user = User.objects.create_user(
            email="other@example.com", password="StrongPass123", name="Other User"
        )
        self.borrow_request = BorrowRequest.objects.create(
            requester=self.user,
            title="Borrow A",
            category="medical",
            reason_detailed="Private",
            amount_requested_cents=8000,
            currency="EUR",
            expected_return_days=45,
            status=BorrowRequestStatus.SUBMITTED,
        )
        BorrowRequest.objects.create(
            requester=self.other_user,
            title="Borrow B",
            category="education",
            reason_detailed="Private",
            amount_requested_cents=9000,
            currency="EUR",
            expected_return_days=60,
            status=BorrowRequestStatus.SUBMITTED,
        )
        self.running_campaign = Campaign.objects.create(
            title_public="Running",
            story_public="Story",
            terms_public="Terms",
            category="medical",
            amount_needed_cents=10000,
            amount_pooled_cents=0,
            expected_return_days=30,
            status=CampaignStatus.RUNNING,
            verified=True,
        )
        self.completed_campaign = Campaign.objects.create(
            title_public="Completed",
            story_public="Story",
            terms_public="Terms",
            category="education",
            amount_needed_cents=10000,
            amount_pooled_cents=10000,
            expected_return_days=30,
            status=CampaignStatus.COMPLETED,
            verified=True,
        )
        Contribution.objects.create(
            contributor=self.user,
            campaign=self.running_campaign,
            amount_cents=3000,
            currency="EUR",
            status=ContributionStatus.PAID,
            provider=PaymentProvider.STRIPE,
            provider_session_id="dash_paid",
        )
        Contribution.objects.create(
            contributor=self.user,
            campaign=self.completed_campaign,
            amount_cents=5000,
            currency="EUR",
            status=ContributionStatus.PAID,
            provider=PaymentProvider.STRIPE,
            provider_session_id="dash_paid_completed",
        )
        Contribution.objects.create(
            contributor=self.user,
            campaign=self.completed_campaign,
            amount_cents=2000,
            currency="EUR",
            status=ContributionStatus.RETURNED,
            provider=PaymentProvider.STRIPE,
            provider_session_id="dash_returned",
        )

    def test_dashboard_totals_and_shape(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/v1/dashboard")
        self.assertEqual(response.status_code, 200)

        self.assertIn("supportSummary", response.data)
        self.assertIn("supportByCampaign", response.data)
        self.assertIn("borrowRequests", response.data)

        summary = response.data["supportSummary"]
        self.assertEqual(summary["totalSupportedCents"], 8000)
        self.assertEqual(summary["activeSupportedCents"], 3000)
        self.assertEqual(summary["returnedCents"], 2000)

        support_by_campaign = response.data["supportByCampaign"]
        self.assertTrue(len(support_by_campaign) >= 3)
        for item in support_by_campaign:
            self.assertIn("campaignId", item)
            self.assertTrue(item["campaignId"].startswith("c_"))
            self.assertIn("campaignTitle", item)
            self.assertIn("amountCents", item)
            self.assertIn("contributionStatus", item)
            self.assertIn("campaignStatus", item)
            self.assertIn("expectedReturnDate", item)

        borrow_requests = response.data["borrowRequests"]
        self.assertEqual(len(borrow_requests), 1)
        self.assertTrue(borrow_requests[0]["id"].startswith("br_"))
        self.assertEqual(borrow_requests[0]["title"], "Borrow A")
