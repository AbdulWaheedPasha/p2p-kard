from __future__ import annotations

import random
import uuid
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

from campaigns.models import Campaign
from payments.models import Contribution

# Helper: set model fields only if they exist
def set_if_exists(obj, **kwargs):
    field_names = {f.name for f in obj._meta.get_fields()}
    for k, v in kwargs.items():
        if k in field_names:
            setattr(obj, k, v)

def model_has_field(model, name: str) -> bool:
    return any(f.name == name for f in model._meta.get_fields())

class Command(BaseCommand):
    help = "Seeds demo data: campaigns + contributions for a user (running/completed + active/returned totals)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="User email to attach contributions to")
        parser.add_argument("--password", default="Password123!", help="Password if user needs to be created")
        parser.add_argument("--running", type=int, default=5)
        parser.add_argument("--completed", type=int, default=5)
        parser.add_argument("--reset", action="store_true", help="Delete existing campaigns + contributions created by this script")

    def handle(self, *args, **opts):
        email = opts["email"].strip().lower()
        password = opts["password"]
        running_n = opts["running"]
        completed_n = opts["completed"]
        reset = opts["reset"]

        User = get_user_model()

        user, created = User.objects.get_or_create(email=email, defaults={"name": email.split("@")[0]})
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created user: {email} / {password}"))
        else:
            self.stdout.write(self.style.WARNING(f"Using existing user: {email}"))

        if reset:
            # Safe reset: remove contributions for this user and all campaigns (adjust if needed)
            Contribution.objects.filter(contributor=user).delete()
            Campaign.objects.all().delete()
            self.stdout.write(self.style.WARNING("Reset done: deleted campaigns and user contributions."))

        categories = ["Medical", "Education", "Housing", "Employment", "Emergency", "Essentials"]
        currency = "EUR"

        def make_campaign(i: int, status_value: str, verified: bool, pooled_ratio: float):
            needed = random.choice([30000, 50000, 80000, 120000, 150000])  # cents
            pooled = int(needed * pooled_ratio)
            expected_days = random.choice([30, 45, 60, 90, 120, 180])
            title = f"{random.choice(categories)} support request #{i}"
            story = (
                "A verified request for urgent assistance. The borrower’s identity is protected. "
                "Funds will be returned according to the estimated timeline."
            )
            terms = (
                "This is interest-free support. Repayment is expected by the estimated timeline, "
                "and recovery is handled through the platform."
            )

            c = Campaign()

            # Fill fields that exist (schema confirms these) :contentReference[oaicite:1]{index=1}
            set_if_exists(
                c,
                title_public=title,
                story_public=story,
                terms_public=terms,
                category=random.choice(categories),
                amount_needed_cents=needed,
                amount_pooled_cents=pooled,
                currency=currency,
                expected_return_days=expected_days,
                verified=verified,
                status=status_value,
            )

            # expected_return_date is nullable in schema :contentReference[oaicite:2]{index=2}
            if model_has_field(Campaign, "expected_return_date"):
                c.expected_return_date = date.today() + timedelta(days=expected_days)

            c.save()
            return c

        # Status values depend on your enums. Common ones are RUNNING/COMPLETED.
        # If your project uses different values, change these two strings.
        RUNNING = "RUNNING"
        COMPLETED = "COMPLETED"

        running_campaigns = [make_campaign(i + 1, RUNNING, True, pooled_ratio=random.uniform(0.15, 0.75)) for i in range(running_n)]
        completed_campaigns = [make_campaign(i + 1, COMPLETED, True, pooled_ratio=1.0) for i in range(completed_n)]
                # Create contributions for THIS user:
        # Some "active" (campaign running), some "returned" (campaign completed)

        import uuid

        def make_contribution(campaign: Campaign, amount_cents: int, status_value: str):
            contrib = Contribution()

            set_if_exists(contrib, contributor=user, campaign=campaign)
            set_if_exists(contrib, amount_cents=amount_cents)
            set_if_exists(contrib, currency=currency)
            set_if_exists(contrib, status=status_value)

            # IMPORTANT: provider_session_id is UNIQUE
            unique_session = f"seed_{uuid.uuid4().hex}"
            set_if_exists(contrib, provider_session_id=unique_session)
            set_if_exists(contrib, provider="stripe")

            if model_has_field(Contribution, "created_at"):
                contrib.created_at = timezone.now()
            if model_has_field(Contribution, "updated_at"):
                contrib.updated_at = timezone.now()

            contrib.save()
            return contrib

        PAID = "PAID"
        RETURNED = "RETURNED"

        # Active support: contributions into running campaigns
        for c in random.sample(running_campaigns, min(3, len(running_campaigns))):
            make_contribution(
                c,
                amount_cents=random.choice([1000, 2500, 5000, 10000]),
                status_value=PAID,
            )

        # Returned support: contributions into completed campaigns
        for c in random.sample(completed_campaigns, min(2, len(completed_campaigns))):
            make_contribution(
                c,
                amount_cents=random.choice([1500, 3000, 7500, 12000]),
                status_value=RETURNED,
            )

        self.stdout.write(self.style.SUCCESS(f"Seeded {running_n} running + {completed_n} completed campaigns."))
        self.stdout.write(self.style.SUCCESS("Seeded contributions for the user (active + returned)."))
