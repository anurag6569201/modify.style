import React, { useEffect, useRef } from 'react';
import { useEditorState, editorStore } from '@/lib/editor/store';
import { CursorLayer } from './CursorLayer';
import { FilterEngine } from '@/lib/effects/filters';

export const VideoLayer: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const filterEngineRef = useRef<FilterEngine | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const seekingRef = useRef(false);
    const { video: videoConfig, playback, colorGrading, presentation } = useEditorState();

    // Initialize canvas size
    useEffect(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;

        // Try to get dimensions from video element if not set in config
        if (canvas && video && video.readyState >= 1) {
            const width = videoConfig.width > 0 ? videoConfig.width : video.videoWidth;
            const height = videoConfig.height > 0 ? videoConfig.height : video.videoHeight;

            if (width > 0 && height > 0) {
                canvas.width = width;
                canvas.height = height;

                // Update store if dimensions were missing
                if (videoConfig.width === 0 || videoConfig.height === 0) {
                    editorStore.setVideo({ width, height, aspectRatio: width / height });
                }
            }
        } else if (canvas && videoConfig.width > 0 && videoConfig.height > 0) {
            canvas.width = videoConfig.width;
            canvas.height = videoConfig.height;
        }
    }, [videoConfig.width, videoConfig.height]);

    // Sync Playback State (from Store -> Video)
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (playback.isPlaying) {
            if (video.paused) {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            // Playback started successfully
                        })
                        .catch((error) => {
                            // Ignore AbortError - it means a new play() was called
                            if (error.name !== 'AbortError') {
                                console.error("Play failed", error);
                            }
                        });
                }
            }
        } else {
            if (!video.paused) {
                video.pause();
            }
        }

        video.volume = playback.volume;
        video.muted = playback.isMuted;
    }, [playback.isPlaying, playback.volume, playback.isMuted]);

    // Handle seeking separately to avoid fighting with time updates
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Validate currentTime is finite and valid
        const targetTime = playback.currentTime;
        if (!isFinite(targetTime) || targetTime < 0 || isNaN(targetTime)) {
            return;
        }

        // Clamp to video duration if available
        const maxTime = video.duration && isFinite(video.duration) ? video.duration : Infinity;
        const clampedTime = Math.min(targetTime, maxTime);

        // Only seek if difference is significant (e.g. user scrubbed)
        // Reduced threshold for smoother scrubbing
        const timeDiff = Math.abs(video.currentTime - clampedTime);
        if (timeDiff > 0.1) {
            seekingRef.current = true;
            video.currentTime = clampedTime;
            // Reset seeking flag after a short delay
            setTimeout(() => {
                seekingRef.current = false;
            }, 100);
        }
    }, [playback.currentTime]);

    // Sync Time (from Video -> Store) - Master Clock
    const handleTimeUpdate = () => {
        if (videoRef.current && !seekingRef.current) {
            const currentTime = videoRef.current.currentTime;
            // Only update if time is finite and valid
            if (isFinite(currentTime) && !isNaN(currentTime) && currentTime >= 0) {
                editorStore.setPlayback({ currentTime });
            }
        }
    };

    const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = e.currentTarget;
        const width = video.videoWidth || videoConfig.width || 1920;
        const height = video.videoHeight || videoConfig.height || 1080;

        editorStore.setVideo({
            duration: video.duration || 0,
            width,
            height,
            aspectRatio: width / height
        });

        // Update canvas dimensions
        const canvas = canvasRef.current;
        if (canvas && width > 0 && height > 0) {
            canvas.width = width;
            canvas.height = height;
        }
    };

    // Render video with color grading filters
    useEffect(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;

        if (!canvas || !video) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Initialize filter engine if needed
        const width = canvas.width || videoConfig.width;
        const height = canvas.height || videoConfig.height;

        if (!filterEngineRef.current && width > 0 && height > 0) {
            filterEngineRef.current = new FilterEngine(ctx, width, height);
        }

        const filterEngine = filterEngineRef.current;
        if (!filterEngine || width === 0 || height === 0) return;

        // Check if we need to apply filters
        const hasFilters =
            colorGrading.brightness !== 0 ||
            colorGrading.contrast !== 0 ||
            colorGrading.saturation !== 0 ||
            colorGrading.hue !== 0 ||
            colorGrading.temperature !== 0 ||
            colorGrading.vignette !== 0;

        const renderFrame = () => {
            if (!video || video.readyState < 2) {
                // Video not ready, try again next frame
                animationFrameRef.current = requestAnimationFrame(renderFrame);
                return;
            }

            // Apply crop if enabled
            // Note: Actual cropping is now handled by the Stage container logic (CSS overflow/clip-path)
            // But we keep the config access if needed for other things, but simplified.
            const style = presentation.videoStyle || {
                borderEnabled: false,
                borderColor: '#ffffff',
                borderWidth: 0,
                shadowEnabled: false,
                shadowColor: 'rgba(0,0,0,0.5)',
                shadowBlur: 20,
                shadowOffsetX: 0,
                shadowOffsetY: 10,
                rotation: 0
            };

            const videoWidth = video.videoWidth || width;
            const videoHeight = video.videoHeight || height;

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // 1. Apply Rotation (Canvas level) - only if we want rotation to affect the canvas source draw
            // However, we are rotating the CONTAINER in Stage.tsx now. 
            // So we should probably disable this canvas rotation to avoid double rotation?
            // User put rotation logic back in CSS in Stage.tsx (implied).
            // Let's remove this canvas operations block to be safe.

            // Standard Draw
            // Filters removed as per request
            ctx.drawImage(video, 0, 0, width, height);

            // Always continue rendering to keep canvas in sync with video
            animationFrameRef.current = requestAnimationFrame(renderFrame);
        };

        // Start rendering loop
        animationFrameRef.current = requestAnimationFrame(renderFrame);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [playback.isPlaying, colorGrading, videoConfig.width, videoConfig.height, videoConfig.url, presentation.videoCrop]);

    return (
        <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
                width: '100%',
                height: '100%',
                background: 'transparent',
            }}
        >
            {videoConfig.url && (
                <>
                    {/* Video element (hidden but still functional for canvas) */}
                    <video
                        ref={videoRef}
                        src={videoConfig.url}
                        style={{ display: 'none' }}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onLoadedData={handleLoadedMetadata}
                        onEnded={() => editorStore.setPlayback({ isPlaying: false })}
                        playsInline
                        crossOrigin="anonymous"
                        preload="metadata"
                    />
                    {/* Canvas for rendering with filters */}
                    <div>
                        <canvas
                            ref={canvasRef}
                            className="block"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            }}
                        />
                        <CursorLayer />
                    </div>
                </>
            )}
        </div>
    );
};
