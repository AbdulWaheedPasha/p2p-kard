from django.urls import path

from .views import StripeWebhookView, SupportCheckoutView

urlpatterns = [
    path("campaigns/<str:campaign_id>/support/checkout", SupportCheckoutView.as_view(), name="support-checkout"),
    path("payments/webhook", StripeWebhookView.as_view(), name="payments-webhook"),
]
