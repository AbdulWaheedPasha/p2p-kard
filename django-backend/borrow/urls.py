from django.urls import path

from .views import (
    BorrowRequestConfirmDocumentsView,
    BorrowRequestCreateView,
    BorrowRequestPresignView,
)

urlpatterns = [
    path("borrow-requests", BorrowRequestCreateView.as_view(), name="borrow-request-create"),
    path(
        "borrow-requests/<str:borrow_request_id>/documents/presign",
        BorrowRequestPresignView.as_view(),
        name="borrow-request-presign",
    ),
    path(
        "borrow-requests/<str:borrow_request_id>/documents/confirm",
        BorrowRequestConfirmDocumentsView.as_view(),
        name="borrow-request-confirm",
    ),
]
