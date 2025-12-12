from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.http import JsonResponse, HttpResponse, StreamingHttpResponse
from django.views.decorators.clickjacking import xframe_options_exempt
from .models import ExampleModel
from .serializers import ExampleModelSerializer
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, quote
import re
import logging
import requests

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
@api_view(['GET', 'OPTIONS'])
@permission_classes([AllowAny])
def proxy_resource(request):
    """
    Proxy endpoint for fetching resources (CSS, JS, images, etc.) from websites.
    This bypasses CORS restrictions by fetching resources server-side.
    """
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        response = HttpResponse()
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response['Access-Control-Allow-Headers'] = '*'
        response['Access-Control-Max-Age'] = '86400'
        return response
    
    resource_url = request.GET.get('url')
    
    if not resource_url:
        return JsonResponse({'error': 'URL parameter is required'}, status=400)
    
    try:
        # Fetch the resource
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': resource_url,
        }
        
        response = requests.get(resource_url, headers=headers, timeout=30, stream=True, allow_redirects=True)
        response.raise_for_status()
        
        # Determine content type
        content_type = response.headers.get('Content-Type', 'application/octet-stream')
        
        # Create response with proper CORS headers
        django_response = StreamingHttpResponse(
            response.iter_content(chunk_size=8192),
            content_type=content_type
        )
        
        # Add CORS headers (only if not already set by CORS middleware)
        # CORS middleware might already set these, so we check first
        if 'Access-Control-Allow-Origin' not in django_response:
            django_response['Access-Control-Allow-Origin'] = '*'
        django_response['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        django_response['Access-Control-Allow-Headers'] = '*'
        django_response['X-Frame-Options'] = 'ALLOWALL'
        
        # Copy relevant headers
        if 'Content-Length' in response.headers:
            django_response['Content-Length'] = response.headers['Content-Length']
        if 'Cache-Control' in response.headers:
            django_response['Cache-Control'] = response.headers['Cache-Control']
        elif 'Expires' in response.headers:
            django_response['Expires'] = response.headers['Expires']
        
        return django_response
        
    except requests.exceptions.RequestException as e:
        logger.error(f'Error fetching resource {resource_url}: {str(e)}')
        return JsonResponse({
            'error': f'Failed to fetch resource: {str(e)}',
            'url': resource_url
        }, status=500)
    except Exception as e:
        logger.error(f'Unexpected error fetching resource {resource_url}: {str(e)}')
        return JsonResponse({
            'error': f'An error occurred: {str(e)}',
            'url': resource_url
        }, status=500)


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
    playwright = None
    
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
        
        # Remove CSP from script tags and inline styles if present
        for script in soup.find_all('script'):
            if script.string and 'Content-Security-Policy' in script.string:
                # Try to remove CSP directives
                script.string = re.sub(
                    r'Content-Security-Policy[^;]*;?',
                    '',
                    script.string,
                    flags=re.IGNORECASE
                )
        
        # Remove CSP from style tags
        for style in soup.find_all('style'):
            if style.string and 'Content-Security-Policy' in style.string:
                style.string = re.sub(
                    r'Content-Security-Policy[^;]*;?',
                    '',
                    style.string,
                    flags=re.IGNORECASE
                )
        
        # Remove X-Frame-Options from HTTP response headers (simulated via meta)
        # This is already handled above, but ensure all variations are removed
        for meta in soup.find_all('meta', attrs={'http-equiv': re.compile('x-frame-options', re.I)}):
            meta.decompose()
        
        # Get the base URL for resolving relative URLs
        parsed_url = urlparse(final_url)
        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        # Helper function to convert relative URLs to absolute and proxy them
        def make_absolute(url, base=base_url):
            """Convert relative URL to absolute URL"""
            if not url or url.startswith(('http://', 'https://', 'data:', 'blob:', '//', '#')):
                return url
            try:
                return urljoin(base, url)
            except:
                return url
        
        def proxy_url(url):
            """Convert absolute URL to proxy URL using a placeholder that will be replaced by frontend"""
            if not url or url.startswith(('data:', 'blob:', '#', 'javascript:', 'mailto:', 'tel:', '/api/proxy-resource/', '{{PROXY_BASE}}')):
                return url
            if url.startswith('//'):
                url = f"{parsed_url.scheme}:{url}"
            # Use a placeholder that the frontend will replace with the actual origin
            # This ensures proxy URLs resolve to the frontend origin, not the original website
            return f"{{{{PROXY_BASE}}}}/api/proxy-resource/?url={quote(url, safe='')}"
        
        # Fix all stylesheet links (critical for CSS injection) - proxy through our endpoint
        for link in soup.find_all('link', rel=True):
            href = link.get('href')
            if href:
                absolute_url = make_absolute(href)
                link['href'] = proxy_url(absolute_url)
            # Remove integrity and crossorigin if present (may block loading)
            if link.get('integrity'):
                del link['integrity']
            if link.get('crossorigin'):
                del link['crossorigin']
        
        # Fix all script sources - proxy through our endpoint
        for script in soup.find_all('script', src=True):
            src = script.get('src')
            if src:
                absolute_url = make_absolute(src)
                script['src'] = proxy_url(absolute_url)
            # Remove integrity and crossorigin if present
            if script.get('integrity'):
                del script['integrity']
            if script.get('crossorigin'):
                del script['crossorigin']
        
        # Fix all image sources - proxy through our endpoint
        for img in soup.find_all('img', src=True):
            src = img.get('src')
            if src:
                absolute_url = make_absolute(src)
                img['src'] = proxy_url(absolute_url)
        
        # Fix srcset attributes for responsive images - proxy through our endpoint
        for img in soup.find_all('img', srcset=True):
            srcset = img.get('srcset')
            if srcset:
                # Parse and fix each URL in srcset
                srcset_parts = []
                for part in srcset.split(','):
                    part = part.strip()
                    if ' ' in part:
                        url, descriptor = part.rsplit(' ', 1)
                        url = url.strip()
                        descriptor = descriptor.strip()
                        absolute_url = make_absolute(url)
                        srcset_parts.append(f"{proxy_url(absolute_url)} {descriptor}")
                    else:
                        absolute_url = make_absolute(part)
                        srcset_parts.append(proxy_url(absolute_url))
                img['srcset'] = ', '.join(srcset_parts)
        
        # Fix source elements (for picture/media elements) - proxy through our endpoint
        for source in soup.find_all('source', src=True):
            src = source.get('src')
            if src:
                absolute_url = make_absolute(src)
                source['src'] = proxy_url(absolute_url)
        
        for source in soup.find_all('source', srcset=True):
            srcset = source.get('srcset')
            if srcset:
                srcset_parts = []
                for part in srcset.split(','):
                    part = part.strip()
                    if ' ' in part:
                        url, descriptor = part.rsplit(' ', 1)
                        url = url.strip()
                        descriptor = descriptor.strip()
                        absolute_url = make_absolute(url)
                        srcset_parts.append(f"{proxy_url(absolute_url)} {descriptor}")
                    else:
                        absolute_url = make_absolute(part)
                        srcset_parts.append(proxy_url(absolute_url))
                source['srcset'] = ', '.join(srcset_parts)
        
        # Fix anchor links
        for link in soup.find_all('a', href=True):
            href = link.get('href')
            if href and not href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
                link['href'] = make_absolute(href)
        
        # Fix form actions
        for form in soup.find_all('form', action=True):
            action = form.get('action')
            if action:
                form['action'] = make_absolute(action)
        
        # Fix video/audio sources - proxy through our endpoint
        for media in soup.find_all(['video', 'audio'], src=True):
            src = media.get('src')
            if src:
                absolute_url = make_absolute(src)
                media['src'] = proxy_url(absolute_url)
        
        # Fix object/embed sources - proxy through our endpoint
        for obj in soup.find_all(['object', 'embed'], src=True):
            src = obj.get('src')
            if src:
                absolute_url = make_absolute(src)
                obj['src'] = proxy_url(absolute_url)
        
        for obj in soup.find_all('object', data=True):
            data = obj.get('data')
            if data:
                absolute_url = make_absolute(data)
                obj['data'] = proxy_url(absolute_url)
        
        # Fix iframe sources
        for iframe in soup.find_all('iframe', src=True):
            src = iframe.get('src')
            if src:
                iframe['src'] = make_absolute(src)
        
        # Fix background images in inline styles - proxy through our endpoint
        for element in soup.find_all(style=True):
            style = element.get('style', '')
            if 'url(' in style:
                # Replace relative URLs in CSS url() functions
                def replace_url(match):
                    url_content = match.group(1)
                    if url_content and not url_content.startswith(('http://', 'https://', 'data:', 'blob:', '//')):
                        # Remove quotes if present
                        url_content = url_content.strip('\'"')
                        absolute_url = make_absolute(url_content)
                        proxied_url = proxy_url(absolute_url)
                        return f"url('{proxied_url}')"
                    elif url_content and url_content.startswith(('http://', 'https://')):
                        # Already absolute, just proxy it
                        url_content = url_content.strip('\'"')
                        proxied_url = proxy_url(url_content)
                        return f"url('{proxied_url}')"
                    return match.group(0)
                
                style = re.sub(r'url\(([^)]+)\)', replace_url, style)
                element['style'] = style
        
        # Ensure base tag exists and is correct
        if not soup.find('base'):
            base_tag = soup.new_tag('base', href=base_url)
            if soup.head:
                soup.head.insert(0, base_tag)
        else:
            # Update existing base tag
            base_tag = soup.find('base')
            base_tag['href'] = base_url
        
        # Add meta tag to allow CSS injection (for better compatibility)
        if soup.head:
            # Remove any existing CSP meta tags first (already done above, but ensure)
            meta_csp = soup.head.find('meta', attrs={'http-equiv': re.compile('content-security-policy', re.I)})
            if meta_csp:
                meta_csp.decompose()
            
            # Add a permissive CSP meta tag to allow CSS injection
            # Note: frame-ancestors is ignored in meta tags, so we omit it
            permissive_csp = soup.new_tag('meta')
            permissive_csp['http-equiv'] = 'Content-Security-Policy'
            permissive_csp['content'] = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"
            soup.head.insert(0, permissive_csp)
        
        # Inject a script to rewrite proxy URLs to use the parent window's origin
        # This ensures proxy URLs resolve correctly even with a base tag
        if soup.head:
            proxy_rewrite_script = soup.new_tag('script')
            proxy_rewrite_script.string = """
(function() {
    var proxyBase = window.location.origin;
    function rewriteProxyUrls() {
        document.querySelectorAll('link[href*="{{PROXY_BASE}}"]').forEach(function(link) {
            link.href = link.href.replace(/\\{\\{PROXY_BASE\\}\\}/g, proxyBase);
        });
        document.querySelectorAll('script[src*="{{PROXY_BASE}}"]').forEach(function(script) {
            script.src = script.src.replace(/\\{\\{PROXY_BASE\\}\\}/g, proxyBase);
        });
        document.querySelectorAll('img[src*="{{PROXY_BASE}}"]').forEach(function(img) {
            img.src = img.src.replace(/\\{\\{PROXY_BASE\\}\\}/g, proxyBase);
        });
        document.querySelectorAll('[srcset*="{{PROXY_BASE}}"]').forEach(function(el) {
            el.srcset = el.srcset.replace(/\\{\\{PROXY_BASE\\}\\}/g, proxyBase);
        });
        document.querySelectorAll('[style*="{{PROXY_BASE}}"]').forEach(function(el) {
            el.style.cssText = el.style.cssText.replace(/\\{\\{PROXY_BASE\\}\\}/g, proxyBase);
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', rewriteProxyUrls);
    } else {
        rewriteProxyUrls();
    }
    setTimeout(rewriteProxyUrls, 100);
})();
""".replace('{{PROXY_BASE}}', '{{PROXY_BASE}}')
            soup.head.insert(0, proxy_rewrite_script)
        
        # Get the final HTML
        final_html = str(soup)
        
        # Clean up browser resources
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
        if playwright:
            try:
                playwright.stop()
            except:
                pass
        
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
        if playwright:
            try:
                playwright.stop()
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
        if playwright:
            try:
                playwright.stop()
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
