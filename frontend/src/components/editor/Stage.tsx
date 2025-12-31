import React, { useRef, useEffect } from 'react';
import { useEditorState, editorStore } from '@/lib/editor/store';
import { VideoLayer } from './VideoLayer';
import { CursorLayer } from './CursorLayer';
import { updateCameraSystem, getInitialCameraState } from '@/lib/composition/camera';

export const Stage: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const spotlightRef = useRef<HTMLDivElement>(null);
    const vignetteRef = useRef<HTMLDivElement>(null);
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
                    const { scale, translateX, translateY, rotation, vignette } = newCameraState.transform;
                    // Apply to Stage Content
                    // Add rotation (banking)
                    const rot = rotation || 0;
                    stageRef.current.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rot}deg)`;

                    // Apply Vignette (using mask or box-shadow on overlay? Stage has blur.)
                    // Actually, Stage doesn't have a vignette overlay yet.
                    // We can add it to the spotlight overlay or a new one.
                    // For now, let's just handle Blur and Transform.
                    stageRef.current.style.filter = newCameraState.blur > 0
                        ? `blur(${newCameraState.blur}px)`
                        : 'none';

                    // Update Vignette Overlay if exists (we need to add it to JSX if we want it)
                    // Let's rely on Spotlight reference for now or adding a specific vignette element.
                    // But wait, the user asked for "God level". I should add the Vignette Overlay to the JSX.

                }

                // Update Spotlight Overlay
                if (spotlightRef.current) {
                    spotlightRef.current.style.opacity = newCameraState.spotlight ? '1' : '0';
                }

                // Update Vignette Overlay
                if (vignetteRef.current) {
                    // Vignette is 0 to 1 opacity
                    vignetteRef.current.style.opacity = (newCameraState.transform.vignette || 0).toString();
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
        </div>
    );
};
