from rest_framework import serializers

from campaigns.models import Campaign
from payments.models import Contribution
from borrow.models import BorrowRequest

from campaigns.serializers import CampaignCardSerializer, CampaignDetailSerializer


class HomeResponseSerializer(serializers.Serializer):
    stats = serializers.DictField()
    running_campaigns = CampaignCardSerializer(many=True)
    completed_campaigns = CampaignCardSerializer(many=True)

    def to_representation(self, instance):
        campaigns = instance.get("campaigns", Campaign.objects.none())

        running = campaigns.filter(status="RUNNING").order_by("-id")[:5]
        completed = campaigns.filter(status="COMPLETED").order_by("-id")[:5]

        total_needed = sum((c.amount_needed_cents or 0) for c in campaigns)
        total_pooled = sum((c.amount_pooled_cents or 0) for c in campaigns)

        return {
            "stats": {
                "activeCampaignCount": running.count(),
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

        total_supported = sum((c.amount_cents or 0) for c in contributions)
        returned = sum((c.amount_cents or 0) for c in contributions.filter(status="RETURNED"))
        active = sum((c.amount_cents or 0) for c in contributions.filter(status="PAID"))

        by_campaign = []
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
