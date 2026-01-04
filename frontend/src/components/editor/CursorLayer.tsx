import React, { useEffect, useRef } from 'react';
import { useEditorState, editorStore } from '@/lib/editor/store';
import { getCursorPos } from '@/lib/composition/math';

interface CursorTrailPoint {
    x: number;
    y: number;
    timestamp: number;
    opacity: number;
}

interface CursorState {
    position: { x: number; y: number } | null;
    trail: CursorTrailPoint[];
    state: 'normal' | 'hover' | 'pressed' | 'busy';
    velocity: { x: number; y: number };
    lastUpdateTime: number;
    pathBuffer: CursorTrailPoint[]; // Dedicated buffer for complete path data
    lastPathSampleTime: number; // For sampling optimization
}

// Path data management utilities
class PathBufferManager {
    private buffer: CursorTrailPoint[] = [];
    private maxSize = 5000; // Maximum points to keep in memory
    private sampleRate = 1; // Dynamic sampling rate

    addPoint(point: CursorTrailPoint): void {
        // Dynamic sampling: increase sample rate when buffer gets large
        if (this.buffer.length > 3000) {
            this.sampleRate = 2; // Sample every 2nd point
        } else if (this.buffer.length > 4000) {
            this.sampleRate = 3; // Sample every 3rd point
        }

        // Only add point based on sample rate
        if (this.buffer.length % this.sampleRate === 0) {
            this.buffer.push(point);
        }

        // Maintain buffer size limit
        if (this.buffer.length > this.maxSize) {
            // Remove oldest points, but keep some history
            const keepPoints = Math.floor(this.maxSize * 0.8);
            this.buffer = this.buffer.slice(-keepPoints);
        }
    }

    getPointsInTimeRange(startTime: number, endTime: number): CursorTrailPoint[] {
        return this.buffer.filter(point =>
            point.timestamp >= startTime && point.timestamp <= endTime
        );
    }

    clear(): void {
        this.buffer = [];
        this.sampleRate = 1;
    }

    get length(): number {
        return this.buffer.length;
    }
}

