import React, { useRef, useEffect } from 'react';
import { useEditorState, editorStore } from '@/lib/editor/store';
import { VideoLayer } from './VideoLayer';
import { CursorLayer } from './CursorLayer';
import { BackgroundLayer } from './BackgroundLayer';
import { BrowserFrame } from './BrowserFrame';
import { updateCameraSystem, getInitialCameraState } from '@/lib/composition/camera';
import { calculateOutputDimensions, calculateVideoTransform } from '@/lib/composition/aspectRatio';

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

    // Show raw video without effects in editor preview
    const showRawVideo = true; // Always show raw video in editor

    useEffect(() => {
        // Skip camera effects if showing raw video
        if (showRawVideo) {
            // Reset transform to show raw video
            if (stageRef.current) {
                stageRef.current.style.transform = 'translate(0px, 0px) scale(1) rotate(0deg)';
                stageRef.current.style.filter = 'none';
            }
            return;
        }

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
    }, [showRawVideo]);

    // Calculate output dimensions based on aspect ratio preset
    const outputDims = calculateOutputDimensions(
        state.presentation.aspectRatio,
        state.video.width,
        state.video.height,
        state.presentation.customAspectRatio
    );

    // Calculate video transform for letterboxing
    const videoTransform = calculateVideoTransform(state.video, state.presentation);

    // Update presentation output dimensions if they changed
    useEffect(() => {
        if (state.presentation.outputWidth !== outputDims.width || 
            state.presentation.outputHeight !== outputDims.height) {
            editorStore.setState({
                presentation: {
                    ...state.presentation,
                    outputWidth: outputDims.width,
                    outputHeight: outputDims.height,
                }
            });
        }
    }, [outputDims.width, outputDims.height, state.presentation.aspectRatio]);

    // For raw video preview, use native video dimensions
    // When showing raw video, the stage should fill the container
    const displayWidth = showRawVideo ? '100%' : videoTransform.width;
    const displayHeight = showRawVideo ? '100%' : videoTransform.height;
    const displayX = showRawVideo ? 0 : videoTransform.x;
    const displayY = showRawVideo ? 0 : videoTransform.y;

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center"
            style={{
                width: showRawVideo ? '100%' : state.presentation.outputWidth,
                height: showRawVideo ? '100%' : state.presentation.outputHeight,
            }}
        >
            {/* Background Layer - only show if not raw video */}
            {!showRawVideo && <BackgroundLayer />}

            {/* The Stage moves effectively 'moving the camera' */}
            <div
                ref={stageRef}
                className="absolute origin-center will-change-transform backface-hidden"
                style={{
                    left: displayX,
                    top: displayY,
                    width: displayWidth,
                    height: displayHeight,
                    // Shadow to separate from background
                    boxShadow: showRawVideo ? 'none' : '0 0 100px rgba(0,0,0,0.5)'
                }}
            >
                <VideoLayer />
                {!showRawVideo && <CursorLayer />}
            </div>

            {/* Browser Frame Overlay - only show if not raw video */}
            {!showRawVideo && <BrowserFrame />}
        </div>
    );
};
