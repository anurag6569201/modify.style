"""
Proxy service for website rendering and resource proxying.
Handles browser automation and HTML processing using Playwright.
"""

import re
import logging
from urllib.parse import urljoin, urlparse, quote
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from django.http import JsonResponse

logger = logging.getLogger(__name__)


class ProxyService:
    """Service for proxying and rendering websites using Playwright."""
    
    @staticmethod
    def render_website(url: str) -> dict:
        """
        Render a website using Playwright and return processed HTML.
        
        Args:
            url: The URL to render
            
        Returns:
            dict: Contains 'html', 'url', and 'status' keys, or 'error' on failure
        """
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        playwright = None
        browser = None
        context = None
        page = None
        
        try:
            playwright = sync_playwright().start()
            
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
            
            context = browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                locale='en-US',
                timezone_id='America/New_York',
                permissions=['geolocation', 'notifications'],
                extra_http_headers={'Accept-Language': 'en-US,en;q=0.9'},
                ignore_https_errors=False,
            )
            
            page = context.new_page()
            
            try:
                page.goto(url, wait_until='networkidle', timeout=60000)
            except PlaywrightTimeoutError:
                logger.warning(f'Network idle timeout for {url}, using domcontentloaded')
                page.goto(url, wait_until='domcontentloaded', timeout=60000)
            
            # Wait for lazy-loaded content
            page.wait_for_timeout(3000)
            page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
            page.wait_for_timeout(1000)
            page.evaluate('window.scrollTo(0, 0)')
            page.wait_for_timeout(1000)
            
            final_url = page.url
            html_content = page.content()
            
            # Process HTML for iframe embedding
            processed_html = ProxyService._process_html(html_content, final_url)
            
            return {
                'html': processed_html,
                'url': final_url,
                'status': 'success'
            }
            
        except PlaywrightTimeoutError:
            error_msg = 'Request timed out. The website may be slow or taking too long to load.'
            logger.error(f'Timeout error for {url}')
            return {'error': error_msg, 'url': url}
            
        except Exception as e:
            error_message = str(e)
            logger.error(f'Error loading website {url}: {error_message}')
            
            if 'net::ERR' in error_message or 'Navigation failed' in error_message:
                return {'error': f'Failed to load website: {error_message}. The website may be unreachable or blocked.', 'url': url}
            elif 'timeout' in error_message.lower():
                return {'error': 'Request timed out. The website may be slow or taking too long to load.', 'url': url}
            else:
                return {'error': f'An error occurred: {error_message}', 'url': url}
                
        finally:
            ProxyService._cleanup_resources(page, context, browser, playwright)
    
    @staticmethod
    def _process_html(html_content: str, base_url: str) -> str:
        """
        Process HTML content for iframe embedding.
        Removes CSP/X-Frame-Options and proxies all resources.
        
        Args:
            html_content: Raw HTML content
            base_url: Base URL for resolving relative URLs
            
        Returns:
            str: Processed HTML ready for iframe embedding
        """
        soup = BeautifulSoup(html_content, 'html.parser')
        parsed_url = urlparse(base_url)
        base_url_str = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        # Remove blocking headers
        ProxyService._remove_blocking_headers(soup)
        
        # Proxy all resources
        # Use full base_url for correct relative path resolution
        ProxyService._proxy_resources(soup, base_url, parsed_url)
        
        # Add base tag and proxy rewrite script
        ProxyService._add_base_and_scripts(soup, base_url)
        
        return str(soup)
    
    @staticmethod
    def _remove_blocking_headers(soup: BeautifulSoup) -> None:
        """Remove X-Frame-Options and CSP meta tags."""
        for meta in soup.find_all('meta'):
            http_equiv = meta.get('http-equiv', '').lower()
            name = meta.get('name', '').lower()
            content = meta.get('content', '').lower()
            
            if http_equiv in ['x-frame-options', 'content-security-policy', 'frame-options']:
                meta.decompose()
            if 'content-security-policy' in name or 'csp' in name:
                meta.decompose()
            if 'content-security-policy' in content:
                meta.decompose()
        
        # Remove CSP from script and style tags
        for tag in soup.find_all(['script', 'style']):
            if tag.string and 'Content-Security-Policy' in tag.string:
                tag.string = re.sub(
                    r'Content-Security-Policy[^;]*;?',
                    '',
                    tag.string,
                    flags=re.IGNORECASE
                )
    
    @staticmethod
    def _proxy_resources(soup: BeautifulSoup, base_url: str, parsed_url) -> None:
        """Proxy all external resources through our endpoint."""
        
        def make_absolute(url: str) -> str:
            """Convert relative URL to absolute."""
            if not url or url.startswith(('http://', 'https://', 'data:', 'blob:', '//', '#')):
                return url
            try:
                return urljoin(base_url, url)
            except:
                return url
        
        def proxy_url(url: str) -> str:
            """Convert absolute URL to proxy URL."""
            if not url or url.startswith(('data:', 'blob:', '#', 'javascript:', 'mailto:', 'tel:', '/api/proxy-resource/', '/api/proxy-path/', '{{PROXY_BASE}}')):
                return url
            if url.startswith('//'):
                url = f"{parsed_url.scheme}:{url}"
            
            # Use path-based proxy to enable relative path resolution
            # The URL is appended to the path, allowing browser to resolve relative links
            return f"{{{{PROXY_BASE}}}}/api/proxy-path/{url}"
        
        # Proxy stylesheets
        for link in soup.find_all('link', rel=True):
            if href := link.get('href'):
                link['href'] = proxy_url(make_absolute(href))
            if link.get('integrity'):
                del link['integrity']
            if link.get('crossorigin'):
                del link['crossorigin']
        
        # Proxy scripts
        for script in soup.find_all('script', src=True):
            if src := script.get('src'):
                script['src'] = proxy_url(make_absolute(src))
            if script.get('integrity'):
                del script['integrity']
            if script.get('crossorigin'):
                del script['crossorigin']
        
        # Proxy images
        for img in soup.find_all('img', src=True):
            if src := img.get('src'):
                img['src'] = proxy_url(make_absolute(src))
        
        # Proxy srcset attributes
        for img in soup.find_all('img', srcset=True):
            if srcset := img.get('srcset'):
                srcset_parts = []
                for part in srcset.split(','):
                    part = part.strip()
                    if ' ' in part:
                        url, descriptor = part.rsplit(' ', 1)
                        url = url.strip()
                        descriptor = descriptor.strip()
                        srcset_parts.append(f"{proxy_url(make_absolute(url))} {descriptor}")
                    else:
                        srcset_parts.append(proxy_url(make_absolute(part)))
                img['srcset'] = ', '.join(srcset_parts)
        
        # Proxy other media elements
        for element in soup.find_all(['source', 'video', 'audio', 'object', 'embed']):
            for attr in ['src', 'srcset', 'data']:
                if value := element.get(attr):
                    if attr == 'srcset':
                        srcset_parts = []
                        for part in value.split(','):
                            part = part.strip()
                            if ' ' in part:
                                url, descriptor = part.rsplit(' ', 1)
                                srcset_parts.append(f"{proxy_url(make_absolute(url.strip()))} {descriptor.strip()}")
                            else:
                                srcset_parts.append(proxy_url(make_absolute(part)))
                        element[attr] = ', '.join(srcset_parts)
                    else:
                        element[attr] = proxy_url(make_absolute(value))
        
        # Fix links and forms
        for link in soup.find_all('a', href=True):
            if href := link.get('href'):
                if not href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
                    link['href'] = make_absolute(href)
        
        for form in soup.find_all('form', action=True):
            if action := form.get('action'):
                form['action'] = make_absolute(action)
        
        # Fix background images in inline styles
        for element in soup.find_all(style=True):
            style = element.get('style', '')
            if 'url(' in style:
                def replace_url(match):
                    url_content = match.group(1).strip('\'"')
                    if url_content and not url_content.startswith(('http://', 'https://', 'data:', 'blob:', '//')):
                        return f"url('{proxy_url(make_absolute(url_content))}')"
                    elif url_content and url_content.startswith(('http://', 'https://')):
                        return f"url('{proxy_url(url_content)}')"
                    return match.group(0)
                
                element['style'] = re.sub(r'url\(([^)]+)\)', replace_url, style)
    
    @staticmethod
    def _add_base_and_scripts(soup: BeautifulSoup, base_url: str) -> None:
        """Add base tag and proxy rewrite script."""
        # Use path-based proxy for the base URL to ensure relative requests go through proxy
        proxy_base_href = f"{{{{PROXY_BASE}}}}/api/proxy-path/{base_url}"
        
        if not soup.find('base'):
            base_tag = soup.new_tag('base', href=proxy_base_href)
            if soup.head:
                soup.head.insert(0, base_tag)
        else:
            soup.find('base')['href'] = proxy_base_href
        
        if soup.head:
            # Add permissive CSP
            permissive_csp = soup.new_tag('meta')
            permissive_csp['http-equiv'] = 'Content-Security-Policy'
            permissive_csp['content'] = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"
            soup.head.insert(0, permissive_csp)
            
            # Add proxy rewrite script
            proxy_rewrite_script = soup.new_tag('script')
            proxy_rewrite_script.string = """
(function() {
    var proxyBase = window.location.origin;
    function rewriteProxyUrls() {
        // Rewrite base tag
        var baseTag = document.querySelector('base');
        if (baseTag && baseTag.href.includes('{{PROXY_BASE}}')) {
            baseTag.href = baseTag.href.replace(/\\{\\{PROXY_BASE\\}\\}/g, proxyBase);
        }

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
"""
            soup.head.insert(0, proxy_rewrite_script)
    
    @staticmethod
    def _cleanup_resources(page, context, browser, playwright) -> None:
        """Clean up browser resources."""
        for resource in [page, context, browser, playwright]:
            if resource:
                try:
                    if hasattr(resource, 'close'):
                        resource.close()
                    elif hasattr(resource, 'stop'):
                        resource.stop()
                except:
                    pass


