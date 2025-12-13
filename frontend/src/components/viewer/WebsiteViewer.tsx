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
  Eye,
  Plus,
  Layout,
  Sparkles,
  Settings2,
  Palette
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../utils/storage';
import type { CustomDevice } from '../../utils/storage';
import { generateColorReplacementCSS, applyColorReplacementsToDOM } from '../../utils/colorPalettes';
import {
  DraggablePanel,
  CSSEditor,
  ElementInspector,
  SettingsPanel,
  ZoomControls,
  RecentUrls,
  CustomDeviceManager,
  CollapsibleLeftPanel,
  PANEL_WIDTH,
  ICON_MENU_WIDTH,
  DesignPanel,
  EffectsPanel,
  BrandExtractor,
  PREDEFINED_EFFECTS,
} from '../';
import type { PanelType } from '../';
import apiService from '../../services/api';
import '../../assets/css/viewer/WebsiteViewer.css';
import '../../assets/css/ui/SpaceIndicator.css';

interface DeviceConfig {
  icon: typeof Smartphone;
  label: string;
  width: string;
  height: string;
  isCustom?: boolean;
  customId?: string;
}

const DEFAULT_DEVICES: Record<string, DeviceConfig> = {
  mobile: { icon: Smartphone, label: 'Mobile', width: '375px', height: '667px' },
  tablet: { icon: Tablet, label: 'Tablet', width: '768px', height: '1024px' },
  laptop: { icon: Laptop, label: 'Laptop', width: '1366px', height: '768px' },
  desktop: { icon: Monitor, label: 'Desktop', width: '100%', height: '100%' },
};

