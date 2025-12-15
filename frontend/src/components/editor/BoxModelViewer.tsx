import { useEffect, useState } from 'react';
import '../../assets/css/editor/BoxModelViewer.css';

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
        const float = parseFloat(value);
        return isNaN(float) ? 0 : float;
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

  return (
    <div className="box-model-viewer">
      <div className="box-model-container">
        {/* Margin */}
        <div className="box-layer margin">
          <span className="layer-label">margin</span>
          <span className="box-value top">{boxModel.margin.top === 0 ? '-' : Math.round(boxModel.margin.top)}</span>
          <span className="box-value right">{boxModel.margin.right === 0 ? '-' : Math.round(boxModel.margin.right)}</span>
          <span className="box-value bottom">{boxModel.margin.bottom === 0 ? '-' : Math.round(boxModel.margin.bottom)}</span>
          <span className="box-value left">{boxModel.margin.left === 0 ? '-' : Math.round(boxModel.margin.left)}</span>

          {/* Border */}
          <div className="box-layer border">
            <span className="layer-label">border</span>
            <span className="box-value top">{boxModel.border.top === 0 ? '-' : Math.round(boxModel.border.top)}</span>
            <span className="box-value right">{boxModel.border.right === 0 ? '-' : Math.round(boxModel.border.right)}</span>
            <span className="box-value bottom">{boxModel.border.bottom === 0 ? '-' : Math.round(boxModel.border.bottom)}</span>
            <span className="box-value left">{boxModel.border.left === 0 ? '-' : Math.round(boxModel.border.left)}</span>

            {/* Padding */}
            <div className="box-layer padding">
              <span className="layer-label">padding</span>
              <span className="box-value top">{boxModel.padding.top === 0 ? '-' : Math.round(boxModel.padding.top)}</span>
              <span className="box-value right">{boxModel.padding.right === 0 ? '-' : Math.round(boxModel.padding.right)}</span>
              <span className="box-value bottom">{boxModel.padding.bottom === 0 ? '-' : Math.round(boxModel.padding.bottom)}</span>
              <span className="box-value left">{boxModel.padding.left === 0 ? '-' : Math.round(boxModel.padding.left)}</span>

              {/* Content */}
              <div className="box-layer content">
                <span className="content-dimensions">
                  {Math.round(boxModel.width)} × {Math.round(boxModel.height)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

