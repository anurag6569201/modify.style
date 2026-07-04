import { useEffect, useRef } from 'react';
import { editorStore } from '@/lib/editor/store';

/**
 * Plays generated voiceover segments in sync with editor playback.
 * Invisible component — mount once inside the editor page.
 *
 * Sync rules:
 * - When the playhead enters a segment window and playback is running,
 *   the segment audio starts at the correct offset.
 * - Seeking re-syncs (audio jumps to offset or stops).
 * - Pause/mute/volume follow the editor playback state.
 */
export function VoiceoverAudioLayer() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentKeyRef = useRef<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const stopAudio = () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
            currentKeyRef.current = null;
        };

        const sync = () => {
            const state = editorStore.getState();
            const { currentTime, isPlaying, isMuted, volume } = state.playback;
            const { scriptSegments, volume: voVolume } = state.voiceover;

            // Find the active segment (audio exists + playhead within its audio window)
            let active: { key: string; url: string | null; blob: Blob | null; offset: number } | null = null;
            for (let i = 0; i < scriptSegments.length; i++) {
                const seg = scriptSegments[i];
                if (!seg.isGenerated || (!seg.audioUrl && !seg.audioBlob)) continue;
                const dur = seg.duration && seg.duration > 0 ? seg.duration : 4;
                if (currentTime >= seg.timestamp && currentTime < seg.timestamp + dur) {
                    active = {
                        key: `${i}-${seg.timestamp}`,
                        url: seg.audioUrl ?? null,
                        blob: seg.audioBlob ?? null,
                        offset: currentTime - seg.timestamp,
                    };
                    break;
                }
            }

            if (!active || !isPlaying) {
                if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
                if (!active) currentKeyRef.current = null;
                return;
            }

            // New segment → load it
            if (currentKeyRef.current !== active.key) {
                stopAudio();
                let src = active.url;
                if (!src && active.blob) {
                    src = URL.createObjectURL(active.blob);
                    objectUrlRef.current = src;
                }
                if (!src) return;
                const audio = new Audio(src);
                audioRef.current = audio;
                currentKeyRef.current = active.key;
                audio.currentTime = Math.max(0, active.offset);
                audio.muted = isMuted;
                audio.volume = Math.max(0, Math.min(1, volume * (voVolume / 100)));
                audio.play().catch(() => {});
                return;
            }

            // Same segment → keep in sync
            const audio = audioRef.current;
            if (!audio) return;
            audio.muted = isMuted;
            audio.volume = Math.max(0, Math.min(1, volume * (voVolume / 100)));
            const drift = Math.abs(audio.currentTime - active.offset);
            if (drift > 0.35) {
                // User scrubbed — re-align
                try {
                    audio.currentTime = Math.max(0, active.offset);
                } catch {
                    /* ignore seek errors */
                }
            }
            if (audio.paused) audio.play().catch(() => {});
        };

        const unsubscribe = editorStore.subscribe(sync);
        sync();
        return () => {
            unsubscribe();
            stopAudio();
        };
    }, []);

    return null;
}
