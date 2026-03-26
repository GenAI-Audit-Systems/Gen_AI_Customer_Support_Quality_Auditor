from django.urls import path
from .views import (
    AlertCheckView, AlertHistoryView, PDFReportView,
    ExcelReportView, WebhookTestView, AlertReviewView,
)

urlpatterns = [
    path("check/",                AlertCheckView.as_view(),    name="alert-check"),
    path("history/",              AlertHistoryView.as_view(),  name="alert-history"),
    path("report/pdf/<int:audit_id>/", PDFReportView.as_view(), name="alert-pdf"),
    path("report/excel/",         ExcelReportView.as_view(),   name="alert-excel"),
    path("webhook-test/",         WebhookTestView.as_view(),   name="alert-webhook-test"),
    path("<int:alert_id>/review/",AlertReviewView.as_view(),   name="alert-review"),
]
