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
