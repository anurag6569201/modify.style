import React, { useState, useEffect } from 'react';
import { Layers, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './CollapsibleLeftPanel.css';

export const PANEL_WIDTH = 280;
export const ICON_MENU_WIDTH = 56;

export type PanelType = 'design' | 'effects' | 'brand' | 'settings' | null;

interface PanelConfig {
  id: PanelType;
  icon: React.ReactNode;
  label: string;
  component: React.ReactNode;
}

interface CollapsibleLeftPanelProps {
  panels: PanelConfig[];
  defaultPanel?: PanelType;
  onPanelChange?: (panel: PanelType) => void;
  onClose?: () => void;
}

const CollapsibleLeftPanel: React.FC<CollapsibleLeftPanelProps> = ({
  panels,
  defaultPanel = 'design',
  onPanelChange,
  onClose,
}) => {
  const [activePanel, setActivePanel] = useState<PanelType>(defaultPanel);

  useEffect(() => {
    onPanelChange?.(activePanel);
  }, [activePanel, onPanelChange]);

  const handlePanelSelect = (panelId: PanelType) => {
    if (activePanel === panelId) {
      // If clicking the same panel, close it
      setActivePanel(null);
      onPanelChange?.(null);
    } else {
      setActivePanel(panelId);
      onPanelChange?.(panelId);
    }
  };

  const activePanelConfig = panels.find(p => p.id === activePanel);

  return (
    <motion.div
      className="collapsible-left-panel"
      initial={false}
      animate={{
        width: activePanel ? PANEL_WIDTH + ICON_MENU_WIDTH : ICON_MENU_WIDTH,
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30
      }}
    >
      {/* Icon Menu Bar (Always Visible) */}
      <div className="icon-menu-bar">
        <div className="menu-logo">
          <Layers size={20} />
        </div>
        
        <div className="menu-icons">
          {panels.map((panel) => (
            <motion.button
              key={panel.id}
              className={`menu-icon-btn ${activePanel === panel.id ? 'active' : ''}`}
              onClick={() => handlePanelSelect(panel.id)}
              title={panel.label}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {panel.icon}
              {activePanel === panel.id && (
                <motion.div
                  className="active-indicator"
                  layoutId="activeIndicator"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Panel Content Area */}
      <AnimatePresence mode="wait">
        {activePanel && activePanelConfig && (
          <motion.div
            className="panel-content-area"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Panel Header */}
            <div className="panel-header">
              <div className="panel-title-section">
                <span className="panel-title">{activePanelConfig.label}</span>
              </div>
              <button
                className="panel-close-btn"
                onClick={() => {
                  setActivePanel(null);
                  onPanelChange?.(null);
                  onClose?.();
                }}
                title="Close Panel"
              >
                <X size={16} />
              </button>
            </div>

            {/* Panel Content */}
            <div className="panel-content-wrapper">
              {activePanelConfig.component}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CollapsibleLeftPanel;
