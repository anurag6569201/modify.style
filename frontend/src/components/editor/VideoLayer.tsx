import React, { useEffect, useRef } from 'react';
import { useEditorState, editorStore } from '@/lib/editor/store';
import { FilterEngine } from '@/lib/effects/filters';

export const VideoLayer: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const filterEngineRef = useRef<FilterEngine | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const { video: videoConfig, playback, colorGrading } = useEditorState();

    // Initialize canvas size
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || videoConfig.width === 0 || videoConfig.height === 0) return;

        canvas.width = videoConfig.width;
        canvas.height = videoConfig.height;
    }, [videoConfig.width, videoConfig.height]);

    // Sync Playback State (from Store -> Video)
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (playback.isPlaying) {
            if (video.paused) video.play().catch(e => console.error("Play failed", e));
        } else {
            if (!video.paused) video.pause();
        }

        video.volume = playback.volume;
        video.muted = playback.isMuted;
    }, [playback.isPlaying, playback.volume, playback.isMuted]);

    // Handle seeking separately to avoid fighting with time updates
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        // Only seek if difference is significant (e.g. user scrubbed)
        if (Math.abs(video.currentTime - playback.currentTime) > 0.5) {
            video.currentTime = playback.currentTime;
        }
    }, [playback.currentTime]);

    // Sync Time (from Video -> Store) - Master Clock
    const handleTimeUpdate = () => {
        if (videoRef.current) {
            editorStore.setPlayback({ currentTime: videoRef.current.currentTime });
        }
    };

    const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = e.currentTarget;
        editorStore.setVideo({
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
            aspectRatio: video.videoWidth / video.videoHeight
        });
    };

    // Render video with color grading filters
    useEffect(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        
        if (!canvas || !video) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Initialize filter engine if needed
        if (!filterEngineRef.current && videoConfig.width > 0 && videoConfig.height > 0) {
            filterEngineRef.current = new FilterEngine(ctx, videoConfig.width, videoConfig.height);
        }

        const filterEngine = filterEngineRef.current;
        if (!filterEngine) return;

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

            if (hasFilters && filterEngine) {
                // Apply color grading filters
                filterEngine.applyFilters(video, {
                    brightness: colorGrading.brightness,
                    contrast: colorGrading.contrast,
                    saturation: colorGrading.saturation,
                    hue: colorGrading.hue,
                    vignette: colorGrading.vignette,
                    // Temperature adjustment via colorize
                    colorize: colorGrading.temperature !== 0 ? {
                        r: colorGrading.temperature > 0 ? 255 : 0,
                        g: colorGrading.temperature > 0 ? 200 : 100,
                        b: colorGrading.temperature < 0 ? 255 : 0,
                        amount: Math.abs(colorGrading.temperature) * 0.3, // Scale down temperature effect
                    } : undefined,
                });
            } else {
                // No filters, just draw video directly
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }

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
    }, [playback.isPlaying, colorGrading, videoConfig.width, videoConfig.height]);

    return (
        <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
                width: '100%',
                height: '100%',
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
                        onEnded={() => editorStore.setPlayback({ isPlaying: false })}
                        playsInline
                        crossOrigin="anonymous"
                    />
                    {/* Canvas for rendering with filters */}
                    <canvas
                        ref={canvasRef}
                        className="block"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                        }}
                    />
                </>
            )}
        </div>
    );
};
