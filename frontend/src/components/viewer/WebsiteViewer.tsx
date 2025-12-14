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
  Palette,
  Shield,
  ShieldAlert,
  Edit,
  SplitSquareHorizontal
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import apiService from '../../services/api';
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
  const { state, dispatch, setUrl, toggleCssEditor, toggleInspector, toggleSettings, setZoomLevel, resetViewport, toggleEffect, setTypographyCss, setEffectMode } = useApp();

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
    resetViewport();
    setPanPosition({ x: 0, y: 0 });
    setShowCustomDevices(false);
  };

  const [isMultiView, setIsMultiView] = useState(false);
  const [useProxy, setUseProxy] = useState(true); // Always default to Proxy Mode
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [comparisonSplit, setComparisonSplit] = useState(50); // 50% split
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isIframeRestricted, setIsIframeRestricted] = useState(false);

  const toggleMultiView = () => {
    setIsMultiView(!isMultiView);
    // Reset viewport when switching modes for better UX
    setTimeout(() => {
      resetViewport();
      setPanPosition({ x: 0, y: 0 });
    }, 50);
  };

  const handleDeviceModeChange = (mode: string) => {
    // Prevent unnecessary reloads - only update if mode actually changed
    if (currentDeviceMode === mode) return;
    
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

    // Smooth transition - use requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      resetViewport();
      setPanPosition({ x: 0, y: 0 });
    });
  };

  // Use refs exclusively for smooth performance - no state updates during interaction
  const panPositionRef = useRef({ x: 0, y: 0 });
  const zoomLevelRef = useRef(1);
  const isInteractingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const sliderHandleRef = useRef<HTMLDivElement>(null); // Ref for slider handle
  const isDraggingSliderRef = useRef(false);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const comparisonSplitRef = useRef(comparisonSplit); // Ref to track latest split value

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

  const iframeRefs = useRef<(HTMLIFrameElement | null)[]>([]);
  const initializedIframesRef = useRef<Set<HTMLIFrameElement>>(new Set()); // Track which iframes have been initialized

  // Clear initialized iframes when URL changes (new website loaded)
  useEffect(() => {
    initializedIframesRef.current.clear();
  }, [state.view.currentUrl]);

  /**
   * Load website using hybrid strategy:
   * 1. Direct Iframe: Fast, but subject to CSP/X-Frame-Options (default)
   * 2. Proxy Mode: Slower, but bypasses restrictions (user toggle)
   */
  /**
   * Load website using hybrid strategy:
   * 1. Direct Iframe: Fast, but subject to CSP/X-Frame-Options (default)
   * 2. Proxy Mode: Slower, but bypasses restrictions (user toggle)
   */
  const loadWebsite = async () => {
    if (!state.view.url.trim()) {
      dispatch({ type: 'SET_ERROR', payload: 'Please enter a URL' });
      return;
    }

    let targetUrl = state.view.url.trim();
    if (!targetUrl.match(/^https?:\/\//)) {
      targetUrl = 'https://' + targetUrl;
    }

    // Save to recent URLs
    storage.saveRecentUrl(targetUrl);
    storage.saveSettings({ lastUrl: targetUrl });

    // Always use Proxy Mode
    if (true) {
      // --- PROXY MODE ---
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      dispatch({ type: 'SET_HTML_CONTENT', payload: null });
      dispatch({ type: 'SET_CURRENT_URL', payload: null });

      try {
        const response = await apiService.proxyWebsite(targetUrl) as { html?: string; url?: string; status?: string; error?: string };

        if (response.error) {
          throw new Error(response.error);
        }
        if (!response.html) {
          throw new Error('No HTML content received from server');
        }

        dispatch({ type: 'SET_HTML_CONTENT', payload: response.html });
        dispatch({ type: 'SET_CURRENT_URL', payload: response.url || targetUrl });

      } catch (err: unknown) {
        console.error('Error loading website via proxy:', err);
        let errorMessage = 'Failed to load website.';
        if (err instanceof Error) errorMessage = err.message;
        if (typeof err === 'string') errorMessage = err;

        dispatch({ type: 'SET_ERROR', payload: errorMessage });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
  };

  // Comprehensive function to fix all asset URLs in an iframe
  const fixAllAssetUrls = useCallback((iframe: HTMLIFrameElement) => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      const proxyBase = window.location.origin;
      let originalBaseUrl = state.view.currentUrl || '';

      // Extract original website URL from base tag
      const baseTag = doc.querySelector('base');
      if (baseTag?.href) {
        const match = baseTag.href.match(/\/api\/proxy-path\/(https?:\/\/[^\/]+(?:\/.*)?)/);
        if (match && match[1]) {
          originalBaseUrl = match[1];
          if (!originalBaseUrl.endsWith('/')) {
            originalBaseUrl += '/';
          }
        }
      }

      if (!originalBaseUrl || (!originalBaseUrl.startsWith('http://') && !originalBaseUrl.startsWith('https://'))) {
        return;
      }

      // Helper function to fix relative URLs
      const fixRelativeUrl = (url: string): string => {
        if (!url || url.startsWith('http://') || url.startsWith('https://') ||
          url.startsWith('data:') || url.startsWith('blob:') ||
          url.startsWith('/api/proxy') || url.startsWith('#')) {
          return url;
        }
        try {
          const absoluteUrl = new URL(url, originalBaseUrl).href;
          return `${proxyBase}/api/proxy-path/${absoluteUrl}`;
        } catch (e) {
          return url;
        }
      };

      let fixedCount = 0;

      // Fix relative image sources (including srcset)
      doc.querySelectorAll('img').forEach((img: HTMLImageElement) => {
        const src = img.getAttribute('src');
        if (src) {
          const fixedSrc = fixRelativeUrl(src);
          if (fixedSrc !== src) {
            img.src = fixedSrc;
            fixedCount++;
          }
        }

        // Fix srcset attribute
        const srcset = img.getAttribute('srcset');
        if (srcset) {
          const fixedSrcset = srcset.split(',').map(part => {
            const trimmed = part.trim();
            const spaceIndex = trimmed.indexOf(' ');
            if (spaceIndex > 0) {
              const url = trimmed.substring(0, spaceIndex);
              const descriptor = trimmed.substring(spaceIndex);
              const fixedUrl = fixRelativeUrl(url);
              return fixedUrl !== url ? fixedUrl + descriptor : trimmed;
            } else {
              return fixRelativeUrl(trimmed);
            }
          }).join(', ');

          if (fixedSrcset !== srcset) {
            img.srcset = fixedSrcset;
            fixedCount++;
          }
        }
      });

      // Fix relative sources in other elements
      ['source', 'video', 'audio'].forEach(tagName => {
        doc.querySelectorAll(tagName).forEach((el: HTMLSourceElement | HTMLVideoElement | HTMLAudioElement) => {
          const src = el.getAttribute('src');
          if (src) {
            const fixedSrc = fixRelativeUrl(src);
            if (fixedSrc !== src) {
              el.src = fixedSrc;
              fixedCount++;
            }
          }

          // Fix srcset for source elements
          const srcset = el.getAttribute('srcset');
          if (srcset) {
            const fixedSrcset = srcset.split(',').map(part => {
              const trimmed = part.trim();
              const spaceIndex = trimmed.indexOf(' ');
              if (spaceIndex > 0) {
                const url = trimmed.substring(0, spaceIndex);
                const descriptor = trimmed.substring(spaceIndex);
                const fixedUrl = fixRelativeUrl(url);
                return fixedUrl !== url ? fixedUrl + descriptor : trimmed;
              } else {
                return fixRelativeUrl(trimmed);
              }
            }).join(', ');

            if (fixedSrcset !== srcset) {
              el.setAttribute('srcset', fixedSrcset);
              fixedCount++;
            }
          }
        });
      });

      // Fix relative links in stylesheets and other resources
      doc.querySelectorAll('link[href]').forEach((link: HTMLLinkElement) => {
        const href = link.getAttribute('href');
        if (href) {
          const fixedHref = fixRelativeUrl(href);
          if (fixedHref !== href) {
            link.href = fixedHref;
            fixedCount++;
          }
        }
      });

      // Fix relative script sources
      doc.querySelectorAll('script[src]').forEach((script: HTMLScriptElement) => {
        const src = script.getAttribute('src');
        if (src) {
          const fixedSrc = fixRelativeUrl(src);
          if (fixedSrc !== src) {
            script.src = fixedSrc;
            fixedCount++;
          }
        }
      });

      // Fix background images in inline styles
      doc.querySelectorAll('[style*="url("]').forEach((el: HTMLElement) => {
        const style = el.getAttribute('style');
        if (style) {
          const fixedStyle = style.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, url) => {
            const fixedUrl = fixRelativeUrl(url.trim());
            return fixedUrl !== url ? `url(${quote}${fixedUrl}${quote})` : match;
          });

          if (fixedStyle !== style) {
            el.setAttribute('style', fixedStyle);
            fixedCount++;
          }
        }
      });

      if (fixedCount > 0) {
        console.log(`Fixed ${fixedCount} asset URL(s) in iframe`);
      }
    } catch (e) {
      // Silently handle errors
    }
  }, [state.view.currentUrl]);

  const injectCustomCss = useCallback((iframe: HTMLIFrameElement) => {
    // Skip injection for "Original" frames in Comparison Mode
    if (iframe.getAttribute('data-mode') === 'original') return;

    let doc: Document | undefined;
    try {
      doc = iframe.contentDocument || iframe.contentWindow?.document || undefined;
    } catch (e) {
      setIsIframeRestricted(true);
      return;
    }

    if (!doc) {
      setIsIframeRestricted(true);
      return;
    }

    setIsIframeRestricted(false);

    if (!state.editor.customCss && !state.editor.typographyCss && state.editor.activeEffects.length === 0) return;

    const styleId = 'modify-style-custom-css';
    let styleEl = doc.getElementById(styleId) as HTMLStyleElement;
    if (styleEl) styleEl.remove();

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

    // Inject combined CSS with high specificity to override defaults
    if (combinedCss.trim()) {
      const style = doc.createElement('style');
      style.id = 'custom-injected-css';
      // Wrap CSS to ensure it overrides default styles
      style.textContent = `
        /* Injected Custom CSS - High Priority */
        ${combinedCss}
      `;
      // Append to head, or create head if it doesn't exist
      if (!doc.head) {
        const head = doc.createElement('head');
        doc.documentElement.insertBefore(head, doc.documentElement.firstChild);
      }
      doc.head.appendChild(style);
    }
  }, [state.editor.customCss, state.editor.activeEffects, state.editor.typographyCss, state.editor.colorMapping]);


  const [isEditMode, setIsEditMode] = useState(false);

  const toggleEditMode = () => {
    const newMode = !isEditMode;
    setIsEditMode(newMode);

    // Toggle designMode on all iframes
    iframeRefs.current.forEach(iframe => {
      if (iframe && iframe.getAttribute('data-mode') !== 'original') {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.designMode = newMode ? 'on' : 'off';
        }
      }
    });

    if (newMode) {
      dispatch({ type: 'SET_ERROR', payload: null }); // Clear any errors
    }
  };

  // Effect for Proxy Content injection
  useEffect(() => {
    if (state.view.htmlContent) {
      iframeRefs.current.forEach((iframe) => {
        if (!iframe) return;

        // Skip original iframes - they use src attribute and load naturally
        if (iframe.getAttribute('data-mode') === 'original') {
          return;
        }

        // Skip if this iframe has already been initialized (prevents reload on device mode/comparison mode toggle)
        if (initializedIframesRef.current.has(iframe)) {
          // Just re-inject CSS/styles if needed, don't reload
          injectCustomCss(iframe);
          return;
        }

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

        if (iframeDoc) {
          // Replace proxy URL placeholders with actual origin before writing
          const proxyBase = window.location.origin;
          const processedHtml = state.view.htmlContent!.replace(/\{\{PROXY_BASE\}\}/g, proxyBase);

          iframeDoc.open();
          iframeDoc.write(processedHtml);
          iframeDoc.close();

          // Mark as initialized
          initializedIframesRef.current.add(iframe);

          // Run the fix function multiple times to catch all assets
          // Immediate fix
          setTimeout(() => fixAllAssetUrls(iframe), 50);

          // After DOM is ready
          setTimeout(() => fixAllAssetUrls(iframe), 200);

          // After window load
          setTimeout(() => fixAllAssetUrls(iframe), 1000);

          // Also listen to iframe's window load event
          try {
            const iframeWindow = iframe.contentWindow;
            if (iframeWindow) {
              const handleIframeLoad = () => {
                setTimeout(() => fixAllAssetUrls(iframe), 100);
                setTimeout(() => fixAllAssetUrls(iframe), 500);
              };

              if (iframeWindow.document.readyState === 'complete') {
                handleIframeLoad();
              } else {
                iframeWindow.addEventListener('load', handleIframeLoad, { once: true });
              }

              // Set up MutationObserver to watch for dynamically added elements
              const observer = new MutationObserver((mutations) => {
                let shouldFix = false;
                mutations.forEach((mutation) => {
                  if (mutation.addedNodes.length > 0 || mutation.type === 'attributes') {
                    shouldFix = true;
                  }
                });
                if (shouldFix) {
                  setTimeout(() => fixAllAssetUrls(iframe), 100);
                }
              });

              // Start observing after a short delay
              setTimeout(() => {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (doc) {
                  observer.observe(doc.body || doc.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['src', 'href', 'srcset', 'style']
                  });
                }
              }, 500);
            }
          } catch (e) {
            // MutationObserver might fail in some cases, ignore
          }

          // Re-apply edit mode if active (only for modified frames)
          if (isEditMode) {
            iframeDoc.designMode = 'on';
          }

          injectCustomCss(iframe);
        }
      });
    }
  }, [state.view.htmlContent, isMultiView, isComparisonMode, injectCustomCss, isEditMode]);

  // Dedicated Effect for Edit Mode Toggling
  useEffect(() => {
    iframeRefs.current.forEach(iframe => {
      if (!iframe || iframe.getAttribute('data-mode') === 'original') return;
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.designMode = isEditMode ? 'on' : 'off';
        }
      } catch (e) { /* ignore cross-origin */ }
    });
  }, [isEditMode]);

  // Effect for Direct Iframe Injection (Load & Reference)
  useEffect(() => {
    const handleIframeLoad = (iframe: HTMLIFrameElement) => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc && iframeDoc.readyState === 'complete') {
          // Mark as initialized
          initializedIframesRef.current.add(iframe);

          // SKIP modifying original frame
          if (iframe.getAttribute('data-mode') === 'original') return;

          // Apply color replacements to DOM
          if (state.editor.colorMapping) {
            applyColorReplacementsToDOM(iframeDoc, state.editor.colorMapping);
          }
          // Apply Edit Mode
          if (isEditMode) {
            iframeDoc.designMode = 'on';
          }
          injectCustomCss(iframe);
        }
      } catch (e) {
        // Cross-origin iframe - cannot inject CSS
        console.warn('Cannot inject CSS into cross-origin iframe:', e);
        setIsIframeRestricted(true);
      }
    };

    // Set up load handlers for all iframes (Direct Mode)
    if (!state.view.htmlContent) {
      iframeRefs.current.forEach((iframe) => {
        if (!iframe) return;

        // Skip if already initialized (prevents reload on comparison mode toggle)
        if (initializedIframesRef.current.has(iframe)) {
          // Just re-inject CSS/styles if needed
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc && iframeDoc.readyState === 'complete') {
              if (iframe.getAttribute('data-mode') !== 'original' && state.editor.colorMapping) {
                applyColorReplacementsToDOM(iframeDoc, state.editor.colorMapping);
              }
              injectCustomCss(iframe);
            }
          } catch (e) {
            // Ignore cross-origin errors
          }
          return;
        }

        // If iframe already loaded, inject immediately
        if (iframe.contentDocument?.readyState === 'complete') {
          handleIframeLoad(iframe);
        } else {
          // Otherwise, wait for load event
          iframe.addEventListener('load', () => handleIframeLoad(iframe), { once: true });
        }
      });
    }

  }, [state.view.currentUrl, state.view.htmlContent, isMultiView, isComparisonMode, injectCustomCss, isEditMode, state.editor.colorMapping]);

  // Separate Effect for Style Injection - ONLY re-runs when styles change
  useEffect(() => {
    iframeRefs.current.forEach((iframe) => {
      if (!iframe) return;
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        // Check if document is ready to accept styles
        if (iframeDoc && (iframeDoc.readyState === 'complete' || state.view.htmlContent)) {
          // Re-apply mappings if they change (Skip Original)
          if (state.editor.colorMapping && iframe.getAttribute('data-mode') !== 'original') {
            applyColorReplacementsToDOM(iframeDoc, state.editor.colorMapping);
          }
          injectCustomCss(iframe);
        }
      } catch (e) {
        // Cross-origin
      }
    });
  }, [injectCustomCss, state.editor.customCss, state.editor.typographyCss, state.editor.activeEffects, state.editor.colorMapping]);

  // Effect for Scroll Synchronization in Comparison Mode - Bidirectional sync
  // Works in both single and multi-view modes
  // Both Modified and Original frames scroll together for effective comparison
  useEffect(() => {
    if (!isComparisonMode) return;

    // Get the Modified (Source) and Original (Target) frames
    // In single view: Modified is at [0] and Original at [1]
    // In multi-view: Modified frames are at [0,1,2] and Original frames at [10,11,12]
    const modifiedFrame = iframeRefs.current[0];
    const originalFrame = isMultiView ? iframeRefs.current[10] : iframeRefs.current[1];

    if (!modifiedFrame || !originalFrame) return;

    // Use separate flags for each direction to prevent infinite loops
    let isSyncingFromModified = false;
    let isSyncingFromOriginal = false;
    let rafIdModified: number | null = null;
    let rafIdOriginal: number | null = null;

    // Function to sync scroll from Modified to Original
    const handleScrollFromModified = () => {
      if (isSyncingFromModified || isSyncingFromOriginal) return;

      try {
        const srcWindow = modifiedFrame.contentWindow;
        const tgtWindow = originalFrame.contentWindow;
        const srcDoc = modifiedFrame.contentDocument || srcWindow?.document;

        if (srcWindow && tgtWindow && srcDoc) {
          if (rafIdModified !== null) {
            cancelAnimationFrame(rafIdModified);
          }

          isSyncingFromModified = true;

          rafIdModified = requestAnimationFrame(() => {
            try {
              const scrollTop = srcWindow.scrollY || srcDoc.documentElement.scrollTop || srcDoc.body.scrollTop || 0;
              const scrollLeft = srcWindow.scrollX || srcDoc.documentElement.scrollLeft || srcDoc.body.scrollLeft || 0;

              tgtWindow.scrollTo({
                top: scrollTop,
                left: scrollLeft,
                behavior: 'instant'
              });
            } catch (e) {
              // Ignore cross-origin errors
            } finally {
              isSyncingFromModified = false;
              rafIdModified = null;
            }
          });
        }
      } catch (e) {
        isSyncingFromModified = false;
        if (rafIdModified !== null) {
          cancelAnimationFrame(rafIdModified);
          rafIdModified = null;
        }
      }
    };

    // Function to sync scroll from Original to Modified (bidirectional)
    const handleScrollFromOriginal = () => {
      if (isSyncingFromOriginal || isSyncingFromModified) return;

      try {
        const srcWindow = originalFrame.contentWindow;
        const tgtWindow = modifiedFrame.contentWindow;
        const srcDoc = originalFrame.contentDocument || srcWindow?.document;

        if (srcWindow && tgtWindow && srcDoc) {
          if (rafIdOriginal !== null) {
            cancelAnimationFrame(rafIdOriginal);
          }

          isSyncingFromOriginal = true;

          rafIdOriginal = requestAnimationFrame(() => {
            try {
              const scrollTop = srcWindow.scrollY || srcDoc.documentElement.scrollTop || srcDoc.body.scrollTop || 0;
              const scrollLeft = srcWindow.scrollX || srcDoc.documentElement.scrollLeft || srcDoc.body.scrollLeft || 0;

              tgtWindow.scrollTo({
                top: scrollTop,
                left: scrollLeft,
                behavior: 'instant'
              });
            } catch (e) {
              // Ignore cross-origin errors
            } finally {
              isSyncingFromOriginal = false;
              rafIdOriginal = null;
            }
          });
        }
      } catch (e) {
        isSyncingFromOriginal = false;
        if (rafIdOriginal !== null) {
          cancelAnimationFrame(rafIdOriginal);
          rafIdOriginal = null;
        }
      }
    };

    // Enhanced attachment function with retry logic - bidirectional
    const attachListeners = () => {
      let bothReady = false;

      try {
        const modWin = modifiedFrame.contentWindow;
        const modDoc = modifiedFrame.contentDocument || modWin?.document;
        const origWin = originalFrame.contentWindow;
        const origDoc = originalFrame.contentDocument || origWin?.document;

        // Check if both frames are ready
        if (modWin && modDoc && origWin && origDoc && 
            (modDoc.readyState === 'complete' || modDoc.readyState === 'interactive') &&
            (origDoc.readyState === 'complete' || origDoc.readyState === 'interactive')) {
          
          // Remove any existing listeners first
          modWin.removeEventListener('scroll', handleScrollFromModified);
          modDoc.removeEventListener('scroll', handleScrollFromModified, true);
          modWin.removeEventListener('wheel', handleScrollFromModified);
          
          origWin.removeEventListener('scroll', handleScrollFromOriginal);
          origDoc.removeEventListener('scroll', handleScrollFromOriginal, true);
          origWin.removeEventListener('wheel', handleScrollFromOriginal);

          // Attach listeners to Modified frame (syncs to Original)
          modWin.addEventListener('scroll', handleScrollFromModified, { passive: true, capture: false });
          modDoc.addEventListener('scroll', handleScrollFromModified, { passive: true, capture: true });
          if (modDoc.body) {
            modDoc.body.addEventListener('scroll', handleScrollFromModified, { passive: true, capture: true });
          }
          modWin.addEventListener('wheel', handleScrollFromModified, { passive: true, capture: false });

          // Attach listeners to Original frame (syncs to Modified) - bidirectional
          origWin.addEventListener('scroll', handleScrollFromOriginal, { passive: true, capture: false });
          origDoc.addEventListener('scroll', handleScrollFromOriginal, { passive: true, capture: true });
          if (origDoc.body) {
            origDoc.body.addEventListener('scroll', handleScrollFromOriginal, { passive: true, capture: true });
          }
          origWin.addEventListener('wheel', handleScrollFromOriginal, { passive: true, capture: false });

          // Initial sync after a brief delay to ensure both frames are ready
          setTimeout(() => {
            handleScrollFromModified();
          }, 150);

          bothReady = true;
        }
      } catch (e) {
        // Cross-origin or not ready
      }
      return bothReady;
    };

    // Try to attach immediately
    if (!attachListeners()) {
      // Retry when iframes load
      const loadHandlerModified = () => {
        attachListeners();
      };
      const loadHandlerOriginal = () => {
        attachListeners();
      };
      
      modifiedFrame.addEventListener('load', loadHandlerModified);
      originalFrame.addEventListener('load', loadHandlerOriginal);

      // Also retry after a delay in case load event already fired
      const retryTimeout = setTimeout(() => {
        attachListeners();
      }, 500);

      return () => {
        clearTimeout(retryTimeout);
        modifiedFrame.removeEventListener('load', loadHandlerModified);
        originalFrame.removeEventListener('load', loadHandlerOriginal);
        
        // Cleanup listeners
        try {
          const modWin = modifiedFrame.contentWindow;
          const modDoc = modifiedFrame.contentDocument || modWin?.document;
          const origWin = originalFrame.contentWindow;
          const origDoc = originalFrame.contentDocument || origWin?.document;
          
          if (modWin) {
            modWin.removeEventListener('scroll', handleScrollFromModified);
            modWin.removeEventListener('wheel', handleScrollFromModified);
          }
          if (modDoc) {
            modDoc.removeEventListener('scroll', handleScrollFromModified, true);
            if (modDoc.body) {
              modDoc.body.removeEventListener('scroll', handleScrollFromModified, true);
            }
          }
          
          if (origWin) {
            origWin.removeEventListener('scroll', handleScrollFromOriginal);
            origWin.removeEventListener('wheel', handleScrollFromOriginal);
          }
          if (origDoc) {
            origDoc.removeEventListener('scroll', handleScrollFromOriginal, true);
            if (origDoc.body) {
              origDoc.body.removeEventListener('scroll', handleScrollFromOriginal, true);
            }
          }
        } catch (e) {
          // Ignore cleanup errors
        }
        
        if (rafIdModified !== null) {
          cancelAnimationFrame(rafIdModified);
        }
        if (rafIdOriginal !== null) {
          cancelAnimationFrame(rafIdOriginal);
        }
      };
    }

    return () => {
      // Cleanup listeners
      try {
        const modWin = modifiedFrame.contentWindow;
        const modDoc = modifiedFrame.contentDocument || modWin?.document;
        const origWin = originalFrame.contentWindow;
        const origDoc = originalFrame.contentDocument || origWin?.document;
        
        if (modWin) {
          modWin.removeEventListener('scroll', handleScrollFromModified);
          modWin.removeEventListener('wheel', handleScrollFromModified);
        }
        if (modDoc) {
          modDoc.removeEventListener('scroll', handleScrollFromModified, true);
          if (modDoc.body) {
            modDoc.body.removeEventListener('scroll', handleScrollFromModified, true);
          }
        }
        
        if (origWin) {
          origWin.removeEventListener('scroll', handleScrollFromOriginal);
          origWin.removeEventListener('wheel', handleScrollFromOriginal);
        }
        if (origDoc) {
          origDoc.removeEventListener('scroll', handleScrollFromOriginal, true);
          if (origDoc.body) {
            origDoc.body.removeEventListener('scroll', handleScrollFromOriginal, true);
          }
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      
      if (rafIdModified !== null) {
        cancelAnimationFrame(rafIdModified);
      }
      if (rafIdOriginal !== null) {
        cancelAnimationFrame(rafIdOriginal);
      }
    };
  }, [isComparisonMode, isMultiView, state.view.currentUrl, state.view.htmlContent]); // Re-bind when content changes or mode changes

  // Sync comparisonSplit to ref and update DOM when not dragging
  // Works for both single and multi-view modes
  useEffect(() => {
    comparisonSplitRef.current = comparisonSplit;

    // Only update DOM if not currently dragging (to avoid conflicts)
    if (!isDraggingSliderRef.current) {
      if (sliderHandleRef.current) {
        sliderHandleRef.current.style.left = `${comparisonSplit}%`;
      }
      // Update all original frames (single view uses [1], multi-view uses [10,11,12])
      if (isMultiView) {
        [10, 11, 12].forEach(idx => {
          const frame = iframeRefs.current[idx];
          if (frame) {
            frame.style.clipPath = `inset(0 ${100 - comparisonSplit}% 0 0)`;
          }
        });
      } else {
        const originalFrame = iframeRefs.current[1];
        if (originalFrame) {
          originalFrame.style.clipPath = `inset(0 ${100 - comparisonSplit}% 0 0)`;
        }
      }
    }
  }, [comparisonSplit, isMultiView]);

  // Ultra-smooth slider using direct DOM updates (NO RAF, NO delays)
  // Works in single view mode (slider handle only available in single view)
  useEffect(() => {
    if (!isComparisonMode) return;
    if (isMultiView) return; // Slider handle only in single view
    if (!sliderHandleRef.current || !sliderContainerRef.current) return;

    const handle = sliderHandleRef.current;
    const container = sliderContainerRef.current;
    const dragStateRef = {
      isActive: false,
      isDragging: false, // Track if actually dragging (vs just clicking)
      startX: 0,
      startY: 0,
      startSplit: 0,
      currentSplit: 0,
      containerWidth: 0, // Cache container width
      dragThreshold: 5, // Minimum pixels to move before considering it a drag
    };

    // Direct synchronous update - no RAF, no delays, instant response
    const updatePosition = (split: number) => {
      dragStateRef.currentSplit = split;

        // Immediate DOM updates - this is what makes it smooth
        // Works for both single and multi-view modes
        if (handle) {
          handle.style.left = `${split}%`;
        }
        if (isMultiView) {
          // Update all original frames in multi-view
          [10, 11, 12].forEach(idx => {
            const frame = iframeRefs.current[idx];
            if (frame) {
              frame.style.clipPath = `inset(0 ${100 - split}% 0 0)`;
            }
          });
        } else {
          // Update single original frame
          const originalFrame = iframeRefs.current[1];
          if (originalFrame) {
            originalFrame.style.clipPath = `inset(0 ${100 - split}% 0 0)`;
          }
        }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStateRef.isActive) return;

      const deltaX = Math.abs(e.clientX - dragStateRef.startX);
      const deltaY = Math.abs(e.clientY - dragStateRef.startY);

      // If vertical movement is greater than horizontal, it's a scroll - don't interfere
      if (!dragStateRef.isDragging && deltaY > deltaX && deltaY > dragStateRef.dragThreshold) {
        // User is scrolling, cancel drag and allow scroll
        dragStateRef.isActive = false;
        dragStateRef.isDragging = false;
        isDraggingSliderRef.current = false;
        handle.releasePointerCapture(e.pointerId);
        document.removeEventListener('pointermove', handlePointerMove, { capture: true });
        document.removeEventListener('pointerup', handlePointerUp, { capture: true });
        handle.style.cursor = 'ew-resize';
        return; // Allow scroll to happen naturally
      }

      // If horizontal movement exceeds threshold, start dragging
      if (!dragStateRef.isDragging && deltaX > dragStateRef.dragThreshold) {
        dragStateRef.isDragging = true;
        isDraggingSliderRef.current = true;
        // Now prevent text selection since we're dragging
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ew-resize';
      }

      // Only prevent default and update slider if actually dragging horizontally
      if (dragStateRef.isDragging) {
        e.preventDefault();
        e.stopPropagation();

        // Use cached container width (only recalc if container resized)
        const currentWidth = container.offsetWidth;
        if (currentWidth !== dragStateRef.containerWidth) {
          dragStateRef.containerWidth = currentWidth;
        }
        const containerWidth = dragStateRef.containerWidth || 1;

        // Calculate delta from start position
        const deltaXValue = e.clientX - dragStateRef.startX;
        const deltaPercent = (deltaXValue / containerWidth) * 100;
        const newSplit = Math.min(100, Math.max(0, dragStateRef.startSplit + deltaPercent));

        // DIRECT UPDATE - no RAF, no batching, instant response
        updatePosition(newSplit);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!dragStateRef.isActive) return;

      // Only prevent default if we were actually dragging
      if (dragStateRef.isDragging) {
        e.preventDefault();
        e.stopPropagation();

        // Update React state only on release (prevents re-renders during drag)
        setComparisonSplit(dragStateRef.currentSplit);
        comparisonSplitRef.current = dragStateRef.currentSplit;
      }

      dragStateRef.isActive = false;
      dragStateRef.isDragging = false;
      isDraggingSliderRef.current = false;

      handle.releasePointerCapture(e.pointerId);
      document.removeEventListener('pointermove', handlePointerMove, { capture: true });
      document.removeEventListener('pointerup', handlePointerUp, { capture: true });
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      handle.style.cursor = 'ew-resize';
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Only handle primary pointer (left mouse button or first touch)
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      // Only prevent default if clicking directly on the handle (not on the iframe behind it)
      // This allows scrolling to work when clicking elsewhere
      const target = e.target as HTMLElement;
      if (!target.closest('.comparison-slider-handle')) {
        return; // Allow the event to bubble for scrolling
      }

      // Don't prevent default yet - wait to see if it's a drag or scroll
      // This allows scrolling to work if user scrolls vertically
      e.stopPropagation();

      // Cache container width on drag start
      dragStateRef.containerWidth = container.offsetWidth || 1;
      dragStateRef.startX = e.clientX;
      dragStateRef.startY = e.clientY;
      dragStateRef.startSplit = comparisonSplitRef.current;
      dragStateRef.currentSplit = comparisonSplitRef.current;
      dragStateRef.isActive = true;
      dragStateRef.isDragging = false; // Not dragging yet, just clicked
      isDraggingSliderRef.current = false; // Only set to true when actually dragging

      // Capture pointer for smooth tracking
      handle.setPointerCapture(e.pointerId);

      // Set cursor but don't prevent text selection yet (wait for actual drag)
      handle.style.cursor = 'ew-resize';

      // Use capture phase for better event handling
      // Use passive: false so we can preventDefault when dragging, but we'll only do it when actually dragging
      document.addEventListener('pointermove', handlePointerMove, { passive: false, capture: true });
      document.addEventListener('pointerup', handlePointerUp, { passive: false, capture: true });
    };

    // Use pointer events (works for mouse, touch, pen)
    handle.addEventListener('pointerdown', handlePointerDown);

    return () => {
      handle.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove, { capture: true });
      document.removeEventListener('pointerup', handlePointerUp, { capture: true });
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      dragStateRef.isActive = false;
      isDraggingSliderRef.current = false;
    };
  }, [isComparisonMode]);

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

  const [isRotated, setIsRotated] = useState(false);

  const handleFitToScreen = () => {
    // Calculate best fit
    const frame = frameRef.current;
    if (frame && canvasContainerRef.current) {
      const containerRect = canvasContainerRef.current.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      // Remove zoom from calculation to get natural size
      const currentZoom = zoomLevelRef.current;
      const naturalWidth = frameRect.width / currentZoom;
      const naturalHeight = frameRect.height / currentZoom;

      const padding = 80; // Safety margin
      const scaleX = (containerRect.width - padding) / naturalWidth;
      const scaleY = (containerRect.height - padding) / naturalHeight;
      const fitScale = Math.min(scaleX, scaleY, 1); // Don't scale up past 100% implicitly

      dispatch({ type: 'SET_ZOOM_LEVEL', payload: fitScale });
      dispatch({ type: 'SET_PAN_POSITION', payload: { x: 0, y: 0 } });
      resetViewport(); // Ensure refs are synced
    }
  };

  // Helper to render a single device frame
  const renderFrame = (mode: string, index: number, customConfig?: CustomDevice | null) => {
    const isCustom = mode.startsWith('custom-');
    const config = isCustom ? null : DEFAULT_DEVICES[mode];
    const isMobileOrTablet = mode === 'mobile' || mode === 'tablet' || (customConfig && (customConfig.type === 'mobile' || customConfig.type === 'tablet'));

    // Determine dimensions
    let width = '100%';
    let height = '100%';

    if (state.viewport.isFullView) {
      width = '100%';
      height = '100%';
    } else if (customConfig) {
      width = `${customConfig.width}px`;
      height = `${customConfig.height}px`;
    } else if (config) {
      width = config.width;
      height = config.height;
    }

    // Apply rotation
    if (isRotated && isMobileOrTablet) {
      const temp = width;
      width = height;
      height = temp;
    }

    // Determine frame class
    const frameClass = `frame-wrapper ${customConfig ? customConfig.type : mode} ${state.viewport.isFullView ? 'full-view-frame' : ''}`;

    // Calculate transform
    // In Multi-view, the transform is applied to the container, not individual frames
    // In Single-view, it's applied to the frame
    const transformStyle = isMultiView
      ? undefined
      : (isDragging
        ? `translate3d(${panPositionRef.current.x}px, ${panPositionRef.current.y}px, 0) scale(${zoomLevelRef.current})`
        : `translate3d(${state.viewport.panPosition.x}px, ${state.viewport.panPosition.y}px, 0) scale(${state.viewport.zoomLevel})`);

    return (
      <div
        key={`${mode}-${index}`}
        ref={isMultiView ? null : frameRef} // Only attach main frame ref in single view for direct manipulation
        className={frameClass}
        style={{
          width,
          height,
          transform: !isMultiView ? transformStyle : undefined,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          willChange: isDragging ? 'transform' : 'auto',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          perspective: 1000,
          margin: isMultiView ? '0 40px' : 0 // Add spacing in multi-view
        }}
      >
        {/* Helper Actions for Frame */}
        {!isMultiView && !state.viewport.isFullView && (
          <div className="frame-actions" style={{
            position: 'absolute',
            top: '-40px',
            right: 0,
            display: 'flex',
            gap: '8px',
            background: 'rgba(20,20,25,0.8)',
            padding: '4px 8px',
            borderRadius: '8px',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div className="device-label" style={{ marginRight: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
              {customConfig ? customConfig.name : config?.label}
            </div>

            {isMobileOrTablet && (
              <button
                className={`action-button ${isRotated ? 'active' : ''}`}
                onClick={() => setIsRotated(!isRotated)}
                title="Rotate Orientation"
                style={{ width: '24px', height: '24px' }}
              >
                <RotateCcw size={14} />
              </button>
            )}

            <button
              className="action-button"
              onClick={handleFitToScreen}
              title="Fit to Screen"
              style={{ width: '24px', height: '24px' }}
            >
              <Minimize2 size={14} />
            </button>

            <button
              className="action-button"
              onClick={toggleFullView}
              title="Enter Full View"
              style={{ width: '24px', height: '24px' }}
            >
              <Maximize2 size={14} />
            </button>
          </div>
        )}
        {state.viewport.isFullView && (
          <button
            className="full-view-exit-btn"
            onClick={toggleFullView}
          >
            <Minimize2 size={16} /> Exit Full View
          </button>
        )}
        <div
          ref={isComparisonMode ? sliderContainerRef : null}
          className="iframe-container"
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            overflow: 'hidden' // Prevent container scroll, let iframe handle it
          }}
        >
          {/* Normal / Modified Frame */}
          <iframe
            ref={(el) => {
              if (isComparisonMode) {
                // In Comparison Mode (Single View), store modified at 0
                iframeRefs.current[0] = el;
              } else {
                iframeRefs.current[index] = el;
              }
            }}
            className="website-iframe"
            title={`Site Preview - ${mode}`}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            data-mode="modified"
            src={!state.view.htmlContent ? state.view.currentUrl || undefined : undefined}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: 'white',
              overflow: 'auto', // Ensure iframe can scroll
              display: 'block'
            }}
            onLoad={(e) => {
              const iframe = e.currentTarget;
              // Mark as initialized to prevent reload on comparison mode toggle
              initializedIframesRef.current.add(iframe);
              try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc) {
                  if (state.editor.colorMapping) {
                    applyColorReplacementsToDOM(iframeDoc, state.editor.colorMapping);
                  }
                  injectCustomCss(iframe);

                  // Fix asset URLs after iframe loads
                  setTimeout(() => fixAllAssetUrls(iframe), 100);
                  setTimeout(() => fixAllAssetUrls(iframe), 500);
                  setTimeout(() => fixAllAssetUrls(iframe), 1500);
                }
              } catch (err) { }
            }}
          />

          {/* Comparison: Original Frame Overlay - Works in all modes */}
          {isComparisonMode && (
            <>
              <iframe
                key={`original-frame-${mode}-${index}`}
                ref={(el) => {
                  // Store original frames - use index + 10 to avoid conflicts with modified frames
                  if (isMultiView) {
                    iframeRefs.current[index + 10] = el;
                  } else {
                    iframeRefs.current[1] = el;
                  }
                }}
                className="website-iframe"
                title="Original Preview"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                data-mode="original"
                src={state.view.currentUrl || undefined}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 2,
                  clipPath: `inset(0 ${100 - comparisonSplit}% 0 0)`, // Clip from right
                  backgroundColor: 'white',
                  pointerEvents: 'none', // Let interactions pass to base frame - scroll handled by sync
                  overflow: 'auto' // Ensure scrolling is enabled
                }}
              />

              {/* Slider Handle - Ultra-smooth direct DOM updates - Works in single view mode */}
              {!isMultiView && (
                <div
                  ref={sliderHandleRef}
                  className="comparison-slider-handle"
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${comparisonSplit}%`,
                    width: '4px',
                    background: '#3b82f6',
                    zIndex: 10,
                    cursor: 'ew-resize',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    touchAction: 'pan-y pinch-zoom', // Allow vertical scrolling and pinch zoom
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    // GPU acceleration for smooth movement
                    willChange: 'left',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    // Prevent any delays
                    transition: 'none',
                    // Allow pointer events
                    pointerEvents: 'auto'
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    background: '#3b82f6',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
                    color: 'white',
                    pointerEvents: 'auto', // Make the knob itself interactive
                    transition: 'transform 0.1s ease'
                  }}>
                    <SplitSquareHorizontal size={14} />
                  </div>
                </div>
              )}

              <div style={{
                position: 'absolute', top: '10px', left: '10px',
                background: 'rgba(0,0,0,0.7)', color: 'white',
                padding: '4px 8px', borderRadius: '4px', fontSize: '12px', zIndex: 20,
                pointerEvents: 'none'
              }}>Original</div>

              <div style={{
                position: 'absolute', top: '10px', right: '10px',
                background: 'rgba(59, 130, 246, 0.9)', color: 'white',
                padding: '4px 8px', borderRadius: '4px', fontSize: '12px', zIndex: 20,
                pointerEvents: 'none'
              }}>Modified</div>
            </>
          )}
        </div>

        {/* Device Label for Multi-View */}
        {isMultiView && (
          <div style={{
            position: 'absolute',
            top: '-30px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '12px',
            fontWeight: 500,
            whiteSpace: 'nowrap'
          }}>
            {customConfig ? customConfig.name : config?.label}
          </div>
        )}
      </div>
    );
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
                  effectMode={state.editor.effectMode || 'multi'}
                  onToggleEffect={toggleEffect}
                  onSetEffectMode={setEffectMode}
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
              className={`action-button ${isEditMode ? 'active' : ''}`}
              onClick={toggleEditMode}
              title={isEditMode ? 'Disable Live Edit' : 'Enable Live Edit (Edit text directly)'}
            >
              <span>{isEditMode ? <Edit size={16} /> : <Edit size={16} />}</span>
            </button>

            <button
              className="action-button"
              onClick={loadWebsite}
              disabled={state.view.loading}
              title="Load Website"
            >
              <span>{state.view.loading ? <RotateCcw className="spin" size={16} /> : <Search size={16} />}</span>
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
        {state.view.error ? (
          <div className="error-state">
            <div className="error-icon">!</div>
            <h3>Unable to Load</h3>
            <p>{state.view.error}</p>
          </div>
        ) : !state.view.currentUrl ? (
          <div className="empty-state">
            <h2>Design. Prototype. Build.</h2>
            <p>Enter a URL to start customizing the web.</p>
          </div>
        ) : (
          /* Multi-View vs Single View Rendering */
          isMultiView ? (
            <div
              ref={frameRef} // Attach logic ref to container for multi-view
              className="multi-view-container"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: isDragging
                  ? `translate3d(${panPositionRef.current.x}px, ${panPositionRef.current.y}px, 0) scale(${zoomLevelRef.current})`
                  : `translate3d(${state.viewport.panPosition.x}px, ${state.viewport.panPosition.y}px, 0) scale(${state.viewport.zoomLevel})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                willChange: isDragging ? 'transform' : 'auto',
              }}
            >
              {renderFrame('mobile', 0)}
              {renderFrame('tablet', 1)}
              {renderFrame('laptop', 2)}
            </div>
          ) : (
            renderFrame(currentDeviceMode, 0, currentCustomDevice)
          )
        )}
      </div>

      {/* Floating Dock (Bottom) */}
      {!state.viewport.isFullView && (
        <div className="dock-container">
          {/* Multi-View Toggle */}
          <button
            className={`dock-item ${isMultiView ? 'active' : ''}`}
            onClick={toggleMultiView}
            title="Multi-Device View"
          >
            <Layout size={20} strokeWidth={1.5} />
            <span className="dock-tooltip">Multi-View</span>
          </button>

          <div className="dock-divider"></div>

          {Object.entries(DEFAULT_DEVICES).map(([mode, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={mode}
                className={`dock-item ${!isMultiView && currentDeviceMode === mode ? 'active' : ''}`}
                onClick={() => {
                  if (isMultiView) toggleMultiView();
                  handleDeviceModeChange(mode);
                }}
                disabled={isMultiView}
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
                className={`dock-item custom-device ${!isMultiView && currentDeviceMode === modeKey ? 'active' : ''}`}
                onClick={() => {
                  if (isMultiView) toggleMultiView();
                  handleDeviceModeChange(modeKey);
                }}
                title={`${custom.name} (${custom.width}×${custom.height})`}
                disabled={isMultiView}
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
            title="CSS Editor"
          >
            <Code2 size={20} strokeWidth={1.5} />
            <span className="dock-tooltip">CSS Editor</span>
          </button>

          <button
            className={`dock-item ${state.editor.showInspector ? 'active' : ''}`}
            onClick={toggleInspector}
            title="Element Inspector"
          >
            <Eye size={20} strokeWidth={1.5} />
            <span className="dock-tooltip">Element Inspector</span>
          </button>

          <div className="dock-divider"></div>

          <div className="dock-divider"></div>

          <button
            className={`dock-item ${isComparisonMode ? 'active' : ''}`}
            onClick={() => {
              // Comparison mode now works in both single and multi-view
              setIsComparisonMode(!isComparisonMode);
            }}
            title="Comparison Slider (Before/After) - Works in all modes"
          >
            <SplitSquareHorizontal size={20} strokeWidth={1.5} />
            <span className="dock-tooltip">Compare</span>
          </button>

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
