from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth import login as django_login
from django.shortcuts import render, redirect
from django.urls import reverse


def signup(request):
    form = UserCreationForm(request.POST or None)
    if form.is_valid():
        form.save()
        return redirect(reverse('login'))

    context = {
        'form':form
    }
    return render(request,'registration/signup.html',context)


def login(request):
    form = AuthenticationForm(request,request.POST or None)
    if form.is_valid():
        django_login(request, form.get_user())
        return redirect(reverse('index'))

    context = {
        'form':form
    }
    return render(request,'registration/login.html',context)