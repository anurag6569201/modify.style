/**
 * God-Level Transition Effects Library
 * Cinematic transitions for video editing
 */

export type TransitionType = 
  | 'fade'
  | 'slide'
  | 'zoom'
  | 'blur'
  | 'wipe'
  | 'glitch'
  | 'morph'
  | 'rotate'
  | 'pixelate'
  | 'wave';

export interface TransitionConfig {
  type: TransitionType;
  duration: number;
  easing: (t: number) => number;
  direction?: 'left' | 'right' | 'up' | 'down' | 'in' | 'out';
}

// Easing functions
export const easings = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  elastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  bounce: (t: number) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  },
};

export class TransitionEngine {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  applyTransition(
    fromImage: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    toImage: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    progress: number,
    config: TransitionConfig
  ): void {
    const eased = config.easing(progress);

    switch (config.type) {
      case 'fade':
        this.fadeTransition(fromImage, toImage, eased);
        break;
      case 'slide':
        this.slideTransition(fromImage, toImage, eased, config.direction || 'right');
        break;
      case 'zoom':
        this.zoomTransition(fromImage, toImage, eased, config.direction || 'in');
        break;
      case 'blur':
        this.blurTransition(fromImage, toImage, eased);
        break;
      case 'wipe':
        this.wipeTransition(fromImage, toImage, eased, config.direction || 'right');
        break;
      case 'glitch':
        this.glitchTransition(fromImage, toImage, eased);
        break;
      case 'morph':
        this.morphTransition(fromImage, toImage, eased);
        break;
      case 'rotate':
        this.rotateTransition(fromImage, toImage, eased);
        break;
      case 'pixelate':
        this.pixelateTransition(fromImage, toImage, eased);
        break;
      case 'wave':
        this.waveTransition(fromImage, toImage, eased);
        break;
    }
  }

  private fadeTransition(
    from: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    to: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    progress: number
  ): void {
    this.ctx.save();
    this.ctx.globalAlpha = 1 - progress;
    this.ctx.drawImage(from, 0, 0, this.width, this.height);
    this.ctx.globalAlpha = progress;
    this.ctx.drawImage(to, 0, 0, this.width, this.height);
    this.ctx.restore();
  }

  private slideTransition(
    from: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    to: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    progress: number,
    direction: 'left' | 'right' | 'up' | 'down'
  ): void {
    let offsetX = 0;
    let offsetY = 0;

    switch (direction) {
      case 'left':
        offsetX = -this.width * progress;
        break;
      case 'right':
        offsetX = this.width * progress;
        break;
      case 'up':
        offsetY = -this.height * progress;
        break;
      case 'down':
        offsetY = this.height * progress;
        break;
    }

    this.ctx.drawImage(from, offsetX, offsetY, this.width, this.height);
    this.ctx.drawImage(to, offsetX - (direction === 'left' ? this.width : direction === 'right' ? -this.width : 0),
      offsetY - (direction === 'up' ? this.height : direction === 'down' ? -this.height : 0),
      this.width, this.height);
  }

  private zoomTransition(
    from: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    to: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    progress: number,
    direction: 'in' | 'out'
  ): void {
    const scale = direction === 'in' ? 1 + progress : 1 - progress;
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.scale(scale, scale);
    this.ctx.translate(-centerX, -centerY);
    this.ctx.globalAlpha = 1 - progress;
    this.ctx.drawImage(from, 0, 0, this.width, this.height);
    this.ctx.restore();

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.scale(direction === 'in' ? progress : 2 - progress, direction === 'in' ? progress : 2 - progress);
    this.ctx.translate(-centerX, -centerY);
    this.ctx.globalAlpha = progress;
    this.ctx.drawImage(to, 0, 0, this.width, this.height);
    this.ctx.restore();
  }

  private blurTransition(
    from: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    to: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    progress: number
  ): void {
    this.ctx.save();
    this.ctx.filter = `blur(${(1 - progress) * 10}px)`;
    this.ctx.globalAlpha = 1 - progress;
    this.ctx.drawImage(from, 0, 0, this.width, this.height);
    this.ctx.restore();

    this.ctx.save();
    this.ctx.filter = `blur(${progress * 10}px)`;
    this.ctx.globalAlpha = progress;
    this.ctx.drawImage(to, 0, 0, this.width, this.height);
    this.ctx.restore();
  }

