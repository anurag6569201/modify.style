/**
 * Shared TypeScript type definitions for the application.
 */

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
  colorMapping: Record<string, string> | null;
  extractedColors: Array<{ color: string; usage: string[] }>;
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

export interface DeviceConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  width: string;
  height: string;
  isCustom?: boolean;
}

export interface CustomDevice {
  id: string;
  name: string;
  width: number;
  height: number;
}

