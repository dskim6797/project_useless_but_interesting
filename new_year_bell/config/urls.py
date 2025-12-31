from django.urls import path
from django.contrib.auth import views as auth_views
from new_year_bell import views

urlpatterns = [
    # Pages
    path('', views.HomeView.as_view(), name='home'),

    # Account
    path('signup/', views.SignUpView.as_view(), name='signup'),
    path('login/', auth_views.LoginView.as_view(template_name='registration/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),

    # API Endpoints
    path('api/time/', views.ServerTimeAPI.as_view(), name='api-time'),
    path('api/strike/', views.StrikeCreateAPI.as_view(), name='api-strike'),
    path('api/ranking/', views.RankingListAPI.as_view(), name='api-ranking'),
    path('api/messages/', views.MessageAPI.as_view(), name='api-messages'),
    path('api/heartbeat/', views.HeartbeatAPI.as_view(), name='api-heartbeat'),
]
