from django.db import models

class AuditResult(models.Model):
    source_type = models.CharField(max_length=10, choices=[('audio', 'Audio'), ('text', 'Text')])
    filename = models.CharField(max_length=255, blank=True, null=True)
    transcript_json = models.JSONField()
    audit_json = models.JSONField()
    overall_score = models.IntegerField()
    sentiment = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.source_type} Audit - {self.created_at.strftime('%Y-%m-%d %H:%M')}"
