from django.contrib import admin
from django.urls import include, path

from christmas_web import views
from users import views as user_views
urlpatterns = [
    path('', views.index, name='index'),
    path('get_messages/', views.get_messages, name='get_messages'),
    path('add_message/', views.add_message, name='add_message'),
    path('signup/', views.add_message, name='add_message'),

    # Auth
    path('admin/', admin.site.urls),
    path('accounts/signup/',user_views.signup, name='signup'),
    path('accounts/login/',user_views.login, name='login'),
    path('accounts/',include('django.contrib.auth.urls')), #logout
]