  private wipeTransition(
    from: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    to: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    progress: number,
    direction: 'left' | 'right' | 'up' | 'down'
  ): void {
    this.ctx.drawImage(from, 0, 0, this.width, this.height);
    this.ctx.save();
    this.ctx.beginPath();
    
    switch (direction) {
      case 'right':
        this.ctx.rect(0, 0, this.width * progress, this.height);
        break;
      case 'left':
        this.ctx.rect(this.width * (1 - progress), 0, this.width * progress, this.height);
        break;
      case 'down':
        this.ctx.rect(0, 0, this.width, this.height * progress);
        break;
      case 'up':
        this.ctx.rect(0, this.height * (1 - progress), this.width, this.height * progress);
        break;
    }
    
    this.ctx.clip();
    this.ctx.drawImage(to, 0, 0, this.width, this.height);
    this.ctx.restore();
  }

  private glitchTransition(
    from: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    to: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    progress: number
  ): void {
    const intensity = Math.sin(progress * Math.PI * 10) * (1 - progress);
    const offset = intensity * 20;

    this.ctx.drawImage(from, 0, 0, this.width, this.height);
    
    this.ctx.save();
    this.ctx.globalAlpha = progress;
    this.ctx.drawImage(to, offset, 0, this.width, this.height);
    this.ctx.globalCompositeOperation = 'difference';
    this.ctx.drawImage(to, -offset, 0, this.width, this.height);
    this.ctx.restore();
  }

  private morphTransition(
    from: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    to: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    progress: number
  ): void {
    const wave = Math.sin(progress * Math.PI);
    const distortion = wave * 30;

    this.ctx.save();
    for (let y = 0; y < this.height; y += 5) {
      const offset = Math.sin((y / this.height) * Math.PI * 2 + progress * Math.PI * 2) * distortion;
      this.ctx.drawImage(from, offset, y, this.width, 5, offset, y, this.width, 5);
    }
    this.ctx.restore();

    this.ctx.save();
    this.ctx.globalAlpha = progress;
    for (let y = 0; y < this.height; y += 5) {
      const offset = Math.sin((y / this.height) * Math.PI * 2 + progress * Math.PI * 2) * distortion;
      this.ctx.drawImage(to, offset, y, this.width, 5, offset, y, this.width, 5);
    }
    this.ctx.restore();
  }

  private rotateTransition(
    from: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    to: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    progress: number
  ): void {
    const angle = progress * Math.PI * 2;
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(-angle);
    this.ctx.translate(-centerX, -centerY);
    this.ctx.globalAlpha = 1 - progress;
    this.ctx.drawImage(from, 0, 0, this.width, this.height);
    this.ctx.restore();

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(Math.PI * 2 - angle);
    this.ctx.translate(-centerX, -centerY);
    this.ctx.globalAlpha = progress;
    this.ctx.drawImage(to, 0, 0, this.width, this.height);
    this.ctx.restore();
  }

  private pixelateTransition(
    from: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    to: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    progress: number
  ): void {
    const pixelSize = Math.max(1, (1 - progress) * 20);
    
    this.ctx.save();
    this.ctx.imageSmoothingEnabled = false;
    
    if (progress < 0.5) {
      this.ctx.drawImage(from, 0, 0, this.width / pixelSize, this.height / pixelSize);
      this.ctx.drawImage(this.ctx.canvas, 0, 0, this.width / pixelSize, this.height / pixelSize,
        0, 0, this.width, this.height);
    } else {
      this.ctx.drawImage(to, 0, 0, this.width / pixelSize, this.height / pixelSize);
      this.ctx.drawImage(this.ctx.canvas, 0, 0, this.width / pixelSize, this.height / pixelSize,
        0, 0, this.width, this.height);
    }
    
    this.ctx.restore();
  }

  private waveTransition(
    from: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    to: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    progress: number
  ): void {
    const waveHeight = Math.sin(progress * Math.PI) * 50;
    
    this.ctx.drawImage(from, 0, 0, this.width, this.height);
    
    this.ctx.save();
    this.ctx.globalAlpha = progress;
    for (let x = 0; x < this.width; x += 2) {
      const offset = Math.sin((x / this.width) * Math.PI * 4 + progress * Math.PI * 2) * waveHeight;
      this.ctx.drawImage(to, x, offset, 2, this.height, x, 0, 2, this.height);
    }
    this.ctx.restore();
  }
}