class ResourceProxyService:
    """Service for proxying individual resources (CSS, JS, images, etc.)."""
    
    @staticmethod
    def proxy_resource(resource_url: str) -> tuple:
        """
        Proxy a single resource from a URL.
        
        Args:
            resource_url: URL of the resource to proxy
            
        Returns:
            tuple: (content, content_type, headers_dict) or (None, None, error_dict)
        """
        import requests
        
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': resource_url,
            }
            
            # Disable streaming to avoid Vite proxy chunking errors
            response = requests.get(resource_url, headers=headers, timeout=30, stream=False, allow_redirects=True)
            response.raise_for_status()
            
            content_type = response.headers.get('Content-Type', 'application/octet-stream')
            
            headers_dict = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'X-Frame-Options': 'ALLOWALL',
            }
            
            if 'Cache-Control' in response.headers:
                headers_dict['Cache-Control'] = response.headers['Cache-Control']
            elif 'Expires' in response.headers:
                headers_dict['Expires'] = response.headers['Expires']
            
            return (response.content, content_type, headers_dict)
            
        except requests.exceptions.RequestException as e:
            logger.error(f'Error fetching resource {resource_url}: {str(e)}')
            return (None, None, {'error': f'Failed to fetch resource: {str(e)}', 'url': resource_url})
        except Exception as e:
            logger.error(f'Unexpected error fetching resource {resource_url}: {str(e)}')
            return (None, None, {'error': f'An error occurred: {str(e)}', 'url': resource_url})

