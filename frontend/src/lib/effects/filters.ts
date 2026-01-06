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
  public readonly width: number;
  public readonly height: number;
  private tempCanvas: HTMLCanvasElement;
  private tempCtx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Validate inputs
    if (!ctx) {
      throw new Error('FilterEngine: Canvas context is required');
    }
    if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) {
      throw new Error(`FilterEngine: Invalid dimensions (${width}x${height})`);
    }
    
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    
    this.tempCanvas = document.createElement('canvas');
    this.tempCanvas.width = width;
    this.tempCanvas.height = height;
    const tempCtx = this.tempCanvas.getContext('2d');
    if (!tempCtx) {
      throw new Error('FilterEngine: Failed to create temporary canvas context');
    }
    this.tempCtx = tempCtx;
  }

  applyFilters(
    image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    config: FilterConfig
  ): void {
    try {
      // Validate image
      if (!image) {
        console.error('FilterEngine: Image is null or undefined');
        return;
      }

      // Check if image is a video element and if it's ready
      if (image instanceof HTMLVideoElement) {
        if (image.readyState < 2) {
          // Video not ready, skip filtering
          return;
        }
        // Validate video dimensions
        if (image.videoWidth <= 0 || image.videoHeight <= 0) {
          return;
        }
      }

      // Draw image to temp canvas
      try {
        this.tempCtx.drawImage(image, 0, 0, this.width, this.height);
      } catch (drawError) {
        console.error('FilterEngine: Error drawing image to temp canvas', drawError);
        return;
      }
      
      // Get image data
      let imageData: ImageData;
      try {
        imageData = this.tempCtx.getImageData(0, 0, this.width, this.height);
      } catch (imageDataError) {
        console.error('FilterEngine: Error getting image data', imageDataError);
        return;
      }
      
      const data = imageData.data;

      // Validate image data
      if (!data || data.length === 0) {
        console.error('FilterEngine: Invalid image data');
        return;
      }

      // Apply pixel-level filters
      if (config.brightness !== undefined || config.contrast !== undefined || 
          config.saturation !== undefined || config.hue !== undefined ||
          config.grayscale !== undefined || config.sepia !== undefined ||
          config.invert !== undefined || config.colorize !== undefined) {
        try {
          this.applyColorFilters(data, config);
        } catch (filterError) {
          console.error('FilterEngine: Error applying color filters', filterError);
          // Continue with other filters even if color filters fail
        }
      }

      if (config.noise !== undefined && config.noise > 0) {
        try {
          this.applyNoise(data, config.noise);
        } catch (noiseError) {
          console.error('FilterEngine: Error applying noise', noiseError);
        }
      }

      // Put modified data back
      try {
        this.tempCtx.putImageData(imageData, 0, 0);
      } catch (putError) {
        console.error('FilterEngine: Error putting image data', putError);
        return;
      }

      // Apply canvas-level filters
      this.ctx.save();
      
      try {
        if (config.blur !== undefined && config.blur > 0 && isFinite(config.blur)) {
          this.ctx.filter = `blur(${Math.max(0, Math.min(20, config.blur))}px)`;
        }
        
        if (config.vignette !== undefined && config.vignette > 0 && isFinite(config.vignette)) {
          this.applyVignette(Math.max(0, Math.min(1, config.vignette)));
        }

        this.ctx.drawImage(this.tempCanvas, 0, 0);
      } catch (drawError) {
        console.error('FilterEngine: Error drawing filtered image', drawError);
      } finally {
        this.ctx.restore();
      }

      // Apply sharpen if needed
      if (config.sharpen !== undefined && config.sharpen > 0 && isFinite(config.sharpen)) {
        try {
          this.applySharpen(Math.max(0, Math.min(1, config.sharpen)));
        } catch (sharpenError) {
          console.error('FilterEngine: Error applying sharpen', sharpenError);
        }
      }
    } catch (error) {
      console.error('FilterEngine: Unexpected error in applyFilters', error);
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
    try {
      if (!isFinite(amount) || amount <= 0) return;
      
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      const radius = Math.max(this.width, this.height) / 2;
      
      if (!isFinite(centerX) || !isFinite(centerY) || !isFinite(radius) || radius <= 0) {
        return;
      }
      
      const gradient = this.ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius
      );
      gradient.addColorStop(0, `rgba(0, 0, 0, 0)`);
      gradient.addColorStop(1, `rgba(0, 0, 0, ${Math.max(0, Math.min(1, amount))})`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.width, this.height);
    } catch (error) {
      console.error('FilterEngine: Error applying vignette', error);
    }
  }

  private applySharpen(amount: number): void {
    try {
      if (!isFinite(amount) || amount <= 0) return;
      
      // Validate dimensions
      if (this.width <= 1 || this.height <= 1) {
        return; // Need at least 2x2 for convolution
      }
      
      // Simple sharpen using convolution (simplified)
      let imageData: ImageData;
      try {
        imageData = this.ctx.getImageData(0, 0, this.width, this.height);
      } catch (error) {
        console.error('FilterEngine: Error getting image data for sharpen', error);
        return;
      }
      
      const data = imageData.data;
      const tempData = new Uint8ClampedArray(data);

      const kernel = [
        0, -amount, 0,
        -amount, 1 + 4 * amount, -amount,
        0, -amount, 0
      ];

      // Only process inner pixels (skip border)
      const maxY = Math.max(1, this.height - 1);
      const maxX = Math.max(1, this.width - 1);
      
      for (let y = 1; y < maxY; y++) {
        for (let x = 1; x < maxX; x++) {
          let r = 0, g = 0, b = 0;
          
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * this.width + (x + kx)) * 4;
              if (idx >= 0 && idx + 2 < data.length) {
                const k = kernel[(ky + 1) * 3 + (kx + 1)];
                r += tempData[idx] * k;
                g += tempData[idx + 1] * k;
                b += tempData[idx + 2] * k;
              }
            }
          }
          
          const idx = (y * this.width + x) * 4;
          if (idx >= 0 && idx + 2 < data.length) {
            data[idx] = Math.max(0, Math.min(255, r));
            data[idx + 1] = Math.max(0, Math.min(255, g));
            data[idx + 2] = Math.max(0, Math.min(255, b));
          }
        }
      }

      try {
        this.ctx.putImageData(imageData, 0, 0);
      } catch (error) {
        console.error('FilterEngine: Error putting image data after sharpen', error);
      }
    } catch (error) {
      console.error('FilterEngine: Unexpected error in applySharpen', error);
    }
  }
}

