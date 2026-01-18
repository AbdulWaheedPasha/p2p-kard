import uuid

from django.core.validators import MinValueValidator
from django.db import models

from borrow.models import BorrowRequest, Currency
from payments.models import PaymentProvider


class RepaymentScheduleStatus(models.TextChoices):
    SCHEDULED = "SCHEDULED", "Scheduled"
    PAID = "PAID", "Paid"
    LATE = "LATE", "Late"
    CANCELLED = "CANCELLED", "Cancelled"


class RepaymentPaymentStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PAID = "PAID", "Paid"
    FAILED = "FAILED", "Failed"


class RepaymentScheduleItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    borrow_request = models.ForeignKey(
        BorrowRequest, related_name="repayment_schedule", on_delete=models.CASCADE
    )
    due_date = models.DateField()
    amount_cents = models.PositiveBigIntegerField(validators=[MinValueValidator(0)])
    status = models.CharField(
        max_length=20, choices=RepaymentScheduleStatus.choices, default=RepaymentScheduleStatus.SCHEDULED
    )

    class Meta:
        indexes = [models.Index(fields=["status"])]


class RepaymentPayment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    borrow_request = models.ForeignKey(
        BorrowRequest, related_name="repayment_payments", on_delete=models.CASCADE
    )
    amount_cents = models.PositiveBigIntegerField(validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.EUR)
    provider = models.CharField(max_length=20, choices=PaymentProvider.choices)
    provider_session_id = models.CharField(max_length=255, unique=True)
    status = models.CharField(
        max_length=20, choices=RepaymentPaymentStatus.choices, default=RepaymentPaymentStatus.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["status"])]


class RepaymentSetup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    borrow_request = models.ForeignKey(
        BorrowRequest, related_name="repayment_setups", on_delete=models.CASCADE
    )
    user = models.ForeignKey("accounts.User", related_name="repayment_setups", on_delete=models.CASCADE)
    provider = models.CharField(max_length=20, choices=PaymentProvider.choices)
    provider_session_id = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
