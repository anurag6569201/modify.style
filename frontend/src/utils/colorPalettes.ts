// Color palette utilities with intelligent color theory-based palette generation

// Color theory-based palette types
export type PaletteType = 'complementary' | 'analogous' | 'triadic' | 'monochromatic' | 'split-complementary' | 'tetradic';

// Convert hex to RGB
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

// Convert RGB to hex
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Convert HSL to RGB
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// Get brightness (luminance) of a color
function getBrightness(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  // Using relative luminance formula
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

// Get saturation of a color
function getSaturation(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return hsl.s;
}

// Helper to normalize color format (used in multiple places)
function normalizeColorString(color: string): string | null {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
    return null;
  }

  if (color.startsWith('#')) {
    // Normalize hex colors
    if (color.length === 4) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
    }
    return color.length === 7 ? color.toLowerCase() : null;
  }

  // Try to convert rgb/rgba to hex
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return rgbToHex(r, g, b).toLowerCase();
  }

  return null;
}

// Generate complementary palette
function generateComplementaryPalette(baseColor: string, count: number = 4): string[] {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return [baseColor];

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const complementaryHue = (hsl.h + 180) % 360;

  const colors: string[] = [baseColor];

  // Generate variations
  for (let i = 1; i < count; i++) {
    const variation = i % 2 === 1 
      ? { h: complementaryHue, s: hsl.s, l: hsl.l }
      : { h: hsl.h, s: hsl.s, l: Math.max(10, Math.min(90, hsl.l + (i % 2 === 0 ? -20 : 20))) };
    
    const newRgb = hslToRgb(variation.h, variation.s, variation.l);
    colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  }

  return colors.slice(0, count);
}

// Generate analogous palette
function generateAnalogousPalette(baseColor: string, count: number = 4): string[] {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return [baseColor];

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const colors: string[] = [baseColor];

  const step = 30; // 30 degrees apart for analogous colors
  for (let i = 1; i < count; i++) {
    const offset = i % 2 === 0 ? (i / 2) * step : -(Math.ceil(i / 2)) * step;
    const newHue = (hsl.h + offset + 360) % 360;
    const newRgb = hslToRgb(newHue, hsl.s, hsl.l);
    colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  }

  return colors.slice(0, count);
}

// Generate triadic palette
function generateTriadicPalette(baseColor: string, count: number = 4): string[] {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return [baseColor];

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const colors: string[] = [baseColor];

  const hue1 = (hsl.h + 120) % 360;
  const hue2 = (hsl.h + 240) % 360;

  const newRgb1 = hslToRgb(hue1, hsl.s, hsl.l);
  const newRgb2 = hslToRgb(hue2, hsl.s, hsl.l);

  colors.push(rgbToHex(newRgb1.r, newRgb1.g, newRgb1.b));
  if (count > 2) colors.push(rgbToHex(newRgb2.r, newRgb2.g, newRgb2.b));

  // Add variations
  for (let i = 3; i < count; i++) {
    const variation = i % 2 === 0 
      ? { h: hsl.h, s: hsl.s, l: Math.max(10, hsl.l - 15) }
      : { h: hsl.h, s: hsl.s, l: Math.min(90, hsl.l + 15) };
    
    const newRgb = hslToRgb(variation.h, variation.s, variation.l);
    colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  }

  return colors.slice(0, count);
}

// Generate monochromatic palette
function generateMonochromaticPalette(baseColor: string, count: number = 4): string[] {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return [baseColor];

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const colors: string[] = [];

  // Generate shades and tints
  for (let i = 0; i < count; i++) {
    const lightness = 20 + (i * (60 / (count - 1 || 1)));
    const newRgb = hslToRgb(hsl.h, hsl.s, Math.min(90, Math.max(10, lightness)));
    colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  }

  return colors;
}

