import { useEffect, useState, useCallback } from 'react';
import { Palette, Type, RefreshCw, Copy, Check, Ruler, Box, Layers, Image as ImageIcon, Link2, Sparkles, Shuffle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getRandomPalette, mapColorsToPalette, applyColorReplacementsToDOM } from '../utils/colorPalettes';
import './BrandExtractor.css';

interface ColorInfo {
  color: string;
  count: number;
  usage: string[];
}

interface FontInfo {
  family: string;
  count: number;
  weights: Set<string>;
  sizes: Set<string>;
}

interface SpacingInfo {
  value: string;
  count: number;
  type: 'margin' | 'padding';
}

interface BorderRadiusInfo {
  value: string;
  count: number;
}

interface ShadowInfo {
  value: string;
  count: number;
  type: 'box-shadow' | 'text-shadow';
}

interface TypographyScale {
  size: string;
  count: number;
  elements: string[];
}

interface LayoutInfo {
  display: string;
  count: number;
  flexDirection?: string;
  gridTemplate?: string;
}

export default function BrandExtractor() {
  const { state, setExtractedColors, setColorMapping } = useApp();
  const [colors, setColors] = useState<ColorInfo[]>([]);
  const [fonts, setFonts] = useState<FontInfo[]>([]);
  const [spacing, setSpacing] = useState<SpacingInfo[]>([]);
  const [borderRadius, setBorderRadius] = useState<BorderRadiusInfo[]>([]);
  const [shadows, setShadows] = useState<ShadowInfo[]>([]);
  const [typographyScale, setTypographyScale] = useState<TypographyScale[]>([]);
  const [layouts, setLayouts] = useState<LayoutInfo[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [isRandomizing, setIsRandomizing] = useState(false);

  // Convert hex/rgb to hex format
  const normalizeColor = (color: string): string | null => {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      return null;
    }

    // Handle rgb/rgba
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      return `#${[r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      }).join('')}`;
    }

    // Handle hex
    if (color.startsWith('#')) {
      if (color.length === 4) {
        return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
      }
      return color.length === 7 ? color : null;
    }

    return null;
  };

  // Extract comprehensive brand info from the iframe
  const extractBrandInfo = useCallback(() => {
    if (!state.view.htmlContent) return;

    setIsExtracting(true);
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe) {
      setIsExtracting(false);
      return;
    }

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        setIsExtracting(false);
        return;
      }

      // Wait for styles to load
      setTimeout(() => {
        const colorMap = new Map<string, { count: number; usage: string[] }>();
        const fontMap = new Map<string, { count: number; weights: Set<string>; sizes: Set<string> }>();
        const spacingMap = new Map<string, { count: number; type: 'margin' | 'padding' }>();
        const borderRadiusMap = new Map<string, number>();
        const shadowMap = new Map<string, { count: number; type: 'box-shadow' | 'text-shadow' }>();
        const fontSizeMap = new Map<string, { count: number; elements: Set<string> }>();
        const layoutMap = new Map<string, { count: number; flexDirection?: string; gridTemplate?: string }>();
        const imageSet = new Set<string>();
        const linkSet = new Set<string>();

        // Get all elements
        const allElements = iframeDoc.querySelectorAll('*');
        
        allElements.forEach((el) => {
          const computed = iframeDoc.defaultView?.getComputedStyle(el) || window.getComputedStyle(el);
          
          // Extract colors
          const colorProps = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'];
          colorProps.forEach(prop => {
            const colorValue = computed.getPropertyValue(prop);
            const normalized = normalizeColor(colorValue);
            if (normalized) {
              const existing = colorMap.get(normalized) || { count: 0, usage: [] };
              existing.count++;
              if (!existing.usage.includes(prop)) {
                existing.usage.push(prop);
              }
              colorMap.set(normalized, existing);
            }
          });

          // Extract fonts
          const fontFamily = computed.fontFamily;
          if (fontFamily && fontFamily !== 'initial' && fontFamily !== 'inherit') {
            const cleanFamily = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
            if (cleanFamily) {
              const existing = fontMap.get(cleanFamily) || { count: 0, weights: new Set(), sizes: new Set() };
              existing.count++;
              existing.weights.add(computed.fontWeight);
              existing.sizes.add(computed.fontSize);
              fontMap.set(cleanFamily, existing);
            }
          }

          // Extract spacing (margins and paddings)
          const margin = computed.margin;
          const padding = computed.padding;
          if (margin && margin !== '0px' && margin !== 'initial' && margin !== 'inherit') {
            const key = `margin:${margin}`;
            const existing = spacingMap.get(key) || { count: 0, type: 'margin' as const };
            existing.count++;
            spacingMap.set(key, existing);
          }
          if (padding && padding !== '0px' && padding !== 'initial' && padding !== 'inherit') {
            const key = `padding:${padding}`;
            const existing = spacingMap.get(key) || { count: 0, type: 'padding' as const };
            existing.count++;
            spacingMap.set(key, existing);
          }

          // Extract border radius
          const borderRadius = computed.borderRadius;
          if (borderRadius && borderRadius !== '0px' && borderRadius !== 'initial' && borderRadius !== 'inherit') {
            const existing = borderRadiusMap.get(borderRadius) || 0;
            borderRadiusMap.set(borderRadius, existing + 1);
          }

          // Extract shadows
          const boxShadow = computed.boxShadow;
          const textShadow = computed.textShadow;
          if (boxShadow && boxShadow !== 'none' && boxShadow !== 'initial' && boxShadow !== 'inherit') {
            const key = `box-shadow:${boxShadow}`;
            const existing = shadowMap.get(key) || { count: 0, type: 'box-shadow' as const };
            existing.count++;
            shadowMap.set(key, existing);
          }
          if (textShadow && textShadow !== 'none' && textShadow !== 'initial' && textShadow !== 'inherit') {
            const key = `text-shadow:${textShadow}`;
            const existing = shadowMap.get(key) || { count: 0, type: 'text-shadow' as const };
            existing.count++;
            shadowMap.set(key, existing);
          }

          // Extract font sizes for typography scale
          const fontSize = computed.fontSize;
          if (fontSize && fontSize !== 'initial' && fontSize !== 'inherit') {
            const existing = fontSizeMap.get(fontSize) || { count: 0, elements: new Set() };
            existing.count++;
            existing.elements.add(el.tagName.toLowerCase());
            fontSizeMap.set(fontSize, existing);
          }

          // Extract layout patterns
          const display = computed.display;
          if (display && display !== 'initial' && display !== 'inherit') {
            const key = display;
            const existing = layoutMap.get(key) || { count: 0 };
            existing.count++;
            if (display === 'flex') {
              existing.flexDirection = computed.flexDirection;
            } else if (display === 'grid') {
              existing.gridTemplate = computed.gridTemplateColumns || computed.gridTemplateRows;
            }
            layoutMap.set(key, existing);
          }

          // Extract images
          if (el.tagName.toLowerCase() === 'img') {
            const src = (el as HTMLImageElement).src;
            if (src && !src.includes('data:') && !src.includes('base64')) {
              imageSet.add(src);
            }
          }

          // Extract links
          if (el.tagName.toLowerCase() === 'a') {
            const href = (el as HTMLAnchorElement).href;
            if (href && href !== '#' && !href.startsWith('javascript:')) {
              linkSet.add(href);
            }
          }
        });

        // Convert to arrays and sort
        const colorArray: ColorInfo[] = Array.from(colorMap.entries())
          .map(([color, data]) => ({
            color,
            count: data.count,
            usage: data.usage,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20);

        const fontArray: FontInfo[] = Array.from(fontMap.entries())
          .map(([family, data]) => ({
            family,
            count: data.count,
            weights: data.weights,
            sizes: data.sizes,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15);

        const spacingArray: SpacingInfo[] = Array.from(spacingMap.entries())
          .map(([key, data]) => ({
            value: key.split(':')[1],
            count: data.count,
            type: data.type,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15);

        const borderRadiusArray: BorderRadiusInfo[] = Array.from(borderRadiusMap.entries())
          .map(([value, count]) => ({
            value,
            count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const shadowArray: ShadowInfo[] = Array.from(shadowMap.entries())
          .map(([key, data]) => ({
            value: key.split(':')[1],
            count: data.count,
            type: data.type,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        const typographyArray: TypographyScale[] = Array.from(fontSizeMap.entries())
          .map(([size, data]) => ({
            size,
            count: data.count,
            elements: Array.from(data.elements),
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12);

        const layoutArray: LayoutInfo[] = Array.from(layoutMap.entries())
          .map(([display, data]) => ({
            display,
            count: data.count,
            flexDirection: data.flexDirection,
            gridTemplate: data.gridTemplate,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        setColors(colorArray);
        setFonts(fontArray);
        setSpacing(spacingArray);
        setBorderRadius(borderRadiusArray);
        setShadows(shadowArray);
        setTypographyScale(typographyArray);
        setLayouts(layoutArray);
        setImages(Array.from(imageSet).slice(0, 20));
        setLinks(Array.from(linkSet).slice(0, 20));
        
        // Store extracted colors in context for color randomization
        setExtractedColors(colorArray.map(c => ({ color: c.color, usage: c.usage })));
        
        setIsExtracting(false);
      }, 1000);
    } catch (err) {
      console.error('Error extracting brand info:', err);
      setIsExtracting(false);
    }
  }, [state.view.htmlContent]);

  // Auto-extract when URL loads
  useEffect(() => {
    if (state.view.htmlContent && state.view.currentUrl) {
      extractBrandInfo();
    }
  }, [state.view.htmlContent, state.view.currentUrl, extractBrandInfo]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(text);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  // Toggle color selection
  const toggleColorSelection = (color: string) => {
    const newSelected = new Set(selectedColors);
    if (newSelected.has(color)) {
      newSelected.delete(color);
    } else {
      newSelected.add(color);
    }
    setSelectedColors(newSelected);
  };

  // Select all colors
  const selectAllColors = () => {
    setSelectedColors(new Set(colors.map(c => c.color)));
  };

  // Deselect all colors
  const deselectAllColors = () => {
    setSelectedColors(new Set());
  };

  // Randomize selected colors
  const randomizeSelectedColors = useCallback(async () => {
    if (selectedColors.size === 0) {
      alert('Please select at least one color to randomize');
      return;
    }

    setIsRandomizing(true);
    try {
      // Get a random palette
      const randomPalette = await getRandomPalette();
      
      // Map selected colors to new palette colors
      const selectedColorsArray = Array.from(selectedColors);
      const colorMapping = mapColorsToPalette(selectedColorsArray, randomPalette);
      
      // Merge with existing color mapping to preserve previous randomizations
      const existingMapping = state.editor.colorMapping || {};
      const mergedMapping = { ...existingMapping, ...colorMapping };
      
      // Store the mapping in state (this will trigger WebsiteViewer's useEffect)
      setColorMapping(mergedMapping);
      
      // Apply to iframe immediately for instant feedback
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (iframe) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          // Apply color replacements directly to DOM - this will override all instances
          // This ensures changes are reflected immediately without page reload
          applyColorReplacementsToDOM(iframeDoc, mergedMapping);
        }
      }
    } catch (error) {
      console.error('Error randomizing colors:', error);
      alert('Failed to randomize colors. Please try again.');
    } finally {
      setIsRandomizing(false);
    }
  }, [selectedColors, setColorMapping, state.editor.colorMapping]);

  return (
    <div className="brand-extractor">
      <div className="brand-header">
        <div className="brand-title">
          <Palette size={16} />
          <span>Brand Extractor</span>
        </div>
        <button
          className="extract-btn"
          onClick={extractBrandInfo}
          disabled={isExtracting || !state.view.htmlContent}
          title="Re-extract Brand Info"
        >
          <RefreshCw size={14} className={isExtracting ? 'spinning' : ''} />
        </button>
      </div>

      {isExtracting && (
        <div className="extracting-indicator">
          <RefreshCw size={14} className="spinning" />
          <span>Extracting brand information...</span>
        </div>
      )}

      {!isExtracting && colors.length === 0 && fonts.length === 0 && state.view.htmlContent && (
        <div className="brand-empty">
          <Palette size={32} />
          <p>No brand information extracted yet</p>
          <button className="extract-action-btn" onClick={extractBrandInfo}>
            Extract Now
          </button>
        </div>
      )}

      {!state.view.htmlContent && (
        <div className="brand-empty">
          <Palette size={32} />
          <p>Load a website to extract brand information</p>
        </div>
      )}

      {/* Color Palette */}
      {colors.length > 0 && (
        <div className="brand-section">
          <div className="section-header">
            <Palette size={14} />
            <span>Color Palette ({colors.length})</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="color-select-btn"
                onClick={selectAllColors}
                title="Select All"
              >
                Select All
              </button>
              <button
                className="color-select-btn"
                onClick={deselectAllColors}
                title="Deselect All"
              >
                Clear
              </button>
              <button
                className="randomize-colors-btn"
                onClick={randomizeSelectedColors}
                disabled={selectedColors.size === 0 || isRandomizing}
                title={selectedColors.size === 0 ? 'Select colors to randomize' : 'Randomize selected colors'}
              >
                <Shuffle size={14} />
                {isRandomizing ? 'Randomizing...' : 'Randomize'}
              </button>
            </div>
          </div>
          <div className="colors-grid">
            {colors.map((colorInfo) => {
              const isSelected = selectedColors.has(colorInfo.color);
              return (
                <div 
                  key={colorInfo.color} 
                  className={`color-item ${isSelected ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="color-checkbox"
                    checked={isSelected}
                    onChange={() => toggleColorSelection(colorInfo.color)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="color-swatch"
                    style={{ backgroundColor: colorInfo.color }}
                    onClick={() => copyToClipboard(colorInfo.color)}
                    title={`Click to copy: ${colorInfo.color}`}
                  >
                    {copiedItem === colorInfo.color && (
                      <div className="copy-indicator">
                        <Check size={12} />
                      </div>
                    )}
                  </div>
                  <div className="color-info">
                    <div className="color-value">{colorInfo.color}</div>
                    <div className="color-count">{colorInfo.count} uses</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Font List */}
      {fonts.length > 0 && (
        <div className="brand-section">
          <div className="section-header">
            <Type size={14} />
            <span>Fonts ({fonts.length})</span>
          </div>
          <div className="fonts-list">
            {fonts.map((fontInfo) => (
              <div key={fontInfo.family} className="font-item">
                <div className="font-preview" style={{ fontFamily: fontInfo.family }}>
                  Aa
                </div>
                <div className="font-info">
                  <div className="font-name">{fontInfo.family}</div>
                  <div className="font-details">
                    {fontInfo.count} uses • {Array.from(fontInfo.weights).join(', ')} • {Array.from(fontInfo.sizes).slice(0, 3).join(', ')}
                  </div>
                </div>
                <button
                  className="font-copy-btn"
                  onClick={() => copyToClipboard(fontInfo.family)}
                  title="Copy font name"
                >
                  {copiedItem === fontInfo.family ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Typography Scale */}
      {typographyScale.length > 0 && (
        <div className="brand-section">
          <div className="section-header">
            <Type size={14} />
            <span>Typography Scale ({typographyScale.length})</span>
          </div>
          <div className="typography-scale-list">
            {typographyScale.map((scale) => (
              <div key={scale.size} className="scale-item">
                <div className="scale-preview" style={{ fontSize: scale.size }}>
                  Aa
                </div>
                <div className="scale-info">
                  <div className="scale-size">{scale.size}</div>
                  <div className="scale-details">
                    {scale.count} uses • {scale.elements.slice(0, 3).join(', ')}
                  </div>
                </div>
                <button
                  className="scale-copy-btn"
                  onClick={() => copyToClipboard(scale.size)}
                  title="Copy font size"
                >
                  {copiedItem === scale.size ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spacing */}
      {spacing.length > 0 && (
        <div className="brand-section">
          <div className="section-header">
            <Ruler size={14} />
            <span>Spacing ({spacing.length})</span>
          </div>
          <div className="spacing-list">
            {spacing.map((spacingInfo, idx) => (
              <div key={`${spacingInfo.type}-${idx}`} className="spacing-item">
                <div className="spacing-type">{spacingInfo.type}</div>
                <div className="spacing-value">{spacingInfo.value}</div>
                <div className="spacing-count">{spacingInfo.count} uses</div>
                <button
                  className="spacing-copy-btn"
                  onClick={() => copyToClipboard(spacingInfo.value)}
                  title="Copy spacing value"
                >
                  {copiedItem === spacingInfo.value ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Border Radius */}
      {borderRadius.length > 0 && (
        <div className="brand-section">
          <div className="section-header">
            <Box size={14} />
            <span>Border Radius ({borderRadius.length})</span>
          </div>
          <div className="border-radius-list">
            {borderRadius.map((radius) => (
              <div key={radius.value} className="radius-item">
                <div className="radius-preview" style={{ borderRadius: radius.value, width: '40px', height: '40px', background: 'rgba(100, 108, 255, 0.3)' }} />
                <div className="radius-info">
                  <div className="radius-value">{radius.value}</div>
                  <div className="radius-count">{radius.count} uses</div>
                </div>
                <button
                  className="radius-copy-btn"
                  onClick={() => copyToClipboard(radius.value)}
                  title="Copy border radius"
                >
                  {copiedItem === radius.value ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shadows */}
      {shadows.length > 0 && (
        <div className="brand-section">
          <div className="section-header">
            <Sparkles size={14} />
            <span>Shadows ({shadows.length})</span>
          </div>
          <div className="shadows-list">
            {shadows.map((shadow, idx) => (
              <div key={`${shadow.type}-${idx}`} className="shadow-item">
                <div className="shadow-preview" style={{ 
                  boxShadow: shadow.type === 'box-shadow' ? shadow.value : 'none',
                  textShadow: shadow.type === 'text-shadow' ? shadow.value : 'none',
                  padding: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '4px'
                }}>
                  {shadow.type === 'box-shadow' ? 'Box' : 'Text'}
                </div>
                <div className="shadow-info">
                  <div className="shadow-type">{shadow.type}</div>
                  <div className="shadow-value" title={shadow.value}>
                    {shadow.value.length > 40 ? shadow.value.substring(0, 40) + '...' : shadow.value}
                  </div>
                  <div className="shadow-count">{shadow.count} uses</div>
                </div>
                <button
                  className="shadow-copy-btn"
                  onClick={() => copyToClipboard(shadow.value)}
                  title="Copy shadow value"
                >
                  {copiedItem === shadow.value ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layout Patterns */}
      {layouts.length > 0 && (
        <div className="brand-section">
          <div className="section-header">
            <Layers size={14} />
            <span>Layout Patterns ({layouts.length})</span>
          </div>
          <div className="layouts-list">
            {layouts.map((layout, idx) => (
              <div key={`${layout.display}-${idx}`} className="layout-item">
                <div className="layout-display">{layout.display}</div>
                {layout.flexDirection && (
                  <div className="layout-detail">Direction: {layout.flexDirection}</div>
                )}
                {layout.gridTemplate && (
                  <div className="layout-detail">Template: {layout.gridTemplate.substring(0, 30)}...</div>
                )}
                <div className="layout-count">{layout.count} uses</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Images */}
      {images.length > 0 && (
        <div className="brand-section">
          <div className="section-header">
            <ImageIcon size={14} />
            <span>Images ({images.length})</span>
          </div>
          <div className="images-list">
            {images.map((imageUrl, idx) => (
              <div key={idx} className="image-item">
                <img src={imageUrl} alt="" className="image-thumbnail" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="image-info">
                  <div className="image-url" title={imageUrl}>
                    {imageUrl.length > 50 ? imageUrl.substring(0, 50) + '...' : imageUrl}
                  </div>
                </div>
                <button
                  className="image-copy-btn"
                  onClick={() => copyToClipboard(imageUrl)}
                  title="Copy image URL"
                >
                  {copiedItem === imageUrl ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      {links.length > 0 && (
        <div className="brand-section">
          <div className="section-header">
            <Link2 size={14} />
            <span>Links ({links.length})</span>
          </div>
          <div className="links-list">
            {links.map((linkUrl, idx) => (
              <div key={idx} className="link-item">
                <div className="link-info">
                  <div className="link-url" title={linkUrl}>
                    {linkUrl.length > 60 ? linkUrl.substring(0, 60) + '...' : linkUrl}
                  </div>
                </div>
                <button
                  className="link-copy-btn"
                  onClick={() => copyToClipboard(linkUrl)}
                  title="Copy link URL"
                >
                  {copiedItem === linkUrl ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
