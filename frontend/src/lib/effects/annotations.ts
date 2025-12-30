/**
 * God-Level Annotation System
 * Real-time drawing tools for screen recording
 */

export interface Annotation {
  id: string;
  type: "arrow" | "circle" | "rectangle" | "highlight" | "text" | "blur";
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  thickness: number;
  timestamp: number;
  duration: number;
  points?: Array<{ x: number; y: number }>;
  text?: string;
  fontSize?: number;
}

export class AnnotationEngine {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  drawAnnotation(annotation: Annotation, currentTime: number): void {
    const timeSince = currentTime - annotation.timestamp;
    if (timeSince < 0 || timeSince > annotation.duration) return;

    const progress = Math.min(1, timeSince / Math.max(0.1, annotation.duration));
    const fadeIn = Math.min(1, progress * 3);
    const fadeOut = Math.min(1, (1 - progress) * 2);
    const opacity = Math.min(fadeIn, fadeOut);

    this.ctx.save();
    this.ctx.globalAlpha = opacity;

    switch (annotation.type) {
      case "arrow":
        this.drawArrow(annotation);
        break;
      case "circle":
        this.drawCircle(annotation);
        break;
      case "rectangle":
        this.drawRectangle(annotation);
        break;
      case "highlight":
        this.drawHighlight(annotation);
        break;
      case "text":
        this.drawText(annotation);
        break;
      case "blur":
        this.drawBlur(annotation);
        break;
    }

    this.ctx.restore();
  }

  private drawArrow(annotation: Annotation): void {
    const x = annotation.x * this.width;
    const y = annotation.y * this.height;
    const endX = (annotation.width || 0) * this.width;
    const endY = (annotation.height || 0) * this.height;

    this.ctx.strokeStyle = annotation.color;
    this.ctx.fillStyle = annotation.color;
    this.ctx.lineWidth = annotation.thickness;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Draw arrow line
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(endX, endY);
    this.ctx.stroke();

    // Draw arrowhead
    const angle = Math.atan2(endY - y, endX - x);
    const arrowLength = 20;
    const arrowWidth = 12;

    this.ctx.beginPath();
    this.ctx.moveTo(endX, endY);
    this.ctx.lineTo(
      endX - arrowLength * Math.cos(angle - Math.PI / 6),
      endY - arrowLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      endX - arrowLength * Math.cos(angle + Math.PI / 6),
      endY - arrowLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawCircle(annotation: Annotation): void {
    const x = annotation.x * this.width;
    const y = annotation.y * this.height;
    const radius = (annotation.width || 50) * Math.min(this.width, this.height);

    this.ctx.strokeStyle = annotation.color;
    this.ctx.fillStyle = annotation.color + "20";
    this.ctx.lineWidth = annotation.thickness;

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  private drawRectangle(annotation: Annotation): void {
    const x = annotation.x * this.width;
    const y = annotation.y * this.height;
    const width = (annotation.width || 100) * this.width;
    const height = (annotation.height || 50) * this.height;

    this.ctx.strokeStyle = annotation.color;
    this.ctx.fillStyle = annotation.color + "20";
    this.ctx.lineWidth = annotation.thickness;

    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeRect(x, y, width, height);
  }

  private drawHighlight(annotation: Annotation): void {
    const x = annotation.x * this.width;
    const y = annotation.y * this.height;
    const width = (annotation.width || 100) * this.width;
    const height = (annotation.height || 50) * this.height;

    this.ctx.fillStyle = annotation.color + "40";
    this.ctx.fillRect(x, y, width, height);
  }

  private drawText(annotation: Annotation): void {
    if (!annotation.text) return;

    const x = annotation.x * this.width;
    const y = annotation.y * this.height;
    const fontSize = annotation.fontSize || 16;

    this.ctx.fillStyle = annotation.color;
    this.ctx.font = `bold ${fontSize}px sans-serif`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    // Text shadow for readability
    this.ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    this.ctx.shadowBlur = 4;
    this.ctx.shadowOffsetX = 2;
    this.ctx.shadowOffsetY = 2;

    this.ctx.fillText(annotation.text, x, y);
    
    this.ctx.shadowColor = "transparent";
  }

  private drawBlur(annotation: Annotation): void {
    const x = annotation.x * this.width;
    const y = annotation.y * this.height;
    const width = (annotation.width || 100) * this.width;
    const height = (annotation.height || 50) * this.height;

    // Create a temporary canvas for blur effect
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    // Draw blurred rectangle
    this.ctx.save();
    this.ctx.filter = "blur(10px)";
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    this.ctx.fillRect(x, y, width, height);
    this.ctx.restore();
  }
}

