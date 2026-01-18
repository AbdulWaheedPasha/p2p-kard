from rest_framework import serializers

from campaigns.models import Campaign
from borrow.models import Currency
from core.serializers import CamelCaseSerializerMixin

from .models import Contribution, PaymentProvider


class SupportCheckoutRequestSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    campaign = serializers.PrimaryKeyRelatedField(queryset=Campaign.objects.all(), required=False)
    amount_cents = serializers.IntegerField()
    currency = serializers.ChoiceField(choices=Currency.choices, default=Currency.EUR)
    return_url = serializers.URLField()
    cancel_url = serializers.URLField()

    def validate_amount_cents(self, value):
        if value <= 0:
            raise serializers.ValidationError("amountCents must be greater than 0.")
        return value


class SupportCheckoutResponseSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    checkout = serializers.DictField()


class ContributionSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Contribution
        fields = [
            "id",
            "campaign",
            "amount_cents",
            "currency",
            "status",
            "provider",
            "provider_session_id",
            "created_at",
            "paid_at",
            "returned_at",
        ]
