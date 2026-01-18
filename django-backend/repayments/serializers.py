from django.db.models import Sum
from rest_framework import serializers

from borrow.models import BorrowRequest, Currency
from core.serializers import CamelCaseSerializerMixin
from core.utils import parse_prefixed_id
from payments.models import PaymentProvider

from .models import RepaymentPayment, RepaymentPaymentStatus, RepaymentScheduleItem, RepaymentSetup


class RepaymentScheduleItemSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = RepaymentScheduleItem
        fields = ["id", "due_date", "amount_cents", "status"]


class RepaymentSetupSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    borrow_request_id = serializers.CharField()
    provider = serializers.ChoiceField(choices=PaymentProvider.choices)
    return_url = serializers.URLField()

    def validate_borrow_request_id(self, value):
        return parse_prefixed_id("br", value)


class RepaymentPaySerializer(CamelCaseSerializerMixin, serializers.Serializer):
    borrow_request_id = serializers.CharField()
    amount_cents = serializers.IntegerField()
    currency = serializers.ChoiceField(choices=Currency.choices, default=Currency.EUR)

    def validate_amount_cents(self, value):
        if value <= 0:
            raise serializers.ValidationError("amountCents must be greater than 0.")
        return value

    def validate_borrow_request_id(self, value):
        return parse_prefixed_id("br", value)


class RepaymentSetupResponseSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    setup_url = serializers.URLField()


class RepaymentPayResponseSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    checkout_url = serializers.URLField()


class RepaymentsMineSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    schedule = serializers.SerializerMethodField()
    totals = serializers.SerializerMethodField()

    def _get_borrow_request(self):
        borrow_request = self.context.get("borrow_request")
        if borrow_request:
            return borrow_request
        return None

    def get_schedule(self, obj):
        borrow_request = self._get_borrow_request()
        if not borrow_request:
            return []
        schedule = RepaymentScheduleItem.objects.filter(borrow_request=borrow_request).order_by("due_date")
        return RepaymentScheduleItemSerializer(schedule, many=True).data

    def get_totals(self, obj):
        borrow_request = self._get_borrow_request()
        if not borrow_request:
            return {"paid_cents": 0, "remaining_cents": 0}
        total_due = (
            RepaymentScheduleItem.objects.filter(borrow_request=borrow_request).aggregate(
                total=Sum("amount_cents")
            )["total"]
            or 0
        )
        total_paid = (
            RepaymentPayment.objects.filter(
                borrow_request=borrow_request, status=RepaymentPaymentStatus.PAID
            ).aggregate(total=Sum("amount_cents"))["total"]
            or 0
        )
        remaining = total_due - total_paid
        return {
            "paid_cents": total_paid,
            "remaining_cents": remaining if remaining > 0 else 0,
        }
