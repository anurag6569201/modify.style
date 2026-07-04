/**
 * Frame-exact playback clock.
 *
 * `video.currentTime` reports the *decode* position, which runs ahead of the
 * frame actually on screen by up to a frame or two — that skew is what makes
 * the synthetic cursor / zoom / effects visibly trail or lead the video pixels.
 *
 * This module tracks the video element via `requestVideoFrameCallback` (where
 * supported), giving us the exact `mediaTime` of the frame that was just
 * presented. Between callbacks we extrapolate with the wall clock and the
 * playback rate, so every overlay samples the same time the pixels show.
 *
 * All preview layers (cursor, camera, click effects, captions) should read
 * time from here — never from `video.currentTime` directly.
 */

type VideoFrameMeta = { mediaTime: number; presentationTime: number };

class FrameClock {
    private video: HTMLVideoElement | null = null;
    private vfcHandle: number | null = null;
    private lastMediaTime = 0;
    private lastPresentationMs = 0;
    private hasFrameInfo = false;

    /** Attach the preview <video> element. Safe to call repeatedly. */
    attach(video: HTMLVideoElement) {
        if (this.video === video) return;
        this.detach();
        this.video = video;
        this.hasFrameInfo = false;
        this.scheduleFrameCallback();
    }

    detach() {
        if (this.video && this.vfcHandle !== null && 'cancelVideoFrameCallback' in this.video) {
            try {
                (this.video as HTMLVideoElement & {
                    cancelVideoFrameCallback: (h: number) => void;
                }).cancelVideoFrameCallback(this.vfcHandle);
            } catch {
                /* already gone */
            }
        }
        this.vfcHandle = null;
        this.video = null;
        this.hasFrameInfo = false;
    }

    private scheduleFrameCallback() {
        const video = this.video;
        if (!video || !('requestVideoFrameCallback' in video)) return;
        const v = video as HTMLVideoElement & {
            requestVideoFrameCallback: (
                cb: (now: number, meta: VideoFrameMeta) => void
            ) => number;
        };
        this.vfcHandle = v.requestVideoFrameCallback((now, meta) => {
            this.lastMediaTime = meta.mediaTime;
            this.lastPresentationMs = now;
            this.hasFrameInfo = true;
            this.scheduleFrameCallback();
        });
    }

    /**
     * Time (seconds) of the frame currently on screen.
     * Falls back to `video.currentTime` when frame callbacks are unavailable.
     */
    getTime(): number {
        const video = this.video;
        if (!video) return 0;

        if (this.hasFrameInfo) {
            if (video.paused || video.seeking) {
                // While paused/seeking, currentTime is authoritative (frame
                // callbacks stop firing and mediaTime goes stale).
                return this.safeCurrentTime();
            }
            // Extrapolate from the last presented frame.
            const elapsed = (performance.now() - this.lastPresentationMs) / 1000;
            const rate = video.playbackRate || 1;
            const extrapolated = this.lastMediaTime + Math.max(0, elapsed) * rate;
            // Never drift more than ~2 frames from currentTime (handles rate
            // changes, stalls, tab throttling).
            const ct = this.safeCurrentTime();
            const maxSkew = 2 / 30;
            if (Math.abs(extrapolated - ct) > maxSkew) return ct;
            return extrapolated;
        }
        return this.safeCurrentTime();
    }

    /** Whether a video element is attached and reporting time. */
    isAttached(): boolean {
        return this.video !== null;
    }

    private safeCurrentTime(): number {
        const t = this.video?.currentTime ?? 0;
        return isFinite(t) && t >= 0 ? t : 0;
    }
}

export const frameClock = new FrameClock();
