import React, { useRef, useEffect, useState } from 'react';
import { useEditorState, editorStore } from '@/lib/editor/store';
import { VideoLayer } from './VideoLayer';
import { BackgroundLayer } from './BackgroundLayer';
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

    // Show effects in editor preview - set to false to show all effects
    const showRawVideo = false; // Show all effects in editor preview

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
    }, [showRawVideo, state.effects.clickRipple, state.camera, state.playback.currentTime]);

    // Calculate output dimensions based on aspect ratio preset
    const outputDims = calculateOutputDimensions(
        state.presentation.aspectRatio,
        state.video.width,
        state.video.height,
        state.presentation.customAspectRatio
    );

    // Use calculated output dimensions for transform (ensures consistency)
    const presentationWithCalculatedDims = {
        ...state.presentation,
        outputWidth: outputDims.width,
        outputHeight: outputDims.height,
    };

    // Calculate video transform for letterboxing
    const videoTransform = calculateVideoTransform(state.video, presentationWithCalculatedDims);

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
    }, [outputDims.width, outputDims.height, state.presentation.aspectRatio, state.video.width, state.video.height, state.presentation.customAspectRatio]);

    // Calculate padding if enabled
    const paddingRaw = state.presentation.videoPadding.enabled ? state.presentation.videoPadding : null;
    // If uniform is enabled, use top value for all sides to ensure consistency
    const padding = paddingRaw && paddingRaw.uniform
        ? { ...paddingRaw, top: paddingRaw.top, right: paddingRaw.top, bottom: paddingRaw.top, left: paddingRaw.top }
        : paddingRaw;
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    
    // Update container size on resize
    useEffect(() => {
        if (!containerRef.current) return;
        
        const updateSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setContainerSize({ width: rect.width, height: rect.height });
            }
        };
        
        updateSize();
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(containerRef.current);
        
        return () => resizeObserver.disconnect();
    }, []);
    
    // For raw video preview, use native video dimensions
    // When showing raw video, the stage should fill the container
    let displayWidth = showRawVideo ? '100%' : `${videoTransform.width}px`;
    let displayHeight = showRawVideo ? '100%' : `${videoTransform.height}px`;
    let displayX = showRawVideo ? 0 : videoTransform.x;
    let displayY = showRawVideo ? 0 : videoTransform.y;
    
    // Apply padding if enabled and not showing raw video
    if (!showRawVideo && padding && containerSize.width > 0 && containerSize.height > 0) {
      const containerWidth = containerSize.width;
      const containerHeight = containerSize.height;
      
      // Padding values are already in pixels
      const paddingLeftPx = padding.left;
      const paddingRightPx = padding.right;
      const paddingTopPx = padding.top;
      const paddingBottomPx = padding.bottom;
      
      // Calculate available space after padding
      const availableWidth = containerWidth - paddingLeftPx - paddingRightPx;
      const availableHeight = containerHeight - paddingTopPx - paddingBottomPx;
      
      // Scale video to fit available space while maintaining aspect ratio
      const videoAspect = videoTransform.width / videoTransform.height;
      const availableAspect = availableWidth / availableHeight;
      
      let scaledWidth = availableWidth;
      let scaledHeight = availableHeight;
      
      if (videoAspect > availableAspect) {
        // Video is wider - fit to width
        scaledHeight = availableWidth / videoAspect;
      } else {
        // Video is taller - fit to height
        scaledWidth = availableHeight * videoAspect;
      }
      
      // Center video in available space
      const centerX = paddingLeftPx + (availableWidth - scaledWidth) / 2;
      const centerY = paddingTopPx + (availableHeight - scaledHeight) / 2;
      
      displayWidth = `${scaledWidth}px`;
      displayHeight = `${scaledHeight}px`;
      displayX = centerX;
      displayY = centerY;
    } else if (!showRawVideo && !padding && containerSize.width > 0 && containerSize.height > 0) {
      // No padding, use video transform but scale to container
      const containerWidth = containerSize.width;
      const containerHeight = containerSize.height;
      const containerAspect = containerWidth / containerHeight;
      const videoAspect = videoTransform.width / videoTransform.height;
      
      let scaledWidth = containerWidth;
      let scaledHeight = containerHeight;
      
      if (videoAspect > containerAspect) {
        scaledHeight = containerWidth / videoAspect;
      } else {
        scaledWidth = containerHeight * videoAspect;
      }
      
      displayWidth = `${scaledWidth}px`;
      displayHeight = `${scaledHeight}px`;
      displayX = (containerWidth - scaledWidth) / 2;
      displayY = (containerHeight - scaledHeight) / 2;
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center"
            style={{
                width: '100%',
                height: '100%',
                background:'transparent',
                aspectRatio: showRawVideo 
                    ? (state.video.width > 0 && state.video.height > 0 
                        ? `${state.video.width} / ${state.video.height}`
                        : '16 / 9')
                    : (outputDims.width > 0 && outputDims.height > 0
                        ? `${outputDims.width} / ${outputDims.height}`
                        : '16 / 9'),
            }}
        >
            {/* Background Layer - always show when effects enabled */}
            {!showRawVideo && (
                <div className="absolute inset-0 w-full h-full">
                    <BackgroundLayer />
                </div>
            )}

            {/* The Stage moves effectively 'moving the camera' */}
            <div
                ref={stageRef}
                className="absolute origin-center will-change-transform backface-hidden"
                style={{
                    left: typeof displayX === 'number' ? `${displayX}px` : displayX,
                    top: typeof displayY === 'number' ? `${displayY}px` : displayY,
                    width: displayWidth,
                    height: displayHeight,
                    boxShadow: showRawVideo ? 'none' : '0 0 100px rgba(0,0,0,0.7)',
                    zIndex: 10,
                    background:'transparent !important',
                    borderRadius: '12px',
                    overflow: 'hidden',
                }}
            >
                <VideoLayer />
            </div>
        </div>
    );
};
