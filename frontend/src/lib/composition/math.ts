import { ClickData, MoveData } from "../../pages/Recorder";
import { Move } from "lucide-react";

// Linear interpolation
export const lerp = (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
};

// Cubic ease-out for smooth natural motion
// ease(p) = 1 - (1 - p)^3
export const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
};

// Cubic ease-in-out for pan
export const easeInOutCubic = (t: number): number => {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

// Clamp a value between min and max
export const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};

// Get interpolated cursor position at a specific time
export const getCursorPos = (
    time: number,
    events: (ClickData | MoveData)[]
): { x: number; y: number } | null => {
    if (!events || events.length === 0) return null;

    // Sort events by timestamp just in case
    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    // Find surrounding events
    let prevEvent: ClickData | MoveData | null = null;
    let nextEvent: ClickData | MoveData | null = null;

    for (const event of sortedEvents) {
        if (event.timestamp <= time) {
            prevEvent = event;
        } else {
            nextEvent = event;
            break;
        }
    }

    // Exact match or past last event
    if (!nextEvent) {
        return prevEvent ? { x: prevEvent.x, y: prevEvent.y } : null;
    }

    // Before first event
    if (!prevEvent) {
        return { x: nextEvent.x, y: nextEvent.y };
    }

    // Interpolate between prev and next
    const duration = nextEvent.timestamp - prevEvent.timestamp;
    if (duration <= 0) return { x: nextEvent.x, y: nextEvent.y };

    const elapsed = time - prevEvent.timestamp;
    const progress = Math.min(1, Math.max(0, elapsed / duration));

    // Use cubic easing for smoother cursor starts/stops
    const easedProgress = easeOutCubic(progress);

    return {
        x: lerp(prevEvent.x, nextEvent.x, easedProgress),
        y: lerp(prevEvent.y, nextEvent.y, easedProgress),
    };
};

/**
 * Calculate cursor velocity in pixels/second (normalized units/second)
 * Returns 0 if cannot determine
 */
export const getCursorVelocity = (
    time: number,
    events: (ClickData | MoveData)[]
): number => {
    // Look briefly fast-forward and backward to estimate speed
    const dt = 0.05; // 50ms window
    const p1 = getCursorPos(time - dt, events);
    const p2 = getCursorPos(time + dt, events);

    if (!p1 || !p2) return 0;

    // Distance in normalized units
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Speed = distance / time (2 * dt)
    return dist / (2 * dt);
};

// Calculate camera follow strength based on padding zones
export const paddedFollow = (d: number, inner: number, outer: number): number => {
    const abs = Math.abs(d);
    if (abs < inner) return 0;

    const excess = Math.min(abs - inner, outer - inner);
    const strength = excess / (outer - inner); // 0 -> 1

    return Math.sign(d) * strength * excess;
};
