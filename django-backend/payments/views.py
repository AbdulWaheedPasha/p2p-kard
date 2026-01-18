import uuid

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

from campaigns.models import Campaign, CampaignStatus
from core.utils import parse_prefixed_uuid

from .models import Contribution, ContributionStatus, PaymentProvider
from .serializers import SupportCheckoutRequestSerializer, SupportCheckoutResponseSerializer


class SupportCheckoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=SupportCheckoutRequestSerializer, responses=SupportCheckoutResponseSerializer)
    def post(self, request, campaign_id):
        campaign_id = parse_prefixed_uuid("c", campaign_id)
        if campaign_id is None:
            return Response({"detail": "Invalid campaign id."}, status=status.HTTP_400_BAD_REQUEST)
        campaign = get_object_or_404(Campaign, id=campaign_id)
        serializer = SupportCheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount_cents = serializer.validated_data["amount_cents"]
        currency = serializer.validated_data["currency"]
        return_url = serializer.validated_data["return_url"]
        cancel_url = serializer.validated_data["cancel_url"]

        paid_total = (
            Contribution.objects.filter(campaign=campaign, status=ContributionStatus.PAID).aggregate(
                total=Sum("amount_cents")
            )["total"]
            or 0
        )
        remaining = campaign.amount_needed_cents - paid_total
        if amount_cents > remaining:
            return Response(
                {"detail": "Amount exceeds remaining campaign need."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        contribution = Contribution.objects.create(
            contributor=request.user,
            campaign=campaign,
            amount_cents=amount_cents,
            currency=currency,
            status=ContributionStatus.PLEDGED,
            provider=PaymentProvider.STRIPE,
            provider_session_id=f"pending_{uuid.uuid4()}",
        )

        stripe.api_key = settings.STRIPE_SECRET_KEY
        session = stripe.checkout.Session.create(
            mode="payment",
            success_url=return_url,
            cancel_url=cancel_url,
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": currency.lower(),
                        "product_data": {"name": campaign.title_public},
                        "unit_amount": amount_cents,
                    },
                    "quantity": 1,
                }
            ],
            metadata={
                "contribution_id": str(contribution.id),
                "campaign_id": str(campaign.id),
                "user_id": str(request.user.id),
            },
        )

        contribution.provider_session_id = session.id
        contribution.save(update_fields=["provider_session_id"])

        response_serializer = SupportCheckoutResponseSerializer(
            {
                "checkout": {
                    "provider": PaymentProvider.STRIPE,
                    "session_id": session.id,
                    "checkout_url": session.url,
                }
            }
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@method_decorator(csrf_exempt, name="dispatch")
class StripeWebhookView(APIView):
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
        contribution_id = metadata.get("contribution_id")
        if not contribution_id:
            return Response(status=status.HTTP_200_OK)

        with transaction.atomic():
            contribution = (
                Contribution.objects.select_for_update()
                .filter(id=contribution_id)
                .select_related("campaign")
                .first()
            )
            if not contribution:
                return Response(status=status.HTTP_200_OK)
            if contribution.status == ContributionStatus.PAID:
                return Response(status=status.HTTP_200_OK)

            contribution.status = ContributionStatus.PAID
            contribution.paid_at = timezone.now()
            contribution.provider_session_id = session.get("id", contribution.provider_session_id)
            contribution.save(update_fields=["status", "paid_at", "provider_session_id"])

            campaign = Campaign.objects.select_for_update().get(id=contribution.campaign_id)
            paid_total = (
                Contribution.objects.filter(campaign=campaign, status=ContributionStatus.PAID).aggregate(
                    total=Sum("amount_cents")
                )["total"]
                or 0
            )
            campaign.amount_pooled_cents = paid_total
            if campaign.amount_pooled_cents >= campaign.amount_needed_cents:
                campaign.status = CampaignStatus.FUNDED
            campaign.save(update_fields=["amount_pooled_cents", "status"])

        return Response(status=status.HTTP_200_OK)
