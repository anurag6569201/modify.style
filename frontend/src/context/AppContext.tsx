/**
 * Application context and state management.
 * Provides global state for the application using React Context and useReducer.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { storage } from '../utils/storage';
import { PREDEFINED_EFFECTS } from '../components/editor/effects';
import { generateColorReplacementCSS } from '../utils/colorPalettes';

// Helpers to manage auto-generated CSS sections (effects, typography, color palette, global design)
const EFFECT_CSS_MARKER_START = '/* Effects CSS - Auto-generated - Do not edit manually */';
const EFFECT_CSS_MARKER_END = '/* End Effects CSS */';
const TYPOGRAPHY_CSS_MARKER_START = '/* Typography CSS - Auto-generated - Do not edit manually */';
const TYPOGRAPHY_CSS_MARKER_END = '/* End Typography CSS */';
const COLOR_CSS_MARKER_START = '/* Color Palette CSS - Auto-generated - Do not edit manually */';
const COLOR_CSS_MARKER_END = '/* End Color Palette CSS */';
const GLOBAL_DESIGN_CSS_MARKER_START = '/* Global Design CSS - Auto-generated - Do not edit manually */';
const GLOBAL_DESIGN_CSS_MARKER_END = '/* End Global Design CSS */';

const stripSection = (css: string, start: string, end: string): string => {
  // Use regex to find the section, allowing for potential whitespace variations
  // Escape special characters in start and end markers for regex
  const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startPattern = escapeRegExp(start);
  const endPattern = escapeRegExp(end);

  // Creates a pattern that matches start...end, including newlines
  // s flag (dotAll) is not standard in all environments, so we use [\s\S]*?
  const regex = new RegExp(`${startPattern}[\\s\\S]*?${endPattern}`, 'g');

  return css.replace(regex, '').trim();
};

const removeAutoSections = (css: string): string => {
  let result = css;
  result = stripSection(result, EFFECT_CSS_MARKER_START, EFFECT_CSS_MARKER_END);
  result = stripSection(result, TYPOGRAPHY_CSS_MARKER_START, TYPOGRAPHY_CSS_MARKER_END);
  result = stripSection(result, COLOR_CSS_MARKER_START, COLOR_CSS_MARKER_END);
  result = stripSection(result, GLOBAL_DESIGN_CSS_MARKER_START, GLOBAL_DESIGN_CSS_MARKER_END);
  return result;
};

const appendSection = (css: string, start: string, end: string, content: string): string => {
  if (!content.trim()) return css.trim();
  const base = css.trim();
  const section = `${start}\n${content.trim()}\n${end}`;
  return base ? `${base}\n\n${section}` : section;
};