export const CursorLayer: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const pathBufferManagerRef = useRef(new PathBufferManager());
    const cursorStateRef = useRef<CursorState>({
        position: null,
        trail: [],
        state: 'normal',
        velocity: { x: 0, y: 0 },
        lastUpdateTime: 0,
        pathBuffer: [],
        lastPathSampleTime: 0
    });

    // Cursor sprite assets
    const cursorSpritesRef = useRef<{
        normal: HTMLImageElement | null;
        hover: HTMLImageElement | null;
        pressed: HTMLImageElement | null;
        busy: HTMLImageElement | null;
    }>({
        normal: null,
        hover: null,
        pressed: null,
        busy: null
    });

    // Subscribe to everything needed for rendering
    const {
        video: videoConfig,
        cursor: cursorConfig,
        effects: effectsConfig,
        events
    } = useEditorState();

    // Generate cursor sprites based on style and theme
    const generateCursorSprites = (style: string, theme: string, color: string) => {
        const isLight = theme === 'light';
        const baseColor = color;
        const strokeColor = isLight ? '#000000' : '#ffffff';
        const accentColor = isLight ? '#0066cc' : '#64B5F6';
        const pressedColor = isLight ? '#cc0000' : '#FF5722';

        const sprites = cursorSpritesRef.current;

        switch (style) {
            case 'modern':
                // Modern sleek cursor
                sprites.normal = new Image();
                sprites.normal.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4L20 20L16 24L12 20L4 28L4 4Z" fill="${baseColor}"/><path d="M4 4L20 20L16 24L12 20L4 28" stroke="${strokeColor}" stroke-width="1.5"/><circle cx="18" cy="18" r="1" fill="${strokeColor}"/></svg>`;

                sprites.hover = new Image();
                sprites.hover.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4L20 20L16 24L12 20L4 28L4 4Z" fill="${accentColor}"/><path d="M4 4L20 20L16 24L12 20L4 28" stroke="${strokeColor}" stroke-width="2"/><circle cx="18" cy="18" r="2" fill="${strokeColor}"/><circle cx="18" cy="18" r="8" fill="none" stroke="${accentColor}" stroke-width="1" opacity="0.3"/></svg>`;

                sprites.pressed = new Image();
                sprites.pressed.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6L18 18L14 22L10 18L4 28L4 6Z" fill="${pressedColor}"/><path d="M4 6L18 18L14 22L10 18L4 28" stroke="${strokeColor}" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="${strokeColor}"/><circle cx="16" cy="16" r="10" fill="${pressedColor}" opacity="0.2"/></svg>`;

                sprites.busy = new Image();
                sprites.busy.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="12" stroke="${accentColor}" stroke-width="3" fill="none" opacity="0.8"/><path d="M16 4L16 8M24 16L28 16M16 24L16 28M8 16L4 16" stroke="${accentColor}" stroke-width="2" opacity="0.6"/><circle cx="16" cy="16" r="3" fill="${accentColor}"/><circle cx="16" cy="16" r="1" fill="${strokeColor}"/></svg>`;
                break;

            case 'classic':
                // Classic Windows-style cursor
                sprites.normal = new Image();
                sprites.normal.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4L20 20L16 24L12 20L4 28L4 4Z" fill="${baseColor}"/><path d="M4 4L20 20L16 24L12 20L4 28" stroke="${strokeColor}" stroke-width="1"/></svg>`;

                sprites.hover = new Image();
                sprites.hover.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4L20 20L16 24L12 20L4 28L4 4Z" fill="${accentColor}"/><path d="M4 4L20 20L16 24L12 20L4 28" stroke="${strokeColor}" stroke-width="1"/></svg>`;

                sprites.pressed = new Image();
                sprites.pressed.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6L18 18L14 22L10 18L4 28L4 6Z" fill="${pressedColor}"/><path d="M4 6L18 18L14 22L10 18L4 28" stroke="${strokeColor}" stroke-width="1"/></svg>`;

                sprites.busy = new Image();
                sprites.busy.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="10" stroke="${accentColor}" stroke-width="2" fill="none"/><circle cx="16" cy="16" r="2" fill="${accentColor}"/><path d="M20 16L24 16" stroke="${accentColor}" stroke-width="2"/></svg>`;
                break;

            case 'gaming':
                // Gaming-style cursor with RGB effects
                sprites.normal = new Image();
                sprites.normal.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4L20 20L16 24L12 20L4 28L4 4Z" fill="${baseColor}"/><path d="M4 4L20 20L16 24L12 20L4 28" stroke="%2300ff00" stroke-width="2"/><rect x="2" y="2" width="28" height="28" fill="none" stroke="%2300ff00" stroke-width="1" opacity="0.5"/></svg>`;

                sprites.hover = new Image();
                sprites.hover.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4L20 20L16 24L12 20L4 28L4 4Z" fill="%2300ff00"/><path d="M4 4L20 20L16 24L12 20L4 28" stroke="%2300ffff" stroke-width="2"/><rect x="1" y="1" width="30" height="30" fill="none" stroke="%2300ff00" stroke-width="2" opacity="0.8"/></svg>`;

                sprites.pressed = new Image();
                sprites.pressed.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6L18 18L14 22L10 18L4 28L4 6Z" fill="%23ff0000"/><path d="M4 6L18 18L14 22L10 18L4 28" stroke="%23ffff00" stroke-width="2"/><rect x="0" y="0" width="32" height="32" fill="none" stroke="%23ff0000" stroke-width="3" opacity="1"/></svg>`;

                sprites.busy = new Image();
                sprites.busy.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="12" stroke="%2300ff00" stroke-width="3" fill="none"/><circle cx="16" cy="16" r="8" stroke="%2300ffff" stroke-width="2" fill="none"/><circle cx="16" cy="16" r="4" stroke="%23ff00ff" stroke-width="2" fill="none"/><circle cx="16" cy="16" r="2" fill="%23ffffff"/></svg>`;
                break;

            case 'minimal':
                // Minimalist cursor
                sprites.normal = new Image();
                sprites.normal.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4L20 20L16 24L12 20L4 28L4 4Z" fill="${baseColor}"/></svg>`;

                sprites.hover = new Image();
                sprites.hover.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4L20 20L16 24L12 20L4 28L4 4Z" fill="${accentColor}"/><circle cx="18" cy="18" r="1" fill="${accentColor}" opacity="0.5"/></svg>`;

                sprites.pressed = new Image();
                sprites.pressed.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6L18 18L14 22L10 18L4 28L4 6Z" fill="${pressedColor}"/><circle cx="16" cy="16" r="1" fill="${pressedColor}" opacity="0.7"/></svg>`;

                sprites.busy = new Image();
                sprites.busy.src = `data:image/svg+xml;utf8,<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="2" fill="${accentColor}"/><circle cx="16" cy="16" r="8" fill="none" stroke="${accentColor}" stroke-width="1" opacity="0.5"/></svg>`;
                break;

            default:
                // Fallback to modern style
                generateCursorSprites('modern', theme, color);
                break;
        }
    };

    // Load cursor sprites based on configuration
    useEffect(() => {
        generateCursorSprites(cursorConfig.style, cursorConfig.theme, cursorConfig.color);
    }, [cursorConfig.style, cursorConfig.theme, cursorConfig.color]);

    // Render Loop with Enhanced Cursor Physics and Trail
    useEffect(() => {
        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Get current time directly from store
            const state = editorStore.getState();
            const time = state.playback.currentTime;
            const { width, height } = state.video;

            // Use canvas dimensions for rendering
            const canvasWidth = canvas.width || width || 1920;
            const canvasHeight = canvas.height || height || 1080;

            // Clear with slight alpha for trail persistence
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 0.1;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;

            // -------------------------------------------------------------
            // 1. Update Cursor State with Physics
            // -------------------------------------------------------------
            const pos = getCursorPos(time, state.events.moves);
            const cursorState = cursorStateRef.current;

            if (pos) {
                const currentPos = {
                    x: pos.x * canvasWidth,
                    y: pos.y * canvasHeight
                };

                // Calculate velocity for physics
                const deltaTime = time - cursorState.lastUpdateTime;
                if (deltaTime > 0 && cursorState.position) {
                    const dx = currentPos.x - cursorState.position.x;
                    const dy = currentPos.y - cursorState.position.y;
                    cursorState.velocity.x = dx / deltaTime * 0.1; // Dampened velocity
                    cursorState.velocity.y = dy / deltaTime * 0.1;
                }

                cursorState.position = currentPos;
                cursorState.lastUpdateTime = time;

                // Handle complete path or standard trail
                const isCompletePath = state.events.moves.length > 1000 || state.cursor.completePath;

                if (isCompletePath) {
                    // Complete path visualization: use efficient path buffer
                    const timeWindow = 2.0; // 2 seconds of path history
                    const startTime = Math.max(0, time - timeWindow);

                    // Get optimized path points from buffer manager
                    const pathPoints = pathBufferManagerRef.current
                        .getPointsInTimeRange(startTime, time)
                        .map(point => ({
                            ...point,
                            opacity: Math.max(0, 1 - (time - point.timestamp) / timeWindow) * 0.8
                        }));

                    cursorState.trail = pathPoints;

                    // Update path buffer with current position (sampled for performance)
                    const sampleInterval = 0.016; // ~60fps sampling
                    if (time - cursorState.lastPathSampleTime >= sampleInterval) {
                        pathBufferManagerRef.current.addPoint({
                            x: currentPos.x,
                            y: currentPos.y,
                            timestamp: time,
                            opacity: 1.0
                        });
                        cursorState.lastPathSampleTime = time;
                    }
                } else if (state.cursor.trail && state.cursor.trailLength > 0) {
                    // Standard trail mode
                    const trailPoint: CursorTrailPoint = {
                        x: currentPos.x,
                        y: currentPos.y,
                        timestamp: time,
                        opacity: 1.0
                    };

                    cursorState.trail.unshift(trailPoint);

                    // Limit trail length and fade older points
                    if (cursorState.trail.length > state.cursor.trailLength) {
                        cursorState.trail = cursorState.trail.slice(0, state.cursor.trailLength);
                    }

                    // Fade trail points based on age
                    cursorState.trail.forEach((point, index) => {
                        const age = time - point.timestamp;
                        const maxAge = 0.5; // 500ms trail lifetime
                        point.opacity = Math.max(0, 1 - (age / maxAge));
                    });

                    // Remove completely faded points
                    cursorState.trail = cursorState.trail = cursorState.trail.filter(point => point.opacity > 0.01);
                } else {
                    cursorState.trail = [];
                }

                // Determine cursor state based on recent clicks
                const recentClicks = state.events.clicks.filter(c =>
                    time - c.timestamp < 0.1 // Last 100ms
                );
                if (recentClicks.length > 0) {
                    cursorState.state = 'pressed';
                } else {
                    // Could add hover detection logic here based on UI elements
                    cursorState.state = 'normal';
                }
            }

            // -------------------------------------------------------------
            // 2. Draw Cursor Trail/Path
            // -------------------------------------------------------------
            if (cursorState.trail.length > 1) {
                const isCompletePath = cursorState.trail.length > 100; // Heuristic for complete path

                if (isCompletePath) {
                    // Optimized complete path rendering
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';

                    // Draw path as connected segments with varying opacity
                    ctx.beginPath();
                    ctx.moveTo(cursorState.trail[0].x, cursorState.trail[0].y);

                    for (let i = 1; i < cursorState.trail.length; i++) {
                        const point = cursorState.trail[i];
                        if (point.opacity > 0.01) {
                            ctx.lineTo(point.x, point.y);
                        }
                    }

                    // Create gradient along the entire path
                    const pathColor = state.cursor.color;
                    ctx.strokeStyle = pathColor;
                    ctx.globalAlpha = 0.6;
                    ctx.lineWidth = 3 * state.cursor.size;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.stroke();

                    // Add glow effect for complete path
                    if (state.cursor.glow) {
                        ctx.shadowColor = pathColor;
                        ctx.shadowBlur = 12;
                        ctx.globalAlpha = 0.3;
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    }

                    ctx.restore();
                } else {
                    // Standard trail rendering
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';

                    for (let i = 1; i < cursorState.trail.length; i++) {
                        const current = cursorState.trail[i];
                        const previous = cursorState.trail[i - 1];

                        if (current.opacity > 0.01) {
                            const gradient = ctx.createLinearGradient(
                                previous.x, previous.y,
                                current.x, current.y
                            );

                            const trailColor = state.cursor.color;
                            const alpha = current.opacity * 0.3;

                            gradient.addColorStop(0, `${trailColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
                            gradient.addColorStop(1, `${trailColor}${Math.floor(alpha * 0.5 * 255).toString(16).padStart(2, '0')}`);

                            ctx.strokeStyle = gradient;
                            ctx.lineWidth = 2 * state.cursor.size * current.opacity;
                            ctx.lineCap = 'round';
                            ctx.lineJoin = 'round';

                            ctx.beginPath();
                            ctx.moveTo(previous.x, previous.y);
                            ctx.lineTo(current.x, current.y);
                            ctx.stroke();

                            // Add glow to trail
                            if (state.cursor.glow) {
                                ctx.shadowColor = state.cursor.color;
                                ctx.shadowBlur = 8 * current.opacity;
                                ctx.stroke();
                                ctx.shadowBlur = 0;
                            }
                        }
                    }

                    ctx.restore();
                }
            }

            // -------------------------------------------------------------
            // 3. Draw Click Animations
            // -------------------------------------------------------------
            if (state.effects.clickAnimationStyle !== 'none' && state.effects.clickRipple) {
                const CLICK_DELAY = 0.08; // 80ms delay
                const ANIMATION_DURATION = 0.6; // 600ms total
                const activeClicks = state.events.clicks.filter(c => {
                    const diff = time - c.timestamp;
                    return diff >= CLICK_DELAY && diff < CLICK_DELAY + ANIMATION_DURATION;
                });

                activeClicks.forEach(click => {
                    const timeSinceClick = time - click.timestamp;
                    const progress = Math.max(0, Math.min(1, (timeSinceClick - CLICK_DELAY) / ANIMATION_DURATION));

                    // Apply easing
                    const easedProgress = applyEasing(progress, state.effects.clickEasing);

                    // Apply force multiplier
                    const force = state.effects.clickForce;

                    const cx = click.x * canvasWidth;
                    const cy = click.y * canvasHeight;

                    // Get color based on click type
                    const baseColor = click.type === 'rightClick'
                        ? { r: 239, g: 68, b: 68 }
                        : { r: 59, g: 130, b: 246 };

                    // Render based on animation style
                    switch (state.effects.clickAnimationStyle) {
                        case 'ripple':
                            drawRipple(ctx, cx, cy, progress, easedProgress, canvasWidth, canvasHeight, state.effects.clickSize, force, baseColor);
                            break;
                        case 'orb':
                            drawOrb(ctx, cx, cy, progress, easedProgress, canvasWidth, canvasHeight, state.effects.clickSize, force, baseColor);
                            break;
                        case 'pulse':
                            drawPulse(ctx, cx, cy, progress, easedProgress, canvasWidth, canvasHeight, state.effects.clickSize, force, baseColor);
                            break;
                        case 'ring':
                            drawRing(ctx, cx, cy, progress, easedProgress, canvasWidth, canvasHeight, state.effects.clickSize, force, baseColor);
                            break;
                        case 'splash':
                            drawSplash(ctx, cx, cy, progress, easedProgress, canvasWidth, canvasHeight, state.effects.clickSize, force, baseColor);
                            break;
                    }
                });
            }

            // -------------------------------------------------------------
            // 4. Draw Enhanced Cursor Sprite
            // -------------------------------------------------------------
            if (cursorState.position) {
                const { x: cx, y: cy } = cursorState.position;
                const sprites = cursorSpritesRef.current;
                const sprite = sprites[cursorState.state] || sprites.normal;

                if (sprite && sprite.complete && sprite.naturalWidth > 0) {
                    const baseSize = 32;
                    const size = baseSize * state.cursor.size;

                    ctx.save();

                    // Handle animated busy cursor
                    if (cursorState.state === 'busy' && state.cursor.animation) {
                        const rotation = (time * 2) % (Math.PI * 2); // 2 rotations per second
                        ctx.translate(cx, cy);
                        ctx.rotate(rotation);
                        ctx.translate(-cx, -cy);
                    }

                    // Advanced glow effects
                    if (state.cursor.glow) {
                        // Multiple glow layers for realism
                        const glowColors = [
                            { color: state.cursor.color, blur: 20, alpha: 0.8 },
                            { color: state.cursor.color, blur: 10, alpha: 0.6 },
                            { color: '#ffffff', blur: 5, alpha: 0.4 }
                        ];

                        glowColors.forEach(glow => {
                            ctx.shadowColor = glow.color;
                            ctx.shadowBlur = glow.blur;
                            ctx.globalAlpha = glow.alpha;
                            ctx.drawImage(sprite, cx - size / 2, cy - size / 2, size, size);
                        });

                        ctx.globalAlpha = 1.0;
                        ctx.shadowBlur = 0;
                    }

                    // Draw main cursor sprite
                    ctx.shadowColor = "rgba(0,0,0,0.3)";
                    ctx.shadowBlur = 2;
                    ctx.drawImage(sprite, cx - size / 2, cy - size / 2, size, size);

                    // Add velocity-based motion blur for fast movements
                    const speed = Math.sqrt(cursorState.velocity.x ** 2 + cursorState.velocity.y ** 2);
                    if (speed > 100 && state.cursor.animation) { // Fast movement threshold
                        ctx.globalAlpha = 0.3;
                        ctx.shadowBlur = 0;
                        const blurOffset = Math.min(speed * 0.02, 10);
                        const angle = Math.atan2(cursorState.velocity.y, cursorState.velocity.x);
                        const blurX = Math.cos(angle) * blurOffset;
                        const blurY = Math.sin(angle) * blurOffset;

                        ctx.drawImage(sprite,
                            cx - size / 2 + blurX,
                            cy - size / 2 + blurY,
                            size, size
                        );
                        ctx.globalAlpha = 1.0;
                    }

                    // Add subtle breathing animation for hover state
                    if (cursorState.state === 'hover' && state.cursor.animation) {
                        const breathe = Math.sin(time * 4) * 0.05 + 0.95; // Subtle breathing
                        ctx.globalAlpha = 0.2;
                        ctx.shadowBlur = 15;
                        ctx.shadowColor = state.cursor.color;
                        ctx.drawImage(sprite,
                            cx - size / 2 * breathe,
                            cy - size / 2 * breathe,
                            size * breathe,
                            size * breathe
                        );
                        ctx.globalAlpha = 1.0;
                        ctx.shadowBlur = 0;
                    }

                    ctx.restore();
                }
            }

            animationFrameRef.current = requestAnimationFrame(render);
        };

        animationFrameRef.current = requestAnimationFrame(render);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [videoConfig.width, videoConfig.height, cursorConfig, effectsConfig]); // Re-bind if config changes

    // Ensure canvas has valid dimensions
    const canvasWidth = videoConfig.width > 0 ? videoConfig.width : 1920;
    const canvasHeight = videoConfig.height > 0 ? videoConfig.height : 1080;

    return (
        <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="absolute inset-0 pointer-events-none z-50"
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                cursor: 'none', // Hide the actual cursor completely
                // Add padding to ensure cursor coverage even at edges
                padding: '20px',
                margin: '-20px',
            }}
        />
    );
};

// Easing functions
function applyEasing(t: number, easing: string): number {
    switch (easing) {
        case 'linear':
            return t;
        case 'ease-out':
            return 1 - Math.pow(1 - t, 3);
        case 'ease-in-out':
            return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        case 'bounce':
            const n1 = 7.5625;
            const d1 = 2.75;
            if (t < 1 / d1) {
                return n1 * t * t;
            } else if (t < 2 / d1) {
                return n1 * (t -= 1.5 / d1) * t + 0.75;
            } else if (t < 2.5 / d1) {
                return n1 * (t -= 2.25 / d1) * t + 0.9375;
            } else {
                return n1 * (t -= 2.625 / d1) * t + 0.984375;
            }
        case 'elastic':
            const c4 = (2 * Math.PI) / 3;
            return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
        default:
            return 1 - Math.pow(1 - t, 3);
    }
}

// Animation drawing functions
function drawRipple(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
    eased: number,
    width: number,
    height: number,
    sizeMultiplier: number,
    force: number,
    color: { r: number; g: number; b: number }
) {
    const maxRadius = Math.min(width, height) * 0.05 * sizeMultiplier * force;
    const radius = maxRadius * (0.3 + 0.7 * eased);
    const opacity = (1 - progress) * force;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.2})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
    ctx.lineWidth = 2 * force;
    ctx.stroke();
}

function drawOrb(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
    eased: number,
    width: number,
    height: number,
    sizeMultiplier: number,
    force: number,
    color: { r: number; g: number; b: number }
) {
    const maxRadius = Math.min(width, height) * 0.04 * sizeMultiplier * force;
    const radius = maxRadius * eased;
    const opacity = (1 - Math.pow(progress, 2)) * force;

    // Outer glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`);
    gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.5})`);
    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
}

function drawPulse(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
    eased: number,
    width: number,
    height: number,
    sizeMultiplier: number,
    force: number,
    color: { r: number; g: number; b: number }
) {
    const maxRadius = Math.min(width, height) * 0.06 * sizeMultiplier * force;
    const pulse = Math.sin(progress * Math.PI * 4) * 0.5 + 0.5; // Pulsing effect
    const radius = maxRadius * (0.4 + 0.6 * eased) * (1 + pulse * 0.2);
    const opacity = (1 - progress) * force * (0.7 + pulse * 0.3);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.3})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
    ctx.lineWidth = 3 * force;
    ctx.stroke();
}

function drawRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
    eased: number,
    width: number,
    height: number,
    sizeMultiplier: number,
    force: number,
    color: { r: number; g: number; b: number }
) {
    const maxRadius = Math.min(width, height) * 0.05 * sizeMultiplier * force;
    const radius = maxRadius * eased;
    const opacity = (1 - progress) * force;
    const ringWidth = 4 * force;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
    ctx.lineWidth = ringWidth;
    ctx.stroke();

    // Inner ring
    if (progress < 0.5) {
        const innerRadius = radius * 0.6;
        ctx.beginPath();
        ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.5})`;
        ctx.lineWidth = ringWidth * 0.5;
        ctx.stroke();
    }
}

function drawSplash(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
    eased: number,
    width: number,
    height: number,
    sizeMultiplier: number,
    force: number,
    color: { r: number; g: number; b: number }
) {
    const maxRadius = Math.min(width, height) * 0.08 * sizeMultiplier * force;
    const radius = maxRadius * eased;
    const opacity = (1 - Math.pow(progress, 1.5)) * force;
    const particles = 8;

    // Central orb
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.5);
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`);
    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Splash particles
    for (let i = 0; i < particles; i++) {
        const angle = (i / particles) * Math.PI * 2;
        const distance = radius * (0.5 + eased * 0.5);
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance;
        const particleSize = (radius * 0.1) * (1 - progress);
        const particleOpacity = opacity * (1 - progress * 0.5);

        ctx.beginPath();
        ctx.arc(px, py, particleSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${particleOpacity})`;
        ctx.fill();
    }
}
