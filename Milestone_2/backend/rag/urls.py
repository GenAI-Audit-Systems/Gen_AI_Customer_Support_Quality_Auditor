from django.urls import path
from .views import (
    PolicyIngestView, RAGAuditView, PolicySearchView,
    AnalyticsView, AgentAnalyticsView, SentimentHeatmapView,
    RiskPredictionView, CoachingReportView, CopilotView, StreamAuditView,
)

urlpatterns = [
    path("ingest/",            PolicyIngestView.as_view(),    name="rag-ingest"),
    path("audit/",             RAGAuditView.as_view(),         name="rag-audit"),
    path("search/",            PolicySearchView.as_view(),     name="rag-search"),
    path("analytics/",         AnalyticsView.as_view(),        name="rag-analytics"),
    path("agents/",            AgentAnalyticsView.as_view(),   name="rag-agents"),
    path("sentiment-heatmap/", SentimentHeatmapView.as_view(),name="rag-heatmap"),
    path("risk/",              RiskPredictionView.as_view(),   name="rag-risk"),
    path("coaching/",          CoachingReportView.as_view(),   name="rag-coaching"),
    path("copilot/",           CopilotView.as_view(),          name="rag-copilot"),
    path("stream-audit/",      StreamAuditView.as_view(),      name="rag-stream"),
]
