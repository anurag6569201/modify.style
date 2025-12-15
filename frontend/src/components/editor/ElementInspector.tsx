import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Copy, Eye, EyeOff, MousePointer2, ChevronUp, ChevronDown, Edit3, Box, Info, Layers, Zap, GitBranch } from 'lucide-react';
import { generateSelector, generateSimpleSelector } from '../../utils/selectorGenerator';
import { StyleEditor, BoxModelViewer } from './';
import '../../assets/css/editor/ElementInspector.css';

interface ElementInfo {
  tag: string;
  id: string | null;
  classes: string[];
  attributes: Record<string, string>;
  inlineStyles: Record<string, string>;
  computedStyles: Record<string, string>;
  dimensions: {
    width: number;
    height: number;
    top: number;
    left: number;
    bottom: number;
    right: number;
  };
  parent: string | null;
  children: number;
  textContent: string;
  innerHTML: string;
  context?: string; // Contextual information
  similarSelector?: string; // Selector for similar items
}

type TabType = 'info' | 'styles' | 'boxmodel';

export default function ElementInspector() {
  const { state, dispatch } = useApp();
  const [elementInfo, setElementInfo] = useState<ElementInfo | null>(null);
  const [highlighted, setHighlighted] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    styles: true,
    dimensions: true,
    attributes: false,
    html: false,
  });
  const [showElementTree, setShowElementTree] = useState(false);
  const [elementPath, setElementPath] = useState<Array<{ tag: string; id?: string; classes?: string[] }>>([]);
  const elementRef = useRef<HTMLElement | null>(null);

  // Get contextual information about the element
  const getElementContext = (
    element: Element,
    computed: CSSStyleDeclaration,
    attributes: Record<string, string>
  ): string => {
    const tag = element.tagName.toLowerCase();
    const role = attributes.role || '';
    const ariaLabel = attributes['aria-label'] || '';
    const className = element.className || '';
    const id = element.id || '';

    // Check for navigation
    if (tag === 'nav' || role === 'navigation' || className.toLowerCase().includes('nav') || id.toLowerCase().includes('nav')) {
      return 'Navigation';
    }

    // Check for header
    if (tag === 'header' || role === 'banner' || className.toLowerCase().includes('header') || id.toLowerCase().includes('header')) {
      return 'Header';
    }

    // Check for footer
    if (tag === 'footer' || role === 'contentinfo' || className.toLowerCase().includes('footer') || id.toLowerCase().includes('footer')) {
      return 'Footer';
    }

    // Check for button
    if (tag === 'button' || role === 'button' || (tag === 'a' && className.toLowerCase().includes('btn')) || className.toLowerCase().includes('button')) {
      return 'Button';
    }

    // Check for link
    if (tag === 'a' && attributes.href) {
      return 'Link';
    }

    // Check for image
    if (tag === 'img' || tag === 'picture') {
      return 'Image';
    }

    // Check for form elements
    if (['input', 'textarea', 'select', 'form'].includes(tag)) {
      return tag === 'form' ? 'Form' : `Form Input (${tag})`;
    }

    // Check for heading
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      return `Heading (${tag.toUpperCase()})`;
    }

    // Check for list
    if (['ul', 'ol', 'li'].includes(tag)) {
      return tag === 'li' ? 'List Item' : 'List';
    }

    // Check for article/section
    if (tag === 'article' || role === 'article') {
      return 'Article';
    }
    if (tag === 'section' || role === 'region') {
      return 'Section';
    }

    // Check for main content
    if (tag === 'main' || role === 'main') {
      return 'Main Content';
    }

    // Check for sidebar
    if (tag === 'aside' || role === 'complementary' || className.toLowerCase().includes('sidebar')) {
      return 'Sidebar';
    }

    // Check for container
    if (computed.display === 'flex' || computed.display === 'grid') {
      return `Container (${computed.display})`;
    }

    // Check for text content
    if (['p', 'span', 'div'].includes(tag) && element.textContent && element.textContent.trim().length > 0) {
      if (computed.fontSize && parseFloat(computed.fontSize) > 18) {
        return 'Large Text';
      }
      return 'Text Content';
    }

    // Default based on display
    if (computed.display === 'block') {
      return 'Block Element';
    }
    if (computed.display === 'inline-block' || computed.display === 'inline') {
      return 'Inline Element';
    }

    return 'Element';
  };

  // Select all similar items
  const selectSimilarItems = useCallback(() => {
    if (!elementInfo?.similarSelector || !state.view.htmlContent) return;

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe) return;

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;

      // Find all elements matching the similar selector
      const similarElements = iframeDoc.querySelectorAll(elementInfo.similarSelector);
      
      if (similarElements.length > 0) {
        // Highlight all similar elements
        similarElements.forEach((el) => {
          if (el instanceof HTMLElement) {
            const originalOutline = el.style.outline;
            el.style.outline = '2px solid #646cff';
            el.style.outlineOffset = '2px';
            
            // Store original outline to restore later
            (el as any).__originalOutline = originalOutline;
          }
        });

        // Show notification
        console.log(`Selected ${similarElements.length} similar items`);
        
        // Store the selector in state for potential bulk editing
        // For now, we'll just highlight them
      }
    } catch (err) {
      console.error('Error selecting similar items:', err);
    }
  }, [elementInfo, state.view.htmlContent]);

  // Clear similar item highlights
  const clearSimilarHighlights = useCallback(() => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe) return;

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;

      const allElements = iframeDoc.querySelectorAll('*');
      allElements.forEach((el) => {
        if (el instanceof HTMLElement && (el as any).__originalOutline !== undefined) {
          el.style.outline = (el as any).__originalOutline;
          delete (el as any).__originalOutline;
        }
      });
    } catch (err) {
      // Ignore
    }
  }, []);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    const newMode = !selectionMode;
    setSelectionMode(newMode);

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe) return;

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;

      // Inject or remove selection script
      if (newMode) {
        injectSelectionScript(iframeDoc);
      } else {
        removeSelectionScript(iframeDoc);
      }
    } catch (err) {
      console.error('Error toggling selection mode:', err);
    }
  }, [selectionMode]);

  // Inject selection script into iframe
  const injectSelectionScript = (doc: Document) => {
    // Remove existing script
    const existing = doc.getElementById('__inspector_selection_script');
    if (existing) existing.remove();

    const script = doc.createElement('script');
    script.id = '__inspector_selection_script';
    script.textContent = `
      (function() {
        let hoveredElement = null;
        let selectedElement = null;
        let hoverOverlay = null;
        let selectionOverlay = null;

        function createOverlay() {
          if (!hoverOverlay) {
            hoverOverlay = document.createElement('div');
            hoverOverlay.id = '__inspector_hover_overlay';
            hoverOverlay.style.cssText = 'position: fixed; pointer-events: none; border: 2px dashed #646cff; background: rgba(100, 108, 255, 0.1); z-index: 999998; box-sizing: border-box;';
            document.body.appendChild(hoverOverlay);
          }
          if (!selectionOverlay) {
            selectionOverlay = document.createElement('div');
            selectionOverlay.id = '__inspector_selection_overlay';
            selectionOverlay.style.cssText = 'position: fixed; pointer-events: none; border: 2px solid #646cff; background: rgba(100, 108, 255, 0.15); z-index: 999999; box-sizing: border-box;';
            document.body.appendChild(selectionOverlay);
          }
        }

        function updateOverlay(element, overlay, isSelected) {
          if (!element || !overlay) return;
          const rect = element.getBoundingClientRect();
          const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
          const scrollY = window.pageYOffset || document.documentElement.scrollTop;
          
          overlay.style.left = (rect.left + scrollX) + 'px';
          overlay.style.top = (rect.top + scrollY) + 'px';
          overlay.style.width = rect.width + 'px';
          overlay.style.height = rect.height + 'px';
          overlay.style.display = 'block';
        }

        function hideOverlay(overlay) {
          if (overlay) overlay.style.display = 'none';
        }

        function getElementSelector(el) {
          if (!el) return '';
          if (el.id) return '#' + el.id.replace(/([^a-zA-Z0-9_-])/g, '\\\\$1');
          
          let path = [];
          while (el && el.nodeType === 1) {
            let selector = el.tagName.toLowerCase();
            if (el.className && typeof el.className === 'string') {
              const classes = el.className.trim().split(/\\s+/).filter(c => !c.startsWith('__inspector'));
              if (classes.length > 0) {
                selector += '.' + classes.map(c => c.replace(/([^a-zA-Z0-9_-])/g, '\\\\$1')).join('.');
              }
            }
            const parent = el.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
              if (siblings.length > 1) {
                const index = siblings.indexOf(el) + 1;
                selector += ':nth-of-type(' + index + ')';
              }
            }
            path.unshift(selector);
            if (el.id) break;
            el = parent;
          }
          return path.join(' > ');
        }

        function handleMouseOver(e) {
          if (e.target.id && (e.target.id.startsWith('__inspector') || e.target.closest('[id^="__inspector"]'))) {
            return;
          }
          hoveredElement = e.target;
          createOverlay();
          updateOverlay(e.target, hoverOverlay, false);
        }

        function handleMouseOut(e) {
          hideOverlay(hoverOverlay);
        }

        function handleClick(e) {
          e.preventDefault();
          e.stopPropagation();
          
          if (e.target.id && (e.target.id.startsWith('__inspector') || e.target.closest('[id^="__inspector"]'))) {
            return;
          }

          selectedElement = e.target;
          const selector = getElementSelector(e.target);
          
          // Send message to parent window
          if (window.parent) {
            window.parent.postMessage({
              type: 'ELEMENT_SELECTED',
              selector: selector
            }, '*');
          }

          updateOverlay(e.target, selectionOverlay, true);
        }

        // Clean up existing listeners
        document.removeEventListener('mouseover', handleMouseOver, true);
        document.removeEventListener('mouseout', handleMouseOut, true);
        document.removeEventListener('click', handleClick, true);

        // Add new listeners
        document.addEventListener('mouseover', handleMouseOver, true);
        document.addEventListener('mouseout', handleMouseOut, true);
        document.addEventListener('click', handleClick, true);

        // Cleanup function
        window.__inspector_cleanup = function() {
          document.removeEventListener('mouseover', handleMouseOver, true);
          document.removeEventListener('mouseout', handleMouseOut, true);
          document.removeEventListener('click', handleClick, true);
          if (hoverOverlay) hoverOverlay.remove();
          if (selectionOverlay) selectionOverlay.remove();
          hoverOverlay = null;
          selectionOverlay = null;
        };
      })();
    `;
    doc.head.appendChild(script);
  };

  // Remove selection script
  const removeSelectionScript = (doc: Document) => {
    const script = doc.getElementById('__inspector_selection_script');
    if (script) script.remove();

    // Call cleanup if available
    try {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow && (iframe.contentWindow as any).__inspector_cleanup) {
        (iframe.contentWindow as any).__inspector_cleanup();
      }
    } catch (e) {
      // Cross-origin or other error
    }

    // Remove overlays
    const hoverOverlay = doc.getElementById('__inspector_hover_overlay');
    const selectionOverlay = doc.getElementById('__inspector_selection_overlay');
    if (hoverOverlay) hoverOverlay.remove();
    if (selectionOverlay) selectionOverlay.remove();
  };

  // Listen for element selection messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'ELEMENT_SELECTED') {
        dispatch({ type: 'SET_SELECTED_ELEMENT', payload: event.data.selector });
        setSelectionMode(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [dispatch]);

  // Clear selection when HTML content changes
  useEffect(() => {
    if (state.view.htmlContent && state.editor.selectedElement) {
      // Clear selection when content changes - element may no longer exist
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (iframe) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const element = iframeDoc.querySelector(state.editor.selectedElement);
            if (!element) {
              // Element doesn't exist in new content, clear selection
              dispatch({ type: 'SET_SELECTED_ELEMENT', payload: null });
              clearSimilarHighlights();
            }
          }
        } catch (e) {
          // Ignore
        }
      }
    }
  }, [state.view.htmlContent, dispatch, clearSimilarHighlights]);

  // Clear similar highlights when selection changes
  useEffect(() => {
    if (!state.editor.selectedElement) {
      clearSimilarHighlights();
    }
  }, [state.editor.selectedElement, clearSimilarHighlights]);

  // Update element info when selection changes
  useEffect(() => {
    if (!state.editor.selectedElement || !state.view.htmlContent) {
      setElementInfo(null);
      return;
    }

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe) return;

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;

      const element = iframeDoc.querySelector(state.editor.selectedElement);
      if (!element) {
        setElementInfo(null);
        return;
      }

      const rect = element.getBoundingClientRect();
      const computed = iframeDoc.defaultView?.getComputedStyle(element) || window.getComputedStyle(element);
      
      // Get inline styles
      const inlineStyles: Record<string, string> = {};
      if (element instanceof HTMLElement && element.style) {
        for (let i = 0; i < element.style.length; i++) {
          const prop = element.style[i];
          inlineStyles[prop] = element.style.getPropertyValue(prop);
        }
      }

      // Get attributes
      const attributes: Record<string, string> = {};
      Array.from(element.attributes).forEach(attr => {
        attributes[attr.name] = attr.value;
      });

      // Get parent selector
      let parentSelector: string | null = null;
      if (element.parentElement) {
        try {
          parentSelector = generateSelector(element.parentElement);
        } catch (e) {
          parentSelector = element.parentElement.tagName.toLowerCase();
        }
      }

      // Determine contextual information
      const context = getElementContext(element, computed, attributes);
      
      // Generate selector for similar items (by class)
      let similarSelector: string | undefined;
      if (element.classList.length > 0) {
        const firstClass = Array.from(element.classList).find(cls => !cls.startsWith('__inspector'));
        if (firstClass) {
          similarSelector = `.${CSS.escape(firstClass)}`;
        }
      } else if (element.tagName) {
        similarSelector = element.tagName.toLowerCase();
      }

      // Build element path (DOM tree path)
      const path: Array<{ tag: string; id?: string; classes?: string[] }> = [];
      let currentElement: Element | null = element;
      while (currentElement && currentElement !== iframeDoc.body && currentElement !== iframeDoc.documentElement) {
        const tag = currentElement.tagName.toLowerCase();
        const id = currentElement.id || undefined;
        const classes = Array.from(currentElement.classList).filter(cls => !cls.startsWith('__inspector'));
        path.unshift({ tag, id, classes: classes.length > 0 ? classes : undefined });
        currentElement = currentElement.parentElement;
      }
      setElementPath(path);

      const info: ElementInfo = {
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        classes: Array.from(element.classList).filter(cls => !cls.startsWith('__inspector')),
        attributes,
        inlineStyles,
        computedStyles: {
          display: computed.display,
          position: computed.position,
          width: computed.width,
          height: computed.height,
          margin: computed.margin,
          padding: computed.padding,
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          fontSize: computed.fontSize,
          fontFamily: computed.fontFamily,
          fontWeight: computed.fontWeight,
          lineHeight: computed.lineHeight,
          border: computed.border,
          borderRadius: computed.borderRadius,
          boxShadow: computed.boxShadow,
          opacity: computed.opacity,
          zIndex: computed.zIndex,
          overflow: computed.overflow,
          textAlign: computed.textAlign,
          verticalAlign: computed.verticalAlign,
          flexDirection: computed.flexDirection,
          justifyContent: computed.justifyContent,
          alignItems: computed.alignItems,
          gap: computed.gap,
        },
        dimensions: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          bottom: rect.bottom,
          right: rect.right,
        },
        parent: parentSelector,
        children: element.children.length,
        textContent: element.textContent?.substring(0, 100) || '',
        innerHTML: element.innerHTML.substring(0, 200) || '',
        context,
        similarSelector,
      };

      setElementInfo(info);
      
      // Store element reference for style editor
      // We need to get it fresh each time since iframe content can change
      const getElement = () => {
        const iframe = document.querySelector('iframe') as HTMLIFrameElement;
        if (!iframe) return null;
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc) return null;
          return iframeDoc.querySelector(state.editor.selectedElement!) as HTMLElement;
        } catch (e) {
          return null;
        }
      };
      elementRef.current = getElement();

      // Highlight element
      if (highlighted && element instanceof HTMLElement) {
        const originalOutline = element.style.outline;
        const originalOutlineOffset = element.style.outlineOffset;
        element.style.outline = '2px solid #646cff';
        element.style.outlineOffset = '2px';

        return () => {
          if (element instanceof HTMLElement) {
            element.style.outline = originalOutline;
            element.style.outlineOffset = originalOutlineOffset;
          }
        };
      }
    } catch (err) {
      console.error('Error inspecting element:', err);
      setElementInfo(null);
    }
  }, [state.editor.selectedElement, state.view.htmlContent, highlighted]);

  // Cleanup selection mode when inspector closes
  useEffect(() => {
    if (!state.editor.showInspector && selectionMode) {
      setSelectionMode(false);
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (iframe) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            removeSelectionScript(iframeDoc);
          }
        } catch (e) {
          // Ignore
        }
      }
    }
  }, [state.editor.showInspector, selectionMode]);

  // Cleanup selection script when HTML content changes
  useEffect(() => {
    if (selectionMode && state.view.htmlContent) {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (iframe) {
        // Wait for iframe to load
        const checkAndInject = () => {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc && iframeDoc.readyState === 'complete') {
              // Remove old script first
              removeSelectionScript(iframeDoc);
              // Re-inject after a short delay to ensure DOM is ready
              setTimeout(() => {
                injectSelectionScript(iframeDoc);
              }, 100);
            }
          } catch (e) {
            // Ignore cross-origin errors
          }
        };

        if (iframe.contentDocument?.readyState === 'complete') {
          checkAndInject();
        } else {
          iframe.addEventListener('load', checkAndInject, { once: true });
          return () => iframe.removeEventListener('load', checkAndInject);
        }
      }
    }
  }, [state.view.htmlContent, selectionMode]);

  const handleCopySelector = () => {
    if (state.editor.selectedElement) {
      navigator.clipboard.writeText(state.editor.selectedElement);
    }
  };

  const handleCopyStyles = () => {
    if (elementInfo) {
      const styles = Object.entries(elementInfo.computedStyles)
        .map(([key, value]) => `${key}: ${value};`)
        .join('\n');
      navigator.clipboard.writeText(styles);
    }
  };

  const handleCopyHTML = () => {
    if (elementInfo && state.editor.selectedElement) {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (iframe) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const element = iframeDoc.querySelector(state.editor.selectedElement!);
            if (element) {
              navigator.clipboard.writeText(element.outerHTML);
            }
          }
        } catch (e) {
          navigator.clipboard.writeText(elementInfo.innerHTML);
        }
      }
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (!state.editor.showInspector) {
    return null;
  }

  return (
    <div className="element-inspector">
      <div className="inspector-header" style={{display:'flex',justifyContent:'right',width:'full'}}>
        <div className="inspector-actions">
          <button
            className={`inspector-btn ${selectionMode ? 'active' : ''}`}
            onClick={toggleSelectionMode}
            title={selectionMode ? 'Exit Selection Mode' : 'Enable Selection Mode'}
          >
            <MousePointer2 size={14} />
          </button>
          <button
            className="inspector-btn"
            onClick={() => setHighlighted(!highlighted)}
            title={highlighted ? 'Hide Highlight' : 'Show Highlight'}
          >
            {highlighted ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
      </div>

      <div className="inspector-content">
        {!elementInfo ? (
          <div className="inspector-empty">
            <MousePointer2 size={32} />
            <p>No element selected</p>
            <button className="select-btn" onClick={toggleSelectionMode}>
              {selectionMode ? 'Exit Selection Mode' : 'Click to Select Element'}
            </button>
            {selectionMode && (
              <p className="hint">Click on any element in the preview to inspect it</p>
            )}
          </div>
        ) : (
          <>
            {/* Selection Mode Indicator */}
            {selectionMode && (
              <div className="selection-mode-indicator">
                <MousePointer2 size={14} />
                <span>Selection mode active - Click an element to inspect</span>
              </div>
            )}

            {/* Element Tree Path */}
            {elementPath.length > 0 && (
              <div className="inspector-section" style={{ 
                padding: '8px 12px', 
                background: 'rgba(100, 108, 255, 0.1)',
                borderRadius: '4px',
                marginBottom: '12px',
                fontSize: '11px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <GitBranch size={12} />
                  <strong>Element Path:</strong>
                  <button
                    onClick={() => setShowElementTree(!showElementTree)}
                    style={{
                      marginLeft: 'auto',
                      padding: '2px 6px',
                      fontSize: '10px',
                      background: 'rgba(100, 108, 255, 0.2)',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    {showElementTree ? 'Hide' : 'Show'} Tree
                  </button>
                </div>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '4px',
                  alignItems: 'center'
                }}>
                  {elementPath.map((item, idx) => (
                    <React.Fragment key={idx}>
                      <code style={{
                        padding: '2px 6px',
                        background: 'rgba(100, 108, 255, 0.2)',
                        borderRadius: '3px',
                        fontSize: '10px'
                      }}>
                        {item.tag}
                        {item.id && <span style={{ color: '#646cff' }}>#{item.id}</span>}
                        {item.classes && item.classes.length > 0 && (
                          <span style={{ color: '#22c55e' }}>.{item.classes[0]}</span>
                        )}
                      </code>
                      {idx < elementPath.length - 1 && (
                        <span style={{ opacity: 0.5 }}>→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                {showElementTree && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    maxHeight: '150px',
                    overflow: 'auto'
                  }}>
                    {elementPath.map((item, idx) => (
                      <div key={idx} style={{ 
                        paddingLeft: `${idx * 12}px`,
                        marginBottom: '2px',
                        color: idx === elementPath.length - 1 ? '#646cff' : 'rgba(255,255,255,0.7)'
                      }}>
                        &lt;{item.tag}
                        {item.id && ` id="${item.id}"`}
                        {item.classes && item.classes.length > 0 && ` class="${item.classes.join(' ')}"`}
                        &gt;
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="inspector-tabs">
              <button
                className={`inspector-tab ${activeTab === 'info' ? 'active' : ''}`}
                onClick={() => setActiveTab('info')}
              >
                <Info size={14} />
                <span>Info</span>
              </button>
              <button
                className={`inspector-tab ${activeTab === 'styles' ? 'active' : ''}`}
                onClick={() => setActiveTab('styles')}
              >
                <Edit3 size={14} />
                <span>Styles</span>
              </button>
              <button
                className={`inspector-tab ${activeTab === 'boxmodel' ? 'active' : ''}`}
                onClick={() => setActiveTab('boxmodel')}
              >
                <Box size={14} />
                <span>Box Model</span>
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'info' && (
              <div className="tab-content">
                {/* Selector */}
                <div className="inspector-section">
                  <h4 className="section-title">Selector</h4>
                  <div className="selector-display">
                    <code>{state.editor.selectedElement}</code>
                    <button className="copy-btn" onClick={handleCopySelector} title="Copy Selector">
                      <Copy size={12} />
                    </button>
                  </div>
                </div>

            {/* Context Badge */}
            {elementInfo.context && (
              <div className="inspector-section">
                <div className="context-badge">
                  <Zap size={14} />
                  <span>{elementInfo.context}</span>
                </div>
              </div>
            )}

            {/* Similar Items Selection */}
            {elementInfo.similarSelector && (
              <div className="inspector-section">
                <button
                  className="similar-items-btn"
                  onClick={selectSimilarItems}
                  title={`Select all elements matching: ${elementInfo.similarSelector}`}
                >
                  <Layers size={14} />
                  <span>Select All Similar Items</span>
                </button>
                <div className="similar-selector-hint">
                  Matches: <code>{elementInfo.similarSelector}</code>
                </div>
                <button
                  className="clear-highlights-btn"
                  onClick={clearSimilarHighlights}
                  title="Clear highlights"
                >
                  Clear Highlights
                </button>
              </div>
            )}

            {/* Element Info */}
            <div className="inspector-section">
              <h4 className="section-title">Element Info</h4>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Tag:</span>
                  <span className="info-value tag-value">{elementInfo.tag}</span>
                </div>
                {elementInfo.id && (
                  <div className="info-item">
                    <span className="info-label">ID:</span>
                    <span className="info-value">#{elementInfo.id}</span>
                  </div>
                )}
                {elementInfo.classes.length > 0 && (
                  <div className="info-item">
                    <span className="info-label">Classes:</span>
                    <span className="info-value">{elementInfo.classes.join(', ')}</span>
                  </div>
                )}
                {elementInfo.parent && (
                  <div className="info-item">
                    <span className="info-label">Parent:</span>
                    <span className="info-value parent-value" title={elementInfo.parent}>
                      {elementInfo.parent.length > 50 ? elementInfo.parent.substring(0, 50) + '...' : elementInfo.parent}
                    </span>
                  </div>
                )}
                <div className="info-item">
                  <span className="info-label">Children:</span>
                  <span className="info-value">{elementInfo.children}</span>
                </div>
              </div>
            </div>

            {/* Dimensions */}
            <div className="inspector-section collapsible">
              <div className="section-header clickable" onClick={() => toggleSection('dimensions')}>
                <h4 className="section-title">Dimensions</h4>
                {expandedSections.dimensions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              {expandedSections.dimensions && (
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Width:</span>
                    <span className="info-value">{Math.round(elementInfo.dimensions.width)}px</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Height:</span>
                    <span className="info-value">{Math.round(elementInfo.dimensions.height)}px</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Top:</span>
                    <span className="info-value">{Math.round(elementInfo.dimensions.top)}px</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Left:</span>
                    <span className="info-value">{Math.round(elementInfo.dimensions.left)}px</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Bottom:</span>
                    <span className="info-value">{Math.round(elementInfo.dimensions.bottom)}px</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Right:</span>
                    <span className="info-value">{Math.round(elementInfo.dimensions.right)}px</span>
                  </div>
                </div>
              )}
            </div>

            {/* Inline Styles */}
            {Object.keys(elementInfo.inlineStyles).length > 0 && (
              <div className="inspector-section collapsible">
                <div className="section-header clickable" onClick={() => toggleSection('inlineStyles')}>
                  <h4 className="section-title">Inline Styles</h4>
                  {expandedSections.inlineStyles ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
                {expandedSections.inlineStyles && (
                  <div className="styles-list">
                    {Object.entries(elementInfo.inlineStyles).map(([key, value]) => (
                      <div key={key} className="style-item">
                        <span className="style-property">{key}:</span>
                        <span className="style-value">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Computed Styles */}
            <div className="inspector-section collapsible">
              <div className="section-header">
                <h4 className="section-title">Computed Styles</h4>
                <button className="copy-btn" onClick={handleCopyStyles} title="Copy All Styles">
                  <Copy size={12} />
                </button>
              </div>
              <div className="styles-list">
                {Object.entries(elementInfo.computedStyles).map(([key, value]) => (
                  <div key={key} className="style-item">
                    <span className="style-property">{key}:</span>
                    <span className="style-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Attributes */}
            {Object.keys(elementInfo.attributes).length > 0 && (
              <div className="inspector-section collapsible">
                <div className="section-header clickable" onClick={() => toggleSection('attributes')}>
                  <h4 className="section-title">Attributes</h4>
                  {expandedSections.attributes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
                {expandedSections.attributes && (
                  <div className="info-grid">
                    {Object.entries(elementInfo.attributes).map(([key, value]) => (
                      <div key={key} className="info-item">
                        <span className="info-label">{key}:</span>
                        <span className="info-value" title={value}>
                          {value.length > 50 ? value.substring(0, 50) + '...' : value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* HTML */}
            <div className="inspector-section collapsible">
              <div className="section-header">
                <h4 className="section-title">HTML</h4>
                <button className="copy-btn" onClick={handleCopyHTML} title="Copy HTML">
                  <Copy size={12} />
                </button>
              </div>
              <div className="html-preview">
                <pre><code>{elementInfo.innerHTML || elementInfo.textContent}</code></pre>
              </div>
            </div>
              </div>
            )}

            {activeTab === 'styles' && elementRef.current && (
              <div className="tab-content">
                <StyleEditor
                  element={elementRef.current}
                  selector={state.editor.selectedElement}
                  onStyleChange={(styles) => {
                    // Trigger re-render of element info
                    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
                    if (iframe) {
                      try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (iframeDoc && state.editor.selectedElement) {
                          const el = iframeDoc.querySelector(state.editor.selectedElement);
                          if (el) {
                            // Force update by dispatching a custom event
                            const event = new CustomEvent('stylechange');
                            el.dispatchEvent(event);
                            // Also update element ref
                            elementRef.current = el as HTMLElement;
                          }
                        }
                      } catch (e) {
                        // Ignore
                      }
                    }
                  }}
                />
              </div>
            )}

            {activeTab === 'boxmodel' && elementRef.current && (
              <div className="tab-content">
                <BoxModelViewer element={elementRef.current} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
