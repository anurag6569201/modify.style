import React, { useRef, useEffect } from 'react';
import { useEditorState, editorStore } from '@/lib/editor/store';
import { VideoLayer } from './VideoLayer';
import { CursorLayer } from './CursorLayer';
import { updateCameraSystem, getInitialCameraState } from '@/lib/composition/camera';

export const Stage: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const spotlightRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number>();

    // Subscribe to store for rendering the container dimensions
    const state = useEditorState();

    // Persistent Camera State (Game Loop State)
    const cameraStateRef = useRef(getInitialCameraState());

    useEffect(() => {
        let lastTime = performance.now();

        const animate = (timestamp: number) => {
            const dt = (timestamp - lastTime) / 1000;
            lastTime = timestamp;

            // -----------------------------------------------------
            // CAMERA LOGIC
            // -----------------------------------------------------
            const currentState = editorStore.getState();
            const videoTime = currentState.playback.currentTime;
            const { width, height } = currentState.video;

            // Only run if we have valid dimensions
            if (width > 0 && height > 0) {
                const newCameraState = updateCameraSystem(
                    cameraStateRef.current,
                    videoTime,
                    // Clamp dt to avoid huge jumps if lag (max 100ms)
                    Math.min(dt, 0.1),
                    currentState.events.clicks,
                    currentState.events.moves,
                    currentState.events.effects || [],
                    { width, height },
                    currentState.video.duration || 0
                );

                cameraStateRef.current = newCameraState;

                // Apply Transform
                if (stageRef.current) {
                    const { scale, translateX, translateY } = newCameraState.transform;
                    // Apply to Stage Content
                    stageRef.current.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

                    // Apply Blur
                    stageRef.current.style.filter = newCameraState.blur > 0
                        ? `blur(${newCameraState.blur}px)`
                        : 'none';
                }

                // Update Spotlight Overlay
                if (spotlightRef.current) {
                    spotlightRef.current.style.opacity = newCameraState.spotlight ? '1' : '0';
                }
            }

            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, []);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center"
        >
            {/* The Stage moves effectively 'moving the camera' */}
            <div
                ref={stageRef}
                className="relative origin-center will-change-transform backface-hidden"
                style={{
                    width: state.video.width,
                    height: state.video.height,
                    // Shadow to separate from background
                    boxShadow: '0 0 100px rgba(0,0,0,0.5)'
                }}
            >
                <VideoLayer />
                <CursorLayer />
            </div>

            {/* Spotlight Overlay */}
            <div
                ref={spotlightRef}
                className="absolute inset-0 pointer-events-none transition-opacity duration-300 ease-out"
                style={{
                    opacity: 0,
                    background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.6) 100%)',
                    mixBlendMode: 'multiply'
                }}
            />
        </div>
    );
};
