from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()

class Snowball(models.Model):
    content = models.CharField(max_length=15)  # 15글자 제한
    ip_address = models.GenericIPAddressField() # 중복 방지용 IP 저장
    created_at = models.DateTimeField(auto_now_add=True)

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True)

    def __str__(self):
        return f"{self.content} ({self.ip_address})"
