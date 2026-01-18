import logging
import uuid

import boto3
from django.conf import settings
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.utils import parse_prefixed_uuid, prefixed_id

from .models import BorrowDocument, BorrowDocumentStatus, BorrowRequest
from .serializers import (
    BorrowRequestCreateResponseSerializer,
    BorrowRequestCreateSerializer,
    ConfirmDocumentsResponseSerializer,
    ConfirmDocumentsSerializer,
    PresignRequestSerializer,
    PresignResponseSerializer,
)

logger = logging.getLogger(__name__)


class BorrowRequestCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=BorrowRequestCreateSerializer, responses=BorrowRequestCreateResponseSerializer)
    def post(self, request):
        serializer = BorrowRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        borrow_request = serializer.save(requester=request.user)
        return Response(
            {"borrowRequest": {"id": prefixed_id("br", borrow_request.id), "status": borrow_request.status}},
            status=status.HTTP_201_CREATED,
        )


class BorrowRequestPresignView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=PresignRequestSerializer, responses=PresignResponseSerializer)
    def post(self, request, borrow_request_id):
        borrow_request_id = parse_prefixed_uuid("br", borrow_request_id)
        if borrow_request_id is None:
            return Response({"detail": "Invalid borrow request id."}, status=status.HTTP_400_BAD_REQUEST)
        borrow_request = get_object_or_404(
            BorrowRequest, id=borrow_request_id, requester=request.user
        )
        serializer = PresignRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        aws_access_key_id = getattr(settings, "AWS_ACCESS_KEY_ID", "")
        aws_secret_access_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", "")
        aws_region = getattr(settings, "AWS_REGION", "")
        bucket = getattr(settings, "AWS_S3_BUCKET", "")
        prefix = getattr(settings, "AWS_S3_PREFIX", "")
        presigned_expire = getattr(settings, "AWS_S3_PRESIGNED_EXPIRE", 3600)

        use_dummy = not (aws_access_key_id and aws_secret_access_key and aws_region and bucket)
        s3_client = None
        if not use_dummy:
            s3_client = boto3.client(
                "s3",
                region_name=aws_region,
                aws_access_key_id=aws_access_key_id,
                aws_secret_access_key=aws_secret_access_key,
            )
        else:
            logger.warning("AWS S3 not configured; using dummy presigned URLs.")

        uploads = []
        for file_spec in serializer.validated_data["files"]:
            file_name = file_spec["file_name"]
            content_type = file_spec["content_type"]
            key_prefix = prefix.strip("/")
            key_base = f"{borrow_request.id}/{uuid.uuid4()}_{file_name}"
            storage_key = f"{key_prefix}/{key_base}" if key_prefix else key_base

            document = BorrowDocument.objects.create(
                borrow_request=borrow_request,
                file_name=file_name,
                content_type=content_type,
                storage_key=storage_key,
                status=BorrowDocumentStatus.PENDING_UPLOAD,
            )

            if use_dummy:
                upload_url = f"https://example.invalid/presign/{storage_key}"
            else:
                upload_url = s3_client.generate_presigned_url(
                    "put_object",
                    Params={
                        "Bucket": bucket,
                        "Key": storage_key,
                        "ContentType": content_type,
                    },
                    ExpiresIn=presigned_expire,
                )

            uploads.append(
                {
                    "document_id": prefixed_id("doc", document.id),
                    "upload_url": upload_url,
                    "file_name": file_name,
                }
            )

        response_serializer = PresignResponseSerializer({"uploads": uploads})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class BorrowRequestConfirmDocumentsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=ConfirmDocumentsSerializer, responses=ConfirmDocumentsResponseSerializer)
    def post(self, request, borrow_request_id):
        borrow_request_id = parse_prefixed_uuid("br", borrow_request_id)
        if borrow_request_id is None:
            return Response({"detail": "Invalid borrow request id."}, status=status.HTTP_400_BAD_REQUEST)
        borrow_request = get_object_or_404(
            BorrowRequest, id=borrow_request_id, requester=request.user
        )
        serializer = ConfirmDocumentsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document_ids = serializer.validated_data["document_ids"]
        documents = BorrowDocument.objects.filter(
            id__in=document_ids, borrow_request=borrow_request
        )
        if documents.count() != len(document_ids):
            return Response({"detail": "Invalid documents."}, status=status.HTTP_400_BAD_REQUEST)

        documents.update(status=BorrowDocumentStatus.CONFIRMED)
        return Response({"ok": True})
