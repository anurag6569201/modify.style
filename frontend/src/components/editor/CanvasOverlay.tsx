import React, { useEffect, useRef } from "react";
import { ClickData, MoveData } from "../../pages/Recorder";
import { getCursorPos } from "../../lib/composition/math";

interface CanvasOverlayProps {
    clickData: ClickData[];
    moveData: MoveData[];
    videoRef: React.RefObject<HTMLVideoElement>;
    width: number;
    height: number;
    isPlaying: boolean;
}

export const CanvasOverlay: React.FC<CanvasOverlayProps> = ({
    clickData,
    moveData,
    videoRef,
    width,
    height,
    isPlaying,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Load cursor image/icon once
    const cursorImageRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        // Create cursor image from an SVG data URI or load it
        const img = new Image();
        // A standard detailed macos-like cursor SVG
        img.src = `data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 3.5L11.5 19.5L14.5 13.5L20.5 13.5L5.5 3.5Z" fill="black" stroke="white" stroke-width="1.5"/></svg>`;
        cursorImageRef.current = img;
    }, []);

    const draw = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Use video timestamp for perfect sync
        const time = video.currentTime;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // 1. Draw Ripples (Under cursor)
        // Find active clicks (happened recently)
        const activeClicks = clickData.filter(
            (c) =>
                (c.type?.includes("click") || c.type === "rightClick") &&
                time >= c.timestamp &&
                time < c.timestamp + 0.8
        );

        activeClicks.forEach((click) => {
            const timeSince = time - click.timestamp;
            const progress = Math.min(1, timeSince / 0.6); // 0.6s duration

            const maxRadius = Math.min(width, height) * 0.08; // 8% of screen size max
            const currentRadius = maxRadius * (0.2 + 0.8 * progress); // start at 20% size

            // Opacity fades out
            const opacity = 1 - Math.pow(progress, 3);

            ctx.beginPath();
            ctx.arc(click.x * width, click.y * height, currentRadius, 0, Math.PI * 2);

            const color = click.type === "rightClick" ? "239, 68, 68" : "59, 130, 246"; // Red or Blue
            ctx.fillStyle = `rgba(${color}, ${opacity * 0.3})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(${color}, ${opacity})`;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Secondary ring
            ctx.beginPath();
            ctx.arc(click.x * width, click.y * height, currentRadius * 0.7, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${color}, ${opacity * 0.5})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // 2. Draw Cursor
        const pos = getCursorPos(time, moveData);
        if (pos) {
            const cx = pos.x * width;
            const cy = pos.y * height;

            if (cursorImageRef.current && cursorImageRef.current.complete) {
                // Draw image cursor (offset to align tip)
                ctx.shadowColor = "rgba(0,0,0,0.3)";
                ctx.shadowBlur = 4;
                ctx.shadowOffsetY = 2;
                ctx.drawImage(cursorImageRef.current, cx - 2, cy - 2, 24, 24);
                ctx.shadowColor = "transparent";
            } else {
                // Fallback drawing
                ctx.fillStyle = "black";
                ctx.strokeStyle = "white";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + 6, cy + 18);
                ctx.lineTo(cx + 10, cy + 12);
                ctx.lineTo(cx + 18, cy + 12);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }

        if (isPlaying) {
            animationFrameRef.current = requestAnimationFrame(draw);
        }
    };

    useEffect(() => {
        if (isPlaying) {
            draw();
        } else {
            requestAnimationFrame(draw);
        }

        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, width, height, clickData, moveData]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="absolute inset-0 pointer-events-none z-50"
            style={{
                width: "100%",
                height: "100%",
            }}
        />
    );
};
