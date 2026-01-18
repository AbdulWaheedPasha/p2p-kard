<<<<<<< HEAD:django-backend/campaigns/views.py
from django.shortcuts import render

# Create your views here.
=======
from django.shortcuts import get_object_or_404

from drf_spectacular.utils import extend_schema
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from campaigns.models import Campaign
from payments.models import Contribution
from borrow.models import BorrowRequest

from .api_serializers import (
    CampaignDetailResponseSerializer,
    DashboardResponseSerializer,
    HomeResponseSerializer,
)
from core.utils import parse_prefixed_id


class HomeView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses=HomeResponseSerializer)
    def get(self, request):
        campaigns = Campaign.objects.all()
        contributions = Contribution.objects.all()

        # IMPORTANT: serializers serialize "instance" (or "data"), not "context".
        # Your previous code only passed context, which can produce {}.
        serializer = HomeResponseSerializer(
            instance={
                "campaigns": campaigns,
                "contributions": contributions,
            },
            context={"request": request},
        )
        return Response(serializer.data)


class CampaignDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses=CampaignDetailResponseSerializer)
    def get(self, request, campaign_id):
        campaign_id = parse_prefixed_id("c", campaign_id)
        campaign = get_object_or_404(Campaign, id=campaign_id)
        serializer = CampaignDetailResponseSerializer({"campaign": campaign})
        return Response(serializer.data)


class DashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses=DashboardResponseSerializer)
    def get(self, request):
        contributions = (
            Contribution.objects.filter(contributor=request.user)
            .select_related("campaign")
        )
        borrow_requests = BorrowRequest.objects.filter(requester=request.user).order_by(
            "-created_at"
        )

        # IMPORTANT: pass instance so the serializer has something to represent.
        serializer = DashboardResponseSerializer(
            instance={
                "contributions": contributions,
                "borrow_requests": borrow_requests,
            },
            context={"request": request},
        )
        return Response(serializer.data)


class HealthView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses=None)
    def get(self, request):
        return Response({"ok": True, "version": "v1"})
>>>>>>> 0185501 (p2p Backend):campaigns/views.py
