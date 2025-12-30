import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MousePointer2 } from 'lucide-react';

export interface ClickData {
    x: number;
    y: number;
    timestamp: number;
    screenWidth: number;
    screenHeight: number;
    type?: "click" | "doubleClick" | "rightClick" | "move";
    elementInfo?: {
        tagName?: string;
        text?: string;
        className?: string;
    };
}

interface VisualEffectsLayerProps {
    currentTime: number;
    clickData: ClickData[];
    videoRef: React.RefObject<HTMLVideoElement>;
    containerRef: React.RefObject<HTMLDivElement>;
    isPlaying: boolean;
}

export const VisualEffectsLayer: React.FC<VisualEffectsLayerProps> = ({
    currentTime,
    clickData,
    videoRef,
    containerRef,
    isPlaying,
}) => {
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
    const [activeRipples, setActiveRipples] = useState<ClickData[]>([]);

    // Optimize: Memoize sorted data
    const sortedData = useMemo(() => {
        return [...clickData].sort((a, b) => a.timestamp - b.timestamp);
    }, [clickData]);

    useEffect(() => {
        if (!containerRef.current || !videoRef.current) return;

        // 1. Calculate Cursor Position
        // Find the two events surrounding the current time
        let prevEvent: ClickData | null = null;
        let nextEvent: ClickData | null = null;

        for (const event of sortedData) {
            if (event.timestamp <= currentTime) {
                prevEvent = event;
            } else {
                nextEvent = event;
                break;
            }
        }

        if (prevEvent && nextEvent) {
            // Interpolate
            const duration = nextEvent.timestamp - prevEvent.timestamp;
            const elapsed = currentTime - prevEvent.timestamp;
            const t = Math.min(1, Math.max(0, elapsed / duration));

            // Simple lerp - can be improved with bezier for curves if we had more points
            const x = prevEvent.x + (nextEvent.x - prevEvent.x) * t;
            const y = prevEvent.y + (nextEvent.y - prevEvent.y) * t;

            setCursorPos({ x, y });
        } else if (prevEvent) {
            setCursorPos({ x: prevEvent.x, y: prevEvent.y });
        } else {
            setCursorPos(null);
        }

        // 2. Manage Ripples
        // Show ripples for clicks that happened in the last 0.8 seconds
        const ripples = sortedData.filter(d =>
            (d.type === 'click' || d.type === 'doubleClick' || d.type === 'rightClick') &&
            currentTime >= d.timestamp &&
            currentTime < d.timestamp + 0.8
        );
        setActiveRipples(ripples);

    }, [currentTime, sortedData, videoRef, containerRef]);

    if (!cursorPos && activeRipples.length === 0) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
            {/* Click Ripples */}
            {activeRipples.map((ripple) => {
                const timeSince = currentTime - ripple.timestamp;
                const progress = Math.min(1, timeSince / 0.6); // 0 to 1 over 0.6s

                // Effects
                const scale = 1 + progress * 2.5; // Grow to 2.5x
                const opacity = 1 - Math.pow(progress, 3); // Fade out cubic

                return (
                    <div
                        key={ripple.timestamp}
                        className="absolute rounded-full border-2 border-primary shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                        style={{
                            left: `${ripple.x * 100}%`,
                            top: `${ripple.y * 100}%`,
                            width: '40px',
                            height: '40px',
                            transform: `translate(-50%, -50%) scale(${scale})`,
                            opacity: opacity,
                            borderColor: ripple.type === 'rightClick' ? '#ef4444' : '#3b82f6', // Red for right click
                        }}
                    >
                        {/* Inner secondary ring for "God Level" detail */}
                        <div
                            className="absolute inset-0 rounded-full border border-white opacity-50"
                            style={{ transform: 'scale(0.7)' }}
                        />
                    </div>
                );
            })}

            {/* Smooth Cursor */}
            {cursorPos && (
                <div
                    className="absolute transition-transform duration-75 ease-linear will-change-transform"
                    style={{
                        left: `${cursorPos.x * 100}%`,
                        top: `${cursorPos.y * 100}%`,
                        transform: `translate(-20%, -20%)`, // Offset to align tip
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                    }}
                >
                    <div className="relative">
                        <MousePointer2
                            className="h-6 w-6 text-black fill-white stroke-[1.5]"
                            style={{ transform: 'rotate(-15deg)' }}
                        />
                        {/* Cursor Trail/Glow */}
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150 -z-10 opacity-50" />
                    </div>
                </div>
            )}
        </div>
    );
};
