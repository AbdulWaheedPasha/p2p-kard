<<<<<<< HEAD:django-backend/campaigns/serializers.py
from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from borrow.models import BorrowRequest
from core.serializers import CamelCaseSerializerMixin
from core.utils import funding_progress_pct, prefixed_id

from .models import Campaign


class CampaignCardSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    funding_progress_pct = serializers.SerializerMethodField()
    expected_return_date = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id",
            "title_public",
            "story_public",
            "category",
            "amount_needed_cents",
            "amount_pooled_cents",
            "currency",
            "expected_return_days",
            "expected_return_date",
            "funding_progress_pct",
            "status",
            "verified",
            "created_at",
        ]

    def get_funding_progress_pct(self, obj):
        return funding_progress_pct(obj.amount_pooled_cents, obj.amount_needed_cents)

    def get_id(self, obj):
        return prefixed_id("c", obj.id)

    def get_expected_return_date(self, obj):
        if obj.expected_return_date:
            return obj.expected_return_date
        base_date = obj.created_at.date() if obj.created_at else timezone.now().date()
        return base_date + timedelta(days=obj.expected_return_days or 0)


class CampaignDetailSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    funding_progress_pct = serializers.SerializerMethodField()
    expected_return_date = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            "id",
            "title_public",
            "story_public",
            "terms_public",
            "category",
            "amount_needed_cents",
            "amount_pooled_cents",
            "currency",
            "expected_return_days",
            "expected_return_date",
            "funding_progress_pct",
            "status",
            "verified",
            "created_at",
            "updated_at",
        ]

    def get_funding_progress_pct(self, obj):
        return funding_progress_pct(obj.amount_pooled_cents, obj.amount_needed_cents)

    def get_id(self, obj):
        return prefixed_id("c", obj.id)

    def get_expected_return_date(self, obj):
        if obj.expected_return_date:
            return obj.expected_return_date
        base_date = obj.created_at.date() if obj.created_at else timezone.now().date()
        return base_date + timedelta(days=obj.expected_return_days or 0)


class CreateCampaignSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    borrow_request = serializers.PrimaryKeyRelatedField(
        queryset=BorrowRequest.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Campaign
        fields = [
            "id",
            "borrow_request",
            "title_public",
            "story_public",
            "terms_public",
            "category",
            "amount_needed_cents",
            "amount_pooled_cents",
            "currency",
            "expected_return_days",
            "expected_return_date",
            "status",
            "verified",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "amount_pooled_cents", "created_at", "updated_at"]

    def validate_amount_needed_cents(self, value):
        if value <= 0:
            raise serializers.ValidationError("amountNeededCents must be greater than 0.")
        return value

    def get_id(self, obj):
        return prefixed_id("c", obj.id)
=======
from rest_framework import serializers

from campaigns.models import Campaign
from payments.models import Contribution
from borrow.models import BorrowRequest


# -------------------------
# Campaign serializers
# -------------------------

class CampaignPublicSerializer(serializers.ModelSerializer):
    """Public campaign fields used by Home/Campaign detail responses."""

    class Meta:
        model = Campaign
        fields = [
            "id",
            "title_public",
            "story_public",
            "terms_public",
            "category",
            "verified",
            "status",
            "currency",
            "amount_needed_cents",
            "amount_pooled_cents",
            "expected_return_days",
            "expected_return_date",
        ]


class CampaignCardSerializer(serializers.ModelSerializer):
    """Compact serializer for campaign cards (used by core/api_serializers imports)."""

    class Meta:
        model = Campaign
        fields = [
            "id",
            "title_public",
            "category",
            "verified",
            "status",
            "currency",
            "amount_needed_cents",
            "amount_pooled_cents",
            "expected_return_days",
            "expected_return_date",
        ]


class CampaignDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for a campaign (used by core/api_serializers imports)."""

    class Meta:
        model = Campaign
        fields = [
            "id",
            "title_public",
            "story_public",
            "terms_public",
            "category",
            "verified",
            "status",
            "currency",
            "amount_needed_cents",
            "amount_pooled_cents",
            "expected_return_days",
            "expected_return_date",
        ]


class CreateCampaignSerializer(serializers.ModelSerializer):
    """Used by staff API to create/update campaigns after internal verification."""

    class Meta:
        model = Campaign
        fields = [
            "title_public",
            "story_public",
            "terms_public",
            "category",
            "verified",
            "status",
            "currency",
            "amount_needed_cents",
            "amount_pooled_cents",
            "expected_return_days",
            "expected_return_date",
        ]


# -------------------------
# Response serializers (core endpoints)
# -------------------------

class HomeResponseSerializer(serializers.Serializer):
    stats = serializers.DictField()
    running_campaigns = CampaignCardSerializer(many=True)
    completed_campaigns = CampaignCardSerializer(many=True)

    def to_representation(self, instance):
        campaigns = instance.get("campaigns", Campaign.objects.none())

        # Status values confirmed in your DB: RUNNING, COMPLETED ✅
        running = (
            campaigns.filter(status="RUNNING").order_by("-id")[:5]
            if hasattr(campaigns, "filter")
            else []
        )
        completed = (
            campaigns.filter(status="COMPLETED").order_by("-id")[:5]
            if hasattr(campaigns, "filter")
            else []
        )

        # Stats
        total_needed = sum((c.amount_needed_cents or 0) for c in campaigns) if hasattr(campaigns, "__iter__") else 0
        total_pooled = sum((c.amount_pooled_cents or 0) for c in campaigns) if hasattr(campaigns, "__iter__") else 0

        return {
            "stats": {
                "activeCampaignCount": running.count() if hasattr(running, "count") else len(running),
                "totalNeededCents": total_needed,
                "totalPooledCents": total_pooled,
            },
            "running_campaigns": CampaignCardSerializer(running, many=True).data,
            "completed_campaigns": CampaignCardSerializer(completed, many=True).data,
        }


class CampaignDetailResponseSerializer(serializers.Serializer):
    campaign = CampaignDetailSerializer()


class BorrowRequestSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = BorrowRequest
        fields = [
            "id",
            "title",
            "category",
            "status",
            "amount_requested_cents",
            "currency",
            "expected_return_days",
            "created_at",
        ]


class DashboardResponseSerializer(serializers.Serializer):
    support_summary = serializers.DictField()
    support_by_campaign = serializers.ListField()
    borrow_requests = BorrowRequestSummarySerializer(many=True)

    def to_representation(self, instance):
        contributions = instance.get("contributions", Contribution.objects.none())
        borrow_requests = instance.get("borrow_requests", BorrowRequest.objects.none())

        total_supported = sum((c.amount_cents or 0) for c in contributions) if hasattr(contributions, "__iter__") else 0

        returned = (
            sum((c.amount_cents or 0) for c in contributions.filter(status="RETURNED"))
            if hasattr(contributions, "filter")
            else 0
        )
        active = (
            sum((c.amount_cents or 0) for c in contributions.filter(status="PAID"))
            if hasattr(contributions, "filter")
            else 0
        )

        by_campaign = []
        if hasattr(contributions, "__iter__"):
            for c in contributions:
                by_campaign.append(
                    {
                        "campaign_id": getattr(c.campaign, "id", None),
                        "campaign_title": getattr(c.campaign, "title_public", ""),
                        "campaign_status": getattr(c.campaign, "status", ""),
                        "amount_cents": c.amount_cents,
                        "currency": getattr(c, "currency", "EUR"),
                        "contribution_status": getattr(c, "status", ""),
                        "expected_return_date": getattr(c.campaign, "expected_return_date", None),
                    }
                )

        return {
            "support_summary": {
                "total_supported_cents": total_supported,
                "active_supported_cents": active,
                "returned_cents": returned,
            },
            "support_by_campaign": by_campaign,
            "borrow_requests": BorrowRequestSummarySerializer(borrow_requests, many=True).data,
        }
>>>>>>> 0185501 (p2p Backend):campaigns/serializers.py
