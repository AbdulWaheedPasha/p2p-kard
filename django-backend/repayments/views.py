import calendar
from datetime import date

import stripe
from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from stripe.error import SignatureVerificationError

from borrow.models import BorrowRequest, BorrowRequestStatus
from campaigns.models import Campaign, CampaignStatus
from core.utils import parse_prefixed_uuid

from .models import (
    RepaymentPayment,
    RepaymentPaymentStatus,
    RepaymentScheduleItem,
    RepaymentScheduleStatus,
    RepaymentSetup,
)
from .serializers import (
    RepaymentPayResponseSerializer,
    RepaymentPaySerializer,
    RepaymentSetupResponseSerializer,
    RepaymentSetupSerializer,
    RepaymentsMineSerializer,
)


def _add_months(base_date, months):
    month = base_date.month - 1 + months
    year = base_date.year + month // 12
    month = month % 12 + 1
    day = min(base_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _generate_schedule(borrow_request):
    if borrow_request.repayment_schedule.exists():
        return borrow_request.repayment_schedule.order_by("due_date")
    total_cents = borrow_request.amount_requested_cents
    months = max(1, (borrow_request.expected_return_days + 29) // 30)
    base_amount = total_cents // months
    remainder = total_cents - (base_amount * months)

    start_date = timezone.now().date()
    items = []
    for idx in range(months):
        amount = base_amount + (remainder if idx == months - 1 else 0)
        due_date = _add_months(start_date, idx + 1)
        items.append(
            RepaymentScheduleItem(
                borrow_request=borrow_request,
                due_date=due_date,
                amount_cents=amount,
                status=RepaymentScheduleStatus.SCHEDULED,
            )
        )
    RepaymentScheduleItem.objects.bulk_create(items)
    return borrow_request.repayment_schedule.order_by("due_date")


class RepaymentSetupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=RepaymentSetupSerializer, responses=RepaymentSetupResponseSerializer)
    def post(self, request):
        serializer = RepaymentSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        borrow_request_id = serializer.validated_data["borrow_request_id"]
        provider = serializer.validated_data["provider"]
        return_url = serializer.validated_data["return_url"]

        borrow_request = get_object_or_404(
            BorrowRequest, id=borrow_request_id, requester=request.user
        )

        stripe.api_key = settings.STRIPE_SECRET_KEY
        session = stripe.checkout.Session.create(
            mode="setup",
            success_url=return_url,
            cancel_url=return_url,
            payment_method_types=["card"],
            metadata={
                "borrow_request_id": str(borrow_request.id),
                "user_id": str(request.user.id),
                "type": "repayment_setup",
            },
        )

        RepaymentSetup.objects.create(
            borrow_request=borrow_request,
            user=request.user,
            provider=provider,
            provider_session_id=session.id,
        )

        response_serializer = RepaymentSetupResponseSerializer({"setup_url": session.url})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class RepaymentPayView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=RepaymentPaySerializer, responses=RepaymentPayResponseSerializer)
    def post(self, request):
        serializer = RepaymentPaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        borrow_request_id = serializer.validated_data["borrow_request_id"]
        amount_cents = serializer.validated_data["amount_cents"]
        currency = serializer.validated_data["currency"]

        borrow_request = get_object_or_404(
            BorrowRequest, id=borrow_request_id, requester=request.user
        )

        stripe.api_key = settings.STRIPE_SECRET_KEY
        session = stripe.checkout.Session.create(
            mode="payment",
            success_url=request.data.get("returnUrl", "https://example.invalid/return"),
            cancel_url=request.data.get("returnUrl", "https://example.invalid/cancel"),
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": currency.lower(),
                        "product_data": {"name": "Repayment"},
                        "unit_amount": amount_cents,
                    },
                    "quantity": 1,
                }
            ],
            metadata={
                "borrow_request_id": str(borrow_request.id),
                "user_id": str(request.user.id),
                "type": "repayment_payment",
            },
        )

        RepaymentPayment.objects.create(
            borrow_request=borrow_request,
            amount_cents=amount_cents,
            currency=currency,
            provider="stripe",
            provider_session_id=session.id,
            status=RepaymentPaymentStatus.PENDING,
        )

        response_serializer = RepaymentPayResponseSerializer({"checkout_url": session.url})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class RepaymentsMineView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses=RepaymentsMineSerializer)
    def get(self, request):
        borrow_request_id = request.query_params.get("borrowRequestId")
        if borrow_request_id:
            borrow_request_id = parse_prefixed_uuid("br", borrow_request_id)
            if borrow_request_id is None:
                return Response(
                    {"detail": "Invalid borrow request id."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            borrow_request = get_object_or_404(
                BorrowRequest, id=borrow_request_id, requester=request.user
            )
        else:
            borrow_request = (
                BorrowRequest.objects.filter(requester=request.user)
                .order_by("-created_at")
                .first()
            )
        if not borrow_request:
            return Response({"schedule": [], "totals": {"paidCents": 0, "remainingCents": 0}})

        _generate_schedule(borrow_request)
        serializer = RepaymentsMineSerializer(context={"borrow_request": borrow_request})
        return Response(serializer.data)


@method_decorator(csrf_exempt, name="dispatch")
class RepaymentsWebhookView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    @extend_schema(request=None, responses=None)
    def post(self, request):
        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")
        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            event = stripe.Webhook.construct_event(
                payload=payload, sig_header=sig_header, secret=settings.STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, SignatureVerificationError):
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if event.get("type") != "checkout.session.completed":
            return Response(status=status.HTTP_200_OK)

        session = event.get("data", {}).get("object", {})
        metadata = session.get("metadata", {})
        if metadata.get("type") != "repayment_payment":
            return Response(status=status.HTTP_200_OK)

        with transaction.atomic():
            payment = (
                RepaymentPayment.objects.select_for_update()
                .filter(provider_session_id=session.get("id"))
                .select_related("borrow_request")
                .first()
            )
            if not payment:
                return Response(status=status.HTTP_200_OK)
            if payment.status == RepaymentPaymentStatus.PAID:
                return Response(status=status.HTTP_200_OK)

            payment.status = RepaymentPaymentStatus.PAID
            payment.paid_at = timezone.now()
            payment.save(update_fields=["status", "paid_at"])

            borrow_request = BorrowRequest.objects.select_for_update().get(id=payment.borrow_request_id)
            if borrow_request.status == BorrowRequestStatus.DISBURSED:
                borrow_request.status = BorrowRequestStatus.IN_REPAYMENT
                borrow_request.save(update_fields=["status"])

            total_paid = (
                RepaymentPayment.objects.filter(
                    borrow_request=borrow_request, status=RepaymentPaymentStatus.PAID
                ).aggregate(total=Sum("amount_cents"))["total"]
                or 0
            )
            if total_paid >= borrow_request.amount_requested_cents:
                borrow_request.status = BorrowRequestStatus.COMPLETED
                borrow_request.save(update_fields=["status"])
                campaign = Campaign.objects.filter(borrow_request=borrow_request).first()
                if campaign:
                    campaign.status = CampaignStatus.COMPLETED
                    campaign.save(update_fields=["status"])

        return Response(status=status.HTTP_200_OK)
