import React, { useRef, useEffect, useState } from 'react';
import { useEditorState, editorStore } from '@/lib/editor/store';
import { VideoLayer } from './VideoLayer';
import { BackgroundLayer } from './BackgroundLayer';
import { TextLayer } from './TextLayer';
import { ClickEffectsLayer } from './ClickEffectsLayer';
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
                try {
                    stageRef.current.style.transform = 'translate(0px, 0px) scale(1) rotate(0deg)';
                    stageRef.current.style.filter = 'none';
                } catch (error) {
                    console.error('Error resetting stage transform:', error);
                }
            }
            return;
        }

        let lastTime = performance.now();
        let consecutiveErrors = 0;
        const MAX_CONSECUTIVE_ERRORS = 10;

        const animate = (timestamp: number) => {
            try {
                const dt = (timestamp - lastTime) / 1000;
                lastTime = timestamp;

                // Clamp dt to avoid huge jumps if lag (max 100ms)
                const clampedDt = Math.min(Math.max(0, dt), 0.1);

                // -----------------------------------------------------
                // CAMERA LOGIC
                // -----------------------------------------------------
                const currentState = editorStore.getState();
                const videoTime = currentState.playback.currentTime;
                const { width, height } = currentState.video;

                // Validate state
                if (!isFinite(videoTime) || isNaN(videoTime) || videoTime < 0) {
                    requestRef.current = requestAnimationFrame(animate);
                    return;
                }

                // Only run if we have valid dimensions
                if (width > 0 && height > 0 && isFinite(width) && isFinite(height)) {
                    try {
                        const newCameraState = updateCameraSystem(
                            cameraStateRef.current,
                            videoTime,
                            clampedDt,
                            currentState.events.clicks,
                            currentState.events.moves,
                            currentState.events.effects || [],
                            { width, height },
                            currentState.video.duration || 0,
                            {
                                zoomStrength: currentState.camera.zoomStrength,
                                speed: currentState.camera.speed,
                                padding: currentState.camera.padding
                            }
                        );

                        cameraStateRef.current = newCameraState;

                        // Apply Transform
                        if (stageRef.current) {
                            try {
                                const { scale, translateX, translateY, rotation, vignette } = newCameraState.transform;
                                // Apply to Stage Content
                                // Add rotation (banking)
                                const rot = rotation || 0;
                                // Add Design Rotation
                                const designRotation = currentState.presentation.videoStyle?.rotation || 0;
                                const totalRotation = rot + designRotation;

                                // Validate values
                                if (!isFinite(scale) || !isFinite(translateX) || !isFinite(translateY) || !isFinite(totalRotation)) {
                                    throw new Error('Invalid transform values');
                                }

                                // Scale translation to match preview size
                                // Camera logic works in native video pixels, so we must scale the translation
                                // to match the current display size of the stage.
                                const nativeWidth = currentState.video.width || 1920;
                                const currentWidth = stageRef.current.offsetWidth || nativeWidth;
                                
                                if (!isFinite(nativeWidth) || !isFinite(currentWidth) || nativeWidth <= 0 || currentWidth <= 0) {
                                    throw new Error('Invalid width values');
                                }
                                
                                const ratio = currentWidth / nativeWidth;

                                if (!isFinite(ratio)) {
                                    throw new Error('Invalid ratio');
                                }

                                const scaledX = translateX * ratio;
                                const scaledY = translateY * ratio;

                                if (!isFinite(scaledX) || !isFinite(scaledY)) {
                                    throw new Error('Invalid scaled translation values');
                                }

                                stageRef.current.style.transform = `scale(${scale}) translate(${scaledX}px, ${scaledY}px) rotate(${totalRotation}deg)`;

                                // Construct CSS filter string from Color Grading + Camera Blur
                                const { brightness, contrast, saturation, hue } = currentState.colorGrading;

                                const filterParts = [];
                                if (newCameraState.blur > 0 && isFinite(newCameraState.blur)) {
                                    filterParts.push(`blur(${Math.max(0, Math.min(20, newCameraState.blur))}px)`);
                                }
                                if (isFinite(brightness) && brightness !== 0) {
                                    filterParts.push(`brightness(${1 + brightness})`);
                                }
                                if (isFinite(contrast) && contrast !== 0) {
                                    filterParts.push(`contrast(${1 + contrast})`);
                                }
                                if (isFinite(saturation) && saturation !== 0) {
                                    filterParts.push(`saturate(${1 + saturation})`);
                                }
                                if (isFinite(hue) && hue !== 0) {
                                    filterParts.push(`hue-rotate(${hue}deg)`);
                                }

                                stageRef.current.style.filter = filterParts.length > 0 ? filterParts.join(' ') : 'none';
                            } catch (transformError) {
                                console.error('Error applying stage transform:', transformError);
                                consecutiveErrors++;
                            }

                            // Update Spotlight Overlay
                            if (spotlightRef.current) {
                                try {
                                    spotlightRef.current.style.opacity = newCameraState.spotlight ? '1' : '0';
                                } catch (error) {
                                    console.error('Error updating spotlight:', error);
                                }
                            }

                            // Update Vignette Overlay
                            if (vignetteRef.current) {
                                try {
                                    // Combine camera vignette and color grading vignette
                                    const cameraVignette = newCameraState.transform.vignette || 0;
                                    const gradingVignette = currentState.colorGrading.vignette || 0;
                                    const totalVignette = Math.min(1, Math.max(0, cameraVignette + gradingVignette));
                                    if (isFinite(totalVignette)) {
                                        vignetteRef.current.style.opacity = totalVignette.toString();
                                    }
                                } catch (error) {
                                    console.error('Error updating vignette:', error);
                                }
                            }
                        }

                        consecutiveErrors = 0; // Reset on success
                    } catch (cameraError) {
                        consecutiveErrors++;
                        console.error('Error in camera system update:', cameraError);
                        
                        // Stop animation if too many errors
                        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                            console.error('Too many camera errors, stopping animation');
                            return;
                        }
                    }
                }

                requestRef.current = requestAnimationFrame(animate);
            } catch (error) {
                consecutiveErrors++;
                console.error('Error in animation loop:', error);
                
                // Stop animation if too many errors
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    console.error('Too many animation errors, stopping animation');
                    return;
                }
                
                // Try to continue
                requestRef.current = requestAnimationFrame(animate);
            }
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
                requestRef.current = undefined;
            }
        };
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
                background: 'transparent',
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
                    overflow: 'hidden',
                    zIndex: 10,

                    // 2. Border
                    border: state.presentation.videoStyle?.borderEnabled
                        ? `${state.presentation.videoStyle.borderWidth}px solid ${state.presentation.videoStyle.borderColor}`
                        : 'none',

                    // 3. Rounding
                    borderRadius: state.presentation.videoCrop.roundedCorners
                        ? `${state.presentation.videoCrop.cornerRadius}px`
                        : undefined,

                    // 4. Shadow
                    boxShadow: state.presentation.videoStyle?.shadowEnabled
                        ? `${state.presentation.videoStyle.shadowOffsetX}px ${state.presentation.videoStyle.shadowOffsetY}px ${state.presentation.videoStyle.shadowBlur}px ${state.presentation.videoStyle.shadowColor}`
                        : (showRawVideo ? 'none' : '0 20px 50px rgba(0,0,0,0.5)'), // Default shadow or custom

                    // 5. Rotation (Applied via ref in animation loop usually, but we can compose here if static)
                    // Note: stageRef transform is overwritten in the animation loop (Stage.tsx:75).
                    // We need to update that loop to include this rotation.
                    // For now, let's leave transform control to the loop and update the loop logic next.
                    background: 'transparent !important',
                }}
            >
                <VideoLayer />
                {/* Click Effects Layer */}
                <ClickEffectsLayer />
                {/* Vignette Overlay */}
                <div
                    ref={vignetteRef}
                    className="absolute inset-0 pointer-events-none z-20"
                    style={{
                        background: 'radial-gradient(circle, transparent 50%, black 150%)',
                        opacity: 0,
                        transition: 'opacity 0.1s ease',
                    }}
                />
            </div>
            <TextLayer />
        </div>
    );
};
