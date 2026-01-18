from django.urls import path

from .views import (
    AdminBorrowRequestDecisionView,
    AdminBorrowRequestDetailView,
    AdminBorrowRequestListView,
    AdminCreateCampaignView,
)

urlpatterns = [
    path("admin/borrow-requests", AdminBorrowRequestListView.as_view(), name="admin-borrow-requests"),
    path(
        "admin/borrow-requests/<str:borrow_request_id>",
        AdminBorrowRequestDetailView.as_view(),
        name="admin-borrow-request-detail",
    ),
    path(
        "admin/borrow-requests/<str:borrow_request_id>/decision",
        AdminBorrowRequestDecisionView.as_view(),
        name="admin-borrow-request-decision",
    ),
    path(
        "admin/borrow-requests/<str:borrow_request_id>/create-campaign",
        AdminCreateCampaignView.as_view(),
        name="admin-borrow-request-create-campaign",
    ),
]
