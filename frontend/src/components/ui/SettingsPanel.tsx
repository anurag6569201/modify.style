import React from 'react';
import { useApp } from '../../context/AppContext';
import { Monitor, Download, Palette, Trash2, Grid, Type, Save } from 'lucide-react';
import { storage } from '../../utils/storage';
import '../../assets/css/ui/SettingsPanel.css';

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

  // Although SettingsPanel is rendered inside CollapsibleLeftPanel now, 
  // we might want to keep the container layout clean.
  // We don't need the header close button if it's in the sidebar, 
  // but if it's standalone, we do. 
  // Based on WebsiteViewer.tsx, it's rendered as a component prop to CollapsibleLeftPanel.
  // The CollapsibleLeftPanel handles title and close. 
  // So we should remove the header from here to avoid double headers.

  return (
    <div className="settings-panel">
      {/* Content */}
      <div className="settings-content">

        {/* Appearance Section */}
        <div className="settings-section">
          <h3 className="section-heading">Appearance</h3>

          <div className="setting-item">
            <label className="setting-label">
              <Monitor size={14} />
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
              <Grid size={14} />
              <span>Grid Background</span>
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

        {/* Editor Section */}
        <div className="settings-section">
          <h3 className="section-heading">Editor</h3>

          <div className="setting-item">
            <label className="setting-label">
              <Save size={14} />
              <span>Auto-save</span>
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
              <Type size={14} />
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

        {/* Data Section */}
        <div className="settings-section">
          <h3 className="section-heading">Configuration</h3>

          <div className="setting-item">
            <label className="setting-label">
              <Download size={14} />
              <span>Export Config</span>
            </label>
            <div className="setting-control">
              <button className="setting-btn" onClick={handleExport}>
                Export JSON
              </button>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <Palette size={14} />
              <span>Import Config</span>
            </label>
            <div className="setting-control">
              <label className="setting-btn file-input-label">
                Import JSON
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

        {/* Danger Zone */}
        <div className="settings-section">
          <h3 className="section-heading" style={{ color: 'rgba(239, 68, 68, 0.8)' }}>Danger Zone</h3>

          <div className="setting-item">
            <label className="setting-label">
              <Trash2 size={14} style={{ color: 'rgba(239, 68, 68, 0.8)' }} />
              <span style={{ color: 'rgba(239, 68, 68, 0.8)' }}>Clear All Data</span>
            </label>
            <div className="setting-control">
              <button className="setting-btn danger" onClick={handleClearStorage}>
                Reset App
              </button>
            </div>
          </div>
        </div>

        {/* About Info */}
        <div className="about-info">
          <div className="about-version">Modify.Style v1.0.0</div>
          <p className="about-description">
            A powerful web customization tool for viewing and editing websites in real-time.
          </p>
        </div>
      </div>
    </div>
  );
}
