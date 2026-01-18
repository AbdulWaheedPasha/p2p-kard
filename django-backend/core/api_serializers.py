from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from borrow.models import BorrowRequest
from borrow.serializers import BorrowRequestListItemSerializer
from campaigns.models import Campaign, CampaignStatus
from campaigns.serializers import CampaignCardSerializer, CampaignDetailSerializer
from core.serializers import CamelCaseSerializerMixin
from core.utils import funding_progress_pct, prefixed_id
from payments.models import Contribution, ContributionStatus


class HomeStatsSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    total_pooled_cents = serializers.SerializerMethodField()
    total_returned_cents = serializers.SerializerMethodField()
    active_campaign_count = serializers.SerializerMethodField()

    def _campaigns(self):
        return self.context.get("campaigns") or Campaign.objects.all()

    def _contributions(self):
        return self.context.get("contributions") or Contribution.objects.none()

    def get_total_pooled_cents(self, obj):
        return self._campaigns().aggregate(total=Sum("amount_pooled_cents"))["total"] or 0

    def get_total_returned_cents(self, obj):
        return (
            self._contributions()
            .filter(status__in=[ContributionStatus.RETURNED, ContributionStatus.DEFAULT_COVERED])
            .aggregate(total=Sum("amount_cents"))["total"]
            or 0
        )

    def get_active_campaign_count(self, obj):
        return self._campaigns().filter(status=CampaignStatus.RUNNING).count()


class SupportSummarySerializer(CamelCaseSerializerMixin, serializers.Serializer):
    total_contributed_cents = serializers.SerializerMethodField()
    total_paid_cents = serializers.SerializerMethodField()
    total_returned_cents = serializers.SerializerMethodField()
    active_support_count = serializers.SerializerMethodField()
    campaigns_supported_count = serializers.SerializerMethodField()

    def _contributions(self):
        return self.context.get("contributions") or Contribution.objects.none()

    def get_total_contributed_cents(self, obj):
        return self._contributions().aggregate(total=Sum("amount_cents"))["total"] or 0

    def get_total_paid_cents(self, obj):
        return (
            self._contributions()
            .filter(status=ContributionStatus.PAID)
            .aggregate(total=Sum("amount_cents"))["total"]
            or 0
        )

    def get_total_returned_cents(self, obj):
        return (
            self._contributions()
            .filter(status__in=[ContributionStatus.RETURNED, ContributionStatus.DEFAULT_COVERED])
            .aggregate(total=Sum("amount_cents"))["total"]
            or 0
        )

    def get_active_support_count(self, obj):
        return self._contributions().filter(
            status__in=[ContributionStatus.PLEDGED, ContributionStatus.PAID]
        ).count()

    def get_campaigns_supported_count(self, obj):
        return self._contributions().values("campaign_id").distinct().count()


class SupportByCampaignSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    campaign = CampaignCardSerializer()
    contributed_amount_cents = serializers.IntegerField()
    funding_progress_pct = serializers.IntegerField()


class DashboardSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    support_summary = serializers.SerializerMethodField()
    support_by_campaign = serializers.SerializerMethodField()
    borrow_requests = serializers.SerializerMethodField()

    def _contributions(self):
        return self.context.get("contributions") or Contribution.objects.none()

    def _borrow_requests(self):
        return self.context.get("borrow_requests") or []

    def get_support_summary(self, obj):
        serializer = SupportSummarySerializer(context={"contributions": self._contributions()})
        return serializer.data

    def get_support_by_campaign(self, obj):
        contributions = self._contributions().select_related("campaign")
        totals = {}
        for contribution in contributions:
            campaign = contribution.campaign
            if campaign.id not in totals:
                totals[campaign.id] = {
                    "campaign": campaign,
                    "contributed_amount_cents": 0,
                }
            totals[campaign.id]["contributed_amount_cents"] += contribution.amount_cents

        items = []
        for entry in totals.values():
            campaign = entry["campaign"]
            items.append(
                {
                    "campaign": campaign,
                    "contributed_amount_cents": entry["contributed_amount_cents"],
                    "funding_progress_pct": funding_progress_pct(
                        campaign.amount_pooled_cents, campaign.amount_needed_cents
                    ),
                }
            )
        return SupportByCampaignSerializer(items, many=True).data

    def get_borrow_requests(self, obj):
        return BorrowRequestListItemSerializer(self._borrow_requests(), many=True).data


class HomeResponseSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    stats = serializers.SerializerMethodField()
    running_campaigns = serializers.SerializerMethodField()
    completed_campaigns = serializers.SerializerMethodField()

    def _campaigns(self):
        return self.context.get("campaigns") or Campaign.objects.all()

    def _contributions(self):
        return self.context.get("contributions") or Contribution.objects.none()

    def get_stats(self, obj):
        serializer = HomeStatsSerializer(
            context={"campaigns": self._campaigns(), "contributions": self._contributions()}
        )
        return serializer.data

    def get_running_campaigns(self, obj):
        campaigns = self._campaigns().filter(status=CampaignStatus.RUNNING).order_by("-created_at")
        return CampaignCardSerializer(campaigns, many=True).data

    def get_completed_campaigns(self, obj):
        campaigns = self._campaigns().filter(status=CampaignStatus.COMPLETED).order_by("-created_at")
        return CampaignCardSerializer(campaigns, many=True).data


class CampaignDetailResponseSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    campaign = CampaignDetailSerializer()


class DashboardResponseSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    support_summary = serializers.SerializerMethodField()
    support_by_campaign = serializers.SerializerMethodField()
    borrow_requests = serializers.SerializerMethodField()

    def _contributions(self):
        return self.context.get("contributions") or Contribution.objects.none()

    def _borrow_requests(self):
        return self.context.get("borrow_requests") or BorrowRequest.objects.none()

    def get_support_summary(self, obj):
        contributions = self._contributions()
        total_supported = (
            contributions.filter(status=ContributionStatus.PAID).aggregate(total=Sum("amount_cents"))["total"]
            or 0
        )
        active_supported = (
            contributions.filter(status=ContributionStatus.PAID)
            .exclude(campaign__status=CampaignStatus.COMPLETED)
            .aggregate(total=Sum("amount_cents"))["total"]
            or 0
        )
        returned = (
            contributions.filter(status=ContributionStatus.RETURNED).aggregate(total=Sum("amount_cents"))["total"]
            or 0
        )
        return {
            "total_supported_cents": total_supported,
            "active_supported_cents": active_supported,
            "returned_cents": returned,
        }

    def get_support_by_campaign(self, obj):
        contributions = self._contributions().select_related("campaign").order_by("-created_at")
        items = []
        for contribution in contributions:
            campaign = contribution.campaign
            expected_return_date = campaign.expected_return_date
            if not expected_return_date:
                base_date = campaign.created_at.date() if campaign.created_at else timezone.now().date()
                expected_return_date = base_date + timedelta(days=campaign.expected_return_days or 0)
            items.append(
                {
                    "campaign_id": prefixed_id("c", campaign.id),
                    "campaign_title": campaign.title_public,
                    "amount_cents": contribution.amount_cents,
                    "contribution_status": contribution.status,
                    "campaign_status": campaign.status,
                    "expected_return_date": expected_return_date,
                }
            )
        return items

    def get_borrow_requests(self, obj):
        items = []
        for borrow_request in self._borrow_requests():
            items.append(
                {
                    "id": prefixed_id("br", borrow_request.id),
                    "title": borrow_request.title,
                    "amount_requested_cents": borrow_request.amount_requested_cents,
                    "status": borrow_request.status,
                    "expected_return_days": borrow_request.expected_return_days,
                }
            )
        return items
