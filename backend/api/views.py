from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.http import JsonResponse, HttpResponse
from django.views.decorators.clickjacking import xframe_options_exempt
from .models import ExampleModel
from .serializers import ExampleModelSerializer
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import re
import logging

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint."""
    return JsonResponse({
        'status': 'healthy',
        'message': 'Django backend is running successfully!'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def api_info(request):
    """API information endpoint."""
    return JsonResponse({
        'name': 'Modify.Style API',
        'version': '1.0.0',
        'endpoints': {
            'health': '/api/health/',
            'info': '/api/info/',
            'examples': '/api/examples/',
        }
    })


class ExampleModelViewSet(viewsets.ModelViewSet):
    """
    ViewSet for viewing and editing ExampleModel instances.
    """
    queryset = ExampleModel.objects.all()
    serializer_class = ExampleModelSerializer
    permission_classes = [AllowAny]


@xframe_options_exempt
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def proxy_website(request):
    """
    Proxy endpoint using Playwright for real browser rendering.
    This provides true browser-like behavior with full JavaScript execution,
    handling CSP, X-Frame-Options, and all dynamic content.
    
    Uses a real Chromium browser engine to render pages exactly as a user would see them.
    """
    url = request.GET.get('url') or (request.data.get('url') if request.method == 'POST' else None)
    
    if not url:
        return JsonResponse({'error': 'URL parameter is required'}, status=400)
    
    # Ensure URL has a protocol
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    browser = None
    context = None
    page = None
    
    try:
        # Launch a new browser instance for each request
        # This ensures isolation and prevents issues with concurrent requests
        playwright = sync_playwright().start()
        
        # Launch browser with realistic settings to avoid detection
        browser = playwright.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials',
            ]
        )
        
        # Create a new context with realistic browser settings
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale='en-US',
            timezone_id='America/New_York',
            permissions=['geolocation', 'notifications'],
            extra_http_headers={
                'Accept-Language': 'en-US,en;q=0.9',
            },
            # Ignore HTTPS errors for development (remove in production if needed)
            ignore_https_errors=False,
        )
        
        # Create a new page
        page = context.new_page()
        
        # Navigate to the URL and wait for network to be idle
        # This ensures all resources are loaded and JavaScript is executed
        try:
            page.goto(url, wait_until='networkidle', timeout=60000)
        except PlaywrightTimeoutError:
            # If networkidle times out, try domcontentloaded as fallback
            logger.warning(f'Network idle timeout for {url}, using domcontentloaded')
            page.goto(url, wait_until='domcontentloaded', timeout=60000)
        
        # Wait a bit more for any lazy-loaded content or animations
        page.wait_for_timeout(3000)
        
        # Scroll to trigger lazy loading
        page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
        page.wait_for_timeout(1000)
        page.evaluate('window.scrollTo(0, 0)')
        page.wait_for_timeout(1000)
        
        # Get the final URL after redirects
        final_url = page.url
        
        # Get the fully rendered HTML (after all JavaScript execution)
        html_content = page.content()
        
        # Parse HTML to remove blocking headers and modify for iframe embedding
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove X-Frame-Options and Content-Security-Policy meta tags
        for meta in soup.find_all('meta'):
            http_equiv = meta.get('http-equiv', '').lower()
            name = meta.get('name', '').lower()
            content = meta.get('content', '').lower()
            
            if http_equiv in ['x-frame-options', 'content-security-policy', 'frame-options']:
                meta.decompose()
            # Also remove CSP from meta tags
            if 'content-security-policy' in name or 'csp' in name:
                meta.decompose()
            if 'content-security-policy' in content:
                meta.decompose()
        
        # Remove CSP from script tags if present
        for script in soup.find_all('script'):
            if script.string and 'Content-Security-Policy' in script.string:
                # Try to remove CSP directives
                script.string = re.sub(
                    r'Content-Security-Policy[^;]*;?',
                    '',
                    script.string,
                    flags=re.IGNORECASE
                )
        
        # Get the base URL for resolving relative URLs
        parsed_url = urlparse(final_url)
        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        # Rewrite relative URLs to absolute URLs (backup for edge cases)
        for img in soup.find_all('img', src=True):
            src = img['src']
            if not src.startswith(('http://', 'https://', 'data:', 'blob:', '//')):
                img['src'] = urljoin(base_url, src)
        
        for link in soup.find_all('a', href=True):
            href = link['href']
            if not href.startswith(('http://', 'https://', '#', 'javascript:', 'mailto:', 'tel:', '//')):
                link['href'] = urljoin(base_url, href)
        
        # Ensure base tag exists
        if not soup.find('base'):
            base_tag = soup.new_tag('base', href=base_url)
            if soup.head:
                soup.head.insert(0, base_tag)
        else:
            # Update existing base tag
            base_tag = soup.find('base')
            base_tag['href'] = base_url
        
        # Get the final HTML
        final_html = str(soup)
        
        # Clean up browser resources
        page.close()
        context.close()
        browser.close()
        playwright.stop()
        
        # Return the rendered HTML
        json_response = JsonResponse({
            'html': final_html,
            'url': final_url,
            'status': 'success'
        })
        json_response['X-Frame-Options'] = 'ALLOWALL'
        
        return json_response
        
    except PlaywrightTimeoutError as e:
        # Clean up on timeout
        if page:
            try:
                page.close()
            except:
                pass
        if context:
            try:
                context.close()
            except:
                pass
        if browser:
            try:
                browser.close()
            except:
                pass
        
        return JsonResponse({
            'error': 'Request timed out. The website may be slow or taking too long to load.',
            'url': url
        }, status=500)
        
    except Exception as e:
        # Clean up browser resources on error
        if page:
            try:
                page.close()
            except:
                pass
        if context:
            try:
                context.close()
            except:
                pass
        if browser:
            try:
                browser.close()
            except:
                pass
        
        error_message = str(e)
        logger.error(f'Error loading website {url}: {error_message}')
        
        # Provide more helpful error messages
        if 'net::ERR' in error_message or 'Navigation failed' in error_message:
            return JsonResponse({
                'error': f'Failed to load website: {error_message}. The website may be unreachable or blocked.',
                'url': url
            }, status=500)
        elif 'timeout' in error_message.lower():
            return JsonResponse({
                'error': 'Request timed out. The website may be slow or taking too long to load.',
                'url': url
            }, status=500)
        else:
            return JsonResponse({
                'error': f'An error occurred: {error_message}',
                'url': url
            }, status=500)
