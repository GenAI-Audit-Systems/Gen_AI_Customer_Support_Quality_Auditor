# ══════════════════════════════════════════════════════════════════════
# Alerts Model — AlertRecord stored in Neon PostgreSQL
# Migration: python manage.py makemigrations alerts && migrate
# ══════════════════════════════════════════════════════════════════════
from django.db import models


class AlertRecord(models.Model):
    SEVERITY_CHOICES = [
        ("CRITICAL", "Critical"),
        ("WARNING",  "Warning"),
        ("INFO",     "Info"),
    ]

    audit_id    = models.IntegerField(db_index=True)          # References processor.AuditResult
    agent_id    = models.CharField(max_length=64, default="unknown")
    severity    = models.CharField(max_length=16, choices=SEVERITY_CHOICES, db_index=True)
    rule_name   = models.CharField(max_length=128)
    description = models.TextField(default="")
    payload     = models.JSONField(default=dict)
    dispatched  = models.BooleanField(default=False)
    reviewed    = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["severity", "created_at"]),
            models.Index(fields=["audit_id"]),
        ]

    def __str__(self):
        return f"[{self.severity}] Audit#{self.audit_id} — {self.rule_name}"
