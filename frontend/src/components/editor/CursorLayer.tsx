import React, { useEffect, useRef } from 'react';
import { editorStore } from '@/lib/editor/store';
import { smoothedCursor, cursorTrail, clickPulseProgress } from '@/lib/editor/cursor';

/**
 * Live synthetic cursor in the editor preview.
 * Mirrors the export renderer: styles, trail, glow and click pulses.
 * Renders into a canvas that fills the stage (same normalized coords as the video).
 */
export const CursorLayer: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number>();
    const videoElRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        const draw = () => {
            rafRef.current = requestAnimationFrame(draw);
            const canvas = canvasRef.current;
            if (!canvas) return;
            const parent = canvas.parentElement;
            if (!parent) return;

            const state = editorStore.getState();
            const { cursor, events, playback } = state;

            // Read time straight off the sibling <video> element — the true
            // frame clock — so the cursor never lags behind the pixels.
            if (!videoElRef.current || !videoElRef.current.isConnected) {
                videoElRef.current = parent.querySelector('video');
            }
            const videoEl = videoElRef.current;
            const frameTime =
                videoEl && isFinite(videoEl.currentTime) && videoEl.currentTime >= 0
                    ? videoEl.currentTime
                    : playback.currentTime;

            // Match canvas to element size (handles resizes cheaply)
            const w = parent.clientWidth;
            const h = parent.clientHeight;
            if (w === 0 || h === 0) return;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
                canvas.width = Math.round(w * dpr);
                canvas.height = Math.round(h * dpr);
            }
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);

            if (cursor.style === 'hidden' || events.moves.length === 0) return;

            const time = frameTime;
            const pos = smoothedCursor(time, events.moves, cursor.smoothing ?? 0.35);
            if (!pos) return;
            const cx = pos.x * w;
            const cy = pos.y * h;
            const size = 22 * (cursor.size || 1) * (w / 1280); // scale with preview size
            const pulse = cursor.clickPulse ? clickPulseProgress(time, events.clicks) : null;

            // ---- Trail ----
            if (cursor.trail && cursor.trailLength > 0) {
                const trail = cursorTrail(time, events.moves, cursor.trailLength, cursor.smoothing ?? 0.35);
                trail.forEach((p, i) => {
                    const alpha = 0.35 * (1 - i / trail.length);
                    const r = Math.max(1, size * 0.22 * (1 - i / trail.length));
                    ctx.beginPath();
                    ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
                    ctx.fillStyle = hexWithAlpha(cursor.haloColor || cursor.color, alpha);
                    ctx.fill();
                });
            }

            // ---- Spotlight (dim everything except around the cursor) ----
            if (cursor.style === 'spotlight') {
                const radius = size * 5;
                const grad = ctx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius * 1.6);
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(1, 'rgba(0,0,0,0.45)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, w, h);
            }

            // ---- Click pulse ring ----
            if (pulse !== null) {
                const pr = size * (1 + pulse * 2.4);
                ctx.beginPath();
                ctx.arc(cx, cy, pr, 0, Math.PI * 2);
                ctx.strokeStyle = hexWithAlpha(cursor.haloColor || '#e8506e', 0.75 * (1 - pulse));
                ctx.lineWidth = Math.max(1.5, size * 0.14 * (1 - pulse));
                ctx.stroke();
            }

            // ---- Glow ----
            if (cursor.glow) {
                ctx.shadowColor = cursor.haloColor || cursor.color;
                ctx.shadowBlur = size * 0.9;
            } else {
                ctx.shadowColor = 'rgba(0,0,0,0.35)';
                ctx.shadowBlur = 4;
            }

            // ---- Cursor body ----
            const pressScale = pulse !== null && pulse < 0.3 ? 1 - 0.18 * (1 - pulse / 0.3) : 1;
            switch (cursor.style) {
                case 'halo': {
                    // Soft highlight circle behind an arrow — great for tutorials
                    ctx.beginPath();
                    ctx.arc(cx, cy, size * 1.5 * pressScale, 0, Math.PI * 2);
                    ctx.fillStyle = hexWithAlpha(cursor.haloColor || '#e8506e', 0.28);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(cx, cy, size * 1.5 * pressScale, 0, Math.PI * 2);
                    ctx.strokeStyle = hexWithAlpha(cursor.haloColor || '#e8506e', 0.6);
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    drawArrow(ctx, cx, cy, size * pressScale, cursor.color);
                    break;
                }
                case 'dot': {
                    ctx.beginPath();
                    ctx.arc(cx, cy, size * 0.55 * pressScale, 0, Math.PI * 2);
                    ctx.fillStyle = cursor.color;
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    break;
                }
                case 'spotlight': {
                    ctx.beginPath();
                    ctx.arc(cx, cy, size * 0.45 * pressScale, 0, Math.PI * 2);
                    ctx.fillStyle = cursor.color;
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    break;
                }
                case 'arrow':
                default:
                    drawArrow(ctx, cx, cy, size * pressScale, cursor.color);
                    break;
            }
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        };

        rafRef.current = requestAnimationFrame(draw);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 z-30 h-full w-full"
        />
    );
};

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + size * 1.15);
    ctx.lineTo(x + size * 0.28, y + size * 0.88);
    ctx.lineTo(x + size * 0.48, y + size * 1.32);
    ctx.lineTo(x + size * 0.62, y + size * 1.24);
    ctx.lineTo(x + size * 0.42, y + size * 0.82);
    ctx.lineTo(x + size * 0.78, y + size * 0.78);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

function hexWithAlpha(hex: string, alpha: number): string {
    if (/^#([0-9a-f]{6})$/i.test(hex)) {
        const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
            .toString(16)
            .padStart(2, '0');
        return `${hex}${a}`;
    }
    return hex; // rgba() strings etc. pass through
}
