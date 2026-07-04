import { useEffect, useRef } from 'react';
import { editorStore } from '@/lib/editor/store';

/**
 * Background music in the editor preview — plays in sync with playback,
 * loops if configured, fades in/out, and auto-ducks under voiceover segments.
 * Invisible component; mount once in the editor page.
 */
export function MusicAudioLayer() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const urlRef = useRef<string | null>(null);
    const objectUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const stop = () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
            urlRef.current = null;
        };

        const sync = () => {
            const state = editorStore.getState();
            const { music, playback, voiceover, video } = state;

            if (!music.enabled || (!music.url && !music.blob)) {
                if (audioRef.current) stop();
                return;
            }

            // (Re)load when the source changes
            const desired = music.url ?? 'blob-src';
            if (urlRef.current !== desired) {
                stop();
                let src = music.url;
                if (!src && music.blob) {
                    src = URL.createObjectURL(music.blob);
                    objectUrlRef.current = src;
                }
                if (!src) return;
                const audio = new Audio(src);
                audio.loop = music.loop;
                audioRef.current = audio;
                urlRef.current = desired;
            }

            const audio = audioRef.current;
            if (!audio) return;
            audio.loop = music.loop;

            // Follow the editor speed control so music stays in sync
            const rate = isFinite(playback.playbackRate) && playback.playbackRate > 0 ? playback.playbackRate : 1;
            if (audio.playbackRate !== rate) audio.playbackRate = rate;

            if (!playback.isPlaying) {
                if (!audio.paused) audio.pause();
                return;
            }

            // Position sync (handles seeks); with loop, wrap into track length
            const t = playback.currentTime;
            if (isFinite(audio.duration) && audio.duration > 0) {
                const target = music.loop ? t % audio.duration : Math.min(t, audio.duration);
                if (Math.abs(audio.currentTime - target) > 0.4) {
                    try {
                        audio.currentTime = target;
                    } catch { /* ignore */ }
                }
            }

            // ---- Volume: base × fades × ducking × master ----
            let vol = (music.volume ?? 30) / 100;

            // Fade in/out against the video duration
            const dur = video.duration || 0;
            if (music.fadeIn > 0 && t < music.fadeIn) vol *= Math.max(0, t / music.fadeIn);
            if (dur > 0 && music.fadeOut > 0 && t > dur - music.fadeOut) {
                vol *= Math.max(0, (dur - t) / music.fadeOut);
            }

            // Duck under narration
            const narrating = voiceover.scriptSegments.some((seg) => {
                if (!seg.isGenerated || (!seg.audioUrl && !seg.audioBlob)) return false;
                const d = seg.duration && seg.duration > 0 ? seg.duration : 4;
                return t >= seg.timestamp - 0.15 && t < seg.timestamp + d + 0.25;
            });
            if (narrating) vol *= 1 - (music.ducking ?? 70) / 100;

            audio.muted = playback.isMuted;
            audio.volume = Math.max(0, Math.min(1, vol * playback.volume));
            if (audio.paused) audio.play().catch(() => {});
        };

        const unsubscribe = editorStore.subscribe(sync);
        sync();
        return () => {
            unsubscribe();
            stop();
        };
    }, []);

    return null;
}
