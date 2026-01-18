import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from borrow.models import BorrowRequest, Currency
from campaigns.models import Campaign


class ContributionStatus(models.TextChoices):
    PLEDGED = "PLEDGED", "Pledged"
    PAID = "PAID", "Paid"
    RETURNED = "RETURNED", "Returned"
    DEFAULT_COVERED = "DEFAULT_COVERED", "Default covered"


class PaymentProvider(models.TextChoices):
    STRIPE = "stripe", "Stripe"


class PlatformLedgerType(models.TextChoices):
    DISBURSEMENT = "DISBURSEMENT", "Disbursement"
    DEFAULT_COVER = "DEFAULT_COVER", "Default cover"
    RETURN = "RETURN", "Return"


class Contribution(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contributor = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="contributions", on_delete=models.CASCADE
    )
    campaign = models.ForeignKey(Campaign, related_name="contributions", on_delete=models.CASCADE)
    amount_cents = models.PositiveBigIntegerField(validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.EUR)
    status = models.CharField(
        max_length=20, choices=ContributionStatus.choices, default=ContributionStatus.PLEDGED
    )
    provider = models.CharField(max_length=20, choices=PaymentProvider.choices)
    provider_session_id = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["status"])]


class PlatformLedger(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=20, choices=PlatformLedgerType.choices)
    amount_cents = models.PositiveBigIntegerField(validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.EUR)
    related_campaign = models.ForeignKey(
        Campaign, null=True, blank=True, on_delete=models.SET_NULL, related_name="ledger_entries"
    )
    related_borrow_request = models.ForeignKey(
        BorrowRequest,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ledger_entries",
    )
    related_contribution = models.ForeignKey(
        Contribution,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ledger_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["type"])]
