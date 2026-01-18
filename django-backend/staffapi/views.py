from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from borrow.models import BorrowRequest, BorrowRequestStatus
from core.utils import parse_prefixed_uuid
from borrow.serializers import (
    AdminBorrowRequestDetailSerializer,
    AdminBorrowRequestListSerializer,
    DecisionSerializer,
)
from campaigns.models import Campaign, CampaignStatus
from campaigns.serializers import CreateCampaignSerializer


class AdminBorrowRequestListView(APIView):
    permission_classes = [permissions.IsAdminUser]

    @extend_schema(responses=AdminBorrowRequestListSerializer)
    def get(self, request):
        qs = BorrowRequest.objects.all().order_by("-created_at")
        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        serializer = AdminBorrowRequestListSerializer(qs, many=True)
        return Response(serializer.data)


class AdminBorrowRequestDetailView(APIView):
    permission_classes = [permissions.IsAdminUser]

    @extend_schema(responses=AdminBorrowRequestDetailSerializer)
    def get(self, request, borrow_request_id):
        borrow_request_id = parse_prefixed_uuid("br", borrow_request_id)
        if borrow_request_id is None:
            return Response({"detail": "Invalid borrow request id."}, status=status.HTTP_400_BAD_REQUEST)
        borrow_request = get_object_or_404(BorrowRequest, id=borrow_request_id)
        serializer = AdminBorrowRequestDetailSerializer(borrow_request)
        return Response(serializer.data)


class AdminBorrowRequestDecisionView(APIView):
    permission_classes = [permissions.IsAdminUser]

    @extend_schema(request=DecisionSerializer, responses=None)
    def post(self, request, borrow_request_id):
        borrow_request_id = parse_prefixed_uuid("br", borrow_request_id)
        if borrow_request_id is None:
            return Response({"detail": "Invalid borrow request id."}, status=status.HTTP_400_BAD_REQUEST)
        borrow_request = get_object_or_404(BorrowRequest, id=borrow_request_id)
        serializer = DecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        decision = serializer.validated_data["decision"]
        note_internal = serializer.validated_data.get("note_internal", "")

        if decision == "VERIFY":
            borrow_request.status = BorrowRequestStatus.VERIFIED
        elif decision == "REJECT":
            borrow_request.status = BorrowRequestStatus.REJECTED

        borrow_request.admin_note_internal = note_internal
        borrow_request.save(update_fields=["status", "admin_note_internal"])
        return Response({"status": borrow_request.status})


class AdminCreateCampaignView(APIView):
    permission_classes = [permissions.IsAdminUser]

    @extend_schema(request=CreateCampaignSerializer, responses=CreateCampaignSerializer)
    def post(self, request, borrow_request_id):
        borrow_request_id = parse_prefixed_uuid("br", borrow_request_id)
        if borrow_request_id is None:
            return Response({"detail": "Invalid borrow request id."}, status=status.HTTP_400_BAD_REQUEST)
        borrow_request = get_object_or_404(BorrowRequest, id=borrow_request_id)
        if borrow_request.status != BorrowRequestStatus.VERIFIED:
            return Response(
                {"detail": "Borrow request must be VERIFIED to create a campaign."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CreateCampaignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            campaign = serializer.save(
                borrow_request=borrow_request,
                status=CampaignStatus.RUNNING,
                verified=True,
            )
            borrow_request.status = BorrowRequestStatus.CAMPAIGN_CREATED
            borrow_request.save(update_fields=["status"])

        return Response(CreateCampaignSerializer(campaign).data, status=status.HTTP_201_CREATED)
