from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from campaigns.models import Campaign, CampaignStatus
from payments.models import Contribution, ContributionStatus, PaymentProvider


class SupportCheckoutTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            email="supporter@example.com", password="StrongPass123", name="Supporter"
        )
        self.campaign = Campaign.objects.create(
            title_public="Campaign",
            story_public="Story",
            terms_public="Terms",
            category="medical",
            amount_needed_cents=10000,
            amount_pooled_cents=0,
            expected_return_days=30,
            status=CampaignStatus.RUNNING,
            verified=True,
        )

    @patch("payments.views.stripe.checkout.Session.create")
    def test_support_checkout_creates_contribution_and_returns_checkout(self, mock_create):
        mock_create.return_value = SimpleNamespace(id="cs_test_123", url="https://stripe.test/checkout")
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            f"/api/v1/campaigns/{self.campaign.id}/support/checkout",
            {
                "amountCents": 5000,
                "currency": "EUR",
                "returnUrl": "https://example.com/return",
                "cancelUrl": "https://example.com/cancel",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertIn("checkout", response.data)
        self.assertEqual(response.data["checkout"]["provider"], "stripe")
        self.assertEqual(response.data["checkout"]["sessionId"], "cs_test_123")
        self.assertEqual(response.data["checkout"]["checkoutUrl"], "https://stripe.test/checkout")

        contribution = Contribution.objects.get(campaign=self.campaign, contributor=self.user)
        self.assertEqual(contribution.status, ContributionStatus.PLEDGED)
        self.assertEqual(contribution.provider_session_id, "cs_test_123")

    def test_support_checkout_requires_auth(self):
        response = self.client.post(
            f"/api/v1/campaigns/{self.campaign.id}/support/checkout",
            {
                "amountCents": 5000,
                "currency": "EUR",
                "returnUrl": "https://example.com/return",
                "cancelUrl": "https://example.com/cancel",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 401)


class StripeWebhookTests(APITestCase):
    @patch("payments.views.stripe.Webhook.construct_event")
    def test_webhook_marks_paid_and_updates_campaign(self, mock_construct_event):
        User = get_user_model()
        user = User.objects.create_user(
            email="contributor@example.com", password="StrongPass123", name="Contributor"
        )
        campaign = Campaign.objects.create(
            title_public="Campaign",
            story_public="Story",
            terms_public="Terms",
            category="education",
            amount_needed_cents=10000,
            amount_pooled_cents=0,
            expected_return_days=30,
            status=CampaignStatus.RUNNING,
            verified=True,
        )
        contribution = Contribution.objects.create(
            contributor=user,
            campaign=campaign,
            amount_cents=10000,
            currency="EUR",
            status=ContributionStatus.PLEDGED,
            provider=PaymentProvider.STRIPE,
            provider_session_id="pending_test",
        )

        mock_construct_event.return_value = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_456",
                    "metadata": {
                        "contribution_id": str(contribution.id),
                        "campaign_id": str(campaign.id),
                        "user_id": str(user.id),
                    },
                }
            },
        }

        response = self.client.post(
            "/api/v1/payments/webhook",
            data='{"dummy":"payload"}',
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="sig",
        )
        self.assertEqual(response.status_code, 200)

        contribution.refresh_from_db()
        campaign.refresh_from_db()
        self.assertEqual(contribution.status, ContributionStatus.PAID)
        self.assertIsNotNone(contribution.paid_at)
        self.assertEqual(campaign.amount_pooled_cents, 10000)
        self.assertEqual(campaign.status, CampaignStatus.FUNDED)

        response_repeat = self.client.post(
            "/api/v1/payments/webhook",
            data='{"dummy":"payload"}',
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="sig",
        )
        self.assertEqual(response_repeat.status_code, 200)
        campaign.refresh_from_db()
        self.assertEqual(campaign.amount_pooled_cents, 10000)
