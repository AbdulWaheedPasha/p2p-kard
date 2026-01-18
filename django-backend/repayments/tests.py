from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from borrow.models import BorrowRequest, BorrowRequestStatus
from repayments.models import RepaymentPayment, RepaymentPaymentStatus, RepaymentScheduleItem


class RepaymentsMineTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            email="repayer@example.com", password="StrongPass123", name="Repayer"
        )
        self.borrow_request = BorrowRequest.objects.create(
            requester=self.user,
            title="Borrow A",
            category="medical",
            reason_detailed="Private",
            amount_requested_cents=10000,
            currency="EUR",
            expected_return_days=45,
            status=BorrowRequestStatus.DISBURSED,
        )

    def test_schedule_generated_and_totals(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/v1/repayments/mine")
        self.assertEqual(response.status_code, 200)
        self.assertIn("schedule", response.data)
        self.assertIn("totals", response.data)
        self.assertEqual(len(response.data["schedule"]), 2)
        self.assertEqual(response.data["totals"]["paidCents"], 0)
        self.assertEqual(response.data["totals"]["remainingCents"], 10000)

        self.assertEqual(RepaymentScheduleItem.objects.filter(borrow_request=self.borrow_request).count(), 2)

        RepaymentPayment.objects.create(
            borrow_request=self.borrow_request,
            amount_cents=4000,
            currency="EUR",
            provider="stripe",
            provider_session_id="repayment_paid",
            status=RepaymentPaymentStatus.PAID,
        )
        response = self.client.get("/api/v1/repayments/mine")
        self.assertEqual(response.data["totals"]["paidCents"], 4000)
        self.assertEqual(response.data["totals"]["remainingCents"], 6000)

    @patch("repayments.views.stripe.checkout.Session.create")
    def test_setup_and_pay(self, mock_create):
        mock_create.return_value = SimpleNamespace(id="cs_setup_123", url="https://stripe.test/setup")
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/api/v1/repayments/setup",
            {"borrowRequestId": f"br_{self.borrow_request.id}", "provider": "stripe", "returnUrl": "https://x"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["setupUrl"], "https://stripe.test/setup")

        mock_create.return_value = SimpleNamespace(id="cs_pay_123", url="https://stripe.test/pay")
        response = self.client.post(
            "/api/v1/repayments/pay",
            {"borrowRequestId": f"br_{self.borrow_request.id}", "amountCents": 2000, "currency": "EUR"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["checkoutUrl"], "https://stripe.test/pay")

    @patch("repayments.views.stripe.Webhook.construct_event")
    def test_repayments_webhook_marks_paid(self, mock_construct_event):
        payment = RepaymentPayment.objects.create(
            borrow_request=self.borrow_request,
            amount_cents=3000,
            currency="EUR",
            provider="stripe",
            provider_session_id="cs_repay_123",
            status=RepaymentPaymentStatus.PENDING,
        )
        mock_construct_event.return_value = {
            "type": "checkout.session.completed",
            "data": {"object": {"id": "cs_repay_123", "metadata": {"type": "repayment_payment"}}},
        }
        response = self.client.post(
            "/api/v1/repayments/webhook",
            data='{"dummy":"payload"}',
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="sig",
        )
        self.assertEqual(response.status_code, 200)
        payment.refresh_from_db()
        self.assertEqual(payment.status, RepaymentPaymentStatus.PAID)
