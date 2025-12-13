import { useState, useEffect, useRef } from 'react';
import { Copy, RotateCcw, Download, Plus, X } from 'lucide-react';
import '../../assets/css/editor/StyleEditor.css';

interface StyleProperty {
  name: string;
  value: string;
  isModified: boolean;
}

interface StyleEditorProps {
  element: HTMLElement | null;
  selector: string | null;
  onStyleChange?: (styles: Record<string, string>) => void;
}

const COLOR_PROPERTIES = ['color', 'background-color', 'background', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color'];
const DIMENSION_PROPERTIES = ['width', 'height', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-width', 'border-radius', 'font-size', 'line-height', 'top', 'left', 'right', 'bottom'];
const COMMON_PROPERTIES = [
  'color', 'background-color', 'width', 'height', 'margin', 'padding', 'border',
  'border-radius', 'font-size', 'font-weight', 'font-family', 'text-align',
  'display', 'position', 'opacity', 'box-shadow', 'transform', 'transition'
];

export default function StyleEditor({ element, selector, onStyleChange }: StyleEditorProps) {
  const [styles, setStyles] = useState<StyleProperty[]>([]);
  const [customStyles, setCustomStyles] = useState<StyleProperty[]>([]);
  const [editingProperty, setEditingProperty] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState('');
  const [newPropertyValue, setNewPropertyValue] = useState('');
  const [styleHistory, setStyleHistory] = useState<Record<string, string>[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const updateStyles = () => {
      // Get fresh element reference
      const getElement = () => {
        if (element) return element;
        const iframe = document.querySelector('iframe') as HTMLIFrameElement;
        if (!iframe) return null;
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc || !selector) return null;
          return iframeDoc.querySelector(selector) as HTMLElement;
        } catch (e) {
          return null;
        }
      };

      const targetElement = getElement();
      if (!targetElement) {
        setStyles([]);
        setCustomStyles([]);
        return;
      }

      // Get computed styles for common properties
      const computed = window.getComputedStyle(targetElement);
      const styleList: StyleProperty[] = COMMON_PROPERTIES.map(prop => ({
        name: prop,
        value: computed.getPropertyValue(prop) || '',
        isModified: false,
      })).filter(s => s.value);

      setStyles(styleList);

      // Get inline styles (custom/modified)
      const inlineStyles: StyleProperty[] = [];
      if (targetElement.style) {
        for (let i = 0; i < targetElement.style.length; i++) {
          const prop = targetElement.style[i];
          const value = targetElement.style.getPropertyValue(prop);
          if (value) {
            inlineStyles.push({
              name: prop,
              value: value,
              isModified: true,
            });
          }
        }
      }
      setCustomStyles(inlineStyles);
    };

    updateStyles();

    // Listen for style changes
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (iframe) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc && selector) {
          const el = iframeDoc.querySelector(selector);
          if (el) {
            el.addEventListener('stylechange', updateStyles);
            return () => {
              el.removeEventListener('stylechange', updateStyles);
            };
          }
        }
      } catch (e) {
        // Ignore
      }
    }
  }, [element, selector]);

  const applyStyle = (property: string, value: string) => {
    if (!element) return;

    const newStyles = { ...getCurrentStyles(), [property]: value };
    saveToHistory(newStyles);
    applyStylesToElement(newStyles);
    onStyleChange?.(newStyles);
  };

  const getCurrentStyles = (): Record<string, string> => {
    const allStyles: Record<string, string> = {};
    [...styles, ...customStyles].forEach(s => {
      allStyles[s.name] = s.value;
    });
    return allStyles;
  };

  const applyStylesToElement = (stylesToApply: Record<string, string>) => {
    if (!element) return;

    // Get fresh element reference in case iframe content changed
    const getElement = () => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (!iframe) return null;
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc || !selector) return null;
        return iframeDoc.querySelector(selector) as HTMLElement;
      } catch (e) {
        return null;
      }
    };

    const targetElement = getElement() || element;

    Object.entries(stylesToApply).forEach(([prop, value]) => {
      if (value) {
        targetElement.style.setProperty(prop, value);
      } else {
        targetElement.style.removeProperty(prop);
      }
    });

    // Update state
    const updatedStyles = styles.map(s => ({
      ...s,
      value: stylesToApply[s.name] || s.value,
      isModified: !!stylesToApply[s.name],
    }));

    const updatedCustom = Object.entries(stylesToApply)
      .filter(([prop, value]) => value && !COMMON_PROPERTIES.includes(prop))
      .map(([name, value]) => ({
        name,
        value,
        isModified: true,
      }));

    setStyles(updatedStyles);
    setCustomStyles(updatedCustom);
  };

  const saveToHistory = (newStyles: Record<string, string>) => {
    const newHistory = styleHistory.slice(0, historyIndex + 1);
    newHistory.push(newStyles);
    setStyleHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      applyStylesToElement(styleHistory[prevIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < styleHistory.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      applyStylesToElement(styleHistory[nextIndex]);
    }
  };

  const handleEdit = (property: string, currentValue: string) => {
    setEditingProperty(property);
    setEditValue(currentValue);
  };

  const handleSaveEdit = () => {
    if (editingProperty && editValue !== undefined) {
      applyStyle(editingProperty, editValue);
    }
    setEditingProperty(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingProperty(null);
    setEditValue('');
  };

  const handleAddProperty = () => {
    if (newPropertyName && newPropertyValue) {
      applyStyle(newPropertyName, newPropertyValue);
      setNewPropertyName('');
      setNewPropertyValue('');
      setShowAddProperty(false);
    }
  };

  const handleRemoveProperty = (property: string) => {
    if (!element) return;
    
    // Get fresh element reference
    const getElement = () => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (!iframe) return null;
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc || !selector) return null;
        return iframeDoc.querySelector(selector) as HTMLElement;
      } catch (e) {
        return null;
      }
    };

    const targetElement = getElement() || element;
    targetElement.style.removeProperty(property);
    setCustomStyles(customStyles.filter(s => s.name !== property));
    const newStyles = { ...getCurrentStyles() };
    delete newStyles[property];
    saveToHistory(newStyles);
    onStyleChange?.(newStyles);
  };

  const handleReset = () => {
    if (!element) return;
    
    // Get fresh element reference
    const getElement = () => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (!iframe) return null;
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc || !selector) return null;
        return iframeDoc.querySelector(selector) as HTMLElement;
      } catch (e) {
        return null;
      }
    };

    const targetElement = getElement() || element;
    targetElement.style.cssText = '';
    setCustomStyles([]);
    setStyles(styles.map(s => ({ ...s, value: '', isModified: false })));
    saveToHistory({});
    onStyleChange?.({});
  };

  const handleExport = () => {
    if (!selector) return;
    const allStyles = getCurrentStyles();
    const css = `${selector} {\n${Object.entries(allStyles)
      .map(([prop, value]) => `  ${prop}: ${value};`)
      .join('\n')}\n}`;
    
    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'styles.css';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyCSS = () => {
    if (!selector) return;
    const allStyles = getCurrentStyles();
    const css = `${selector} {\n${Object.entries(allStyles)
      .map(([prop, value]) => `  ${prop}: ${value};`)
      .join('\n')}\n}`;
    navigator.clipboard.writeText(css);
  };

  const isColorProperty = (prop: string) => COLOR_PROPERTIES.some(cp => prop.includes(cp));
  const isDimensionProperty = (prop: string) => DIMENSION_PROPERTIES.some(dp => prop.includes(dp));

  const getColorValue = (value: string): string => {
    // Convert rgb/rgba to hex if needed
    if (value.startsWith('rgb')) {
      const match = value.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0]).toString(16).padStart(2, '0');
        const g = parseInt(match[1]).toString(16).padStart(2, '0');
        const b = parseInt(match[2]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
    return value;
  };

  const handleColorChange = (property: string, color: string) => {
    applyStyle(property, color);
  };

  if (!element) {
    return (
      <div className="style-editor-empty">
        <p>Select an element to edit styles</p>
      </div>
    );
  }

  return (
    <div className="style-editor">
      <div className="style-editor-header">
        <div className="style-editor-title">Style Editor</div>
        <div className="style-editor-actions">
          <button
            className="style-btn"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo"
          >
            <RotateCcw size={14} />
          </button>
          <button
            className="style-btn"
            onClick={handleRedo}
            disabled={historyIndex >= styleHistory.length - 1}
            title="Redo"
          >
            <RotateCcw size={14} style={{ transform: 'scaleX(-1)' }} />
          </button>
          <button className="style-btn" onClick={handleCopyCSS} title="Copy CSS">
            <Copy size={14} />
          </button>
          <button className="style-btn" onClick={handleExport} title="Export CSS">
            <Download size={14} />
          </button>
          <button className="style-btn" onClick={handleReset} title="Reset Styles">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div className="style-editor-content">
        {/* Common Properties */}
        <div className="style-section">
          <div className="style-section-title">Common Properties</div>
          <div className="style-properties">
            {styles.map(style => (
              <div key={style.name} className={`style-property ${style.isModified ? 'modified' : ''}`}>
                <div className="style-property-name">{style.name}:</div>
                {editingProperty === style.name ? (
                  <div className="style-property-edit">
                    {isColorProperty(style.name) ? (
                      <div className="color-input-group">
                        <input
                          ref={colorInputRef}
                          type="color"
                          value={getColorValue(editValue)}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="color-picker"
                        />
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="style-input"
                          placeholder="value"
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="style-input"
                        placeholder="value"
                        autoFocus
                      />
                    )}
                    <button className="save-btn" onClick={handleSaveEdit}>✓</button>
                    <button className="cancel-btn" onClick={handleCancelEdit}>✕</button>
                  </div>
                ) : (
                  <div className="style-property-value-group">
                    <div
                      className="style-property-value"
                      onClick={() => handleEdit(style.name, style.value)}
                      title="Click to edit"
                    >
                      {style.value || <span className="empty-value">(empty)</span>}
                    </div>
                    {isColorProperty(style.name) && style.value && (
                      <div
                        className="color-preview"
                        style={{ backgroundColor: style.value }}
                        onClick={() => {
                          setEditingProperty(style.name);
                          setEditValue(style.value);
                          setTimeout(() => colorInputRef.current?.click(), 0);
                        }}
                        title="Click to change color"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Custom/Modified Properties */}
        {customStyles.length > 0 && (
          <div className="style-section">
            <div className="style-section-title">Custom Properties</div>
            <div className="style-properties">
              {customStyles.map(style => (
                <div key={style.name} className="style-property modified">
                  <div className="style-property-name">{style.name}:</div>
                  {editingProperty === style.name ? (
                    <div className="style-property-edit">
                      {isColorProperty(style.name) ? (
                        <div className="color-input-group">
                          <input
                            type="color"
                            value={getColorValue(editValue)}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="color-picker"
                          />
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="style-input"
                            placeholder="value"
                          />
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="style-input"
                          placeholder="value"
                          autoFocus
                        />
                      )}
                      <button className="save-btn" onClick={handleSaveEdit}>✓</button>
                      <button className="cancel-btn" onClick={handleCancelEdit}>✕</button>
                    </div>
                  ) : (
                    <div className="style-property-value-group">
                      <div
                        className="style-property-value"
                        onClick={() => handleEdit(style.name, style.value)}
                        title="Click to edit"
                      >
                        {style.value}
                      </div>
                      {isColorProperty(style.name) && style.value && (
                        <div
                          className="color-preview"
                          style={{ backgroundColor: style.value }}
                          onClick={() => {
                            setEditingProperty(style.name);
                            setEditValue(style.value);
                          }}
                          title="Click to change color"
                        />
                      )}
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveProperty(style.name)}
                        title="Remove property"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Property */}
        {showAddProperty ? (
          <div className="style-section">
            <div className="style-section-title">Add Property</div>
            <div className="add-property-form">
              <input
                type="text"
                value={newPropertyName}
                onChange={(e) => setNewPropertyName(e.target.value)}
                placeholder="property-name"
                className="property-name-input"
                autoFocus
              />
              <input
                type="text"
                value={newPropertyValue}
                onChange={(e) => setNewPropertyValue(e.target.value)}
                placeholder="value"
                className="property-value-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddProperty();
                  if (e.key === 'Escape') setShowAddProperty(false);
                }}
              />
              <button className="add-btn" onClick={handleAddProperty}>Add</button>
              <button className="cancel-btn" onClick={() => setShowAddProperty(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button
            className="add-property-btn"
            onClick={() => setShowAddProperty(true)}
          >
            <Plus size={14} />
            Add Property
          </button>
        )}
      </div>
    </div>
  );
}
