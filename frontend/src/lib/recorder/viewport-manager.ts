// Simple and effective viewport management system

export interface ViewportTransform {
  zoom: number;
  pan: { x: number; y: number };
}

export interface ViewportConfig {
  minZoom: number;
  maxZoom: number;
  smoothing: number;
  autoZoom: boolean;
  followCursor: boolean;
}

export class SimpleViewportManager {
  private currentTransform: ViewportTransform = { zoom: 1, pan: { x: 0, y: 0 } };
  private targetTransform: ViewportTransform = { zoom: 1, pan: { x: 0, y: 0 } };
  private isAnimating = false;
  private lastCursorPos: { x: number; y: number } = { x: 0.5, y: 0.5 };
  private config: ViewportConfig;
  
  constructor(
    private container: HTMLElement,
    config: Partial<ViewportConfig> = {}
  ) {
    this.config = {
      minZoom: 1,
      maxZoom: 3,
      smoothing: 0.1,
      autoZoom: true,
      followCursor: true,
      ...config
    };
  }
  
  // Update cursor position and calculate viewport
  updateCursor(pos: { x: number; y: number }) {
    this.lastCursorPos = pos;
    
    if (!this.config.followCursor) return;
    
    // Calculate zoom based on cursor position from center
    const centerDist = Math.sqrt(
      Math.pow(pos.x - 0.5, 2) + 
      Math.pow(pos.y - 0.5, 2)
    );
    
    // Auto zoom when cursor is near edges
    if (this.config.autoZoom) {
      const targetZoom = 1 + centerDist * 1.5; // Gradual zoom based on distance
      this.setZoom(Math.min(targetZoom, this.config.maxZoom));
    }
    
    // Pan to keep cursor in view
    if (this.currentTransform.zoom > 1) {
      const scale = this.currentTransform.zoom;
      const panX = (0.5 - pos.x) * 200 * (scale - 1);
      const panY = (0.5 - pos.y) * 200 * (scale - 1);
      this.setPan(panX, panY);
    } else {
      this.setPan(0, 0);
    }
  }
  
  // Set zoom level
  setZoom(zoom: number) {
    this.targetTransform.zoom = Math.max(
      this.config.minZoom, 
      Math.min(this.config.maxZoom, zoom)
    );
    this.animate();
  }
  
  // Set pan position
  setPan(x: number, y: number) {
    this.targetTransform.pan = { x, y };
    this.animate();
  }
  
  // Reset viewport
  reset() {
    this.targetTransform = { zoom: 1, pan: { x: 0, y: 0 } };
    this.animate();
  }
  
  // Handle click events for smart zoom
  handleClick(pos: { x: number; y: number }) {
    if (!this.config.autoZoom) return;
    
    // Zoom in on click if not already zoomed
    if (this.currentTransform.zoom < 1.5) {
      this.setZoom(1.8);
      this.updateCursor(pos);
      
      // Auto reset after delay
      setTimeout(() => {
        if (this.currentTransform.zoom > 1.5) {
          this.setZoom(1);
        }
      }, 3000);
    }
  }
  
  // Smooth animation loop
  private animate() {
    if (this.isAnimating) return;
    
    this.isAnimating = true;
    const animateFrame = () => {
      const { smoothing } = this.config;
      
      // Interpolate zoom
      const zoomDiff = this.targetTransform.zoom - this.currentTransform.zoom;
      if (Math.abs(zoomDiff) > 0.001) {
        this.currentTransform.zoom += zoomDiff * smoothing;
      }
      
      // Interpolate pan
      const panXDiff = this.targetTransform.pan.x - this.currentTransform.pan.x;
      const panYDiff = this.targetTransform.pan.y - this.currentTransform.pan.y;
      
      if (Math.abs(panXDiff) > 0.1 || Math.abs(panYDiff) > 0.1) {
        this.currentTransform.pan.x += panXDiff * smoothing;
        this.currentTransform.pan.y += panYDiff * smoothing;
      }
      
      // Apply transform
      this.applyTransform();
      
      // Continue animation if needed
      const needsAnimation = 
        Math.abs(zoomDiff) > 0.001 || 
        Math.abs(panXDiff) > 0.1 || 
        Math.abs(panYDiff) > 0.1;
        
      if (needsAnimation) {
        requestAnimationFrame(animateFrame);
      } else {
        this.isAnimating = false;
      }
    };
    
    requestAnimationFrame(animateFrame);
  }
  
  // Apply transform to container
  private applyTransform() {
    const { zoom, pan } = this.currentTransform;
    this.container.style.transform = `
      translate(${pan.x}px, ${pan.y}px) 
      scale(${zoom})
    `;
  }
  
  // Get current transform
  getTransform(): ViewportTransform {
    return { ...this.currentTransform };
  }
}
