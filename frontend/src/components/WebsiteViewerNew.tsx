import { useRef, useEffect, useCallback, useState } from 'react';
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
  Move,
  Settings,
  Eye
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import DraggablePanel from './DraggablePanel';
import CSSEditor from './CSSEditor';
import ElementInspector from './ElementInspector';
import SettingsPanel from './SettingsPanel';
import './WebsiteViewer.css';

// CORS proxy services (fallback options)
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
];

interface DeviceConfig {
  icon: typeof Smartphone;
  label: string;
  width: string;
  height: string;
}

const DEVICES: Record<string, DeviceConfig> = {
  mobile: { icon: Smartphone, label: 'Mobile', width: '375px', height: '667px' },
  tablet: { icon: Tablet, label: 'Tablet', width: '768px', height: '1024px' },
  laptop: { icon: Laptop, label: 'Laptop', width: '1366px', height: '768px' },
  desktop: { icon: Monitor, label: 'Desktop', width: '100%', height: '100%' },
};

function WebsiteViewer() {
  const { state, dispatch, setUrl, setCustomCss, toggleCssEditor, toggleInspector, toggleSettings, setDeviceMode, setZoomLevel, resetViewport, handleZoomIn, handleZoomOut, handleZoomReset } = useApp();
  
  // Local state for pan/drag
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const fetchWithProxy = async (targetUrl: string, proxyIndex: number = 0): Promise<string> => {
    if (proxyIndex >= CORS_PROXIES.length) {
      throw new Error('All proxy services failed. Please try again later.');
    }

    const proxy = CORS_PROXIES[proxyIndex];
    const proxyUrl = `${proxy}${encodeURIComponent(targetUrl)}`;

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

    // Fix relative URLs
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

    return doc.documentElement.outerHTML;
  };

  const loadWebsite = async () => {
    if (!state.view.url.trim()) {
      dispatch({ type: 'SET_ERROR', payload: 'Please enter a URL' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });
    dispatch({ type: 'SET_HTML_CONTENT', payload: null });
    dispatch({ type: 'SET_CURRENT_URL', payload: null });

    try {
      let targetUrl = state.view.url.trim();
      if (!targetUrl.match(/^https?:\/\//)) {
        targetUrl = 'https://' + targetUrl;
      }

      const html = await fetchWithProxy(targetUrl);
      const processedHtml = processHtml(html, targetUrl);

      dispatch({ type: 'SET_HTML_CONTENT', payload: processedHtml });
      dispatch({ type: 'SET_CURRENT_URL', payload: targetUrl });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      dispatch({ type: 'SET_ERROR', payload: errorMessage || 'Failed to load website.' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const injectCustomCss = useCallback((doc: Document) => {
    if (!doc) return;

    const existingStyle = doc.getElementById('custom-injected-css');
    if (existingStyle) existingStyle.remove();

    if (state.editor.customCss.trim()) {
      const style = doc.createElement('style');
      style.id = 'custom-injected-css';
      style.textContent = state.editor.customCss;
      doc.head.appendChild(style);
    }
  }, [state.editor.customCss]);

  useEffect(() => {
    if (state.view.htmlContent && iframeRef.current) {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(state.view.htmlContent);
        iframeDoc.close();
        injectCustomCss(iframeDoc);
      }
    }
  }, [state.view.htmlContent, injectCustomCss]);

  useEffect(() => {
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        injectCustomCss(iframeDoc);
      }
    }
  }, [state.editor.customCss, state.editor.showCssEditor, injectCustomCss]);

  // Zoom functions
  const handleZoomIn = useCallback(() => {
    setZoomLevel(Math.min(state.viewport.zoomLevel + 0.25, 5));
  }, [state.viewport.zoomLevel, setZoomLevel]);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(Math.max(state.viewport.zoomLevel - 0.25, 0.25));
  }, [state.viewport.zoomLevel, setZoomLevel]);

  const handleZoomReset = useCallback(() => {
    resetViewport();
    setPanPosition({ x: 0, y: 0 });
  }, [resetViewport]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(Math.max(0.25, Math.min(5, state.viewport.zoomLevel + delta)));
    }
  };

  // Pan functions
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && (state.viewport.isPanning || e.ctrlKey || e.metaKey || state.viewport.zoomLevel > 1)) {
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    dispatch({ type: 'TOGGLE_FULL_VIEW' });
    setPanPosition({ x: 0, y: 0 });
  };

  return (
    <div className={`website-viewer ${state.viewport.isFullView ? 'full-view-mode' : ''}`}>
      {/* Animated Background */}
      {!state.viewport.isFullView && (
        <div className="ambient-background">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
          <div className="mesh-grid"></div>
        </div>
      )}

      {/* Floating Command Bar (Top) */}
      {!state.viewport.isFullView && (
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
                value={state.view.url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadWebsite()}
                disabled={state.view.loading}
              />
            </div>
            <button
              className="action-button"
              onClick={loadWebsite}
              disabled={state.view.loading}
              title="Load Website"
            >
              {state.view.loading ? <RotateCcw className="spin" size={16} /> : <Search size={16} />}
            </button>

            {state.view.currentUrl && (
              <a href={state.view.currentUrl} target="_blank" rel="noopener noreferrer" className="action-button" title="Open Original">
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div 
        ref={canvasRef}
        className={`viewer-canvas ${state.viewport.isFullView ? 'full-view' : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: (isDragging || (state.viewport.isPanning && state.viewport.zoomLevel > 1)) ? 'grabbing' : (state.viewport.isPanning || state.viewport.zoomLevel > 1 ? 'grab' : 'default')
        }}
      >
        {state.view.error ? (
          <div className="error-state">
            <div className="error-icon">!</div>
            <h3>Unable to Load</h3>
            <p>{state.view.error}</p>
          </div>
        ) : !state.view.htmlContent ? (
          <div className="empty-state">
            <h2>Design. Prototype. Build.</h2>
            <p>Enter a URL to start customizing the web.</p>
          </div>
        ) : (
          <div
            className={`frame-wrapper ${state.viewport.deviceMode} ${state.viewport.isFullView ? 'full-view-frame' : ''}`}
            style={{
              width: state.viewport.isFullView ? '100%' : DEVICES[state.viewport.deviceMode].width,
              height: state.viewport.isFullView ? '100%' : (state.viewport.deviceMode === 'desktop' ? '100%' : DEVICES[state.viewport.deviceMode].height),
              transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${state.viewport.zoomLevel})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.2s ease-out'
            }}
          >
            {!state.viewport.isFullView && (
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
      {!state.viewport.isFullView && (
        <div className="dock-container">
          {Object.entries(DEVICES).map(([mode, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={mode}
                className={`dock-item ${state.viewport.deviceMode === mode ? 'active' : ''}`}
                onClick={() => {
                  setDeviceMode(mode as any);
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
            className={`dock-item ${state.editor.showCssEditor ? 'active' : ''}`}
            onClick={toggleCssEditor}
          >
            <Code2 size={20} strokeWidth={1.5} />
            <span className="dock-tooltip">CSS Editor</span>
          </button>

          <button
            className={`dock-item ${state.editor.showInspector ? 'active' : ''}`}
            onClick={toggleInspector}
          >
            <Eye size={20} strokeWidth={1.5} />
            <span className="dock-tooltip">Element Inspector</span>
          </button>

          <div className="dock-divider"></div>

          <button
            className={`dock-item ${state.viewport.isPanning ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_PANNING', payload: !state.viewport.isPanning })}
            title="Pan Mode (Hold Ctrl/Cmd + Drag)"
          >
            <Move size={20} strokeWidth={1.5} />
            <span className="dock-tooltip">Pan Mode</span>
          </button>

          <div className="dock-divider"></div>

          <button
            className="dock-item"
            onClick={handleZoomOut}
            disabled={state.viewport.zoomLevel <= 0.25}
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
            <span className="zoom-level">{Math.round(state.viewport.zoomLevel * 100)}%</span>
            <span className="dock-tooltip">Reset Zoom</span>
          </button>

          <button
            className="dock-item"
            onClick={handleZoomIn}
            disabled={state.viewport.zoomLevel >= 5}
            title="Zoom In (Ctrl/Cmd + Scroll)"
          >
            <ZoomIn size={20} strokeWidth={1.5} />
            <span className="dock-tooltip">Zoom In</span>
          </button>

          <div className="dock-divider"></div>

          <button
            className={`dock-item ${state.editor.showSettings ? 'active' : ''}`}
            onClick={toggleSettings}
            title="Settings"
          >
            <Settings size={20} strokeWidth={1.5} />
            <span className="dock-tooltip">Settings</span>
          </button>

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
      {state.viewport.isFullView && (
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
      {state.editor.showCssEditor && !state.viewport.isFullView && (
        <DraggablePanel
          title="CSS Editor"
          onClose={toggleCssEditor}
          initialPosition={{ x: window.innerWidth - 420, y: 60 }}
          width={400}
          height={500}
        >
          <CSSEditor />
        </DraggablePanel>
      )}

      {/* Element Inspector */}
      {state.editor.showInspector && !state.viewport.isFullView && (
        <DraggablePanel
          title="Element Inspector"
          onClose={toggleInspector}
          initialPosition={{ x: 20, y: 60 }}
          width={380}
          height={600}
        >
          <ElementInspector />
        </DraggablePanel>
      )}

      {/* Settings Panel */}
      {state.editor.showSettings && !state.viewport.isFullView && (
        <DraggablePanel
          title="Settings"
          onClose={toggleSettings}
          initialPosition={{ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 300 }}
          width={400}
        >
          <SettingsPanel />
        </DraggablePanel>
      )}
    </div>
  );
}

export default WebsiteViewer;
