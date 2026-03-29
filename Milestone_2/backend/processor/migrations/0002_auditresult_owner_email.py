from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("processor", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="auditresult",
            name="owner_email",
            field=models.EmailField(blank=True, db_index=True, max_length=254, null=True),
        ),
    ]
