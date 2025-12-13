import React, { useState, useEffect, useRef } from 'react';
import { GripHorizontal, X } from 'lucide-react';

interface DraggablePanelProps {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  initialPosition?: { x: number; y: number };
  width?: number | string;
  height?: number | string;
}

const DraggablePanel: React.FC<DraggablePanelProps> = ({
  title,
  children,
  onClose,
  initialPosition = { x: 20, y: 100 },
  width = 350,
  height = 'auto',
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (panelRef.current) {
      setIsDragging(true);
      const rect = panelRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        // Calculate new position
        let newX = e.clientX - dragOffset.x;
        let newY = e.clientY - dragOffset.y;

        // Boundary checks to keep panel within viewport
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const panelWidth = panelRef.current?.offsetWidth || 0;
        const panelHeight = panelRef.current?.offsetHeight || 0;

        // Clamp values
        newX = Math.max(0, Math.min(newX, windowWidth - panelWidth));
        newY = Math.max(0, Math.min(newY, windowHeight - panelHeight));

        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={panelRef}
      className="draggable-panel"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: width,
        height: height,
        zIndex: 1000,
      }}
    >
      <div className="draggable-header" onMouseDown={handleMouseDown}>
        <div className="draggable-title">
          <GripHorizontal size={16} />
          <span>{title}</span>
        </div>
        {onClose && (
          <button className="draggable-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </div>
      <div className="draggable-content">
        {children}
      </div>
    </div>
  );
};

export default DraggablePanel;
