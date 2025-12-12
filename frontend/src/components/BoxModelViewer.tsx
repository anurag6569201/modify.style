import { useEffect, useState } from 'react';
import './BoxModelViewer.css';

interface BoxModelViewerProps {
  element: HTMLElement | null;
}

interface BoxModel {
  margin: { top: number; right: number; bottom: number; left: number };
  border: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
  width: number;
  height: number;
}

export default function BoxModelViewer({ element }: BoxModelViewerProps) {
  const [boxModel, setBoxModel] = useState<BoxModel | null>(null);

  useEffect(() => {
    const getElement = () => {
      if (element) return element;
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (!iframe) return null;
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) return null;
        // Try to find element by selector or use provided element
        return element;
      } catch (e) {
        return null;
      }
    };

    const targetElement = getElement();
    if (!targetElement) {
      setBoxModel(null);
      return;
    }

    const updateBoxModel = () => {
      const el = getElement();
      if (!el) {
        setBoxModel(null);
        return;
      }
      const computed = window.getComputedStyle(el);
      
      const parseValue = (value: string): number => {
        return parseFloat(value) || 0;
      };

      setBoxModel({
        margin: {
          top: parseValue(computed.marginTop),
          right: parseValue(computed.marginRight),
          bottom: parseValue(computed.marginBottom),
          left: parseValue(computed.marginLeft),
        },
        border: {
          top: parseValue(computed.borderTopWidth),
          right: parseValue(computed.borderRightWidth),
          bottom: parseValue(computed.borderBottomWidth),
          left: parseValue(computed.borderLeftWidth),
        },
        padding: {
          top: parseValue(computed.paddingTop),
          right: parseValue(computed.paddingRight),
          bottom: parseValue(computed.paddingBottom),
          left: parseValue(computed.paddingLeft),
        },
        width: parseValue(computed.width),
        height: parseValue(computed.height),
      });
    };

    updateBoxModel();

    // Update on resize
    const resizeObserver = new ResizeObserver(updateBoxModel);
    resizeObserver.observe(targetElement);

    // Watch for style changes
    const mutationObserver = new MutationObserver(updateBoxModel);
    mutationObserver.observe(targetElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    // Listen for custom style change events
    targetElement.addEventListener('stylechange', updateBoxModel);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      targetElement.removeEventListener('stylechange', updateBoxModel);
    };
  }, [element]);

  if (!element || !boxModel) {
    return (
      <div className="box-model-empty">
        <p>Select an element to view box model</p>
      </div>
    );
  }

  const totalWidth = boxModel.margin.left + boxModel.border.left + boxModel.padding.left + 
                     boxModel.width + boxModel.padding.right + boxModel.border.right + boxModel.margin.right;
  const totalHeight = boxModel.margin.top + boxModel.border.top + boxModel.padding.top + 
                      boxModel.height + boxModel.padding.bottom + boxModel.border.bottom + boxModel.margin.bottom;

  return (
    <div className="box-model-viewer">
      <div className="box-model-title">Box Model</div>
      <div className="box-model-visualization">
        {/* Margin */}
        <div className="box-layer margin-layer">
          <div className="box-label margin-label">margin</div>
          <div className="box-value margin-value">
            <div className="box-value-item">
              <span className="box-value-label">top</span>
              <span className="box-value-number">{boxModel.margin.top}px</span>
            </div>
            <div className="box-value-item">
              <span className="box-value-label">right</span>
              <span className="box-value-number">{boxModel.margin.right}px</span>
            </div>
            <div className="box-value-item">
              <span className="box-value-label">bottom</span>
              <span className="box-value-number">{boxModel.margin.bottom}px</span>
            </div>
            <div className="box-value-item">
              <span className="box-value-label">left</span>
              <span className="box-value-number">{boxModel.margin.left}px</span>
            </div>
          </div>
          
          {/* Border */}
          <div className="box-layer border-layer">
            <div className="box-label border-label">border</div>
            <div className="box-value border-value">
              <div className="box-value-item">
                <span className="box-value-label">top</span>
                <span className="box-value-number">{boxModel.border.top}px</span>
              </div>
              <div className="box-value-item">
                <span className="box-value-label">right</span>
                <span className="box-value-number">{boxModel.border.right}px</span>
              </div>
              <div className="box-value-item">
                <span className="box-value-label">bottom</span>
                <span className="box-value-number">{boxModel.border.bottom}px</span>
              </div>
              <div className="box-value-item">
                <span className="box-value-label">left</span>
                <span className="box-value-number">{boxModel.border.left}px</span>
              </div>
            </div>
            
            {/* Padding */}
            <div className="box-layer padding-layer">
              <div className="box-label padding-label">padding</div>
              <div className="box-value padding-value">
                <div className="box-value-item">
                  <span className="box-value-label">top</span>
                  <span className="box-value-number">{boxModel.padding.top}px</span>
                </div>
                <div className="box-value-item">
                  <span className="box-value-label">right</span>
                  <span className="box-value-number">{boxModel.padding.right}px</span>
                </div>
                <div className="box-value-item">
                  <span className="box-value-label">bottom</span>
                  <span className="box-value-number">{boxModel.padding.bottom}px</span>
                </div>
                <div className="box-value-item">
                  <span className="box-value-label">left</span>
                  <span className="box-value-number">{boxModel.padding.left}px</span>
                </div>
              </div>
              
              {/* Content */}
              <div className="box-layer content-layer">
                <div className="box-label content-label">content</div>
                <div className="box-value content-value">
                  <div className="box-value-item">
                    <span className="box-value-label">width</span>
                    <span className="box-value-number">{Math.round(boxModel.width)}px</span>
                  </div>
                  <div className="box-value-item">
                    <span className="box-value-label">height</span>
                    <span className="box-value-number">{Math.round(boxModel.height)}px</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="box-model-summary">
        <div className="summary-item">
          <span className="summary-label">Total Width:</span>
          <span className="summary-value">{Math.round(totalWidth)}px</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Height:</span>
          <span className="summary-value">{Math.round(totalHeight)}px</span>
        </div>
      </div>
    </div>
  );
}
