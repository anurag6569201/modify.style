import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Check, Eye } from 'lucide-react';
import '../../assets/css/editor/EffectsPanel.css';

export interface CSSEffect {
  id: string;
  name: string;
  description: string;
  css: string;
  category: 'animation' | 'filter' | 'transform' | 'color' | 'layout' | 'other';
}

const PREDEFINED_EFFECTS: CSSEffect[] = [
  {
    id: 'grayscale',
    name: 'Grayscale',
    description: 'Convert all colors to grayscale',
    category: 'filter',
    css: 'body { filter: grayscale(100%) !important; }',
  },
  {
    id: 'sepia',
    name: 'Sepia Tone',
    description: 'Apply vintage sepia filter',
    category: 'filter',
    css: 'body { filter: sepia(100%) !important; }',
  },
  {
    id: 'blur',
    name: 'Blur Effect',
    description: 'Blur the entire page',
    category: 'filter',
    css: 'body { filter: blur(5px) !important; }',
  },
  {
    id: 'invert',
    name: 'Invert Colors',
    description: 'Invert all colors (dark mode effect)',
    category: 'filter',
    css: 'body { filter: invert(1) !important; }',
  },
  {
    id: 'brightness',
    name: 'Brightness Boost',
    description: 'Increase brightness by 20%',
    category: 'filter',
    css: 'body { filter: brightness(1.2) !important; }',
  },
  {
    id: 'contrast',
    name: 'High Contrast',
    description: 'Increase contrast for better readability',
    category: 'filter',
    css: 'body { filter: contrast(1.3) !important; }',
  },
  {
    id: 'saturate',
    name: 'Vibrant Colors',
    description: 'Increase color saturation',
    category: 'filter',
    css: 'body { filter: saturate(1.5) !important; }',
  },
  {
    id: 'rotate',
    name: 'Rotate Page',
    description: 'Rotate the entire page 5 degrees',
    category: 'transform',
    css: 'body { transform: rotate(5deg) !important; }',
  },
  {
    id: 'scale',
    name: 'Scale Up',
    description: 'Scale up the page by 10%',
    category: 'transform',
    css: 'body { transform: scale(1.1) !important; }',
  },
  {
    id: 'skew',
    name: 'Skew Effect',
    description: 'Apply skew transformation',
    category: 'transform',
    css: 'body { transform: skew(2deg, 1deg) !important; }',
  },
  {
    id: 'pulse',
    name: 'Pulse Animation',
    description: 'Add pulsing animation to the page',
    category: 'animation',
    css: `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
      }
      body { animation: pulse 2s ease-in-out infinite !important; }
    `,
  },
  {
    id: 'shake',
    name: 'Shake Animation',
    description: 'Add shaking animation',
    category: 'animation',
    css: `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
      body { animation: shake 0.5s ease-in-out infinite !important; }
    `,
  },
  {
    id: 'fade-in',
    name: 'Fade In',
    description: 'Fade in animation on load',
    category: 'animation',
    css: `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      body { animation: fadeIn 1s ease-in !important; }
    `,
  },
  {
    id: 'dark-mode',
    name: 'Dark Mode',
    description: 'Apply dark mode styling',
    category: 'color',
    css: `
      body {
        background-color: #1a1a1a !important;
        color: #ffffff !important;
        filter: invert(1) hue-rotate(180deg) !important;
      }
      img, video, iframe {
        filter: invert(1) hue-rotate(180deg) !important;
      }
    `,
  },
  {
    id: 'high-contrast-mode',
    name: 'High Contrast Mode',
    description: 'High contrast for accessibility',
    category: 'color',
    css: `
      * {
        background-color: #000000 !important;
        color: #ffffff !important;
        border-color: #ffffff !important;
      }
      a {
        color: #ffff00 !important;
      }
    `,
  },
  {
    id: 'no-images',
    name: 'Hide Images',
    description: 'Hide all images on the page',
    category: 'layout',
    css: 'img { display: none !important; }',
  },
  {
    id: 'large-text',
    name: 'Large Text',
    description: 'Increase font size for readability',
    category: 'layout',
    css: 'body { font-size: 1.5em !important; }',
  },
  {
    id: 'monospace',
    name: 'Monospace Font',
    description: 'Change all text to monospace',
    category: 'layout',
    css: '* { font-family: monospace !important; }',
  },
  {
    id: 'outline-all',
    name: 'Outline All Elements',
    description: 'Add outline to all elements (debugging)',
    category: 'other',
    css: '* { outline: 1px solid red !important; }',
  },
  {
    id: 'no-animations',
    name: 'Disable Animations',
    description: 'Remove all animations and transitions',
    category: 'animation',
    css: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  },
  {
    id: 'readable-width',
    name: 'Readable Width',
    description: 'Limit content width for better readability',
    category: 'layout',
    css: `
      body {
        max-width: 800px !important;
        margin: 0 auto !important;
      }
    `,
  },
];

