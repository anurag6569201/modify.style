/**
 * God-Level Particle System for Cursor Trails
 * Creates stunning visual effects with physics-based particles
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
}

export interface ParticleSystemConfig {
  particleCount: number;
  particleLifetime: number;
  particleSize: { min: number; max: number };
  velocity: { min: number; max: number };
  colors: string[];
  gravity: number;
  friction: number;
  trailLength: number;
  spawnRate: number;
}

const DEFAULT_CONFIG: ParticleSystemConfig = {
  particleCount: 50,
  particleLifetime: 1.5,
  particleSize: { min: 2, max: 6 },
  velocity: { min: 20, max: 80 },
  colors: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
  gravity: 0.3,
  friction: 0.98,
  trailLength: 10,
  spawnRate: 0.05,
};

export class ParticleSystem {
  private particles: Particle[] = [];
  private config: ParticleSystemConfig;
  private lastSpawnTime: number = 0;
  private trail: Array<{ x: number; y: number; time: number }> = [];

  constructor(config: Partial<ParticleSystemConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  spawn(x: number, y: number, velocityX: number = 0, velocityY: number = 0): void {
    const now = Date.now();
    if (now - this.lastSpawnTime < this.config.spawnRate * 1000) return;
    this.lastSpawnTime = now;

    const count = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = this.config.velocity.min + 
        Math.random() * (this.config.velocity.max - this.config.velocity.min);
      
      const particle: Particle = {
        x,
        y,
        vx: velocityX + Math.cos(angle) * speed,
        vy: velocityY + Math.sin(angle) * speed,
        life: this.config.particleLifetime,
        maxLife: this.config.particleLifetime,
        size: this.config.particleSize.min + 
          Math.random() * (this.config.particleSize.max - this.config.particleSize.min),
        color: this.config.colors[Math.floor(Math.random() * this.config.colors.length)],
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      };

      this.particles.push(particle);
    }

    // Maintain trail
    this.trail.push({ x, y, time: now });
    if (this.trail.length > this.config.trailLength) {
      this.trail.shift();
    }
  }

  update(deltaTime: number): void {
    const dt = deltaTime / 1000; // Convert to seconds

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update physics
      p.vy += this.config.gravity * dt * 1000;
      p.vx *= this.config.friction;
      p.vy *= this.config.friction;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Update rotation
      p.rotation += p.rotationSpeed;

      // Update life
      p.life -= dt;
      p.alpha = p.life / p.maxLife;

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Clean old trail points
    const now = Date.now();
    this.trail = this.trail.filter(point => now - point.time < 200);
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Draw trail
    if (this.trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      
      for (let i = 0; i < this.trail.length - 1; i++) {
        const current = this.trail[i];
        const next = this.trail[i + 1];
        const alpha = i / this.trail.length;
        
        ctx.globalAlpha = alpha * 0.5;
        if (i === 0) {
          ctx.moveTo(current.x * width, current.y * height);
        }
        ctx.lineTo(next.x * width, next.y * height);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x * width, p.y * height);
      ctx.rotate(p.rotation);

      // Draw particle with glow effect
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
      gradient.addColorStop(0, p.color);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();

      // Outer glow
      ctx.shadowBlur = p.size * 2;
      ctx.shadowColor = p.color;
      ctx.fill();

      ctx.restore();
    }
  }

  clear(): void {
    this.particles = [];
    this.trail = [];
  }

  getParticleCount(): number {
    return this.particles.length;
  }
}

