from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from .models import Snowball
import json

# 클라이언트 IP 확인 함수
def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

@ensure_csrf_cookie
def index(request):
    """메인 페이지 렌더링"""
    # 현재 접속자의 IP를 확인해서 이미 작성했는지 여부를 템플릿에 전달
    ip = get_client_ip(request)
    has_posted = Snowball.objects.filter(ip_address=ip).exists()

    context = {
        'has_posted': 'true' if has_posted else 'false'
    }
    return render(request, 'index.html', context)

def get_messages(request):
    """저장된 모든 눈덩이 메시지 반환 (API)"""
    messages = list(Snowball.objects.values_list('content', flat=True))
    return JsonResponse({'messages': messages})

def add_message(request):
    """눈덩이 메시지 저장 (API)"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            content = data.get('content', '').strip()
            ip = get_client_ip(request)

            # 유효성 검사
            if not content:
                return JsonResponse({'error': '내용을 입력해주세요.'}, status=400)
            if len(content) > 15:
                return JsonResponse({'error': '15자를 초과할 수 없습니다.'}, status=400)

            # 1인 1회 체크 (IP 기준)
            if not request.user.is_superuser:
                if Snowball.objects.filter(ip_address=ip).exists():
                    return JsonResponse({'error': '이미 눈덩이를 등록하셨습니다.'}, status=403)

            # 저장
            Snowball.objects.create(content=content, ip_address=ip)
            return JsonResponse({'status': 'success', 'content': content})

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'POST 요청만 가능합니다.'}, status=405)