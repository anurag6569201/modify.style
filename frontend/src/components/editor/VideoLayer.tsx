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
    const isMountedRef = useRef(true);
    const renderErrorCountRef = useRef(0);
    const { video: videoConfig, playback, colorGrading, presentation } = useEditorState();

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            // Cleanup filter engine
            filterEngineRef.current = null;
        };
    }, []);

    // Initialize canvas size
    useEffect(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;

        if (!canvas) return;

        try {
            // Try to get dimensions from video element if not set in config
            if (video && video.readyState >= 1) {
                const width = videoConfig.width > 0 ? videoConfig.width : video.videoWidth;
                const height = videoConfig.height > 0 ? videoConfig.height : video.videoHeight;

                if (width > 0 && height > 0 && isFinite(width) && isFinite(height)) {
                    canvas.width = width;
                    canvas.height = height;

                    // Update store if dimensions were missing
                    if (videoConfig.width === 0 || videoConfig.height === 0) {
                        editorStore.setVideo({ width, height, aspectRatio: width / height });
                    }
                }
            } else if (videoConfig.width > 0 && videoConfig.height > 0) {
                if (isFinite(videoConfig.width) && isFinite(videoConfig.height)) {
                    canvas.width = videoConfig.width;
                    canvas.height = videoConfig.height;
                }
            }
        } catch (error) {
            console.error('Error initializing canvas size:', error);
        }
    }, [videoConfig.width, videoConfig.height]);

    // Sync Playback State (from Store -> Video)
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !isMountedRef.current) return;

        try {
            if (playback.isPlaying) {
                if (video.paused && video.readyState >= 2) {
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise
                            .then(() => {
                                // Playback started successfully
                                renderErrorCountRef.current = 0; // Reset error count on success
                            })
                            .catch((error) => {
                                // Ignore AbortError - it means a new play() was called
                                if (error.name !== 'AbortError') {
                                    console.error("Play failed", error);
                                    // Pause playback on error
                                    editorStore.setPlayback({ isPlaying: false });
                                }
                            });
                    }
                }
            } else {
                if (!video.paused) {
                    video.pause();
                }
            }

            if (isFinite(playback.volume) && playback.volume >= 0 && playback.volume <= 1) {
                video.volume = playback.volume;
            }
            video.muted = playback.isMuted;
        } catch (error) {
            console.error('Error syncing playback state:', error);
        }
    }, [playback.isPlaying, playback.volume, playback.isMuted]);

    // Handle seeking separately to avoid fighting with time updates
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !isMountedRef.current) return;

        try {
            // Validate currentTime is finite and valid
            const targetTime = playback.currentTime;
            if (!isFinite(targetTime) || targetTime < 0 || isNaN(targetTime)) {
                return;
            }

            // Clamp to video duration if available
            const maxTime = video.duration && isFinite(video.duration) && video.duration > 0 
                ? video.duration 
                : Infinity;
            const clampedTime = Math.max(0, Math.min(targetTime, maxTime));

            // Only seek if difference is significant (e.g. user scrubbed)
            // Reduced threshold for smoother scrubbing
            const timeDiff = Math.abs(video.currentTime - clampedTime);
            if (timeDiff > 0.1) {
                seekingRef.current = true;
                video.currentTime = clampedTime;
                // Reset seeking flag after a short delay
                const timeoutId = setTimeout(() => {
                    seekingRef.current = false;
                }, 100);
                return () => clearTimeout(timeoutId);
            }
        } catch (error) {
            console.error('Error seeking video:', error);
            seekingRef.current = false;
        }
    }, [playback.currentTime]);

    // Sync Time (from Video -> Store) - Master Clock
    const handleTimeUpdate = () => {
        if (!isMountedRef.current) return;
        
        try {
            const video = videoRef.current;
            if (video && !seekingRef.current) {
                const currentTime = video.currentTime;
                // Only update if time is finite and valid
                if (isFinite(currentTime) && !isNaN(currentTime) && currentTime >= 0) {
                    editorStore.setPlayback({ currentTime });
                }
            }
        } catch (error) {
            console.error('Error in handleTimeUpdate:', error);
        }
    };

    const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        if (!isMountedRef.current) return;
        
        try {
            const video = e.currentTarget;
            let duration = video.duration;
            const width = video.videoWidth || videoConfig.width || 1920;
            const height = video.videoHeight || videoConfig.height || 1080;

            // Validate dimensions
            if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) {
                console.error('Invalid video dimensions:', { width, height });
                return;
            }

            // Fix for Chrome MediaRecorder Infinity duration bug
            if (duration === Infinity || !isFinite(duration)) {
                video.currentTime = 1e101;
                const timeUpdateHandler = () => {
                    video.ontimeupdate = null;
                    video.currentTime = 0;
                    duration = video.duration;

                    if (isMountedRef.current) {
                        // Update store with corrected duration
                        editorStore.setVideo({
                            duration: (duration && isFinite(duration)) ? duration : 0,
                            width,
                            height,
                            aspectRatio: width / height
                        });
                    }
                };
                video.ontimeupdate = timeUpdateHandler;
            } else {
                editorStore.setVideo({
                    duration: duration || 0,
                    width,
                    height,
                    aspectRatio: width / height
                });
            }

            // Update canvas dimensions
            const canvas = canvasRef.current;
            if (canvas && width > 0 && height > 0) {
                canvas.width = width;
                canvas.height = height;
                // Reset filter engine when dimensions change
                filterEngineRef.current = null;
            }
        } catch (error) {
            console.error('Error in handleLoadedMetadata:', error);
        }
    };

    // Render video with color grading filters
    useEffect(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;

        if (!canvas || !video || !isMountedRef.current) {
            // Cleanup if not ready
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }

        const ctx = canvas.getContext('2d', { 
            willReadFrequently: false,
            alpha: false 
        });
        if (!ctx) {
            console.error('Failed to get canvas context');
            return;
        }

        // Initialize filter engine if needed
        const width = canvas.width || videoConfig.width;
        const height = canvas.height || videoConfig.height;

        // Validate dimensions
        if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) {
            console.warn('Invalid canvas dimensions, skipping render setup');
            return;
        }

        // Recreate filter engine if dimensions changed
        if (!filterEngineRef.current || 
            filterEngineRef.current.width !== width || 
            filterEngineRef.current.height !== height) {
            try {
                filterEngineRef.current = new FilterEngine(ctx, width, height);
            } catch (error) {
                console.error('Failed to create filter engine:', error);
                filterEngineRef.current = null;
            }
        }

        const filterEngine = filterEngineRef.current;

        // Check if we need to apply filters
        const hasFilters =
            colorGrading.brightness !== 0 ||
            colorGrading.contrast !== 0 ||
            colorGrading.saturation !== 0 ||
            colorGrading.hue !== 0 ||
            colorGrading.temperature !== 0 ||
            colorGrading.vignette !== 0;

        let consecutiveErrors = 0;
        const MAX_CONSECUTIVE_ERRORS = 5;

        const renderFrame = () => {
            // Check if component is still mounted
            if (!isMountedRef.current) {
                return;
            }

            // Validate refs are still valid
            const currentCanvas = canvasRef.current;
            const currentVideo = videoRef.current;
            
            if (!currentCanvas || !currentVideo) {
                return;
            }

            try {
                // Check video ready state
                if (currentVideo.readyState < 2) {
                    // Video not ready, try again next frame (but limit retries)
                    if (consecutiveErrors < MAX_CONSECUTIVE_ERRORS) {
                        animationFrameRef.current = requestAnimationFrame(renderFrame);
                    }
                    return;
                }

                // Validate canvas dimensions
                const currentWidth = currentCanvas.width;
                const currentHeight = currentCanvas.height;
                
                if (!isFinite(currentWidth) || !isFinite(currentHeight) || 
                    currentWidth <= 0 || currentHeight <= 0) {
                    console.warn('Invalid canvas dimensions during render');
                    return;
                }

                // Validate video dimensions
                const videoWidth = currentVideo.videoWidth || currentWidth;
                const videoHeight = currentVideo.videoHeight || currentHeight;
                
                if (!isFinite(videoWidth) || !isFinite(videoHeight) || 
                    videoWidth <= 0 || videoHeight <= 0) {
                    // Video dimensions not ready yet
                    animationFrameRef.current = requestAnimationFrame(renderFrame);
                    return;
                }

                // Clear canvas
                ctx.clearRect(0, 0, currentWidth, currentHeight);

                // Draw video frame
                try {
                    ctx.drawImage(currentVideo, 0, 0, currentWidth, currentHeight);
                    consecutiveErrors = 0; // Reset error count on success
                } catch (drawError) {
                    consecutiveErrors++;
                    console.error('Error drawing video frame:', drawError);
                    
                    // Stop rendering if too many consecutive errors
                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                        console.error('Too many render errors, stopping render loop');
                        renderErrorCountRef.current = consecutiveErrors;
                        return;
                    }
                }

                // Continue rendering loop
                animationFrameRef.current = requestAnimationFrame(renderFrame);
            } catch (error) {
                consecutiveErrors++;
                console.error('Error in renderFrame:', error);
                
                // Stop rendering if too many consecutive errors
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    console.error('Too many render errors, stopping render loop');
                    renderErrorCountRef.current = consecutiveErrors;
                    return;
                }
                
                // Try to continue on error (but with backoff)
                if (isMountedRef.current) {
                    animationFrameRef.current = requestAnimationFrame(renderFrame);
                }
            }
        };

        // Start rendering loop
        animationFrameRef.current = requestAnimationFrame(renderFrame);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [playback.isPlaying, colorGrading, videoConfig.width, videoConfig.height, videoConfig.url, presentation.videoCrop]);

    // Handle duration change explicitly
    const handleDurationChange = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        if (!isMountedRef.current) return;
        
        try {
            const video = e.currentTarget;
            const duration = video.duration;
            // Ignore Infinity here, handled in loadedmetadata or timeupdate
            if (duration > 0 && duration !== Infinity && isFinite(duration)) {
                const width = video.videoWidth || videoConfig.width || 1920;
                const height = video.videoHeight || videoConfig.height || 1080;
                
                if (isFinite(width) && isFinite(height) && width > 0 && height > 0) {
                    editorStore.setVideo({
                        duration,
                        width,
                        height,
                        aspectRatio: width / height
                    });
                }
            }
        } catch (error) {
            console.error('Error in handleDurationChange:', error);
        }
    };

    // Handle video errors
    const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = e.currentTarget;
        const error = video.error;
        if (error) {
            console.error('Video error:', {
                code: error.code,
                message: error.message,
            });
            // Pause playback on error
            editorStore.setPlayback({ isPlaying: false });
        }
    };

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
                        onDurationChange={handleDurationChange}
                        onEnded={() => editorStore.setPlayback({ isPlaying: false })}
                        onError={handleVideoError}
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
