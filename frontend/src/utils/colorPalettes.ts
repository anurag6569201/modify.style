// Color palette utilities for randomization

export interface ColorPalette {
  id: string;
  colors: string[];
  date?: string;
  likes?: number;
}

// Fallback palettes if JSON file is not available
const FALLBACK_PALETTES: ColorPalette[] = [
  { id: '1', colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'] },
  { id: '2', colors: ['#2C3E50', '#E74C3C', '#3498DB', '#F39C12'] },
  { id: '3', colors: ['#9B59B6', '#1ABC9C', '#E67E22', '#34495E'] },
  { id: '4', colors: ['#E91E63', '#00BCD4', '#FFC107', '#4CAF50'] },
  { id: '5', colors: ['#673AB7', '#03A9F4', '#FF9800', '#8BC34A'] },
  { id: '6', colors: ['#F44336', '#2196F3', '#FFEB3B', '#009688'] },
  { id: '7', colors: ['#9C27B0', '#00E676', '#FF5722', '#00ACC1'] },
  { id: '8', colors: ['#3F51B5', '#FF4081', '#FFC400', '#00BCD4'] },
  { id: '9', colors: ['#795548', '#607D8B', '#FF9800', '#4CAF50'] },
  { id: '10', colors: ['#E91E63', '#00E5FF', '#FF6F00', '#1DE9B6'] },
];

let cachedPalettes: ColorPalette[] | null = null;

/**
 * Load color palettes from JSON file or use fallback
 */
export async function loadColorPalettes(): Promise<ColorPalette[]> {
  if (cachedPalettes) {
    return cachedPalettes;
  }

  try {
    const response = await fetch('/colorhunt_palettes.json');
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        // Transform the data to match our interface
        const palettes: ColorPalette[] = data.map((item: any) => ({
          id: item.id || String(Math.random()),
          colors: item.colors || [],
          date: item.date,
          likes: item.likes,
        })).filter((p: ColorPalette) => p.colors.length >= 4);
        
        if (palettes.length > 0) {
          cachedPalettes = palettes;
          return palettes;
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load color palettes from JSON, using fallback:', error);
  }

  // Use fallback palettes
  cachedPalettes = FALLBACK_PALETTES;
  return FALLBACK_PALETTES;
}

/**
 * Get a random palette from the available palettes
 */
export async function getRandomPalette(): Promise<ColorPalette> {
  const palettes = await loadColorPalettes();
  const randomIndex = Math.floor(Math.random() * palettes.length);
  return palettes[randomIndex];
}

/**
 * Convert hex color to RGB for better color matching
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate color brightness (0-255)
 */
function getBrightness(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 128;
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
}

/**
 * Calculate color distance between two colors
 */
function colorDistance(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  if (!rgb1 || !rgb2) return Infinity;

  const dr = rgb1.r - rgb2.r;
  const dg = rgb1.g - rgb2.g;
  const db = rgb1.b - rgb2.b;

  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Map existing colors to new palette colors
 * Tries to match colors by brightness and usage frequency
 */
export function mapColorsToPalette(
  existingColors: string[],
  newPalette: ColorPalette
): Record<string, string> {
  const colorMap: Record<string, string> = {};
  const usedPaletteColors = new Set<number>();

  // Sort existing colors by frequency (if provided) or brightness
  const sortedColors = [...existingColors].sort((a, b) => {
    const brightnessA = getBrightness(a);
    const brightnessB = getBrightness(b);
    return brightnessA - brightnessB;
  });

  // Sort palette colors by brightness
  const sortedPalette = [...newPalette.colors].sort((a, b) => {
    return getBrightness(a) - getBrightness(b);
  });

  // Map each existing color to the closest unused palette color
  for (const existingColor of sortedColors) {
    let bestMatch = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < sortedPalette.length; i++) {
      if (usedPaletteColors.has(i)) continue;

      const distance = colorDistance(existingColor, sortedPalette[i]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = i;
      }
    }

    // If all colors are used, cycle through them
    if (bestMatch === -1) {
      bestMatch = Math.floor(Math.random() * sortedPalette.length);
    } else {
      usedPaletteColors.add(bestMatch);
    }

    colorMap[existingColor.toLowerCase()] = sortedPalette[bestMatch];
  }

  return colorMap;
}

/**
 * Generate CSS rules to replace colors using a more effective approach
 * This creates CSS custom properties and rules for color replacement
 * Note: DOM manipulation is more effective, but this provides additional coverage
 */
export function generateColorReplacementCSS(colorMap: Record<string, string>): string {
  if (!colorMap || Object.keys(colorMap).length === 0) return '';

  let css = '/* Color Palette Replacement - Additional Coverage */\n';
  
  // Generate CSS custom properties for each color mapping
  css += ':root {\n';
  for (const [oldColor, newColor] of Object.entries(colorMap)) {
    const normalizedOldColor = oldColor.startsWith('#') ? oldColor.toLowerCase() : `#${oldColor.toLowerCase()}`;
    const varName = `--color-replace-${normalizedOldColor.replace('#', '')}`;
    css += `  ${varName}: ${newColor};\n`;
  }
  css += '}\n\n';
  
  // Note: The actual replacement is done via DOM manipulation
  // This CSS is just for additional coverage if needed
  
  return css;
}

/**
 * Convert any color format to hex
 */
function colorToHex(color: string): string | null {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;

  // Already hex
  if (color.startsWith('#')) {
    if (color.length === 4) {
      // Short hex like #fff
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }
    return color.length === 7 ? color.toLowerCase() : null;
  }

  // RGB/RGBA
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

  return null;
}

/**
 * Apply color replacements directly to DOM elements
 * This comprehensively replaces colors in all possible locations
 */
export function applyColorReplacementsToDOM(
  doc: Document,
  colorMap: Record<string, string>
): void {
  if (!doc || !colorMap || Object.keys(colorMap).length === 0) return;

  // Normalize color map keys - create a map with all possible variations
  const normalizedColorMap: Record<string, string> = {};
  for (const [oldColor, newColor] of Object.entries(colorMap)) {
    const normalized = oldColor.startsWith('#') ? oldColor.toLowerCase() : `#${oldColor.toLowerCase()}`;
    normalizedColorMap[normalized] = newColor;
    normalizedColorMap[normalized.toUpperCase()] = newColor;
    // Also add without # prefix
    normalizedColorMap[normalized.substring(1)] = newColor;
    normalizedColorMap[normalized.substring(1).toUpperCase()] = newColor;
    
    // Add RGB variations
    const rgb = hexToRgb(normalized);
    if (rgb) {
      normalizedColorMap[`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`] = newColor;
      normalizedColorMap[`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`] = newColor;
    }
  }

  // Replace colors in all stylesheets
  try {
    for (let i = 0; i < doc.styleSheets.length; i++) {
      const sheet = doc.styleSheets[i];
      try {
        if (sheet.cssRules) {
          for (let j = 0; j < sheet.cssRules.length; j++) {
            const rule = sheet.cssRules[j] as CSSStyleRule;
            if (rule.style) {
              const colorProps = [
                'color', 'background-color', 'background', 'border-color',
                'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
                'outline-color', 'text-decoration-color', 'column-rule-color', 'box-shadow', 'text-shadow'
              ];
              
              colorProps.forEach(prop => {
                const value = rule.style.getPropertyValue(prop);
                if (value) {
                  const hexValue = colorToHex(value);
                  if (hexValue && normalizedColorMap[hexValue]) {
                    rule.style.setProperty(prop, normalizedColorMap[hexValue], 'important');
                  }
                }
              });
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheets may throw errors, skip them
        continue;
      }
    }
  } catch (e) {
    // Ignore stylesheet access errors
  }

  // Get all elements and replace colors
  const allElements = doc.querySelectorAll('*');
  
  allElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const computed = doc.defaultView?.getComputedStyle(el) || window.getComputedStyle(el);
    
    // Check and replace color properties
    const colorProps = [
      { js: 'color', css: 'color' },
      { js: 'backgroundColor', css: 'background-color' },
      { js: 'borderColor', css: 'border-color' },
      { js: 'borderTopColor', css: 'border-top-color' },
      { js: 'borderRightColor', css: 'border-right-color' },
      { js: 'borderBottomColor', css: 'border-bottom-color' },
      { js: 'borderLeftColor', css: 'border-left-color' },
      { js: 'outlineColor', css: 'outline-color' },
      { js: 'textDecorationColor', css: 'text-decoration-color' },
      { js: 'columnRuleColor', css: 'column-rule-color' },
    ];

    colorProps.forEach(({ js, css }) => {
      const value = computed.getPropertyValue(css) || (computed as any)[js];
      if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)' || value === 'initial' || value === 'inherit') {
        return;
      }

      // Convert to hex
      const hexValue = colorToHex(value);
      if (hexValue && normalizedColorMap[hexValue]) {
        const newColor = normalizedColorMap[hexValue];
        htmlEl.style.setProperty(css, newColor, 'important');
      }
    });

    // Replace in inline styles (comprehensive)
    if (htmlEl.style && htmlEl.style.cssText) {
      let inlineStyle = htmlEl.style.cssText;
      let modified = false;
      
      for (const [oldColor, newColor] of Object.entries(normalizedColorMap)) {
        // Create regex patterns for various color formats
        const patterns = [
          new RegExp(`\\b${oldColor.replace('#', '#?')}\\b`, 'gi'),
          new RegExp(`rgb\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*\\)`, 'gi'),
        ];
        
        patterns.forEach(pattern => {
          if (pattern.test(inlineStyle)) {
            // Get RGB value if it matches
            const rgb = hexToRgb(oldColor);
            if (rgb) {
              const rgbPattern = new RegExp(`rgb\\(\\s*${rgb.r}\\s*,\\s*${rgb.g}\\s*,\\s*${rgb.b}\\s*\\)`, 'gi');
              inlineStyle = inlineStyle.replace(rgbPattern, newColor);
              modified = true;
            }
            inlineStyle = inlineStyle.replace(new RegExp(oldColor.replace('#', '#?'), 'gi'), newColor);
            modified = true;
          }
        });
      }
      
      if (modified) {
        htmlEl.style.cssText = inlineStyle;
      }
    }

    // Also check SVG elements
    if (el.tagName === 'svg' || el.querySelector('svg')) {
      const svgElements = el.querySelectorAll('*');
      svgElements.forEach(svgEl => {
        const svgHtmlEl = svgEl as HTMLElement;
        const svgAttrs = ['fill', 'stroke', 'stop-color'];
        svgAttrs.forEach(attr => {
          const value = svgHtmlEl.getAttribute(attr);
          if (value) {
            const hexValue = colorToHex(value);
            if (hexValue && normalizedColorMap[hexValue]) {
              svgHtmlEl.setAttribute(attr, normalizedColorMap[hexValue]);
            }
          }
        });
      });
    }
  });
}

