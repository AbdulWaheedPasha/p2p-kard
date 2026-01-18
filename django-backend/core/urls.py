from django.urls import include, path

from .views import CampaignDetailView, DashboardView, HomeView

urlpatterns = [
    path("home", HomeView.as_view(), name="home"),
    path("campaigns/<str:campaign_id>", CampaignDetailView.as_view(), name="campaign-detail"),
    path("dashboard", DashboardView.as_view(), name="dashboard"),
    path("", include("accounts.urls")),
    path("", include("borrow.urls")),
    path("", include("staffapi.urls")),
    path("", include("payments.urls")),
    path("", include("repayments.urls")),
]
