import uuid
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from borrow.models import BorrowRequest, Currency


class CampaignStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    RUNNING = "RUNNING", "Running"
    FUNDED = "FUNDED", "Funded"
    DISBURSED = "DISBURSED", "Disbursed"
    IN_REPAYMENT = "IN_REPAYMENT", "In repayment"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class Campaign(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    borrow_request = models.OneToOneField(
        BorrowRequest, related_name="campaign", on_delete=models.SET_NULL, null=True, blank=True
    )
    title_public = models.CharField(max_length=255)
    story_public = models.TextField()
    terms_public = models.TextField()
    category = models.CharField(max_length=100)
    amount_needed_cents = models.PositiveBigIntegerField(validators=[MinValueValidator(0)])
    amount_pooled_cents = models.PositiveBigIntegerField(default=0, validators=[MinValueValidator(0)])
    expected_return_days = models.PositiveIntegerField(validators=[MinValueValidator(0)])
    expected_return_date = models.DateField(null=True, blank=True)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.EUR)
    status = models.CharField(
        max_length=20, choices=CampaignStatus.choices, default=CampaignStatus.DRAFT
    )
    verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status"])]

    def clean(self):
        if self.amount_pooled_cents > self.amount_needed_cents:
            raise ValidationError("amount_pooled_cents cannot exceed amount_needed_cents.")

    def save(self, *args, **kwargs):
        if self.expected_return_date is None and self.expected_return_days is not None:
            base_date = self.created_at.date() if self.created_at else timezone.now().date()
            self.expected_return_date = base_date + timedelta(days=self.expected_return_days)
        self.full_clean()
        super().save(*args, **kwargs)
