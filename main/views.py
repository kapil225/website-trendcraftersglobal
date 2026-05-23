from django.shortcuts import render, redirect
from django.core.mail import send_mail
from django.contrib import messages
from django.core.cache import cache
from django.http import HttpResponse
from django.views.decorators.http import require_http_methods
from functools import wraps
import time

def rate_limit(key_prefix, limit=20, period=60):
    """
    Rate limiting decorator that allows X requests per Y seconds
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            key = f"{key_prefix}:{request.META.get('REMOTE_ADDR', '')}"
            requests = cache.get(key, [])
            now = time.time()
            
            # Filter out old requests
            requests = [req for req in requests if req > now - period]
            
            if len(requests) >= limit:
                return HttpResponse("Too many requests. Please try again later.", status=429)
            
            requests.append(now)
            cache.set(key, requests, timeout=period)
            
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator

def index(request):
    return render(request, 'main/index.html')  # homepage template

from django.core.validators import validate_email
from django.core.exceptions import ValidationError
import re

@rate_limit('contact', limit=20, period=60)  # 20 requests per minute
@require_http_methods(["GET", "POST"])
def contact(request):
    if request.method == 'POST':
        try:
            name = request.POST.get('name', '').strip()
            email = request.POST.get('email', '').strip()
            phone = request.POST.get('phone', '').strip()
            message = request.POST.get('message', '').strip()

            # Validation
            if not all([name, email, message]):
                messages.error(request, "Please fill in all required fields.")
                return redirect('contact')

            # Email validation
            try:
                validate_email(email)
            except ValidationError:
                messages.error(request, "Please enter a valid email address.")
                return redirect('contact')

            # Phone validation (optional field)
            if phone:
                phone_pattern = re.compile(r'^\+?1?\d{9,15}$')
                if not phone_pattern.match(phone):
                    messages.error(request, "Please enter a valid phone number.")
                    return redirect('contact')

            # Message length validation
            if len(message) < 10:
                messages.error(request, "Message is too short. Please provide more details.")
                return redirect('contact')

            # Prepare email with IP address for tracking
            ip_address = request.META.get('REMOTE_ADDR', 'Unknown')
            user_agent = request.META.get('HTTP_USER_AGENT', 'Unknown')
            
            full_message = (
                f"New Contact Form Submission\n"
                f"------------------------\n"
                f"Name: {name}\n"
                f"Email: {email}\n"
                f"Phone: {phone}\n"
                f"Message: {message}\n\n"
                f"Additional Information:\n"
                f"IP Address: {ip_address}\n"
                f"User Agent: {user_agent}\n"
                f"------------------------"
            )

            try:
                send_mail(
                    subject=f"New Contact Form Submission from {name}",
                    message=full_message,
                    from_email=email,
                    recipient_list=['trendcraftersglobal@gmail.com'],
                    fail_silently=False,
                )
                messages.success(request, "Thank you for your message! We'll get back to you soon.")
            except Exception as e:
                messages.error(request, "There was an error sending your message. Please try again later.")
                # Log the error here if you have logging configured
                print(f"Email error: {str(e)}")  # Replace with proper logging
                
            return redirect('contact')

        except Exception as e:
            messages.error(request, "An unexpected error occurred. Please try again later.")
            # Log the error here
            print(f"Unexpected error: {str(e)}")  # Replace with proper logging
            return redirect('contact')

    return render(request, 'main/contact.html')


def about(request):
    return render(request, 'main/about.html')

def services(request):
    return render(request, 'main/services.html')

def work(request):
    return render(request, 'main/work.html')

def brand_campaign(request):
    return render(request, 'main/brand_campaign.html')

def digital_marketing(request):
    return render(request, 'main/digital_marketing.html')

def photo_shoot(request):
    return render(request, 'main/photo_shoot.html')

def production(request):
    return render(request, 'main/production.html')

def web_development(request):
    return render(request, 'main/web_development.html')
