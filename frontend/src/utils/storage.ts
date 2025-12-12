// LocalStorage utility for persisting user preferences and state

const STORAGE_KEYS = {
  VIEWPORT: 'modify_style_viewport',
  EDITOR: 'modify_style_editor',
  SETTINGS: 'modify_style_settings',
  RECENT_URLS: 'modify_style_recent_urls',
  CUSTOM_CSS: 'modify_style_custom_css',
  CUSTOM_DEVICES: 'modify_style_custom_devices',
} as const;

export interface ViewportState {
  deviceMode: 'mobile' | 'tablet' | 'laptop' | 'desktop';
  zoomLevel: number;
  panPosition: { x: number; y: number };
  isPanning: boolean;
  showZoomControls: boolean;
}

export interface EditorState {
  customCss: string;
  showCssEditor: boolean;
  showInspector: boolean;
  showSettings: boolean;
  activeEffects?: string[];
  typographyCss?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  showGrid: boolean;
  autoSave: boolean;
  fontSize: number;
  lastUrl?: string;
}

export interface CustomDevice {
  id: string;
  name: string;
  type: 'mobile' | 'tablet' | 'laptop';
  width: number;
  height: number;
  icon?: string;
}

export const storage = {
  // Viewport state
  saveViewport: (viewport: Partial<ViewportState>) => {
    try {
      const existing = storage.getViewport();
      const updated = { ...existing, ...viewport };
      localStorage.setItem(STORAGE_KEYS.VIEWPORT, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save viewport state:', err);
    }
  },

  getViewport: (): Partial<ViewportState> => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VIEWPORT);
      return data ? JSON.parse(data) : {};
    } catch (err) {
      console.warn('Failed to load viewport state:', err);
      return {};
    }
  },

  // Editor state
  saveEditor: (editor: Partial<EditorState>) => {
    try {
      const existing = storage.getEditor();
      const updated = { ...existing, ...editor };
      localStorage.setItem(STORAGE_KEYS.EDITOR, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save editor state:', err);
    }
  },

  getEditor: (): Partial<EditorState> => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EDITOR);
      return data ? JSON.parse(data) : {};
    } catch (err) {
      console.warn('Failed to load editor state:', err);
      return {};
    }
  },

  // Settings
  saveSettings: (settings: Partial<AppSettings>) => {
    try {
      const existing = storage.getSettings();
      const updated = { ...existing, ...settings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save settings:', err);
    }
  },

  getSettings: (): Partial<AppSettings> => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : {};
    } catch (err) {
      console.warn('Failed to load settings:', err);
      return {};
    }
  },

  // Recent URLs
  saveRecentUrl: (url: string) => {
    try {
      const recent = storage.getRecentUrls();
      // Remove if already exists
      const filtered = recent.filter(u => u !== url);
      // Add to beginning
      const updated = [url, ...filtered].slice(0, 10); // Keep last 10
      localStorage.setItem(STORAGE_KEYS.RECENT_URLS, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save recent URL:', err);
    }
  },

  getRecentUrls: (): string[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECENT_URLS);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.warn('Failed to load recent URLs:', err);
      return [];
    }
  },

  // Custom CSS
  saveCustomCss: (css: string) => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_CSS, css);
    } catch (err) {
      console.warn('Failed to save custom CSS:', err);
    }
  },

  getCustomCss: (): string | null => {
    try {
      return localStorage.getItem(STORAGE_KEYS.CUSTOM_CSS);
    } catch (err) {
      console.warn('Failed to load custom CSS:', err);
      return null;
    }
  },

  // Custom Devices
  saveCustomDevices: (devices: CustomDevice[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_DEVICES, JSON.stringify(devices));
    } catch (err) {
      console.warn('Failed to save custom devices:', err);
    }
  },

  getCustomDevices: (): CustomDevice[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_DEVICES);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.warn('Failed to load custom devices:', err);
      return [];
    }
  },

  // Clear all data
  clearAll: () => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (err) {
      console.warn('Failed to clear storage:', err);
    }
  },
};

// Re-export types for easier importing