function WebsiteViewer() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { state, dispatch, setUrl, toggleCssEditor, toggleInspector, toggleSettings, setZoomLevel, resetViewport, toggleEffect, setTypographyCss } = useApp();

  // Local state for pan/drag - minimal state updates
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [showRecentUrls, setShowRecentUrls] = useState(false);
  const [showCustomDevices, setShowCustomDevices] = useState(false);
  const [customDevices, setCustomDevices] = useState<CustomDevice[]>([]);
  const [currentDeviceMode, setCurrentDeviceMode] = useState<string>('desktop');
  const [currentCustomDevice, setCurrentCustomDevice] = useState<CustomDevice | null>(null);
  const [activePanel, setActivePanel] = useState<PanelType>('design');
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Load custom devices on mount and sync with state
  useEffect(() => {
    const loaded = storage.getCustomDevices();
    setCustomDevices(loaded);
    setCurrentDeviceMode(state.viewport.deviceMode);
  }, []);

  // Update current device mode when state changes
  useEffect(() => {
    if (!currentDeviceMode.startsWith('custom-')) {
      setCurrentDeviceMode(state.viewport.deviceMode);
    }
  }, [state.viewport.deviceMode]);



  const handleCustomDeviceSelect = (device: CustomDevice) => {
    setCurrentCustomDevice(device);
    setCurrentDeviceMode(`custom-${device.id}`);
    dispatch({
      type: 'SET_DEVICE_MODE',
      payload: device.type as any // Use the type for frame styling
    });
    resetViewport();
    setPanPosition({ x: 0, y: 0 });
    setShowCustomDevices(false);
  };

  const handleDeviceModeChange = (mode: string) => {
    setCurrentDeviceMode(mode);

    if (mode.startsWith('custom-')) {
      const customId = mode.replace('custom-', '');
      const custom = customDevices.find(d => d.id === customId);
      if (custom) {
        setCurrentCustomDevice(custom);
        dispatch({ type: 'SET_DEVICE_MODE', payload: custom.type as any });
      }
    } else {
      setCurrentCustomDevice(null);
      dispatch({ type: 'SET_DEVICE_MODE', payload: mode as any });
    }

    resetViewport();
    setPanPosition({ x: 0, y: 0 });
  };

  // Use refs exclusively for smooth performance - no state updates during interaction
  const panPositionRef = useRef({ x: 0, y: 0 });
  const zoomLevelRef = useRef(1);
  const isInteractingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  // Sync refs with state only when not interacting
  useEffect(() => {
    if (!isInteractingRef.current) {
      panPositionRef.current = { x: state.viewport.panPosition.x, y: state.viewport.panPosition.y };
      zoomLevelRef.current = state.viewport.zoomLevel;
    }
  }, [state.viewport.panPosition.x, state.viewport.panPosition.y, state.viewport.zoomLevel]);

  // Update DOM transform efficiently (removed - using direct updates instead)

  // Debounced state sync - only update React state when interaction ends or periodically
  const syncStateToReact = useCallback(() => {
    // Use setTimeout instead of RAF for state updates (less overhead)
    // This ensures React state is updated but doesn't block rendering
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      // Batch both updates together
      dispatch({
        type: 'SET_PAN_POSITION',
        payload: { ...panPositionRef.current }
      });
      dispatch({
        type: 'SET_ZOOM_LEVEL',
        payload: zoomLevelRef.current
      });
      rafIdRef.current = null;
    });
  }, [dispatch]);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  /**
   * Load website using Django reverse proxy (Playwright-based)
   * This provides full browser rendering with JavaScript execution
   */
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

      // Use Django backend proxy with Playwright for full browser rendering
      const response = await apiService.proxyWebsite(targetUrl) as { html?: string; url?: string; status?: string; error?: string };
      
      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.html) {
        throw new Error('No HTML content received from server');
      }

      // The backend already processes HTML (removes CSP, fixes URLs, etc.)
      // So we can use it directly
      dispatch({ type: 'SET_HTML_CONTENT', payload: response.html });
      dispatch({ type: 'SET_CURRENT_URL', payload: response.url || targetUrl });

      // Save to recent URLs
      storage.saveRecentUrl(response.url || targetUrl);
      storage.saveSettings({ lastUrl: response.url || targetUrl });
    } catch (err: unknown) {
      console.error('Error loading website:', err);
      let errorMessage = 'Failed to load website.';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      // Provide helpful error messages
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = 'Unable to connect to the server. Please ensure the backend is running on http://localhost:8000';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'The website took too long to load. Please try again or check if the URL is correct.';
      }
      
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const injectCustomCss = useCallback((doc: Document) => {
    if (!doc) return;

    // Remove existing custom CSS
    const existingStyle = doc.getElementById('custom-injected-css');
    if (existingStyle) existingStyle.remove();

    // Remove existing effects CSS
    const existingEffectsStyle = doc.getElementById('effects-injected-css');
    if (existingEffectsStyle) existingEffectsStyle.remove();

    // Combine custom CSS, typography CSS, effects CSS, and color replacement CSS
    let combinedCss = '';

    // Add color replacement CSS
    if (state.editor.colorMapping) {
      const colorCss = generateColorReplacementCSS(state.editor.colorMapping);
      if (colorCss.trim()) {
        combinedCss += '\n/* Color Palette Replacement */\n' + colorCss;
      }
    }

    // Add typography CSS
    if (state.editor.typographyCss.trim()) {
      combinedCss += state.editor.typographyCss + '\n';
    }

    // Add custom CSS
    if (state.editor.customCss.trim()) {
      combinedCss += state.editor.customCss + '\n';
    }

    // Add effects CSS
    if (state.editor.activeEffects.length > 0) {
      const effectsCss = state.editor.activeEffects
        .map(effectId => {
          const effect = PREDEFINED_EFFECTS.find(e => e.id === effectId);
          return effect ? effect.css : '';
        })
        .filter(css => css.trim())
        .join('\n');

      if (effectsCss.trim()) {
        combinedCss += '\n/* Effects CSS */\n' + effectsCss;
      }
    }

    // Inject combined CSS
    if (combinedCss.trim()) {
      const style = doc.createElement('style');
      style.id = 'custom-injected-css';
      style.textContent = combinedCss;
      doc.head.appendChild(style);
    }
  }, [state.editor.customCss, state.editor.activeEffects, state.editor.typographyCss, state.editor.colorMapping]);


  useEffect(() => {
    if (state.view.htmlContent && iframeRef.current) {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

      if (iframeDoc) {
        // Replace proxy URL placeholders with actual origin before writing
        const proxyBase = window.location.origin;
        const processedHtml = state.view.htmlContent.replace(/\{\{PROXY_BASE\}\}/g, proxyBase);
        
        iframeDoc.open();
        iframeDoc.write(processedHtml);
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
        // Apply color replacements to DOM
        if (state.editor.colorMapping) {
          applyColorReplacementsToDOM(iframeDoc, state.editor.colorMapping);
        }
        injectCustomCss(iframeDoc);
      }
    }
  }, [state.editor.customCss, state.editor.showCssEditor, state.editor.colorMapping, injectCustomCss]);

  // Custom zoom functions with smooth scaling
  const handleZoomIn = useCallback(() => {
    // Exponential zoom in for smoother experience
    const newZoom = Math.min(state.viewport.zoomLevel * 1.15, 5);
    setZoomLevel(newZoom);
  }, [state.viewport.zoomLevel, setZoomLevel]);

  const handleZoomOut = useCallback(() => {
    // Exponential zoom out for smoother experience
    const newZoom = Math.max(state.viewport.zoomLevel / 1.15, 0.1);
    setZoomLevel(newZoom);
  }, [state.viewport.zoomLevel, setZoomLevel]);

  const handleZoomReset = useCallback(() => {
    resetViewport();
    setPanPosition({ x: 0, y: 0 });
  }, [resetViewport]);

  // Figma-like scroll zoom - highly optimized for performance
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Allow normal scrolling when holding space (panning mode)
    if (state.viewport.isSpacePressed) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const container = canvasContainerRef.current;
    if (!container || !frameRef.current) return;

    isInteractingRef.current = true;

    // Get mouse position relative to container (cached)
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Use refs for current values
    const currentZoom = zoomLevelRef.current;
    const currentPan = panPositionRef.current;

    // Optimized zoom calculation
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const zoomSensitivity = 0.0008;
    const zoomFactor = 1 - delta * zoomSensitivity;
    const newZoom = Math.max(0.1, Math.min(5, currentZoom * zoomFactor));

    // Early exit if change is too small
    if (Math.abs(newZoom - currentZoom) < 0.0001) {
      isInteractingRef.current = false;
      return;
    }

    // Optimized zoom-to-point calculation
    const centerX = rect.width * 0.5;
    const centerY = rect.height * 0.5;
    const scaleChange = newZoom / currentZoom;

    // Calculate new pan to keep point under cursor fixed
    const newPanX = mouseX - centerX - (mouseX - centerX - currentPan.x) * scaleChange;
    const newPanY = mouseY - centerY - (mouseY - centerY - currentPan.y) * scaleChange;

    // Update refs
    zoomLevelRef.current = newZoom;
    panPositionRef.current = { x: newPanX, y: newPanY };

    // Direct DOM update for instant visual feedback (GPU accelerated)
    frameRef.current.style.transform = `translate3d(${newPanX}px, ${newPanY}px, 0) scale(${newZoom})`;

    // Throttled React state update (batched)
    syncStateToReact();

    // Reset interaction flag after a delay
    setTimeout(() => {
      isInteractingRef.current = false;
    }, 100);
  }, [state.viewport.isSpacePressed, syncStateToReact]);

  // Figma-like panning: Space + drag or middle mouse button (optimized)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Don't pan if clicking on buttons or interactive elements
    if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('textarea')) {
      return;
    }

    // Pan with Space + left click (Figma style)
    const shouldPan =
      state.viewport.isSpacePressed || // Space key pressed
      e.button === 1 || // Middle mouse button
      (e.button === 0 && state.viewport.isPanning) || // Pan mode active
      (e.button === 0 && (e.ctrlKey || e.metaKey)); // Ctrl/Cmd + drag (fallback)

    if (shouldPan) {
      isInteractingRef.current = true;
      setIsDragging(true);
      setDragStart({
        x: e.clientX - panPositionRef.current.x,
        y: e.clientY - panPositionRef.current.y
      });
      e.preventDefault();
      e.stopPropagation();

      if (canvasContainerRef.current) {
        canvasContainerRef.current.style.cursor = 'grabbing';
      }
    }
  }, [state.viewport.isSpacePressed, state.viewport.isPanning]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && frameRef.current) {
      e.preventDefault();
      e.stopPropagation();

      // Direct calculation
      const newPanX = e.clientX - dragStart.x;
      const newPanY = e.clientY - dragStart.y;

      // Update ref
      panPositionRef.current = { x: newPanX, y: newPanY };

      // Direct DOM update - no spaces in transform string for better performance
      const zoom = zoomLevelRef.current;
      frameRef.current.style.transform = `translate3d(${newPanX}px,${newPanY}px,0) scale(${zoom})`;
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    isInteractingRef.current = false;

    // Sync final position to React state
    syncStateToReact();

    // Reset cursor
    if (canvasContainerRef.current) {
      if (state.viewport.isSpacePressed) {
        canvasContainerRef.current.style.cursor = 'grab';
      } else {
        canvasContainerRef.current.style.cursor = '';
      }
    }
  }, [state.viewport.isSpacePressed, syncStateToReact]);

  // Handle Space key for panning (Figma style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space' && !state.viewport.isSpacePressed) {
        e.preventDefault();
        dispatch({ type: 'SET_SPACE_PRESSED', payload: true });
        if (canvasContainerRef.current) {
          canvasContainerRef.current.style.cursor = 'grab';
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && state.viewport.isSpacePressed) {
        e.preventDefault();
        dispatch({ type: 'SET_SPACE_PRESSED', payload: false });
        if (canvasContainerRef.current && !isDragging) {
          canvasContainerRef.current.style.cursor = '';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state.viewport.isSpacePressed, isDragging, dispatch]);

  useEffect(() => {
    if (!isDragging) return;

    // Store drag start in ref to avoid closure issues
    const dragStartRef = { ...dragStart };
    let stateSyncTimeout: number | null = null;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Calculate new position
      const newPanX = e.clientX - dragStartRef.x;
      const newPanY = e.clientY - dragStartRef.y;

      // Update ref immediately
      panPositionRef.current = { x: newPanX, y: newPanY };

      // CRITICAL: Direct DOM update with NO delays - this is what makes it smooth
      if (frameRef.current) {
        const zoom = zoomLevelRef.current;
        // Use transform property directly - fastest possible update
        frameRef.current.style.transform = `translate3d(${newPanX}px,${newPanY}px,0) scale(${zoom})`;
      }

      // Debounce React state sync (only update every 200ms to avoid re-renders during drag)
      // This prevents React re-renders from blocking smooth panning
      if (stateSyncTimeout) {
        clearTimeout(stateSyncTimeout);
      }
      stateSyncTimeout = window.setTimeout(() => {
        syncStateToReact();
        stateSyncTimeout = null;
      }, 200);
    };

    const handleGlobalMouseUp = () => {
      // Clear any pending state sync
      if (stateSyncTimeout) {
        clearTimeout(stateSyncTimeout);
        stateSyncTimeout = null;
      }

      // Final state sync
      syncStateToReact();

      setIsDragging(false);
      isInteractingRef.current = false;

      if (canvasContainerRef.current) {
        if (state.viewport.isSpacePressed) {
          canvasContainerRef.current.style.cursor = 'grab';
        } else {
          canvasContainerRef.current.style.cursor = '';
        }
      }
    };

    // Add listeners with optimal settings - use document for better capture
    document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false, capture: true });
    document.addEventListener('mouseup', handleGlobalMouseUp, { passive: true, capture: true });
    window.addEventListener('mouseleave', handleGlobalMouseUp, { passive: true });

    return () => {
      if (stateSyncTimeout) {
        clearTimeout(stateSyncTimeout);
      }
      document.removeEventListener('mousemove', handleGlobalMouseMove, { capture: true });
      document.removeEventListener('mouseup', handleGlobalMouseUp, { capture: true });
      window.removeEventListener('mouseleave', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart, state.viewport.isSpacePressed, syncStateToReact]);

  // Keyboard shortcuts (excluding Space which is handled separately)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Skip Space key - handled in separate effect
      if (e.code === 'Space') {
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
      {/* Collapsible Left Panel with Design Tools */}
      {!state.viewport.isFullView && (
        <CollapsibleLeftPanel
          defaultPanel="design"
          onPanelChange={setActivePanel}
          panels={[
            {
              id: 'design',
              icon: <Layout size={20} />,
              label: 'Design',
              component: (
                <DesignPanel
                  activeEffects={state.editor.activeEffects}
                  onToggleEffect={toggleEffect}
                  onTypographyChange={setTypographyCss}
                />
              ),
            },
            {
              id: 'effects',
              icon: <Sparkles size={20} />,
              label: 'Effects',
              component: (
                <EffectsPanel
                  activeEffects={state.editor.activeEffects}
                  onToggleEffect={toggleEffect}
                />
              ),
            },
            {
              id: 'brand',
              icon: <Palette size={20} />,
              label: 'Brand',
              component: <BrandExtractor />,
            },
            {
              id: 'settings',
              icon: <Settings2 size={20} />,
              label: 'Settings',
              component: <SettingsPanel />,
            },
          ]}
        />
      )}

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
            <div className="url-input-wrapper" style={{ position: 'relative' }}>
              <input
                ref={urlInputRef}
                type="text"
                className="url-input"
                placeholder="Type a URL to explore..."
                value={state.view.url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    loadWebsite();
                    setShowRecentUrls(false);
                  } else if (e.key === 'ArrowDown' && showRecentUrls) {
                    e.preventDefault();
                  }
                }}
                onFocus={() => {
                  const recent = storage.getRecentUrls();
                  if (recent.length > 0) {
                    setShowRecentUrls(true);
                  }
                }}
                onBlur={() => {
                  // Delay to allow click on recent URLs
                  setTimeout(() => setShowRecentUrls(false), 200);
                }}
                disabled={state.view.loading}
              />
              <RecentUrls
                isOpen={showRecentUrls}
                onClose={() => setShowRecentUrls(false)}
                onSelectUrl={(url) => {
                  setUrl(url);
                  setTimeout(() => loadWebsite(), 0);
                }}
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
        ref={canvasContainerRef}
        className={`viewer-canvas ${state.viewport.isFullView ? 'full-view' : ''} ${activePanel ? 'panel-open' : 'panel-closed'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => {
          // Prevent context menu when panning with middle mouse
          if (e.button === 1) {
            e.preventDefault();
          }
        }}
        style={{
          cursor: isDragging
            ? 'grabbing'
            : state.viewport.isSpacePressed
              ? 'grab'
              : 'default',
          userSelect: isDragging ? 'none' : 'auto',
          paddingLeft: state.viewport.isFullView ? 0 : (activePanel ? `${PANEL_WIDTH + ICON_MENU_WIDTH + 16}px` : `${ICON_MENU_WIDTH + 16}px`),
        }}
      >
        {state.view.loading ? (
          <div className="loading-state">
            <div className="loader-container">
              <div className="loader-spinner">
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
              </div>
              <h3>Loading Website</h3>
              <p>Rendering with Playwright...</p>
            </div>
          </div>
        ) : state.view.error ? (
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
            ref={frameRef}
            className={`frame-wrapper ${currentCustomDevice ? currentCustomDevice.type : state.viewport.deviceMode} ${state.viewport.isFullView ? 'full-view-frame' : ''}`}
            style={{
              width: state.viewport.isFullView
                ? '100%'
                : (currentCustomDevice
                  ? `${currentCustomDevice.width}px`
                  : (DEFAULT_DEVICES[state.viewport.deviceMode]?.width || '100%')),
              height: state.viewport.isFullView
                ? '100%'
                : (state.viewport.deviceMode === 'desktop'
                  ? '100%'
                  : (currentCustomDevice
                    ? `${currentCustomDevice.height}px`
                    : (DEFAULT_DEVICES[state.viewport.deviceMode]?.height || '100%'))),
              // Use refs during interaction, state when idle
              transform: isDragging
                ? `translate3d(${panPositionRef.current.x}px, ${panPositionRef.current.y}px, 0) scale(${zoomLevelRef.current})`
                : `translate3d(${state.viewport.panPosition.x}px, ${state.viewport.panPosition.y}px, 0) scale(${state.viewport.zoomLevel})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              willChange: isDragging ? 'transform' : 'auto',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              perspective: 1000
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
          {Object.entries(DEFAULT_DEVICES).map(([mode, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={mode}
                className={`dock-item ${currentDeviceMode === mode ? 'active' : ''}`}
                onClick={() => handleDeviceModeChange(mode)}
              >
                <Icon size={20} strokeWidth={1.5} />
                <span className="dock-tooltip">{config.label}</span>
              </button>
            );
          })}

          {/* Custom Devices */}
          {customDevices.map((custom) => {
            const iconMap: Record<string, typeof Smartphone> = {
              mobile: Smartphone,
              tablet: Tablet,
              laptop: Laptop,
            };
            const Icon = iconMap[custom.type] || Smartphone;
            const modeKey = `custom-${custom.id}`;

            return (
              <button
                key={modeKey}
                className={`dock-item custom-device ${currentDeviceMode === modeKey ? 'active' : ''}`}
                onClick={() => handleDeviceModeChange(modeKey)}
                title={`${custom.name} (${custom.width}×${custom.height})`}
              >
                <Icon size={20} strokeWidth={1.5} />
                <span className="dock-tooltip">{custom.name}</span>
              </button>
            );
          })}

          {/* Add Custom Device Button */}
          <div className="dock-divider"></div>
          <button
            className="dock-item"
            onClick={() => setShowCustomDevices(true)}
            title="Manage Custom Devices"
          >
            <Plus size={20} strokeWidth={1.5} />
            <span className="dock-tooltip">Custom Devices</span>
          </button>

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
            title="Pan Mode (Space + Drag or Middle Mouse Button)"
          >
            <Move size={20} strokeWidth={1.5} />
            <span className="dock-tooltip">Pan Mode (Space + Drag)</span>
          </button>

          <div className="dock-divider"></div>

          <button
            className="dock-item"
            onClick={handleZoomOut}
            disabled={state.viewport.zoomLevel <= 0.1}
            title="Zoom Out (Ctrl/Cmd + Scroll)"
          >
            <ZoomOut size={20} strokeWidth={1.5} />
            <span className="dock-tooltip">Zoom Out</span>
          </button>

          <button
            className={`dock-item zoom-indicator ${state.viewport.showZoomControls ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'TOGGLE_ZOOM_CONTROLS' })}
            title="Zoom Controls (Click to open advanced controls)"
          >
            <span className="zoom-level">{Math.round(state.viewport.zoomLevel * 100)}%</span>
            <span className="dock-tooltip">Zoom Controls</span>
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

      {/* Zoom Controls Panel */}
      {state.viewport.showZoomControls && !state.viewport.isFullView && (
        <DraggablePanel
          title="Zoom Controls"
          onClose={() => dispatch({ type: 'TOGGLE_ZOOM_CONTROLS' })}
          initialPosition={{ x: window.innerWidth / 2 - 150, y: 100 }}
          width={320}
        >
          <ZoomControls />
        </DraggablePanel>
      )}

      {/* Custom Device Manager */}
      {showCustomDevices && !state.viewport.isFullView && (
        <DraggablePanel
          title="Custom Devices"
          onClose={() => setShowCustomDevices(false)}
          initialPosition={{ x: window.innerWidth / 2 - 200, y: 100 }}
          width={400}
          height={600}
        >
          <CustomDeviceManager
            onDeviceSelect={handleCustomDeviceSelect}
            onClose={() => setShowCustomDevices(false)}
            onDevicesChange={(devices) => setCustomDevices(devices)}
          />
        </DraggablePanel>
      )}

      {/* Space Key Indicator */}
      {state.viewport.isSpacePressed && !state.viewport.isFullView && (
        <div className="space-indicator show">
          <span className="space-key">SPACE</span>
          <span className="space-indicator-text">Hold and drag to pan</span>
        </div>
      )}

    </div>
  );
}

export default WebsiteViewer;
