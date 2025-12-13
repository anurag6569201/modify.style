import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Smartphone,
  Tablet,
  Laptop,
  Monitor,
  RotateCcw,
  Code2,
  Globe,
  Search,
  ExternalLink,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Move
} from 'lucide-react';
import { DraggablePanel } from '../';
import '../../assets/css/viewer/WebsiteViewer.css';

// CORS proxy services (fallback options)
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
];

type DeviceMode = 'mobile' | 'tablet' | 'laptop' | 'desktop';

interface DeviceConfig {
  icon: typeof Smartphone;
  label: string;
  width: string;
  height: string;
}

const DEVICES: Record<DeviceMode, DeviceConfig> = {
  mobile: { icon: Smartphone, label: 'Mobile', width: '375px', height: '667px' },
  tablet: { icon: Tablet, label: 'Tablet', width: '768px', height: '1024px' },
  laptop: { icon: Laptop, label: 'Laptop', width: '1366px', height: '768px' },
  desktop: { icon: Monitor, label: 'Desktop', width: '100%', height: '100%' },
};

function WebsiteViewer() {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);

  // Design & Tools States
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [showCssEditor, setShowCssEditor] = useState(false);
  const [isFullView, setIsFullView] = useState(false);
  const [customCss, setCustomCss] = useState(`/* Add your custom CSS here */
/* Example: */
/* body { background-color: #f0f0f0 !important; } */`);

  // Zoom & Pan States
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

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
      console.warn(`Proxy ${proxyIndex} failed, trying next...`, err);
      return fetchWithProxy(targetUrl, proxyIndex + 1);
    }
  };

  const processHtml = (html: string, baseUrl: string): string => {
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
        } catch {
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

    // Inject a small script to disable link clicking inside iframe if needed
    // or to handle potential navigation issues (optional)

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
      let targetUrl = url.trim();
      if (!targetUrl.match(/^https?:\/\//)) {
        targetUrl = 'https://' + targetUrl;
      }

      const html = await fetchWithProxy(targetUrl);
      const processedHtml = processHtml(html, targetUrl);

      setHtmlContent(processedHtml);
      setCurrentUrl(targetUrl);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage || 'Failed to load website.');
    } finally {
      setLoading(false);
    }
  };

  const injectCustomCss = useCallback((doc: Document) => {
    if (!doc) return;

    // Always clean up old style first
    const existingStyle = doc.getElementById('custom-injected-css');
    if (existingStyle) existingStyle.remove();

    // Only inject if editor is active or we have content that matters
    if (customCss.trim()) {
      const style = doc.createElement('style');
      style.id = 'custom-injected-css';
      style.textContent = customCss;
      doc.head.appendChild(style);
    }
  }, [customCss]);

  useEffect(() => {
    if (htmlContent && iframeRef.current) {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();
        injectCustomCss(iframeDoc);
      }
    }
  }, [htmlContent, injectCustomCss]);

  useEffect(() => {
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        injectCustomCss(iframeDoc);
      }
    }
  }, [customCss, showCssEditor, injectCustomCss]);

  // Zoom Functions - Define these first before they're used in useEffect
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.25, 5)); // Max 5x zoom
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.25)); // Min 0.25x zoom
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoomIn();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleZoomReset]);

  const toggleFullView = () => {
    setIsFullView(!isFullView);
    // Close CSS editor when entering full view for maximum space
    if (!isFullView) {
      setShowCssEditor(false);
    }
    // Reset zoom and pan when entering full view
    if (!isFullView) {
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(prev => Math.max(0.25, Math.min(5, prev + delta)));
    }
  };

  // Pan Functions
  const handleMouseDown = (e: React.MouseEvent) => {
    // Allow panning when:
    // 1. Pan mode is active, OR
    // 2. Ctrl/Cmd is held, OR
    // 3. Zoom level is greater than 1
    if (e.button === 0 && (isPanning || e.ctrlKey || e.metaKey || zoomLevel > 1)) {
      // Don't pan if clicking on buttons or interactive elements
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('a') || target.closest('input')) {
        return;
      }
      setIsDragging(true);
      setDragStart({
        x: e.clientX - panPosition.x,
        y: e.clientY - panPosition.y
      });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPanPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart]);

  return (
    <div className={`website-viewer ${isFullView ? 'full-view-mode' : ''}`}>
      {/* Animated Background */}
      {!isFullView && (
        <div className="ambient-background">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
          <div className="mesh-grid"></div>
        </div>
      )}

      {/* Floating Command Bar (Top) */}
      {!isFullView && (
        <div className="command-bar-container">
        <div className="command-bar">
          <div className="brand-pill">
            <Globe size={16} />
          </div>
          <div className="url-input-wrapper">
            <input
              type="text"
              className="url-input"
              placeholder="Type a URL to explore..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadWebsite()}
              disabled={loading}
            />
          </div>
          <button
            className="action-button"
            onClick={loadWebsite}
            disabled={loading}
            title="Load Website"
          >
            {loading ? <RotateCcw className="spin" size={16} /> : <Search size={16} />}
          </button>

          {currentUrl && (
            <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="action-button" title="Open Original">
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>
      )}

      {/* Main Canvas Area */}
      <div 
        ref={canvasRef}
        className={`viewer-canvas ${isFullView ? 'full-view' : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: (isDragging || (isPanning && zoomLevel > 1)) ? 'grabbing' : (isPanning || zoomLevel > 1 ? 'grab' : 'default')
        }}
      >
        {error ? (
          <div className="error-state">
            <div className="error-icon">!</div>
            <h3>Unable to Load</h3>
            <p>{error}</p>
          </div>
        ) : !htmlContent ? (
          <div className="empty-state">
            <h2>Design. Prototype. Build.</h2>
            <p>Enter a URL to start customizing the web.</p>
          </div>
        ) : (
          <div
            className={`frame-wrapper ${deviceMode} ${isFullView ? 'full-view-frame' : ''}`}
            style={{
              width: isFullView ? '100%' : DEVICES[deviceMode].width,
              height: isFullView ? '100%' : (deviceMode === 'desktop' ? '100%' : DEVICES[deviceMode].height),
              transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.2s ease-out'
            }}
          >
            {/* Frame Controls Overlay */}
            {!isFullView && (
              <div className="frame-controls">
                <button
                  className="frame-control-btn full-view-btn"
                  onClick={toggleFullView}
                  title="Enter Full View"
                >
                  <Maximize2 size={16} />
                </button>
              </div>
            )}
            <iframe
              ref={iframeRef}
              className="website-iframe"
              title="Site Preview"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            />
          </div>
        )}
      </div>

      {/* Floating Dock (Bottom) */}
      {!isFullView && (
        <div className="dock-container">
        {Object.entries(DEVICES).map(([mode, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={mode}
              className={`dock-item ${deviceMode === mode ? 'active' : ''}`}
              onClick={() => {
                setDeviceMode(mode as DeviceMode);
                // Reset zoom and pan when changing device
                setZoomLevel(1);
                setPanPosition({ x: 0, y: 0 });
              }}
            >
              <Icon size={20} strokeWidth={1.5} />
              <span className="dock-tooltip">{config.label}</span>
            </button>
          );
        })}

        <div className="dock-divider"></div>

        <button
          className={`dock-item ${showCssEditor ? 'active' : ''}`}
          onClick={() => setShowCssEditor(!showCssEditor)}
        >
          <Code2 size={20} strokeWidth={1.5} />
          <span className="dock-tooltip">CSS Editor</span>
        </button>

        <div className="dock-divider"></div>

        <button
          className={`dock-item ${isPanning ? 'active' : ''}`}
          onClick={() => setIsPanning(!isPanning)}
          title="Pan Mode (Hold Ctrl/Cmd + Drag)"
        >
          <Move size={20} strokeWidth={1.5} />
          <span className="dock-tooltip">Pan Mode</span>
        </button>

        <div className="dock-divider"></div>

        <button
          className="dock-item"
          onClick={handleZoomOut}
          disabled={zoomLevel <= 0.25}
          title="Zoom Out (Ctrl/Cmd + Scroll)"
        >
          <ZoomOut size={20} strokeWidth={1.5} />
          <span className="dock-tooltip">Zoom Out</span>
        </button>

        <button
          className="dock-item zoom-indicator"
          onClick={handleZoomReset}
          title="Reset Zoom"
        >
          <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
          <span className="dock-tooltip">Reset Zoom</span>
        </button>

        <button
          className="dock-item"
          onClick={handleZoomIn}
          disabled={zoomLevel >= 5}
          title="Zoom In (Ctrl/Cmd + Scroll)"
        >
          <ZoomIn size={20} strokeWidth={1.5} />
          <span className="dock-tooltip">Zoom In</span>
        </button>

        <div className="dock-divider"></div>

        <button
          className="dock-item"
          onClick={toggleFullView}
          title="Full View"
        >
          <Maximize2 size={20} strokeWidth={1.5} />
          <span className="dock-tooltip">Full View</span>
        </button>
      </div>
      )}

      {/* Full View Exit Button */}
      {isFullView && (
        <button
          className="full-view-exit-btn"
          onClick={toggleFullView}
          title="Exit Full View"
        >
          <Minimize2 size={20} />
          <span>Exit Full View</span>
        </button>
      )}

      {/* Draggable CSS Editor */}
      {showCssEditor && !isFullView && (
        <DraggablePanel
          title="CSS Inspector"
          onClose={() => setShowCssEditor(false)}
          initialPosition={{ x: window.innerWidth - 380, y: 60 }}
          width={340}
        >
          <div className="css-editor-container">
            <textarea
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              placeholder="/* Enter custom CSS */"
              spellCheck={false}
            />
            <div className="editor-footer">
              Live Preview Active
            </div>
          </div>
        </DraggablePanel>
      )}
    </div>
  );
}

export default WebsiteViewer;
