/**
 * Shared cursor math — used by the editor preview (CursorLayer) and the
 * export renderer (Render.tsx) so what you see is what you ship.
 */
import type { MoveData, ClickData } from '@/pages/Recorder';

export interface CursorPoint {
    x: number; // normalized 0–1
    y: number; // normalized 0–1
}

/** Linear interpolation between recorded move samples at `time`. */
export function interpolateCursor(time: number, moves: MoveData[]): CursorPoint | null {
    if (!moves || moves.length === 0) return null;
    if (time <= moves[0].timestamp) return { x: moves[0].x, y: moves[0].y };
    const last = moves[moves.length - 1];
    if (time >= last.timestamp) return { x: last.x, y: last.y };

    // Binary search for the sample pair surrounding `time`
    let lo = 0;
    let hi = moves.length - 1;
    while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (moves[mid].timestamp <= time) lo = mid;
        else hi = mid;
    }
    const a = moves[lo];
    const b = moves[hi];
    const span = b.timestamp - a.timestamp;
    const t = span > 0 ? (time - a.timestamp) / span : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Smoothed cursor position with ZERO lag: averages interpolated samples over
 * a window centered on `time` (we have the full recording, so future samples
 * are available). A trailing/causal filter would make the cursor drag behind
 * the video — a centered window smooths jitter without any delay.
 * smoothing 0 → raw, 1 → ~240ms centered window.
 */
export function smoothedCursor(time: number, moves: MoveData[], smoothing: number): CursorPoint | null {
    const s = Math.max(0, Math.min(1, smoothing || 0));
    if (s < 0.02) return interpolateCursor(time, moves);
    const window = 0.24 * s;
    const SAMPLES = 7; // odd → one sample lands exactly on `time`
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let i = 0; i < SAMPLES; i++) {
        const offset = ((i / (SAMPLES - 1)) - 0.5) * window; // -w/2 … +w/2
        const p = interpolateCursor(Math.max(0, time + offset), moves);
        if (p) {
            // Triangular weights peaked at the center sample
            const w = 1 - Math.abs(i / (SAMPLES - 1) - 0.5) * 1.6;
            sx += p.x * w;
            sy += p.y * w;
            n += w;
        }
    }
    if (n === 0) return null;
    return { x: sx / n, y: sy / n };
}

/** Trail points behind the cursor (most recent first). */
export function cursorTrail(
    time: number,
    moves: MoveData[],
    length: number,
    smoothing: number
): CursorPoint[] {
    const count = Math.max(0, Math.min(40, Math.round(length)));
    if (count === 0) return [];
    const SPACING = 0.028; // seconds between trail samples
    const points: CursorPoint[] = [];
    for (let i = 1; i <= count; i++) {
        const p = smoothedCursor(Math.max(0, time - i * SPACING), moves, smoothing);
        if (p) points.push(p);
    }
    return points;
}

const PULSE_DURATION = 0.45; // seconds

/** 0→1 progress of the most recent click pulse at `time`, or null. */
export function clickPulseProgress(time: number, clicks: ClickData[]): number | null {
    let best: number | null = null;
    for (const click of clicks) {
        const dt = time - click.timestamp;
        if (dt >= 0 && dt <= PULSE_DURATION) {
            const p = dt / PULSE_DURATION;
            if (best === null || p < best) best = p;
        }
    }
    return best;
}
