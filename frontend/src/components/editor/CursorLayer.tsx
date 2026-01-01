import React, { useEffect, useRef } from 'react';
import { useEditorState, editorStore } from '@/lib/editor/store';
import { getCursorPos } from '@/lib/composition/math';

export const CursorLayer: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const cursorImageRef = useRef<HTMLImageElement | null>(null);

    // Subscribe to everything needed for rendering
    // We use the hook to get initial config, but for the loop we might want direct access or refs
    // for performance. However, useEditorState uses useSyncExternalStore which is fast.
    const {
        video: videoConfig,
        cursor: cursorConfig,
        effects: effectsConfig,
        events
    } = useEditorState();

    // Load cursor asset
    useEffect(() => {
        const img = new Image();
        img.src = `data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 3.5L11.5 19.5L14.5 13.5L20.5 13.5L5.5 3.5Z" fill="black" stroke="white" stroke-width="1.5"/></svg>`;
        cursorImageRef.current = img;
    }, []);

    // Render Loop
    useEffect(() => {
        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Get current time directly from store to ensure 60fps smoothness 
            // without React render cycle lag
            const state = editorStore.getState();
            const time = state.playback.currentTime;
            const { width, height } = state.video;

            // Clear
            ctx.clearRect(0, 0, width, height);

            // -------------------------------------------------------------
            // 1. Draw Click Animations
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
                    
                    const cx = click.x * width;
                    const cy = click.y * height;
                    
                    // Get color based on click type
                    const baseColor = click.type === 'rightClick'
                        ? { r: 239, g: 68, b: 68 }
                        : { r: 59, g: 130, b: 246 };
                    
                    // Render based on animation style
                    switch (state.effects.clickAnimationStyle) {
                        case 'ripple':
                            drawRipple(ctx, cx, cy, progress, easedProgress, width, height, state.effects.clickSize, force, baseColor);
                            break;
                        case 'orb':
                            drawOrb(ctx, cx, cy, progress, easedProgress, width, height, state.effects.clickSize, force, baseColor);
                            break;
                        case 'pulse':
                            drawPulse(ctx, cx, cy, progress, easedProgress, width, height, state.effects.clickSize, force, baseColor);
                            break;
                        case 'ring':
                            drawRing(ctx, cx, cy, progress, easedProgress, width, height, state.effects.clickSize, force, baseColor);
                            break;
                        case 'splash':
                            drawSplash(ctx, cx, cy, progress, easedProgress, width, height, state.effects.clickSize, force, baseColor);
                            break;
                    }
                });
            }

            // -------------------------------------------------------------
            // 2. Draw Cursor
            // -------------------------------------------------------------
            const pos = getCursorPos(time, state.events.moves);

            if (pos) {
                const cx = pos.x * width;
                const cy = pos.y * height;

                // Draw Cursor Trail first
                if (state.cursor.trail) {
                    // This would require a history buffer. 
                    // For MVP, we can enable it later or implement a simple one based on previous MoveData points
                    // Skipping complex trail for now to ensure performance
                }

                // Draw Cursor Sprite
                if (cursorImageRef.current && cursorImageRef.current.complete) {
                    const size = 24 * state.cursor.size;

                    // Glow
                    if (state.cursor.glow) {
                        ctx.shadowColor = state.cursor.color;
                        ctx.shadowBlur = 15;
                    } else {
                        ctx.shadowColor = "rgba(0,0,0,0.3)";
                        ctx.shadowBlur = 4;
                    }

                    ctx.drawImage(cursorImageRef.current, cx, cy, size, size);
                    ctx.shadowColor = "transparent";
                    ctx.shadowBlur = 0;
                }
            }

            animationFrameRef.current = requestAnimationFrame(render);
        };

        animationFrameRef.current = requestAnimationFrame(render);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [videoConfig.width, videoConfig.height]); // Re-bind if loop changes size

    return (
        <canvas
            ref={canvasRef}
            width={videoConfig.width}
            height={videoConfig.height}
            className="absolute inset-0 pointer-events-none z-10"
            style={{
                width: videoConfig.width,
                height: videoConfig.height,
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
