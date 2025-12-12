import React, { useState } from 'react';
import {
  Type,
  Sparkles,
  Layout,
  FileText,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Palette
} from 'lucide-react';
import { motion } from 'framer-motion';
import './DesignPanel.css';
import { PREDEFINED_EFFECTS } from './EffectsPanel';

interface DesignPanelProps {
  activeEffects: string[];
  onToggleEffect: (effectId: string) => void;
  onTypographyChange: (css: string) => void;
}

interface TypographySettings {
  fontSize: string;
  fontWeight: string;
  fontFamily: string;
  fontStyle: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: string;
  textTransform: string;
  textDecoration: string;
}

const DesignPanel: React.FC<DesignPanelProps> = ({
  activeEffects,
  onToggleEffect,
  onTypographyChange,
}) => {
  const [typography, setTypography] = useState<TypographySettings>({
    fontSize: '',
    fontWeight: '400',
    fontFamily: '',
    fontStyle: 'normal',
    lineHeight: '',
    letterSpacing: '',
    textAlign: 'left',
    textTransform: 'none',
    textDecoration: 'none',
  });

  const updateTypography = (field: keyof TypographySettings, value: string) => {
    const updated = { ...typography, [field]: value };
    setTypography(updated);

    // Generate CSS
    const cssRules: string[] = [];
    if (updated.fontSize) cssRules.push(`font-size: ${updated.fontSize} !important;`);
    if (updated.fontWeight && updated.fontWeight !== '400') cssRules.push(`font-weight: ${updated.fontWeight} !important;`);
    if (updated.fontFamily) cssRules.push(`font-family: ${updated.fontFamily} !important;`);
    if (updated.fontStyle && updated.fontStyle !== 'normal') cssRules.push(`font-style: ${updated.fontStyle} !important;`);
    if (updated.lineHeight) cssRules.push(`line-height: ${updated.lineHeight} !important;`);
    if (updated.letterSpacing) cssRules.push(`letter-spacing: ${updated.letterSpacing} !important;`);
    if (updated.textAlign && updated.textAlign !== 'left') cssRules.push(`text-align: ${updated.textAlign} !important;`);
    if (updated.textTransform && updated.textTransform !== 'none') cssRules.push(`text-transform: ${updated.textTransform} !important;`);
    if (updated.textDecoration && updated.textDecoration !== 'none') cssRules.push(`text-decoration: ${updated.textDecoration} !important;`);

    const css = cssRules.length > 0 ? `body, * { ${cssRules.join(' ')} }` : '';
    onTypographyChange(css);
  };

  const fontFamilies = [
    'Inter, sans-serif',
    'Roboto, sans-serif',
    'Playfair Display, serif',
    'Montserrat, sans-serif',
    'Open Sans, sans-serif',
    'Lato, sans-serif',
    'Courier New, monospace',
  ];

  return (
    <div className="design-panel">

      {/* Typography Section */}
      <div className="design-section">
        <div className="section-title">
          <Type size={16} />
          <span>Typography</span>
        </div>
        <div className="section-content">

                {/* Font Size & Weight */}
                <div className="control-row">
                  <div className="control-group half">
                    <label>Size</label>
                    <input
                      type="text"
                      placeholder="16px"
                      value={typography.fontSize}
                      onChange={(e) => updateTypography('fontSize', e.target.value)}
                      className="modern-input"
                    />
                  </div>
                  <div className="control-group half">
                    <label>Weight</label>
                    <select
                      value={typography.fontWeight}
                      onChange={(e) => updateTypography('fontWeight', e.target.value)}
                      className="modern-select"
                    >
                      <option value="300">Light</option>
                      <option value="400">Regular</option>
                      <option value="500">Medium</option>
                      <option value="600">SemiBold</option>
                      <option value="700">Bold</option>
                    </select>
                  </div>
                </div>

                {/* Font Family */}
                <div className="control-group">
                  <label>Font Family</label>
                  <select
                    value={typography.fontFamily}
                    onChange={(e) => updateTypography('fontFamily', e.target.value)}
                    className="modern-select full"
                  >
                    <option value="">Default System Font</option>
                    {fontFamilies.map((font) => (
                      <option key={font} value={font}>
                        {font.split(',')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Style Toggles */}
                <div className="control-group">
                  <label>Style</label>
                  <div className="toggle-group">
                    <button
                      className={`toggle-btn ${typography.fontWeight === '700' ? 'active' : ''}`}
                      onClick={() => updateTypography('fontWeight', typography.fontWeight === '700' ? '400' : '700')}
                    >
                      <Bold size={16} />
                    </button>
                    <button
                      className={`toggle-btn ${typography.fontStyle === 'italic' ? 'active' : ''}`}
                      onClick={() => updateTypography('fontStyle', typography.fontStyle === 'italic' ? 'normal' : 'italic')}
                    >
                      <Italic size={16} />
                    </button>
                    <button
                      className={`toggle-btn ${typography.textDecoration === 'underline' ? 'active' : ''}`}
                      onClick={() => updateTypography('textDecoration', typography.textDecoration === 'underline' ? 'none' : 'underline')}
                    >
                      <Underline size={16} />
                    </button>
                  </div>
                </div>

                {/* Alignment */}
                <div className="control-group">
                  <label>Align</label>
                  <div className="toggle-group">
                    <button
                      className={`toggle-btn ${typography.textAlign === 'left' ? 'active' : ''}`}
                      onClick={() => updateTypography('textAlign', 'left')}
                    >
                      <AlignLeft size={16} />
                    </button>
                    <button
                      className={`toggle-btn ${typography.textAlign === 'center' ? 'active' : ''}`}
                      onClick={() => updateTypography('textAlign', 'center')}
                    >
                      <AlignCenter size={16} />
                    </button>
                    <button
                      className={`toggle-btn ${typography.textAlign === 'right' ? 'active' : ''}`}
                      onClick={() => updateTypography('textAlign', 'right')}
                    >
                      <AlignRight size={16} />
                    </button>
                    <button
                      className={`toggle-btn ${typography.textAlign === 'justify' ? 'active' : ''}`}
                      onClick={() => updateTypography('textAlign', 'justify')}
                    >
                      <AlignJustify size={16} />
                    </button>
                  </div>
                </div>
        </div>
      </div>

      {/* Effects Section */}
      <div className="design-section">
        <div className="section-title">
          <Sparkles size={16} />
          <span>Effects</span>
        </div>
        <div className="section-content">
                <div className="effects-grid-new">
                  {PREDEFINED_EFFECTS.map((effect) => {
                    const isActive = activeEffects.includes(effect.id);
                    return (
                      <motion.button
                        key={effect.id}
                        className={`effect-card-new ${isActive ? 'active' : ''}`}
                        onClick={() => onToggleEffect(effect.id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="effect-icon-placeholder">
                          <Palette size={16} />
                        </div>
                        <div className="effect-info">
                          <span className="effect-name">{effect.name}</span>
                        </div>
                        {isActive && <div className="active-dot" />}
                      </motion.button>
                    );
                  })}
                </div>
        </div>
      </div>

      {/* Templates Section */}
      <div className="design-section">
        <div className="section-title">
          <FileText size={16} />
          <span>Templates</span>
        </div>
        <div className="section-content">
                <div className="templates-list-modern">
                  {['Modern Blog', 'Corporate', 'Creative', 'Minimalist'].map(t => (
                    <div key={t} className="template-item-modern">
                      <div className="template-preview" />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
        </div>
      </div>

      {/* Layout Section */}
      <div className="design-section">
        <div className="section-title">
          <Layout size={16} />
          <span>Layout</span>
        </div>
        <div className="section-content">
                <div className="control-group">
                  <label>Max Width</label>
                  <input type="text" placeholder="1200px" className="modern-input" />
                </div>
        </div>
      </div>

    </div>
  );
};

export default DesignPanel;