// Generate split-complementary palette
function generateSplitComplementaryPalette(baseColor: string, count: number = 4): string[] {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return [baseColor];

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const colors: string[] = [baseColor];

  const hue1 = (hsl.h + 150) % 360;
  const hue2 = (hsl.h + 210) % 360;

  const newRgb1 = hslToRgb(hue1, hsl.s, hsl.l);
  const newRgb2 = hslToRgb(hue2, hsl.s, hsl.l);

  colors.push(rgbToHex(newRgb1.r, newRgb1.g, newRgb1.b));
  if (count > 2) colors.push(rgbToHex(newRgb2.r, newRgb2.g, newRgb2.b));

  // Add variations
  for (let i = 3; i < count; i++) {
    const variation = { h: hsl.h, s: hsl.s, l: Math.max(10, Math.min(90, hsl.l + (i % 2 === 0 ? -10 : 10))) };
    const newRgb = hslToRgb(variation.h, variation.s, variation.l);
    colors.push(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  }

  return colors.slice(0, count);
}

// Analyze extracted colors to determine the best palette type
function analyzeColorScheme(colors: string[]): { dominantColor: string; paletteType: PaletteType } {
  if (colors.length === 0) {
    return { dominantColor: '#646cff', paletteType: 'complementary' };
  }

  // Find the most used color (assuming first is most common)
  const dominantColor = colors[0];

  // Analyze color relationships
  const rgb = hexToRgb(dominantColor);
  if (!rgb) {
    return { dominantColor, paletteType: 'complementary' };
  }

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Determine palette type based on color characteristics
  if (hsl.s < 20) {
    // Low saturation - use monochromatic
    return { dominantColor, paletteType: 'monochromatic' };
  } else if (colors.length <= 2) {
    // Few colors - use complementary
    return { dominantColor, paletteType: 'complementary' };
  } else if (colors.length === 3) {
    // Three colors - use triadic
    return { dominantColor, paletteType: 'triadic' };
  } else {
    // Multiple colors - use analogous for harmony
    return { dominantColor, paletteType: 'analogous' };
  }
}

// Generate intelligent palette based on extracted colors
export async function getRandomPalette(extractedColors?: string[]): Promise<string[]> {
  // First, try to load from colorhunt palettes for truly random colors
  try {
    const response = await fetch('/colorhunt_palettes.json');
    if (response.ok) {
      const palettes = await response.json();
      if (palettes && palettes.length > 0) {
        const randomPalette = palettes[Math.floor(Math.random() * palettes.length)];
        if (randomPalette && randomPalette.colors && randomPalette.colors.length > 0) {
          // Use the size based on extracted colors if available
          const paletteSize = extractedColors && extractedColors.length > 0 
            ? Math.max(extractedColors.length, 4) 
            : randomPalette.colors.length;
          
          // If we need more colors, generate additional ones
          if (paletteSize > randomPalette.colors.length) {
            const baseColor = randomPalette.colors[0];
            const additionalColors = generateComplementaryPalette(baseColor, paletteSize - randomPalette.colors.length);
            return [...randomPalette.colors, ...additionalColors].slice(0, paletteSize);
          }
          
          return randomPalette.colors.slice(0, paletteSize);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load colorhunt palettes:', error);
  }

  // Generate a completely random palette with random colors
  const paletteSize = extractedColors && extractedColors.length > 0 
    ? Math.max(extractedColors.length, 4) 
    : 4;
  
  // Randomly choose a palette type (excluding monochromatic to avoid dull colors)
  const paletteTypes: PaletteType[] = ['complementary', 'analogous', 'triadic', 'split-complementary'];
  const randomPaletteType = paletteTypes[Math.floor(Math.random() * paletteTypes.length)];
  
  // Generate a completely random base color (not based on extracted colors)
  // Use vibrant colors with good saturation and lightness
  const randomHue = Math.random() * 360;
  const randomSaturation = 50 + Math.random() * 40; // 50-90% saturation for vibrant colors
  const randomLightness = 40 + Math.random() * 30; // 40-70% lightness
  const randomRgb = hslToRgb(randomHue, randomSaturation, randomLightness);
  const randomBaseColor = rgbToHex(randomRgb.r, randomRgb.g, randomRgb.b);
  
  // Generate palette based on random type and color
  let palette: string[] = [];
  switch (randomPaletteType) {
    case 'complementary':
      palette = generateComplementaryPalette(randomBaseColor, paletteSize);
      break;
    case 'analogous':
      palette = generateAnalogousPalette(randomBaseColor, paletteSize);
      break;
    case 'triadic':
      palette = generateTriadicPalette(randomBaseColor, paletteSize);
      break;
    case 'split-complementary':
      palette = generateSplitComplementaryPalette(randomBaseColor, paletteSize);
      break;
    default:
      palette = generateComplementaryPalette(randomBaseColor, paletteSize);
  }

  return palette;
}

// Map colors to palette intelligently, preserving relationships
export function mapColorsToPalette(
  originalColors: string[],
  newPalette: string[]
): Record<string, string> {
  if (originalColors.length === 0 || newPalette.length === 0) {
    return {};
  }

  const mapping: Record<string, string> = {};

  // Normalize all original colors to lowercase hex
  const normalizedOriginals = originalColors.map(color => {
    const normalized = normalizeColorString(color);
    return normalized || color.toLowerCase();
  });

  // Normalize all palette colors to lowercase hex
  const normalizedPalette = newPalette.map(color => {
    const normalized = normalizeColorString(color);
    return normalized || color.toLowerCase();
  });

  // Sort original colors by brightness
  const sortedOriginals = [...normalizedOriginals].sort((a, b) => {
    return getBrightness(a) - getBrightness(b);
  });

  // Sort palette colors by brightness
  const sortedPalette = [...normalizedPalette].sort((a, b) => {
    return getBrightness(a) - getBrightness(b);
  });

  // Track which palette colors have been used to ensure uniqueness
  const usedPaletteColors = new Set<string>();
  
  // Map each original color to a unique palette color with closest brightness
  sortedOriginals.forEach((originalColor) => {
    const originalBrightness = getBrightness(originalColor);
    const originalSaturation = getSaturation(originalColor);

    // Find the best match in the palette that hasn't been used yet
    let bestMatch = sortedPalette[0];
    let bestScore = Infinity;

    sortedPalette.forEach((paletteColor) => {
      // Skip if this palette color is already used
      if (usedPaletteColors.has(paletteColor)) {
        return;
      }

      const paletteBrightness = getBrightness(paletteColor);
      const paletteSaturation = getSaturation(paletteColor);

      // Calculate match score (lower is better)
      // Consider both brightness and saturation
      const brightnessDiff = Math.abs(originalBrightness - paletteBrightness);
      const saturationDiff = Math.abs(originalSaturation - paletteSaturation);
      const score = brightnessDiff * 2 + saturationDiff; // Weight brightness more

      if (score < bestScore) {
        bestScore = score;
        bestMatch = paletteColor;
      }
    });

    // Mark this palette color as used
    usedPaletteColors.add(bestMatch);

    // Map both the normalized and original format
    mapping[originalColor] = bestMatch;
    // Also map uppercase and with/without # variations
    if (originalColor.startsWith('#')) {
      mapping[originalColor.toUpperCase()] = bestMatch;
      mapping[originalColor.replace('#', '')] = bestMatch;
    }
  });

  // Also map by index as fallback for exact count matches
  if (normalizedOriginals.length === normalizedPalette.length) {
    normalizedOriginals.forEach((color, index) => {
      if (!mapping[color]) {
        mapping[color] = normalizedPalette[index];
      }
    });
  }

  return mapping;
}

// Apply color replacements to DOM elements - comprehensive replacement
export function applyColorReplacementsToDOM(
  doc: Document,
  colorMapping: Record<string, string>
): void {
  if (!doc || !colorMapping || Object.keys(colorMapping).length === 0) {
    return;
  }

  // Properties that can contain colors
  const colorProperties = [
    'color',
    'backgroundColor',
    'background-color',
    'borderColor',
    'border-color',
    'borderTopColor',
    'border-top-color',
    'borderRightColor',
    'border-right-color',
    'borderBottomColor',
    'border-bottom-color',
    'borderLeftColor',
    'border-left-color',
    'outlineColor',
    'outline-color',
    'textDecorationColor',
    'text-decoration-color',
    'columnRuleColor',
    'column-rule-color',
    'fill',
    'stroke',
  ];

  // Get all elements
  const allElements = doc.querySelectorAll('*');

  allElements.forEach((element) => {
    const htmlElement = element as HTMLElement;
    if (!htmlElement) return;

    // Get computed styles
    let computed: CSSStyleDeclaration;
    try {
      computed = doc.defaultView?.getComputedStyle(htmlElement) || window.getComputedStyle(htmlElement);
    } catch (e) {
      return; // Skip if we can't get computed styles
    }

    // Replace colors in style properties
    colorProperties.forEach((prop) => {
      try {
        const value = computed.getPropertyValue(prop);
        if (value && value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)' && value !== 'none') {
          const normalized = normalizeColorString(value);
          
          // Check direct mapping
          if (normalized && colorMapping[normalized]) {
            htmlElement.style.setProperty(prop, colorMapping[normalized], 'important');
          } else if (normalized) {
            // Also check case-insensitive and with/without # variations
            const normalizedUpper = normalized.toUpperCase();
            const normalizedLower = normalized.toLowerCase();
            const withoutHash = normalized.replace('#', '');
            
            if (colorMapping[normalizedUpper]) {
              htmlElement.style.setProperty(prop, colorMapping[normalizedUpper], 'important');
            } else if (colorMapping[normalizedLower]) {
              htmlElement.style.setProperty(prop, colorMapping[normalizedLower], 'important');
            } else if (colorMapping[`#${withoutHash}`]) {
              htmlElement.style.setProperty(prop, colorMapping[`#${withoutHash}`], 'important');
            } else if (colorMapping[withoutHash]) {
              htmlElement.style.setProperty(prop, colorMapping[withoutHash], 'important');
            }
          }
        }
      } catch (e) {
        // Ignore errors for specific properties
      }
    });

    // Handle box-shadow and text-shadow (they contain colors)
    try {
      const boxShadow = computed.boxShadow;
      if (boxShadow && boxShadow !== 'none') {
        let newBoxShadow = boxShadow;
        let changed = false;
        
        Object.entries(colorMapping).forEach(([oldColor, newColor]) => {
          // Create regex patterns for different color formats
          const patterns = [
            new RegExp(`\\b${oldColor.replace('#', '')}\\b`, 'gi'), // Hex without #
            new RegExp(`\\b${oldColor}\\b`, 'gi'), // Hex with #
            new RegExp(oldColor.replace('#', '#?'), 'gi'), // Flexible hex
          ];

          patterns.forEach(pattern => {
            if (pattern.test(newBoxShadow)) {
              newBoxShadow = newBoxShadow.replace(pattern, newColor);
              changed = true;
            }
          });
        });

        if (changed) {
          htmlElement.style.setProperty('box-shadow', newBoxShadow, 'important');
        }
      }

      const textShadow = computed.textShadow;
      if (textShadow && textShadow !== 'none') {
        let newTextShadow = textShadow;
        let changed = false;
        
        Object.entries(colorMapping).forEach(([oldColor, newColor]) => {
          const patterns = [
            new RegExp(`\\b${oldColor.replace('#', '')}\\b`, 'gi'),
            new RegExp(`\\b${oldColor}\\b`, 'gi'),
            new RegExp(oldColor.replace('#', '#?'), 'gi'),
          ];

          patterns.forEach(pattern => {
            if (pattern.test(newTextShadow)) {
              newTextShadow = newTextShadow.replace(pattern, newColor);
              changed = true;
            }
          });
        });

        if (changed) {
          htmlElement.style.setProperty('text-shadow', newTextShadow, 'important');
        }
      }
    } catch (e) {
      // Ignore shadow errors
    }

    // Handle inline styles - replace colors in style attribute
    if (htmlElement.hasAttribute('style')) {
      try {
        const styleAttr = htmlElement.getAttribute('style') || '';
        let changed = false;

        // Parse and replace colors in style attribute
        const stylePairs = styleAttr.split(';').map(s => s.trim()).filter(s => s);
        const newPairs: string[] = [];

        stylePairs.forEach((pair) => {
          const [prop, value] = pair.split(':').map(s => s.trim());
          if (prop && value) {
            const normalized = normalizeColorString(value);
            if (normalized && colorMapping[normalized]) {
              newPairs.push(`${prop}: ${colorMapping[normalized]} !important`);
              changed = true;
            } else {
              // Also check if value contains the color as substring
              let newValue = value;
              Object.entries(colorMapping).forEach(([oldColor, newColor]) => {
                if (value.includes(oldColor)) {
                  newValue = value.replace(new RegExp(oldColor.replace('#', '#?'), 'gi'), newColor);
                  changed = true;
                }
              });
              newPairs.push(`${prop}: ${newValue}`);
            }
          } else {
            newPairs.push(pair);
          }
        });

        if (changed) {
          htmlElement.setAttribute('style', newPairs.join('; '));
        }
      } catch (e) {
        // Ignore style attribute errors
      }
    }

    // Handle SVG elements (fill and stroke)
    if (htmlElement instanceof SVGElement) {
      try {
        const fill = htmlElement.getAttribute('fill');
        if (fill) {
          const normalized = normalizeColorString(fill);
          if (normalized && colorMapping[normalized]) {
            htmlElement.setAttribute('fill', colorMapping[normalized]);
          }
        }

        const stroke = htmlElement.getAttribute('stroke');
        if (stroke) {
          const normalized = normalizeColorString(stroke);
          if (normalized && colorMapping[normalized]) {
            htmlElement.setAttribute('stroke', colorMapping[normalized]);
          }
        }
      } catch (e) {
        // Ignore SVG errors
      }
    }
  });

  // Also replace colors in stylesheets
  try {
    Array.from(doc.styleSheets).forEach((styleSheet) => {
      try {
        const rules = styleSheet.cssRules || styleSheet.rules;
        if (!rules) return;

        Array.from(rules).forEach((rule) => {
          try {
            if (rule instanceof CSSStyleRule) {
              const style = rule.style;
              colorProperties.forEach((prop) => {
                try {
                  const value = style.getPropertyValue(prop);
                  if (value) {
                    const normalized = normalizeColorString(value);
                    if (normalized && colorMapping[normalized]) {
                      style.setProperty(prop, colorMapping[normalized], 'important');
                    }
                  }
                } catch (e) {
                  // Ignore property errors
                }
              });
            }
          } catch (e) {
            // Ignore rule errors
          }
        });
      } catch (e) {
        // Cross-origin stylesheets may throw errors, ignore them
      }
    });
  } catch (e) {
    // Ignore stylesheet errors
  }
}

// Generate CSS for color replacements
export function generateColorReplacementCSS(
  colorMapping: Record<string, string>
): string {
  if (!colorMapping || Object.keys(colorMapping).length === 0) {
    return '';
  }

  const rules: string[] = [];

  Object.entries(colorMapping).forEach(([oldColor, newColor]) => {
    // Generate rules for various color properties
    const selectors = [
      `[style*="${oldColor}"]`,
      `[style*="${oldColor.toUpperCase()}"]`,
      `[style*="${oldColor.toLowerCase()}"]`,
    ];

    selectors.forEach((selector) => {
      rules.push(`
        ${selector} {
          color: ${newColor} !important;
          background-color: ${newColor} !important;
          border-color: ${newColor} !important;
        }
      `);
    });
  });

  return rules.join('\n');
}
