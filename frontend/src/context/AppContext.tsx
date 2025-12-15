/**
 * Application context and state management.
 * Provides global state for the application using React Context and useReducer.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { storage } from '../utils/storage';

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
  | { type: 'SET_EFFECT_MODE'; payload: 'single' | 'multi' };

// Load initial state from localStorage
const loadInitialState = (): AppState => {
  const savedViewport = storage.getViewport();
  const savedEditor = storage.getEditor();
  const savedSettings = storage.getSettings();
  const savedCss = storage.getCustomCss();

  return {
    view: {
      url: savedSettings.lastUrl || '',
      currentUrl: null,
      htmlContent: null,
      loading: false,
      error: null,
    },
    editor: {
      customCss: savedCss || savedEditor.customCss || '/* Add your custom CSS here */\n/* Example: */\n/* body { background-color: #f0f0f0 !important; } */',
      showCssEditor: savedEditor.showCssEditor || false,
      showInspector: savedEditor.showInspector || false,
      showSettings: false,
      selectedElement: null,
      activeEffects: savedEditor.activeEffects || [],
      typographyCss: savedEditor.typographyCss || '',
      colorMapping: null,
      extractedColors: [],
      effectMode: 'multi', // Default to multi to support existing behavior
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
      present: savedCss || savedEditor.customCss || '/* Add your custom CSS here */\n/* Example: */\n/* body { background-color: #f0f0f0 !important; } */',
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
      return {
        ...state,
        editor: { ...state.editor, customCss: action.payload },
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
        newEffects = currentEffects.includes(effectId) ? [] : [effectId];
      }

      return {
        ...state,
        editor: {
          ...state.editor,
          activeEffects: newEffects,
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
      return {
        ...state,
        editor: {
          ...state.editor,
          activeEffects: [],
        },
      };
    case 'SET_TYPOGRAPHY_CSS':
      return {
        ...state,
        editor: {
          ...state.editor,
          typographyCss: action.payload,
        },
      };
    case 'SET_COLOR_MAPPING':
      return {
        ...state,
        editor: {
          ...state.editor,
          colorMapping: action.payload,
        },
      };
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

