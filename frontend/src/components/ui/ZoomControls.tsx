import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import '../../assets/css/ui/ZoomControls.css';

export default function ZoomControls() {
  const { state, setZoomLevel, resetViewport } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const zoomLevel = state.viewport.zoomLevel;
  const zoomPercentage = Math.round(zoomLevel * 100);

  // Update input value when zoom changes externally
  useEffect(() => {
    if (!isEditing) {
      setInputValue(zoomPercentage.toString());
    }
  }, [zoomPercentage, isEditing]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setZoomLevel(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const value = parseFloat(inputValue);
    if (!isNaN(value) && value >= 10 && value <= 500) {
      setZoomLevel(value / 100);
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
  };

  const handleZoomOut = () => {
    // Smooth zoom out - decrease by 10% or to next nice number
    const newZoom = Math.max(zoomLevel / 1.1, 0.1);
    setZoomLevel(newZoom);
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
        <button
          className="zoom-reset-btn"
          onClick={handleReset}
          title="Reset to 100%"
        >
          Reset
        </button>
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
            onClick={() => setZoomLevel(preset / 100)}
            title={`Zoom to ${preset}%`}
          >
            {preset}%
          </button>
        ))}
      </div>
    </div>
  );
}
