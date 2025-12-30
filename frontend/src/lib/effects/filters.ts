/**
 * God-Level Video Filters and Effects
 * Real-time image processing filters
 */

export interface FilterConfig {
  brightness?: number; // -1 to 1
  contrast?: number; // -1 to 1
  saturation?: number; // -1 to 1
  hue?: number; // 0 to 360
  blur?: number; // 0 to 20
  sharpen?: number; // 0 to 1
  noise?: number; // 0 to 1
  vignette?: number; // 0 to 1
  sepia?: number; // 0 to 1
  grayscale?: number; // 0 to 1
  invert?: boolean;
  colorize?: { r: number; g: number; b: number; amount: number };
}

export class FilterEngine {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private tempCanvas: HTMLCanvasElement;
  private tempCtx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    
    this.tempCanvas = document.createElement('canvas');
    this.tempCanvas.width = width;
    this.tempCanvas.height = height;
    this.tempCtx = this.tempCanvas.getContext('2d')!;
  }

  applyFilters(
    image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    config: FilterConfig
  ): void {
    // Draw image to temp canvas
    this.tempCtx.drawImage(image, 0, 0, this.width, this.height);
    
    // Get image data
    const imageData = this.tempCtx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    // Apply pixel-level filters
    if (config.brightness !== undefined || config.contrast !== undefined || 
        config.saturation !== undefined || config.hue !== undefined ||
        config.grayscale !== undefined || config.sepia !== undefined ||
        config.invert !== undefined || config.colorize !== undefined) {
      this.applyColorFilters(data, config);
    }

    if (config.noise !== undefined && config.noise > 0) {
      this.applyNoise(data, config.noise);
    }

    // Put modified data back
    this.tempCtx.putImageData(imageData, 0, 0);

    // Apply canvas-level filters
    this.ctx.save();
    
    if (config.blur !== undefined && config.blur > 0) {
      this.ctx.filter = `blur(${config.blur}px)`;
    }
    
    if (config.vignette !== undefined && config.vignette > 0) {
      this.applyVignette(config.vignette);
    }

    this.ctx.drawImage(this.tempCanvas, 0, 0);
    this.ctx.restore();

    // Apply sharpen if needed
    if (config.sharpen !== undefined && config.sharpen > 0) {
      this.applySharpen(config.sharpen);
    }
  }

  private applyColorFilters(data: Uint8ClampedArray, config: FilterConfig): void {
    const brightness = config.brightness ?? 0;
    const contrast = config.contrast ?? 0;
    const saturation = config.saturation ?? 0;
    const hue = config.hue ?? 0;
    const grayscale = config.grayscale ?? 0;
    const sepia = config.sepia ?? 0;
    const invert = config.invert ?? false;
    const colorize = config.colorize;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Brightness
      if (brightness !== 0) {
        r += brightness * 255;
        g += brightness * 255;
        b += brightness * 255;
      }

      // Contrast
      if (contrast !== 0) {
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
        r = factor * (r - 128) + 128;
        g = factor * (g - 128) + 128;
        b = factor * (b - 128) + 128;
      }

      // Grayscale
      if (grayscale > 0) {
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        r = r * (1 - grayscale) + gray * grayscale;
        g = g * (1 - grayscale) + gray * grayscale;
        b = b * (1 - grayscale) + gray * grayscale;
      }

      // Sepia
      if (sepia > 0) {
        const tr = 0.393 * r + 0.769 * g + 0.189 * b;
        const tg = 0.349 * r + 0.686 * g + 0.168 * b;
        const tb = 0.272 * r + 0.534 * g + 0.131 * b;
        r = r * (1 - sepia) + tr * sepia;
        g = g * (1 - sepia) + tg * sepia;
        b = b * (1 - sepia) + tb * sepia;
      }

      // Hue rotation
      if (hue !== 0) {
        const h = hue * Math.PI / 180;
        const cos = Math.cos(h);
        const sin = Math.sin(h);
        const newR = r * (cos + (1 - cos) / 3) + g * ((1 - cos) / 3 - Math.sqrt(3) * sin / 3) + b * ((1 - cos) / 3 + Math.sqrt(3) * sin / 3);
        const newG = r * ((1 - cos) / 3 + Math.sqrt(3) * sin / 3) + g * (cos + (1 - cos) / 3) + b * ((1 - cos) / 3 - Math.sqrt(3) * sin / 3);
        const newB = r * ((1 - cos) / 3 - Math.sqrt(3) * sin / 3) + g * ((1 - cos) / 3 + Math.sqrt(3) * sin / 3) + b * (cos + (1 - cos) / 3);
        r = newR;
        g = newG;
        b = newB;
      }

      // Saturation
      if (saturation !== 0) {
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        r = gray + (r - gray) * (1 + saturation);
        g = gray + (g - gray) * (1 + saturation);
        b = gray + (b - gray) * (1 + saturation);
      }

      // Colorize
      if (colorize) {
        r = r * (1 - colorize.amount) + colorize.r * colorize.amount;
        g = g * (1 - colorize.amount) + colorize.g * colorize.amount;
        b = b * (1 - colorize.amount) + colorize.b * colorize.amount;
      }

      // Invert
      if (invert) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }

      // Clamp values
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }
  }

  private applyNoise(data: Uint8ClampedArray, amount: number): void {
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * amount * 255;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
  }

  private applyVignette(amount: number): void {
    const gradient = this.ctx.createRadialGradient(
      this.width / 2, this.height / 2, 0,
      this.width / 2, this.height / 2, Math.max(this.width, this.height) / 2
    );
    gradient.addColorStop(0, `rgba(0, 0, 0, 0)`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${amount})`);
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private applySharpen(amount: number): void {
    // Simple sharpen using convolution (simplified)
    const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;
    const tempData = new Uint8ClampedArray(data);

    const kernel = [
      0, -amount, 0,
      -amount, 1 + 4 * amount, -amount,
      0, -amount, 0
    ];

    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        let r = 0, g = 0, b = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * this.width + (x + kx)) * 4;
            const k = kernel[(ky + 1) * 3 + (kx + 1)];
            r += tempData[idx] * k;
            g += tempData[idx + 1] * k;
            b += tempData[idx + 2] * k;
          }
        }
        
        const idx = (y * this.width + x) * 4;
        data[idx] = Math.max(0, Math.min(255, r));
        data[idx + 1] = Math.max(0, Math.min(255, g));
        data[idx + 2] = Math.max(0, Math.min(255, b));
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
  }
}

