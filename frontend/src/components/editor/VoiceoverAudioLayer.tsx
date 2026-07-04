import { useEffect, useRef } from 'react';
import { editorStore } from '@/lib/editor/store';

/**
 * Plays generated voiceover segments in sync with editor playback.
 * Invisible component — mount once inside the editor page.
 *
 * Accuracy notes:
 * - Audio elements are created and preloaded AHEAD of time (one per generated
 *   segment), so a segment starts the instant the playhead enters it instead
 *   of paying decode/network latency at the boundary.
 * - Drift is corrected at ±0.12s (was 0.35s) and playbackRate follows the
 *   editor speed control, so narration stays glued to the video.
 */
export function VoiceoverAudioLayer() {
    // Pool of preloaded audio elements, keyed by segment identity.
    const poolRef = useRef<Map<string, { audio: HTMLAudioElement; objectUrl: string | null }>>(new Map());
    const activeKeyRef = useRef<string | null>(null);

    useEffect(() => {
        const pool = poolRef.current;

        // Key includes the audio source so regenerating a segment's voice
        // invalidates the preloaded element instead of replaying stale audio.
        const keyFor = (
            seg: { id?: string; timestamp: number; audioUrl?: string | null; audioBlob?: Blob | null },
            i: number
        ) => `${seg.id ?? i}::${seg.audioUrl ?? (seg.audioBlob ? `blob-${seg.audioBlob.size}` : 'none')}`;

        const releaseEntry = (key: string) => {
            const entry = pool.get(key);
            if (!entry) return;
            entry.audio.pause();
            entry.audio.src = '';
            if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
            pool.delete(key);
        };

        /** Ensure a preloaded element exists for a generated segment. */
        const ensureLoaded = (
            seg: { id?: string; audioUrl?: string | null; audioBlob?: Blob | null; timestamp: number },
            i: number
        ) => {
            const key = keyFor(seg, i);
            if (pool.has(key)) return pool.get(key)!;
            let objectUrl: string | null = null;
            let src = seg.audioUrl ?? null;
            if (!src && seg.audioBlob) {
                objectUrl = URL.createObjectURL(seg.audioBlob);
                src = objectUrl;
            }
            if (!src) return null;
            const audio = new Audio(src);
            audio.preload = 'auto';
            const entry = { audio, objectUrl };
            pool.set(key, entry);
            return entry;
        };

        const sync = () => {
            const state = editorStore.getState();
            const { currentTime, isPlaying, isMuted, volume, playbackRate } = state.playback;
            const { scriptSegments, volume: voVolume } = state.voiceover;
            const rate = isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;

            // Preload: current + anything starting within the next 8 seconds.
            let active: { key: string; offset: number; entry: { audio: HTMLAudioElement } } | null = null;
            const validKeys = new Set<string>();
            for (let i = 0; i < scriptSegments.length; i++) {
                const seg = scriptSegments[i];
                if (!seg.isGenerated || (!seg.audioUrl && !seg.audioBlob)) continue;
                const key = keyFor(seg, i);
                validKeys.add(key);
                const dur = seg.duration && seg.duration > 0 ? seg.duration : 4;
                const startsSoon = seg.timestamp - currentTime >= 0 && seg.timestamp - currentTime < 8;
                const isActive = currentTime >= seg.timestamp && currentTime < seg.timestamp + dur;
                if (isActive || startsSoon) {
                    const entry = ensureLoaded(seg, i);
                    if (entry && isActive && !active) {
                        active = { key, offset: currentTime - seg.timestamp, entry };
                    }
                }
            }
            // Drop pool entries whose segments were deleted/regenerated.
            for (const key of Array.from(pool.keys())) {
                if (!validKeys.has(key)) releaseEntry(key);
            }

            // Pause everything that shouldn't be sounding.
            for (const [key, entry] of pool) {
                if ((!active || key !== active.key || !isPlaying) && !entry.audio.paused) {
                    entry.audio.pause();
                }
            }

            if (!active) {
                activeKeyRef.current = null;
                return;
            }

            const audio = active.entry.audio;
            audio.muted = isMuted;
            audio.volume = Math.max(0, Math.min(1, volume * (voVolume / 100)));
            if (audio.playbackRate !== rate) audio.playbackRate = rate;

            if (!isPlaying) {
                // Paused/scrubbing — park the audio at the exact offset so
                // resuming is sample-accurate.
                if (!audio.paused) audio.pause();
                if (Math.abs(audio.currentTime - active.offset) > 0.05) {
                    try {
                        audio.currentTime = Math.max(0, active.offset);
                    } catch { /* not seekable yet */ }
                }
                activeKeyRef.current = active.key;
                return;
            }

            const isNew = activeKeyRef.current !== active.key;
            const drift = Math.abs(audio.currentTime - active.offset);
            if (isNew || drift > 0.12) {
                try {
                    audio.currentTime = Math.max(0, active.offset);
                } catch { /* not seekable yet */ }
            }
            activeKeyRef.current = active.key;
            if (audio.paused) audio.play().catch(() => {});
        };

        const unsubscribe = editorStore.subscribe(sync);
        sync();
        return () => {
            unsubscribe();
            for (const key of Array.from(pool.keys())) releaseEntry(key);
            activeKeyRef.current = null;
        };
    }, []);

    return null;
}
