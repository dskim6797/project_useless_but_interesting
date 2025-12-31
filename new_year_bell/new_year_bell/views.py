import datetime
from django.http import JsonResponse
from django.utils import timezone
from django.views.generic import TemplateView, CreateView
from django.urls import reverse_lazy
from django.db import transaction
from django.db.models import F, ExpressionWrapper, fields
from django.db.models.functions import Abs

from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import ListAPIView
from rest_framework.renderers import TemplateHTMLRenderer, JSONRenderer

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

from .models import User, StrikeRecord, FallingMessage, UserActivity
from .serializers import StrikeRecordSerializer, FallingMessageSerializer

# 서울 시간대 설정
KST = ZoneInfo("Asia/Seoul")

def get_target_time():
    """2026년 1월 1일 00시 00분 00초 서울 시간 반환"""
    return datetime.datetime(2026, 1, 1, 0, 0, 0, tzinfo=KST)

# --- 1. Template Views ---

class HomeView(TemplateView):
    template_name = 'index.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # 클라이언트에 전달할 서버 시간 (ISO)
        context['server_time_iso'] = timezone.now().isoformat()
        return context

class SignUpView(CreateView):
    model = User
    fields = ['username', 'email', 'password']
    template_name = 'registration/signup.html'
    success_url = reverse_lazy('login')

    def form_valid(self, form):
        user = form.save(commit=False)
        user.set_password(form.cleaned_data['password'])
        user.save()
        return super().form_valid(form)

# --- 2. API Views ---

class ServerTimeAPI(APIView):
    def get(self, request):
        return Response({'server_time': timezone.now().timestamp() * 1000})

class StrikeCreateAPI(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # 중복 클릭 방어 (1인 1회)
        if not request.user.is_superuser:
            if StrikeRecord.objects.filter(user=request.user).exists():
                return Response({"error": "이미 타종에 참여하셨습니다!"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # 얼리 클릭 허용을 위해 시간 체크 로직 제거
            # 현재 시간을 자동으로 press_time에 저장
            strike = StrikeRecord.objects.create(user=request.user)
            data = StrikeRecordSerializer(strike).data
            data['username'] = request.user.username
            return Response(data, status=status.HTTP_201_CREATED)

class RankingListAPI(ListAPIView):
    serializer_class = StrikeRecordSerializer
    renderer_classes = [TemplateHTMLRenderer, JSONRenderer]
    template_name = 'ranking.html'

    def get_queryset(self):
        target = get_target_time()

        # 모든 기록을 가져와서 정각과의 차이(절대값)를 계산
        # 1. target과 press_time의 차이를 초 단위로 계산
        # 2. 그 차이의 절대값이 작은 순서대로 정렬

        # QuerySet 수준에서 절대값 계산을 위해 Annotation 사용
        # press_time은 DateTimeField이므로 target(DateTime)과의 차이를 DurationField로 추출
        queryset = StrikeRecord.objects.annotate(
            time_diff=Abs(ExpressionWrapper(
                F('press_time') - target,
                output_field=fields.DurationField()
            ))
        ).order_by('time_diff')[:50]

        return queryset

    def get(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        # 템플릿에서 서울 시간으로 쉽게 표시하기 위해 데이터 가공
        records_data = []
        target = get_target_time()

        for record in queryset:
            # UTC 시간을 서울 시간으로 변환
            kst_press_time = record.press_time.astimezone(KST)
            # 정각과의 오차 계산 (초 단위)
            diff_seconds = (record.press_time - target).total_seconds()

            records_data.append({
                'username': record.user.username,
                'press_time_kst': kst_press_time,
                'diff_seconds': diff_seconds,
                'diff_display': f"{'+' if diff_seconds > 0 else ''}{diff_seconds:.4f}s"
            })

        return Response({'records': records_data})

class HeartbeatAPI(APIView):
    def get(self, request):
        now = timezone.now()
        if request.user.is_authenticated:
            UserActivity.objects.update_or_create(
                user=request.user,
                defaults={'last_seen': now}
            )
        active_threshold = now - datetime.timedelta(seconds=10)
        count = UserActivity.objects.filter(last_seen__gte=active_threshold).count()
        return Response({'active_users': count})

def get_messages(request):
    """
    실시간 채팅 메시지를 가져오는 뷰
    1. 처음 접속 시(last_id=0): 최근 50개의 메시지를 가져옴
    2. 이후(last_id > 0): 해당 ID 이후에 생성된 새 메시지만 가져옴
    """
    try:
        last_id = int(request.GET.get('last_id', 0))
    except (ValueError, TypeError):
        last_id = 0

    if last_id == 0:
        # 처음 로드 시: 최근 50개를 가져와서 시간순(ID순)으로 정렬
        messages = FallingMessage.objects.all().order_by('-id')[:100]
        messages = reversed(messages) # 최신순을 다시 과거순으로 뒤집음
    else:
        # 폴링 시: 마지막으로 받은 메시지 이후의 것들만 가져옴
        messages = FallingMessage.objects.filter(id__gt=last_id).order_by('id')

    data = [{
        'id': m.id,
        'username': m.user.username,
        'content': m.content,
        'created_at': m.created_at.strftime('%H:%M:%S')
    } for m in messages]

    return JsonResponse({'messages': data})

def send_message(request):
    """
    메시지를 전송하고 저장하는 뷰
    """
    if request.method == 'POST' and request.user.is_authenticated:
        content = request.POST.get('content')
        if content:
            msg = FallingMessage.objects.create(user=request.user, content=content)
            return JsonResponse({
                'status': 'success',
                'message': {
                    'id': msg.id,
                    'username': msg.user.username,
                    'content': msg.content,
                    'created_at': msg.created_at.strftime('%H:%M:%S')
                }
            })
    return JsonResponse({'status': 'error', 'message': '로그인이 필요하거나 내용이 없습니다.'}, status=400)