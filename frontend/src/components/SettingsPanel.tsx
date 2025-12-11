import React from 'react';
import { useApp } from '../context/AppContext';
import { X, Monitor, Download, Palette, Trash2 } from 'lucide-react';
import { storage } from '../utils/storage';
import './SettingsPanel.css';

export default function SettingsPanel() {
  const { state, dispatch } = useApp();
  const savedSettings = storage.getSettings();
  
  const [theme, setTheme] = React.useState<'light' | 'dark' | 'auto'>(savedSettings.theme || 'dark');
  const [autoSave, setAutoSave] = React.useState(savedSettings.autoSave !== undefined ? savedSettings.autoSave : true);
  const [showGrid, setShowGrid] = React.useState(savedSettings.showGrid !== undefined ? savedSettings.showGrid : true);
  const [fontSize, setFontSize] = React.useState(savedSettings.fontSize || 13);

  const handleExport = () => {
    const data = {
      css: state.editor.customCss,
      url: state.view.currentUrl,
      deviceMode: state.viewport.deviceMode,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modify-style-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.css) {
          dispatch({ type: 'SET_CUSTOM_CSS', payload: data.css });
        }
        if (data.deviceMode) {
          dispatch({ type: 'SET_DEVICE_MODE', payload: data.deviceMode });
        }
        if (data.settings) {
          storage.saveSettings(data.settings);
        }
      } catch (err) {
        console.error('Failed to import:', err);
        alert('Failed to import file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'auto') => {
    setTheme(newTheme);
    storage.saveSettings({ theme: newTheme });
  };

  const handleAutoSaveChange = (value: boolean) => {
    setAutoSave(value);
    storage.saveSettings({ autoSave: value });
  };

  const handleShowGridChange = (value: boolean) => {
    setShowGrid(value);
    storage.saveSettings({ showGrid: value });
  };

  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    storage.saveSettings({ fontSize: size });
  };

  const handleClearStorage = () => {
    if (confirm('Are you sure you want to clear all saved data? This cannot be undone.')) {
      storage.clearAll();
      window.location.reload();
    }
  };

  if (!state.editor.showSettings) return null;

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <div className="settings-title">
          <Palette size={18} />
          <span>Settings</span>
        </div>
        <button
          className="settings-close-btn"
          onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })}
        >
          <X size={18} />
        </button>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h3 className="section-heading">Appearance</h3>
          
          <div className="setting-item">
            <label className="setting-label">
              <Monitor size={16} />
              <span>Theme</span>
            </label>
            <div className="setting-control">
              <select
                value={theme}
                onChange={(e) => handleThemeChange(e.target.value as 'light' | 'dark' | 'auto')}
                className="setting-select"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span>Show Grid Background</span>
            </label>
            <div className="setting-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => handleShowGridChange(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="section-heading">Editor</h3>
          
          <div className="setting-item">
            <label className="setting-label">
              <span>Auto-save Changes</span>
            </label>
            <div className="setting-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => handleAutoSaveChange(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span>Font Size</span>
            </label>
            <div className="setting-control">
              <select 
                className="setting-select" 
                value={fontSize}
                onChange={(e) => handleFontSizeChange(Number(e.target.value))}
              >
                <option value="12">12px</option>
                <option value="13">13px</option>
                <option value="14">14px</option>
                <option value="16">16px</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="section-heading">Data</h3>
          
          <div className="setting-item">
            <label className="setting-label">
              <Download size={16} />
              <span>Export Configuration</span>
            </label>
            <div className="setting-control">
              <button className="setting-btn" onClick={handleExport}>
                Export
              </button>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span>Import Configuration</span>
            </label>
            <div className="setting-control">
              <label className="setting-btn file-input-label">
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="file-input"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="section-heading">Data Management</h3>
          
          <div className="setting-item">
            <label className="setting-label">
              <Trash2 size={16} />
              <span>Clear All Data</span>
            </label>
            <div className="setting-control">
              <button className="setting-btn danger" onClick={handleClearStorage}>
                Clear All
              </button>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="section-heading">About</h3>
          <div className="about-info">
            <p>Modify.Style v1.0.0</p>
            <p className="about-description">
              A powerful web customization tool for viewing and editing websites in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
