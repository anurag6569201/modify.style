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
            // 1. Draw Clicks (Ripples)
            // -------------------------------------------------------------
            if (state.effects.clickRipple) {
                const CLICK_DELAY = 0.08; // 80ms delay
                const activeClicks = state.events.clicks.filter(c => {
                    const diff = time - c.timestamp;
                    return diff >= CLICK_DELAY && diff < CLICK_DELAY + 0.6; // 600ms lifetime after delay
                });

                activeClicks.forEach(click => {
                    const CLICK_DELAY = 0.08;
                    const progress = (time - (click.timestamp + CLICK_DELAY)) / 0.6;
                    const ease = 1 - Math.pow(1 - progress, 3); // Cubic ease out

                    const maxRadius = Math.min(width, height) * 0.05 * state.effects.clickSize;
                    const radius = maxRadius * (0.5 + 0.5 * ease);
                    const opacity = 1 - Math.pow(progress, 2);

                    const cx = click.x * width;
                    const cy = click.y * height;

                    ctx.beginPath();
                    ctx.arc(cx, cy, radius, 0, Math.PI * 2);

                    // Parse color or use default
                    ctx.fillStyle = click.type === 'rightClick'
                        ? `rgba(239, 68, 68, ${opacity * 0.2})`
                        : `rgba(59, 130, 246, ${opacity * 0.2})`;
                    ctx.fill();

                    ctx.strokeStyle = click.type === 'rightClick'
                        ? `rgba(239, 68, 68, ${opacity})`
                        : `rgba(59, 130, 246, ${opacity})`;
                    ctx.lineWidth = 2;
                    ctx.stroke();
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
