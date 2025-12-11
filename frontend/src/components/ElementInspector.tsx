import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Copy, Eye, EyeOff } from 'lucide-react';
import './ElementInspector.css';

interface ElementInfo {
  tag: string;
  id: string | null;
  classes: string[];
  styles: Record<string, string>;
  computedStyles: Record<string, string>;
  dimensions: {
    width: number;
    height: number;
    top: number;
    left: number;
  };
}

export default function ElementInspector() {
  const { state, dispatch } = useApp();
  const [elementInfo, setElementInfo] = useState<ElementInfo | null>(null);
  const [highlighted, setHighlighted] = useState(true);

  useEffect(() => {
    if (!state.editor.selectedElement || !state.view.htmlContent) return;

    const iframe = document.querySelector('iframe');
    if (!iframe) return;

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;

      const element = iframeDoc.querySelector(state.editor.selectedElement);
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const computed = window.getComputedStyle(element);
      
      const info: ElementInfo = {
        tag: element.tagName.toLowerCase(),
        id: element.id || null,
        classes: Array.from(element.classList),
        styles: {},
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
        },
        dimensions: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
        },
      };

      setElementInfo(info);

      // Highlight element
      if (highlighted && element instanceof HTMLElement) {
        const originalOutline = element.style.outline;
        element.style.outline = '2px solid #646cff';
        element.style.outlineOffset = '2px';

        return () => {
          if (element instanceof HTMLElement) {
            element.style.outline = originalOutline;
          }
        };
      }
    } catch (err) {
      console.error('Error inspecting element:', err);
    }
  }, [state.editor.selectedElement, state.view.htmlContent, highlighted]);

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

  if (!state.editor.showInspector || !elementInfo) {
    return null;
  }

  return (
    <div className="element-inspector">
      <div className="inspector-header">
        <div className="inspector-title">
          <Eye size={16} />
          <span>Element Inspector</span>
        </div>
        <div className="inspector-actions">
          <button
            className="inspector-btn"
            onClick={() => setHighlighted(!highlighted)}
            title={highlighted ? 'Hide Highlight' : 'Show Highlight'}
          >
            {highlighted ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            className="inspector-btn"
            onClick={() => {
              dispatch({ type: 'TOGGLE_INSPECTOR' });
              dispatch({ type: 'SET_SELECTED_ELEMENT', payload: null });
            }}
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="inspector-content">
        <div className="inspector-section">
          <h4 className="section-title">Selector</h4>
          <div className="selector-display">
            <code>{state.editor.selectedElement}</code>
            <button className="copy-btn" onClick={handleCopySelector} title="Copy">
              <Copy size={12} />
            </button>
          </div>
        </div>

        <div className="inspector-section">
          <h4 className="section-title">Element Info</h4>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Tag:</span>
              <span className="info-value">{elementInfo.tag}</span>
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
          </div>
        </div>

        <div className="inspector-section">
          <h4 className="section-title">Dimensions</h4>
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
              <span className="info-label">Position:</span>
              <span className="info-value">
                {Math.round(elementInfo.dimensions.left)}, {Math.round(elementInfo.dimensions.top)}
              </span>
            </div>
          </div>
        </div>

        <div className="inspector-section">
          <div className="section-header">
            <h4 className="section-title">Computed Styles</h4>
            <button className="copy-btn" onClick={handleCopyStyles} title="Copy Styles">
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
      </div>
    </div>
  );
}
