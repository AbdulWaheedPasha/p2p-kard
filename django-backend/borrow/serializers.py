from rest_framework import serializers

from core.serializers import CamelCaseSerializerMixin
from core.utils import parse_prefixed_id, prefixed_id

from .models import BorrowDocument, BorrowRequest, BorrowRequestStatus


class BorrowRequestCreateSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    class Meta:
        model = BorrowRequest
        fields = [
            "id",
            "title",
            "category",
            "reason_detailed",
            "amount_requested_cents",
            "currency",
            "expected_return_days",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "created_at", "updated_at"]

    def validate_amount_requested_cents(self, value):
        if value <= 0:
            raise serializers.ValidationError("amountRequestedCents must be greater than 0.")
        return value

    def get_id(self, obj):
        return prefixed_id("br", obj.id)


class BorrowRequestListItemSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    class Meta:
        model = BorrowRequest
        fields = [
            "id",
            "title",
            "category",
            "amount_requested_cents",
            "currency",
            "expected_return_days",
            "status",
            "created_at",
            "updated_at",
        ]

    def get_id(self, obj):
        return prefixed_id("br", obj.id)


class BorrowDocumentSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = BorrowDocument
        fields = [
            "id",
            "file_name",
            "content_type",
            "storage_key",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PresignFileSpecSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    file_name = serializers.CharField(max_length=255)
    content_type = serializers.CharField(max_length=100)


class PresignRequestSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    files = PresignFileSpecSerializer(many=True)


class PresignUploadSpecSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    document_id = serializers.CharField()
    upload_url = serializers.URLField()
    file_name = serializers.CharField(max_length=255)


class PresignResponseSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    uploads = PresignUploadSpecSerializer(many=True)


class ConfirmDocumentsSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    document_ids = serializers.ListField(child=serializers.CharField(), allow_empty=False)

    def validate_document_ids(self, value):
        parsed = []
        for item in value:
            parsed.append(parse_prefixed_id("doc", item))
        return parsed


class AdminBorrowRequestListSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    requester_id = serializers.UUIDField(source="requester.id", read_only=True)
    requester_email = serializers.EmailField(source="requester.email", read_only=True)

    class Meta:
        model = BorrowRequest
        fields = [
            "id",
            "requester_id",
            "requester_email",
            "title",
            "category",
            "amount_requested_cents",
            "currency",
            "expected_return_days",
            "status",
            "created_at",
        ]

    def get_id(self, obj):
        return prefixed_id("br", obj.id)


class AdminBorrowRequestDetailSerializer(CamelCaseSerializerMixin, serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    requester_id = serializers.UUIDField(source="requester.id", read_only=True)
    requester_email = serializers.EmailField(source="requester.email", read_only=True)
    documents = BorrowDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = BorrowRequest
        fields = [
            "id",
            "requester_id",
            "requester_email",
            "title",
            "category",
            "reason_detailed",
            "amount_requested_cents",
            "currency",
            "expected_return_days",
            "status",
            "admin_note_internal",
            "created_at",
            "updated_at",
            "documents",
        ]

    def get_id(self, obj):
        return prefixed_id("br", obj.id)


class DecisionSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    decision = serializers.ChoiceField(choices=["VERIFY", "REJECT"])
    note_internal = serializers.CharField(allow_blank=True, required=False)


class BorrowRequestStatusSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    status = serializers.ChoiceField(choices=BorrowRequestStatus.choices)


class BorrowRequestCreateResponseSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    borrow_request = serializers.DictField()


class ConfirmDocumentsResponseSerializer(CamelCaseSerializerMixin, serializers.Serializer):
    ok = serializers.BooleanField()