const buildCustomCssWithAuto = (
  baseCss: string,
  activeEffects: string[],
  typographyCss: string,
  colorMapping: Record<string, string> | null,
  backgroundOverlay: { enabled: boolean; color: string; opacity: number },
  gridSystem: { enabled: boolean; size: number; color: string; opacity: number },
  colorBlindness: { enabled: boolean; type: 'protanopia' | 'deuteranopia' | 'tritanopia' | 'none' },
  colorAdjustments: { brightness: number; contrast: number; saturation: number },
  outlineMode: boolean
): string => {
  let result = removeAutoSections(baseCss);

  // Color palette CSS
  if (colorMapping) {
    const colorCss = generateColorReplacementCSS(colorMapping).trim();
    result = appendSection(result, COLOR_CSS_MARKER_START, COLOR_CSS_MARKER_END, colorCss);
  }

  // Typography CSS
  if (typographyCss.trim()) {
    result = appendSection(result, TYPOGRAPHY_CSS_MARKER_START, TYPOGRAPHY_CSS_MARKER_END, typographyCss);
  }
  // Effects CSS
  if (activeEffects.length > 0) {
    const effectsCss = activeEffects
      .map(id => {
        const effect = PREDEFINED_EFFECTS.find(e => e.id === id);
        return effect ? effect.css : '';
      })
      .filter(css => css.trim())
      .join('\n\n');

    result = appendSection(result, EFFECT_CSS_MARKER_START, EFFECT_CSS_MARKER_END, effectsCss);
  }

  // Global design CSS (overlays, grids, filters, outlines)
  const globalRules: string[] = [];

  if (backgroundOverlay.enabled && backgroundOverlay.opacity > 0) {
    globalRules.push(`
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: ${backgroundOverlay.color};
  opacity: ${backgroundOverlay.opacity};
  mix-blend-mode: multiply;
  z-index: 999999;
}`.trim());
  }

  if (gridSystem.enabled && gridSystem.size > 0) {
    globalRules.push(`
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(to right, ${gridSystem.color} 1px, transparent 1px),
    linear-gradient(to bottom, ${gridSystem.color} 1px, transparent 1px);
  background-size: ${gridSystem.size}px ${gridSystem.size}px;
  opacity: ${gridSystem.opacity};
  z-index: 999998;
}`.trim());
  }

  const filters: string[] = [];

  if (colorAdjustments) {
    if (colorAdjustments.brightness !== 100) {
      filters.push(`brightness(${colorAdjustments.brightness}%)`);
    }
    if (colorAdjustments.contrast !== 100) {
      filters.push(`contrast(${colorAdjustments.contrast}%)`);
    }
    if (colorAdjustments.saturation !== 100) {
      filters.push(`saturate(${colorAdjustments.saturation}%)`);
    }
  }

  if (colorBlindness.enabled && colorBlindness.type !== 'none') {
    // Simple approximations for color blindness simulation
    if (colorBlindness.type === 'protanopia') {
      filters.push('grayscale(0.6)');
    } else if (colorBlindness.type === 'deuteranopia') {
      filters.push('grayscale(0.5) contrast(1.1)');
    } else if (colorBlindness.type === 'tritanopia') {
      filters.push('grayscale(0.4) contrast(1.05)');
    }
  }

  if (filters.length > 0) {
    globalRules.push(`html { filter: ${filters.join(' ')} !important; }`);
  }

  if (outlineMode) {
    globalRules.push(`
* {
  outline: 1px solid rgba(56, 189, 248, 0.7) !important;
  outline-offset: -1px;
}`.trim());
  }

  if (globalRules.length > 0) {
    const globalCss = globalRules.join('\n\n');
    result = appendSection(result, GLOBAL_DESIGN_CSS_MARKER_START, GLOBAL_DESIGN_CSS_MARKER_END, globalCss);
  }

  return result.trim();
};

// Types
export type DeviceMode = 'mobile' | 'tablet' | 'laptop' | 'desktop';

export interface ViewState {
  url: string;
  currentUrl: string | null;
  htmlContent: string | null;
  loading: boolean;
  error: string | null;
}

export interface EditorState {
  customCss: string;
  showCssEditor: boolean;
  showInspector: boolean;
  showSettings: boolean;
  selectedElement: string | null;
  activeEffects: string[];
  typographyCss: string;
  colorMapping: Record<string, string> | null; // Using Record instead of Map for serialization
  extractedColors: Array<{ color: string; usage: string[] }>;
  effectMode: 'single' | 'multi';
  // Global design features
  backgroundOverlay: { enabled: boolean; color: string; opacity: number };
  gridSystem: { enabled: boolean; size: number; color: string; opacity: number };
  colorBlindness: { enabled: boolean; type: 'protanopia' | 'deuteranopia' | 'tritanopia' | 'none' };
  colorAdjustments: { brightness: number; contrast: number; saturation: number };
  outlineMode: boolean;
}

export interface ViewportState {
  deviceMode: DeviceMode;
  zoomLevel: number;
  panPosition: { x: number; y: number };
  isFullView: boolean;
  isPanning: boolean;
  showZoomControls: boolean;
  isSpacePressed: boolean;
  zoomToPoint: { x: number; y: number } | null;
}

export interface HistoryState {
  past: string[];
  present: string;
  future: string[];
}

