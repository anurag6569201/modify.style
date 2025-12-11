import { useState, useRef, useEffect } from 'react';
import './WebsiteViewer.css';

// CORS proxy services (fallback options)
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
];

function WebsiteViewer() {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [customCss, setCustomCss] = useState(`/* Add your custom CSS here */
/* Example: */
/* body { background-color: #f0f0f0 !important; } */`);
  const [showCssEditor, setShowCssEditor] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchWithProxy = async (targetUrl: string, proxyIndex: number = 0): Promise<string> => {
    if (proxyIndex >= CORS_PROXIES.length) {
      throw new Error('All proxy services failed. Please try again later.');
    }

    const proxy = CORS_PROXIES[proxyIndex];
    let proxyUrl: string;

    if (proxy.includes('allorigins.win')) {
      proxyUrl = `${proxy}${encodeURIComponent(targetUrl)}`;
    } else if (proxy.includes('corsproxy.io')) {
      proxyUrl = `${proxy}${encodeURIComponent(targetUrl)}`;
    } else {
      proxyUrl = `${proxy}${encodeURIComponent(targetUrl)}`;
    }

    try {
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      return html;
    } catch (err) {
      // Try next proxy
      console.warn(`Proxy ${proxyIndex} failed, trying next...`, err);
      return fetchWithProxy(targetUrl, proxyIndex + 1);
    }
  };

  const processHtml = (html: string, baseUrl: string): string => {
    // Create a temporary DOM to process the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove X-Frame-Options and CSP meta tags
    const metas = doc.querySelectorAll('meta');
    metas.forEach((meta) => {
      const httpEquiv = meta.getAttribute('http-equiv')?.toLowerCase();
      const name = meta.getAttribute('name')?.toLowerCase();
      if (
        httpEquiv === 'x-frame-options' ||
        httpEquiv === 'content-security-policy' ||
        name === 'csp'
      ) {
        meta.remove();
      }
    });

    // Convert relative URLs to absolute URLs
    const base = doc.createElement('base');
    base.href = baseUrl;
    if (doc.head) {
      doc.head.insertBefore(base, doc.head.firstChild);
    }

    // Fix relative URLs in various elements
    const fixUrl = (element: Element, attr: string) => {
      const value = element.getAttribute(attr);
      if (value && !value.match(/^(https?:|#|javascript:|mailto:|tel:|\/\/)/)) {
        try {
          element.setAttribute(attr, new URL(value, baseUrl).href);
        } catch (e) {
          // Invalid URL, skip
        }
      }
    };

    doc.querySelectorAll('img[src]').forEach((img) => fixUrl(img, 'src'));
    doc.querySelectorAll('a[href]').forEach((a) => fixUrl(a, 'href'));
    doc.querySelectorAll('link[href]').forEach((link) => fixUrl(link, 'href'));
    doc.querySelectorAll('script[src]').forEach((script) => fixUrl(script, 'src'));
    doc.querySelectorAll('source[src]').forEach((source) => fixUrl(source, 'src'));
    doc.querySelectorAll('form[action]').forEach((form) => fixUrl(form, 'action'));

    return doc.documentElement.outerHTML;
  };

  const loadWebsite = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setHtmlContent(null);
    setCurrentUrl(null);

    try {
      // Ensure URL has a protocol
      let targetUrl = url.trim();
      if (!targetUrl.match(/^https?:\/\//)) {
        targetUrl = 'https://' + targetUrl;
      }

      // Fetch the website using CORS proxy
      const html = await fetchWithProxy(targetUrl);

      // Process the HTML
      const processedHtml = processHtml(html, targetUrl);

      setHtmlContent(processedHtml);
      setCurrentUrl(targetUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to load website. The site may block proxy requests.');
      console.error('Error loading website:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (htmlContent && iframeRef.current) {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

      if (iframeDoc) {
        // Write the HTML content
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        // Inject custom CSS if editor is visible and has content
        if (showCssEditor && customCss.trim() && !customCss.trim().startsWith('/*')) {
          // Remove existing custom CSS if any
          const existingStyle = iframeDoc.getElementById('custom-injected-css');
          if (existingStyle) {
            existingStyle.remove();
          }

          const style = iframeDoc.createElement('style');
          style.id = 'custom-injected-css';
          style.textContent = customCss;
          iframeDoc.head.appendChild(style);
        }
      }
    }
  }, [htmlContent, customCss, showCssEditor]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      loadWebsite();
    }
  };

  return (
    <div className="website-viewer">
      <div className="website-viewer-header">
        <div className="url-input-container">
          <input
            type="text"
            className="url-input"
            placeholder="Enter website URL (e.g., example.com or https://example.com)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
          <button
            className="load-button"
            onClick={loadWebsite}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load Website'}
          </button>
        </div>
        <button
          className="toggle-css-button"
          onClick={() => setShowCssEditor(!showCssEditor)}
          title="Toggle CSS Editor"
        >
          {showCssEditor ? 'Hide CSS' : 'Show CSS'}
        </button>
      </div>

      {currentUrl && (
        <div className="current-url-bar">
          <span className="current-url-label">Viewing:</span>
          <span className="current-url">{currentUrl}</span>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="website-viewer-content">
        {showCssEditor && (
          <div className="css-editor-panel">
            <div className="css-editor-header">
              <h3>Custom CSS (Optional)</h3>
              <span className="css-hint">CSS is applied in real-time</span>
            </div>
            <textarea
              className="css-editor"
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              placeholder="Enter your custom CSS here..."
            />
          </div>
        )}

        <div className="iframe-container">
          {htmlContent ? (
            <iframe
              ref={iframeRef}
              className="website-iframe"
              title="Website Preview"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
            />
          ) : (
            <div className="empty-state">
              <h2>Website Viewer</h2>
              <p>Enter any website URL above and click "Load Website" to view it here</p>
              <p className="empty-state-hint">
                Try: example.com, google.com, github.com, wikipedia.org, etc.
              </p>
              <p className="empty-state-hint" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                <strong>Note:</strong> This uses client-side CORS proxies. Some websites may block proxy requests.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WebsiteViewer;
