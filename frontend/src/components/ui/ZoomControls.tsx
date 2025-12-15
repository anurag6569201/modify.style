import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, RotateCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import '../../assets/css/ui/ZoomControls.css';

export default function ZoomControls() {
  const { state, setZoomLevel, resetViewport } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const zoomHistoryRef = useRef<number[]>([1]); // Track zoom history
  const historyIndexRef = useRef<number>(0);

  const zoomLevel = state.viewport.zoomLevel;
  const zoomPercentage = Math.round(zoomLevel * 100);

  // Update input value when zoom changes externally
  useEffect(() => {
    if (!isEditing) {
      setInputValue(zoomPercentage.toString());
    }
  }, [zoomPercentage, isEditing]);

  // Add to zoom history
  const addToHistory = (level: number) => {
    const history = zoomHistoryRef.current;
    const index = historyIndexRef.current;
    
    // Remove any future history if we're not at the end
    if (index < history.length - 1) {
      history.splice(index + 1);
    }
    
    // Add new zoom level
    history.push(level);
    historyIndexRef.current = history.length - 1;
    
    // Limit history size
    if (history.length > 10) {
      history.shift();
      historyIndexRef.current = history.length - 1;
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) / 100;
    setZoomLevel(value);
    addToHistory(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const value = parseFloat(inputValue);
    if (!isNaN(value) && value >= 10 && value <= 500) {
      const newZoom = value / 100;
      setZoomLevel(newZoom);
      addToHistory(newZoom);
    } else {
      setInputValue(zoomPercentage.toString());
    }
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setInputValue(zoomPercentage.toString());
      setIsEditing(false);
      inputRef.current?.blur();
    }
  };

  const handleInputFocus = () => {
    setIsEditing(true);
    inputRef.current?.select();
  };

  const handleZoomIn = () => {
    // Smooth zoom in - increase by 10% or to next nice number
    const newZoom = Math.min(zoomLevel * 1.1, 5);
    setZoomLevel(newZoom);
    addToHistory(newZoom);
  };

  const handleZoomOut = () => {
    // Smooth zoom out - decrease by 10% or to next nice number
    const newZoom = Math.max(zoomLevel / 1.1, 0.1);
    setZoomLevel(newZoom);
    addToHistory(newZoom);
  };

  const handleZoomBack = () => {
    const history = zoomHistoryRef.current;
    const index = historyIndexRef.current;
    
    if (index > 0) {
      historyIndexRef.current = index - 1;
      setZoomLevel(history[historyIndexRef.current]);
    }
  };

  const handleZoomForward = () => {
    const history = zoomHistoryRef.current;
    const index = historyIndexRef.current;
    
    if (index < history.length - 1) {
      historyIndexRef.current = index + 1;
      setZoomLevel(history[historyIndexRef.current]);
    }
  };

  const handleReset = () => {
    resetViewport();
  };

  // Zoom presets
  const zoomPresets = [25, 50, 75, 100, 125, 150, 200, 300, 400, 500];

  return (
    <div className="zoom-controls">
      <div className="zoom-controls-header">
        <span className="zoom-label">Zoom</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className="zoom-reset-btn"
            onClick={handleZoomBack}
            disabled={historyIndexRef.current === 0}
            title="Previous zoom level"
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            <RotateCcw size={12} />
          </button>
          <button
            className="zoom-reset-btn"
            onClick={handleZoomForward}
            disabled={historyIndexRef.current >= zoomHistoryRef.current.length - 1}
            title="Next zoom level"
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            <RotateCw size={12} />
          </button>
          <button
            className="zoom-reset-btn"
            onClick={handleReset}
            title="Reset to 100%"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="zoom-slider-container">
        <button
          className="zoom-btn zoom-out-btn"
          onClick={handleZoomOut}
          disabled={zoomLevel <= 0.1}
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>

        <div className="zoom-slider-wrapper">
          <input
            type="range"
            min="10"
            max="500"
            step="1"
            value={zoomPercentage}
            onChange={handleSliderChange}
            className="zoom-slider"
            title={`Zoom: ${zoomPercentage}%`}
          />
          <div className="zoom-slider-labels">
            <span>10%</span>
            <span>100%</span>
            <span>500%</span>
          </div>
        </div>

        <button
          className="zoom-btn zoom-in-btn"
          onClick={handleZoomIn}
          disabled={zoomLevel >= 5}
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      <div className="zoom-input-container">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={handleInputFocus}
          onKeyDown={handleInputKeyDown}
          className="zoom-input"
          placeholder="100"
          maxLength={4}
        />
        <span className="zoom-percent">%</span>
      </div>

      <div className="zoom-presets">
        {zoomPresets.map((preset) => (
          <button
            key={preset}
            className={`zoom-preset-btn ${zoomPercentage === preset ? 'active' : ''}`}
            onClick={() => {
              const newZoom = preset / 100;
              setZoomLevel(newZoom);
              addToHistory(newZoom);
            }}
            title={`Zoom to ${preset}%`}
          >
            {preset}%
          </button>
        ))}
      </div>
    </div>
  );
}
