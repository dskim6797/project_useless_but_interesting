from rest_framework import serializers
from .models import StrikeRecord, FallingMessage

class StrikeRecordSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = StrikeRecord
        fields = ['username', 'press_time']

class FallingMessageSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = FallingMessage
        fields = ['id', 'username', 'content', 'created_at']