export interface AppState {
  view: ViewState;
  editor: EditorState;
  viewport: ViewportState;
  history: HistoryState;
  activeTab: number;
  tabs: ViewState[];
}

// Action Types
type AppAction =
  | { type: 'SET_URL'; payload: string }
  | { type: 'SET_CURRENT_URL'; payload: string | null }
  | { type: 'SET_HTML_CONTENT'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CUSTOM_CSS'; payload: string }
  | { type: 'TOGGLE_CSS_EDITOR' }
  | { type: 'TOGGLE_INSPECTOR' }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'SET_SELECTED_ELEMENT'; payload: string | null }
  | { type: 'SET_DEVICE_MODE'; payload: DeviceMode }
  | { type: 'SET_ZOOM_LEVEL'; payload: number }
  | { type: 'SET_PAN_POSITION'; payload: { x: number; y: number } }
  | { type: 'TOGGLE_FULL_VIEW' }
  | { type: 'SET_PANNING'; payload: boolean }
  | { type: 'RESET_VIEWPORT' }
  | { type: 'TOGGLE_ZOOM_CONTROLS' }
  | { type: 'SET_SPACE_PRESSED'; payload: boolean }
  | { type: 'SET_ZOOM_TO_POINT'; payload: { x: number; y: number } | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SAVE_TO_HISTORY'; payload: string }
  | { type: 'ADD_TAB' }
  | { type: 'CLOSE_TAB'; payload: number }
  | { type: 'SET_ACTIVE_TAB'; payload: number }
  | { type: 'RESET_STATE' }
  | { type: 'TOGGLE_EFFECT'; payload: string }
  | { type: 'CLEAR_ALL_EFFECTS' }
  | { type: 'SET_TYPOGRAPHY_CSS'; payload: string }
  | { type: 'SET_COLOR_MAPPING'; payload: Record<string, string> | null }
  | { type: 'SET_EXTRACTED_COLORS'; payload: Array<{ color: string; usage: string[] }> }
  | { type: 'SET_EFFECT_MODE'; payload: 'single' | 'multi' }
  | { type: 'SET_BACKGROUND_OVERLAY'; payload: { enabled: boolean; color: string; opacity: number } }
  | { type: 'SET_GRID_SYSTEM'; payload: { enabled: boolean; size: number; color: string; opacity: number } }
  | { type: 'SET_COLOR_BLINDNESS'; payload: { enabled: boolean; type: 'protanopia' | 'deuteranopia' | 'tritanopia' | 'none' } }
  | { type: 'SET_COLOR_ADJUSTMENTS'; payload: { brightness: number; contrast: number; saturation: number } }
  | { type: 'SET_OUTLINE_MODE'; payload: boolean };

// Load initial state from localStorage
const loadInitialState = (): AppState => {
  const savedViewport = storage.getViewport();
  const savedEditor = storage.getEditor();
  const savedSettings = storage.getSettings();
  const savedCss = storage.getCustomCss();

  // Get saved active effects
  const savedActiveEffects = savedEditor.activeEffects || [];

  const initialBackgroundOverlay =
    savedEditor.backgroundOverlay || { enabled: false, color: 'rgba(15, 23, 42, 0.9)', opacity: 0.3 };
  const initialGridSystem =
    savedEditor.gridSystem || { enabled: false, size: 8, color: 'rgba(148, 163, 184, 0.6)', opacity: 0.45 };
  const initialColorBlindness =
    savedEditor.colorBlindness || { enabled: false, type: 'none' as const };
  const initialColorAdjustments =
    savedEditor.colorAdjustments || { brightness: 100, contrast: 100, saturation: 100 };
  const initialOutlineMode = savedEditor.outlineMode ?? false;

  // Base user CSS (strip any auto-generated sections first)
  const baseCustomCss = removeAutoSections(
    savedCss || savedEditor.customCss || '/* Add your custom CSS here */'
  );

  // Rebuild CSS with all auto-generated sections (effects, typography, colors)
  const finalCustomCss = buildCustomCssWithAuto(
    baseCustomCss,
    savedActiveEffects,
    savedEditor.typographyCss || '',
    savedEditor.colorMapping || null,
    initialBackgroundOverlay,
    initialGridSystem,
    initialColorBlindness,
    initialColorAdjustments,
    initialOutlineMode
  );

  return {
    view: {
      url: savedSettings.lastUrl || '',
      currentUrl: null,
      htmlContent: null,
      loading: false,
      error: null,
    },
    editor: {
      customCss: finalCustomCss,
      showCssEditor: savedEditor.showCssEditor || false,
      showInspector: savedEditor.showInspector || false,
      showSettings: false,
      selectedElement: null,
      activeEffects: savedActiveEffects,
      typographyCss: savedEditor.typographyCss || '',
      colorMapping: savedEditor.colorMapping || null,
      extractedColors: [],
      effectMode: 'single', // Default to single as requested
      backgroundOverlay: initialBackgroundOverlay,
      gridSystem: initialGridSystem,
      colorBlindness: initialColorBlindness,
      colorAdjustments: initialColorAdjustments,
      outlineMode: initialOutlineMode,
    },
    viewport: {
      deviceMode: savedViewport.deviceMode || 'desktop',
      zoomLevel: savedViewport.zoomLevel || 1,
      panPosition: savedViewport.panPosition || { x: 0, y: 0 },
      isFullView: false,
      isPanning: savedViewport.isPanning || false,
      showZoomControls: savedViewport.showZoomControls || false,
      isSpacePressed: false,
      zoomToPoint: null,
    },
    history: {
      past: [],
      present: finalCustomCss,
      future: [],
    },
    activeTab: 0,
    tabs: [{
      url: '',
      currentUrl: null,
      htmlContent: null,
      loading: false,
      error: null,
    }],
  };
};

const initialState: AppState = loadInitialState();

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_URL':
      return {
        ...state,
        view: { ...state.view, url: action.payload },
      };
    case 'SET_CURRENT_URL':
      return {
        ...state,
        view: { ...state.view, currentUrl: action.payload },
      };
    case 'SET_HTML_CONTENT':
      return {
        ...state,
        view: { ...state.view, htmlContent: action.payload },
      };
    case 'SET_LOADING':
      return {
        ...state,
        view: { ...state.view, loading: action.payload },
      };
    case 'SET_ERROR':
      return {
        ...state,
        view: { ...state.view, error: action.payload },
      };
    case 'SET_CUSTOM_CSS':
      // When user edits CSS, preserve auto-generated sections (effects, typography, colors)
      const userCss = removeAutoSections(action.payload);
      const cssWithEffects = buildCustomCssWithAuto(
        userCss,
        state.editor.activeEffects,
        state.editor.typographyCss,
        state.editor.colorMapping,
        state.editor.backgroundOverlay,
        state.editor.gridSystem,
        state.editor.colorBlindness,
        state.editor.colorAdjustments,
        state.editor.outlineMode
      );
      return {
        ...state,
        editor: { ...state.editor, customCss: cssWithEffects },
      };
    case 'TOGGLE_CSS_EDITOR':
      return {
        ...state,
        editor: { ...state.editor, showCssEditor: !state.editor.showCssEditor },
      };
    case 'TOGGLE_INSPECTOR':
      return {
        ...state,
        editor: { ...state.editor, showInspector: !state.editor.showInspector },
      };
    case 'TOGGLE_SETTINGS':
      return {
        ...state,
        editor: { ...state.editor, showSettings: !state.editor.showSettings },
      };
    case 'SET_SELECTED_ELEMENT':
      return {
        ...state,
        editor: { ...state.editor, selectedElement: action.payload },
      };
    case 'SET_DEVICE_MODE':
      return {
        ...state,
        viewport: { ...state.viewport, deviceMode: action.payload },
      };
    case 'SET_ZOOM_LEVEL':
      return {
        ...state,
        viewport: { ...state.viewport, zoomLevel: action.payload },
      };
    case 'SET_PAN_POSITION':
      return {
        ...state,
        viewport: { ...state.viewport, panPosition: action.payload },
      };
    case 'TOGGLE_FULL_VIEW':
      return {
        ...state,
        viewport: {
          ...state.viewport,
          isFullView: !state.viewport.isFullView,
          zoomLevel: !state.viewport.isFullView ? 1 : state.viewport.zoomLevel,
          panPosition: !state.viewport.isFullView ? { x: 0, y: 0 } : state.viewport.panPosition,
        },
        editor: {
          ...state.editor,
          showCssEditor: !state.viewport.isFullView ? false : state.editor.showCssEditor,
        },
      };
    case 'SET_PANNING':
      return {
        ...state,
        viewport: { ...state.viewport, isPanning: action.payload },
      };
    case 'RESET_VIEWPORT':
      return {
        ...state,
        viewport: {
          ...state.viewport,
          zoomLevel: 1,
          panPosition: { x: 0, y: 0 },
        },
      };
    case 'TOGGLE_ZOOM_CONTROLS':
      return {
        ...state,
        viewport: {
          ...state.viewport,
          showZoomControls: !state.viewport.showZoomControls,
        },
      };
    case 'SET_SPACE_PRESSED':
      return {
        ...state,
        viewport: {
          ...state.viewport,
          isSpacePressed: action.payload,
        },
      };
    case 'SET_ZOOM_TO_POINT':
      return {
        ...state,
        viewport: {
          ...state.viewport,
          zoomToPoint: action.payload,
        },
      };
    case 'SAVE_TO_HISTORY':
      return {
        ...state,
        history: {
          past: [...state.history.past, state.history.present],
          present: action.payload,
          future: [],
        },
      };
    case 'UNDO':
      if (state.history.past.length === 0) return state;
      return {
        ...state,
        history: {
          past: state.history.past.slice(0, -1),
          present: state.history.past[state.history.past.length - 1],
          future: [state.history.present, ...state.history.future],
        },
        editor: {
          ...state.editor,
          customCss: state.history.past[state.history.past.length - 1],
        },
      };
    case 'REDO':
      if (state.history.future.length === 0) return state;
      return {
        ...state,
        history: {
          past: [...state.history.past, state.history.present],
          present: state.history.future[0],
          future: state.history.future.slice(1),
        },
        editor: {
          ...state.editor,
          customCss: state.history.future[0],
        },
      };
    case 'ADD_TAB':
      return {
        ...state,
        tabs: [...state.tabs, { url: '', currentUrl: null, htmlContent: null, loading: false, error: null }],
        activeTab: state.tabs.length,
      };
    case 'CLOSE_TAB':
      if (state.tabs.length <= 1) return state;
      const newTabs = state.tabs.filter((_, i) => i !== action.payload);
      return {
        ...state,
        tabs: newTabs,
        activeTab: Math.min(state.activeTab, newTabs.length - 1),
      };
    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTab: action.payload,
        view: state.tabs[action.payload] || state.view,
      };
    case 'RESET_STATE':
      return initialState;
    case 'TOGGLE_EFFECT':
      const effectId = action.payload;
      const currentEffects = state.editor.activeEffects;
      const isMulti = state.editor.effectMode === 'multi';

      let newEffects: string[];
      if (isMulti) {
        newEffects = currentEffects.includes(effectId)
          ? currentEffects.filter(id => id !== effectId)
          : [...currentEffects, effectId];
      } else {
        // Single mode: Toggle off if same, otherwise replace
        // If clicking the same effect, toggle it off (empty array)
        if (currentEffects.includes(effectId)) {
          newEffects = [];
        } else {
          // If clicking a new effect, replace the entire array with just this one
          newEffects = [effectId];
        }
      }

      // Sync auto CSS (effects + others) with customCss
      const baseCssForEffects = removeAutoSections(state.editor.customCss);
      const updatedCustomCss = buildCustomCssWithAuto(
        baseCssForEffects,
        newEffects,
        state.editor.typographyCss,
        state.editor.colorMapping,
        state.editor.backgroundOverlay,
        state.editor.gridSystem,
        state.editor.colorBlindness,
        state.editor.colorAdjustments,
        state.editor.outlineMode
      );

      return {
        ...state,
        editor: {
          ...state.editor,
          activeEffects: newEffects,
          customCss: updatedCustomCss,
        },
      };

    case 'SET_EFFECT_MODE':
      return {
        ...state,
        editor: {
          ...state.editor,
          effectMode: action.payload,
          // Optional: clear effects when switching? keeping them seems friendlier
        }
      };
    case 'CLEAR_ALL_EFFECTS':
      // Remove effects CSS from customCss, keep other auto sections
      const baseCssWithoutEffects = removeAutoSections(state.editor.customCss);
      const clearedCustomCss = buildCustomCssWithAuto(
        baseCssWithoutEffects,
        [],
        state.editor.typographyCss,
        state.editor.colorMapping,
        state.editor.backgroundOverlay,
        state.editor.gridSystem,
        state.editor.colorBlindness,
        state.editor.colorAdjustments,
        state.editor.outlineMode
      );
      return {
        ...state,
        editor: {
          ...state.editor,
          activeEffects: [],
          customCss: clearedCustomCss,
        },
      };
    case 'SET_TYPOGRAPHY_CSS':
      return {
        ...state,
        editor: {
          ...state.editor,
          typographyCss: action.payload,
          customCss: buildCustomCssWithAuto(
            removeAutoSections(state.editor.customCss),
            state.editor.activeEffects,
            action.payload,
            state.editor.colorMapping,
            state.editor.backgroundOverlay,
            state.editor.gridSystem,
            state.editor.colorBlindness,
            state.editor.colorAdjustments,
            state.editor.outlineMode
          ),
        },
      };
    case 'SET_COLOR_MAPPING':
      return {
        ...state,
        editor: {
          ...state.editor,
          colorMapping: action.payload,
          customCss: buildCustomCssWithAuto(
            removeAutoSections(state.editor.customCss),
            state.editor.activeEffects,
            state.editor.typographyCss,
            action.payload,
            state.editor.backgroundOverlay,
            state.editor.gridSystem,
            state.editor.colorBlindness,
            state.editor.colorAdjustments,
            state.editor.outlineMode
          ),
        },
      };
    case 'SET_BACKGROUND_OVERLAY': {
      const baseCss = removeAutoSections(state.editor.customCss);
      const updatedCustomCss = buildCustomCssWithAuto(
        baseCss,
        state.editor.activeEffects,
        state.editor.typographyCss,
        state.editor.colorMapping,
        action.payload,
        state.editor.gridSystem,
        state.editor.colorBlindness,
        state.editor.colorAdjustments,
        state.editor.outlineMode
      );
      return {
        ...state,
        editor: {
          ...state.editor,
          backgroundOverlay: action.payload,
          customCss: updatedCustomCss,
        },
      };
    }
    case 'SET_GRID_SYSTEM': {
      const baseCss = removeAutoSections(state.editor.customCss);
      const updatedCustomCss = buildCustomCssWithAuto(
        baseCss,
        state.editor.activeEffects,
        state.editor.typographyCss,
        state.editor.colorMapping,
        state.editor.backgroundOverlay,
        action.payload,
        state.editor.colorBlindness,
        state.editor.colorAdjustments,
        state.editor.outlineMode
      );
      return {
        ...state,
        editor: {
          ...state.editor,
          gridSystem: action.payload,
          customCss: updatedCustomCss,
        },
      };
    }
    case 'SET_COLOR_BLINDNESS': {
      const baseCss = removeAutoSections(state.editor.customCss);
      const updatedCustomCss = buildCustomCssWithAuto(
        baseCss,
        state.editor.activeEffects,
        state.editor.typographyCss,
        state.editor.colorMapping,
        state.editor.backgroundOverlay,
        state.editor.gridSystem,
        action.payload,
        state.editor.colorAdjustments,
        state.editor.outlineMode
      );
      return {
        ...state,
        editor: {
          ...state.editor,
          colorBlindness: action.payload,
          customCss: updatedCustomCss,
        },
      };
    }
    case 'SET_COLOR_ADJUSTMENTS': {
      const baseCss = removeAutoSections(state.editor.customCss);
      const updatedCustomCss = buildCustomCssWithAuto(
        baseCss,
        state.editor.activeEffects,
        state.editor.typographyCss,
        state.editor.colorMapping,
        state.editor.backgroundOverlay,
        state.editor.gridSystem,
        state.editor.colorBlindness,
        action.payload,
        state.editor.outlineMode
      );
      return {
        ...state,
        editor: {
          ...state.editor,
          colorAdjustments: action.payload,
          customCss: updatedCustomCss,
        },
      };
    }
    case 'SET_OUTLINE_MODE': {
      const baseCss = removeAutoSections(state.editor.customCss);
      const updatedCustomCss = buildCustomCssWithAuto(
        baseCss,
        state.editor.activeEffects,
        state.editor.typographyCss,
        state.editor.colorMapping,
        state.editor.backgroundOverlay,
        state.editor.gridSystem,
        state.editor.colorBlindness,
        state.editor.colorAdjustments,
        action.payload
      );
      return {
        ...state,
        editor: {
          ...state.editor,
          outlineMode: action.payload,
          customCss: updatedCustomCss,
        },
      };
    }
    case 'SET_EXTRACTED_COLORS':
      return {
        ...state,
        editor: {
          ...state.editor,
          extractedColors: action.payload,
        },
      };
    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Convenience methods
  setUrl: (url: string) => void;
  setCustomCss: (css: string) => void;
  toggleCssEditor: () => void;
  toggleInspector: () => void;
  toggleSettings: () => void;
  setDeviceMode: (mode: DeviceMode) => void;
  setZoomLevel: (level: number) => void;
  resetViewport: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  toggleEffect: (effectId: string) => void;
  clearAllEffects: () => void;
  setTypographyCss: (css: string) => void;
  setColorMapping: (mapping: Record<string, string> | null) => void;
  setExtractedColors: (colors: Array<{ color: string; usage: string[] }>) => void;
  setEffectMode: (mode: 'single' | 'multi') => void;
  setBackgroundOverlay: (overlay: { enabled: boolean; color: string; opacity: number }) => void;
  setGridSystem: (grid: { enabled: boolean; size: number; color: string; opacity: number }) => void;
  setColorBlindness: (options: { enabled: boolean; type: 'protanopia' | 'deuteranopia' | 'tritanopia' | 'none' }) => void;
  setColorAdjustments: (adjustments: { brightness: number; contrast: number; saturation: number }) => void;
  setOutlineMode: (enabled: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Save viewport state to localStorage (debounced for pan/zoom)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      storage.saveViewport({
        deviceMode: state.viewport.deviceMode,
        zoomLevel: state.viewport.zoomLevel,
        panPosition: state.viewport.panPosition,
        isPanning: state.viewport.isPanning,
        showZoomControls: state.viewport.showZoomControls,
      });
    }, 500); // Debounce to avoid too many writes

    return () => clearTimeout(timeoutId);
  }, [
    state.viewport.deviceMode,
    state.viewport.zoomLevel,
    state.viewport.panPosition.x,
    state.viewport.panPosition.y,
    state.viewport.isPanning,
    state.viewport.showZoomControls,
  ]);

  // Save editor state to localStorage (debounced for CSS to avoid excessive writes)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      storage.saveEditor({
        customCss: state.editor.customCss,
        showCssEditor: state.editor.showCssEditor,
        showInspector: state.editor.showInspector,
      });

      // Also save CSS separately for quick access
      if (state.editor.customCss) {
        storage.saveCustomCss(state.editor.customCss);
      }
    }, 1000); // Debounce CSS saves to avoid excessive writes

    return () => clearTimeout(timeoutId);
  }, [state.editor.customCss, state.editor.showCssEditor, state.editor.showInspector, state.editor.activeEffects, state.editor.typographyCss]);

  // Save current URL when it changes
  useEffect(() => {
    if (state.view.currentUrl) {
      storage.saveSettings({ lastUrl: state.view.currentUrl });
      storage.saveRecentUrl(state.view.currentUrl);
    }
  }, [state.view.currentUrl]);

  const setUrl = useCallback((url: string) => {
    dispatch({ type: 'SET_URL', payload: url });
  }, []);

  const setCustomCss = useCallback((css: string) => {
    dispatch({ type: 'SET_CUSTOM_CSS', payload: css });
    dispatch({ type: 'SAVE_TO_HISTORY', payload: css });
  }, []);

  const toggleCssEditor = useCallback(() => {
    dispatch({ type: 'TOGGLE_CSS_EDITOR' });
  }, []);

  const toggleInspector = useCallback(() => {
    dispatch({ type: 'TOGGLE_INSPECTOR' });
  }, []);

  const toggleSettings = useCallback(() => {
    dispatch({ type: 'TOGGLE_SETTINGS' });
  }, []);

  const setDeviceMode = useCallback((mode: DeviceMode) => {
    dispatch({ type: 'SET_DEVICE_MODE', payload: mode });
    dispatch({ type: 'RESET_VIEWPORT' });
  }, []);

  const setZoomLevel = useCallback((level: number) => {
    dispatch({ type: 'SET_ZOOM_LEVEL', payload: level });
  }, []);

  const resetViewport = useCallback(() => {
    dispatch({ type: 'RESET_VIEWPORT' });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const toggleEffect = useCallback((effectId: string) => {
    dispatch({ type: 'TOGGLE_EFFECT', payload: effectId });
  }, []);

  const clearAllEffects = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_EFFECTS' });
  }, []);

  const setTypographyCss = useCallback((css: string) => {
    dispatch({ type: 'SET_TYPOGRAPHY_CSS', payload: css });
  }, []);

  const setColorMapping = useCallback((mapping: Record<string, string> | null) => {
    dispatch({ type: 'SET_COLOR_MAPPING', payload: mapping });
  }, []);

  const setExtractedColors = useCallback((colors: Array<{ color: string; usage: string[] }>) => {
    dispatch({ type: 'SET_EXTRACTED_COLORS', payload: colors });
  }, []);

  const setEffectMode = useCallback((mode: 'single' | 'multi') => {
    dispatch({ type: 'SET_EFFECT_MODE', payload: mode });
  }, []);

  const setBackgroundOverlay = useCallback((overlay: { enabled: boolean; color: string; opacity: number }) => {
    dispatch({ type: 'SET_BACKGROUND_OVERLAY', payload: overlay });
  }, []);

  const setGridSystem = useCallback((grid: { enabled: boolean; size: number; color: string; opacity: number }) => {
    dispatch({ type: 'SET_GRID_SYSTEM', payload: grid });
  }, []);

  const setColorBlindness = useCallback(
    (options: { enabled: boolean; type: 'protanopia' | 'deuteranopia' | 'tritanopia' | 'none' }) => {
      dispatch({ type: 'SET_COLOR_BLINDNESS', payload: options });
    },
    []
  );

  const setColorAdjustments = useCallback((adjustments: { brightness: number; contrast: number; saturation: number }) => {
    dispatch({ type: 'SET_COLOR_ADJUSTMENTS', payload: adjustments });
  }, []);

  const setOutlineMode = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_OUTLINE_MODE', payload: enabled });
  }, []);

  const value: AppContextType = {
    state,
    dispatch,
    setUrl,
    setCustomCss,
    toggleCssEditor,
    toggleInspector,
    toggleSettings,
    setDeviceMode,
    setZoomLevel,
    resetViewport,
    undo,
    redo,
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
    toggleEffect,
    clearAllEffects,
    setTypographyCss,
    setColorMapping,
    setExtractedColors,
    setEffectMode,
    setBackgroundOverlay,
    setGridSystem,
    setColorBlindness,
    setColorAdjustments,
    setOutlineMode,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

