from django.urls import path
from .views import AudioProcessView, TextProcessView, HistoryListView, DiagnosticView, ExcelExportView

urlpatterns = [
    path('process-audio/', AudioProcessView.as_view(), name='process-audio'),
    path('process-text/', TextProcessView.as_view(), name='process-text'),
    path('history/', HistoryListView.as_view(), name='history'),
    path('test-connection/', DiagnosticView.as_view(), name='test-connection'),
    path('export-excel/<int:audit_id>/', ExcelExportView.as_view(), name='export-excel'),
]