interface EffectsPanelProps {
  activeEffects: string[];
  onToggleEffect: (effectId: string) => void;
}

const EffectsPanel: React.FC<EffectsPanelProps> = ({ activeEffects, onToggleEffect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [previewingEffect, setPreviewingEffect] = useState<string | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);

  const categories = ['all', ...Array.from(new Set(PREDEFINED_EFFECTS.map(e => e.category)))];

  const filteredEffects = PREDEFINED_EFFECTS.filter(effect => {
    const matchesSearch = effect.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         effect.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || effect.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryLabel = (category: string) => {
    return category === 'all' ? 'All Effects' : category.charAt(0).toUpperCase() + category.slice(1);
  };

  // Preview effect on hover
  const handleEffectHover = (effectId: string) => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    
    setPreviewingEffect(effectId);
    
    // Auto-remove preview after 3 seconds
    previewTimeoutRef.current = window.setTimeout(() => {
      setPreviewingEffect(null);
    }, 3000);
  };

  const handleEffectLeave = () => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    setPreviewingEffect(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="effects-panel">
      <div className="effects-panel-search">
        <input
          type="text"
          placeholder="Search effects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="effects-search-input"
        />
      </div>

      <div className="effects-panel-categories">
        {categories.map(category => (
          <button
            key={category}
            className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category)}
          >
            {getCategoryLabel(category)}
          </button>
        ))}
      </div>

      <div className="effects-list">
        {filteredEffects.length === 0 ? (
          <div className="effects-empty">
            No effects found matching your search.
          </div>
        ) : (
          filteredEffects.map(effect => {
            const isActive = activeEffects.includes(effect.id);
            return (
              <div
                key={effect.id}
                className={`effect-item ${isActive ? 'active' : ''} ${previewingEffect === effect.id ? 'previewing' : ''}`}
                onClick={() => onToggleEffect(effect.id)}
                onMouseEnter={() => handleEffectHover(effect.id)}
                onMouseLeave={handleEffectLeave}
                title={previewingEffect === effect.id ? 'Previewing...' : 'Hover to preview'}
              >
                <div className="effect-item-content">
                  <div className="effect-item-info">
                    <div className="effect-item-name">
                      {effect.name}
                      {isActive && <span className="active-dot"></span>}
                      {previewingEffect === effect.id && !isActive && (
                        <Eye size={12} style={{ marginLeft: '6px', opacity: 0.7 }} />
                      )}
                    </div>
                    <div className="effect-item-description">{effect.description}</div>
                    <div className="effect-item-category" style={{ 
                      fontSize: '10px', 
                      opacity: 0.6, 
                      marginTop: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {effect.category}
                    </div>
                  </div>
                  <div className={`effect-item-toggle ${isActive ? 'active' : ''}`}>
                    {isActive ? <Check size={14} /> : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {activeEffects.length > 0 && (
        <div className="effects-panel-footer">
          <button
            className="clear-all-btn"
            onClick={() => {
              activeEffects.forEach(effectId => onToggleEffect(effectId));
            }}
          >
            Clear All ({activeEffects.length})
          </button>
        </div>
      )}
    </div>
  );
};

export default EffectsPanel;
export { PREDEFINED_EFFECTS };
