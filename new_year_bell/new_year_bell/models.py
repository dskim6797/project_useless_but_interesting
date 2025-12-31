from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings

class User(AbstractUser):
    """
    이메일을 필수로 받는 커스텀 유저 모델.
    상품 지급을 위해 email 필드에 unique=True 설정.
    """
    email = models.EmailField(unique=True, blank=False)

    class Meta:
        # db_table = 'auth_user' <- 이 줄을 삭제하거나 주석 처리하세요.
        pass

class StrikeRecord(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='strike_records'
    )
    press_time = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['press_time']

class FallingMessage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.CharField(max_length=30)
    created_at = models.DateTimeField(auto_now_add=True)

class UserActivity(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    last_seen = models.DateTimeField(auto_now=True)