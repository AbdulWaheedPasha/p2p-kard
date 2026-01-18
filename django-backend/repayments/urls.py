from django.urls import path

from .views import RepaymentPayView, RepaymentSetupView, RepaymentsMineView, RepaymentsWebhookView

urlpatterns = [
    path("repayments/setup", RepaymentSetupView.as_view(), name="repayments-setup"),
    path("repayments/pay", RepaymentPayView.as_view(), name="repayments-pay"),
    path("repayments/mine", RepaymentsMineView.as_view(), name="repayments-mine"),
    path("repayments/webhook", RepaymentsWebhookView.as_view(), name="repayments-webhook"),
]
