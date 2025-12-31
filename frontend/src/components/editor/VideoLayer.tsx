import React, { useEffect, useRef } from 'react';
import { useEditorState, editorStore } from '@/lib/editor/store';

export const VideoLayer: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { video: videoConfig, playback } = useEditorState();

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
            // Update store without triggering re-renders of this component unnecessarily
            // (Store handles diffing or we just update)
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

    return (
        <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
                width: videoConfig.width,
                height: videoConfig.height,
            }}
        >
            {videoConfig.url && (
                <video
                    ref={videoRef}
                    src={videoConfig.url}
                    className="block object-cover" // Ensure no extra spacing
                    style={{
                        width: '100%',
                        height: '100%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' // Cinematic shadow
                    }}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => editorStore.setPlayback({ isPlaying: false })}
                    playsInline
                    crossOrigin="anonymous"
                />
            )}
        </div>
    );
};
