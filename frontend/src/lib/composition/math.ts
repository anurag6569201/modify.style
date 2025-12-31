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

// Smoothstep interpolation
export const smoothstep = (min: number, max: number, value: number): number => {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
};

// Cache for sorted events to avoid re-sorting
let cachedEvents: (ClickData | MoveData)[] | null = null;
let cachedSortedEvents: (ClickData | MoveData)[] | null = null;

// Get interpolated cursor position at a specific time (OPTIMIZED)
export const getCursorPos = (
    time: number,
    events: (ClickData | MoveData)[]
): { x: number; y: number } | null => {
    if (!events || events.length === 0) return null;

    // Use cached sorted events if events array hasn't changed
    let sortedEvents: (ClickData | MoveData)[];
    if (events === cachedEvents && cachedSortedEvents) {
        sortedEvents = cachedSortedEvents;
    } else {
        // Only sort if events array changed
        sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
        cachedEvents = events;
        cachedSortedEvents = sortedEvents;
    }

    // Binary search optimization for large arrays (fallback to linear for small arrays)
    let prevEvent: ClickData | MoveData | null = null;
    let nextEvent: ClickData | MoveData | null = null;

    if (sortedEvents.length > 50) {
        // Binary search for large arrays
        let left = 0;
        let right = sortedEvents.length - 1;
        let mid = 0;

        while (left <= right) {
            mid = Math.floor((left + right) / 2);
            if (sortedEvents[mid].timestamp <= time) {
                prevEvent = sortedEvents[mid];
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        if (mid + 1 < sortedEvents.length) {
            nextEvent = sortedEvents[mid + 1];
        }
    } else {
        // Linear search for small arrays (faster for small datasets)
        for (const event of sortedEvents) {
            if (event.timestamp <= time) {
                prevEvent = event;
            } else {
                nextEvent = event;
                break;
            }
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

    // Linear interpolation for raw input feel
    // const easedProgress = easeOutCubic(progress);

    return {
        x: lerp(prevEvent.x, nextEvent.x, progress),
        y: lerp(prevEvent.y, nextEvent.y, progress),
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

    // Soft boundary using smoothstep
    // strength goes from 0 to 1 as we go from inner to outer
    const strength = smoothstep(inner, outer, abs);

    // Return the "excess" purely for direction/magnitude scaling, 
    // but the *feel* comes from the strength curve being smooth.
    // Actually, user said: strength = smoothstep(inner, outer, abs(distance));
    // And applied it to the boundary response.

    // We render the "force" or "shift" as:
    const excess = abs - inner;
    return Math.sign(d) * strength * excess;
};

/**
 * Calculate cursor velocity vector in component normalized units/second
 * Returns {x: 0, y: 0} if cannot determine
 */
export const getCursorVelocityVector = (
    time: number,
    events: (ClickData | MoveData)[]
): { x: number; y: number } => {
    // Look briefly fast-forward and backward to estimate speed
    const dt = 0.05; // 50ms window
    const p1 = getCursorPos(time - dt, events);
    const p2 = getCursorPos(time + dt, events);

    if (!p1 || !p2) return { x: 0, y: 0 };

    // Distance in normalized units
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    // Velocity components
    return {
        x: dx / (2 * dt),
        y: dy / (2 * dt)
    };
};

/**
 * Filter out micro-movements (jitter) from a sequence of moves
 * @param moves List of MoveData
 * @param threshold Normalized distance threshold (e.g. 0.005 for 0.5%)
 */
export const cleanJitter = (
    moves: MoveData[],
    threshold: number = 0.005
): MoveData[] => {
    if (moves.length < 2) return moves;

    const result: MoveData[] = [moves[0]];
    let lastValid = moves[0];

    for (let i = 1; i < moves.length; i++) {
        const current = moves[i];
        const dx = current.x - lastValid.x;
        const dy = current.y - lastValid.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // If moved enough, keep it
        if (dist >= threshold) {
            result.push(current);
            lastValid = current;
        } else {
            // Check if significant time passed (e.g. not jitter, but slow drift or stop)
            // If time diff > 0.5s, maybe we SHOULD update to show we stopped here?
            // For now, simple distance filter as requested.
        }
    }

    // Always keep the last one to ensure we end up at the right place
    if (result[result.length - 1] !== moves[moves.length - 1]) {
        result.push(moves[moves.length - 1]);
    }

    return result;
};

/**
 * Critically Damped Spring Solver
 * @param current Current value
 * @param target Target value
 * @param velocity Current velocity
 * @param stiffness Spring stiffness (k). Higher = faster/tighter. Good range: 100-200.
 * @param damping Damping ratio (zeta). 1 = critically damped (no overshoot). <1 = bouncy. >1 = sluggish.
 * @param mass Mass (m). Usually 1.
 * @param dt Delta time in seconds.
 */
export const solveSpring = (
    current: number,
    target: number,
    velocity: number,
    stiffness: number,
    damping: number,
    mass: number,
    dt: number
): { value: number; velocity: number } => {
    // Force method (Semi-Implicit Euler for stability)
    // F_spring = -k * (x - target)
    // F_damp = -c * v
    // c = damping * 2 * sqrt(k * m)

    // Safety clamp for dt to prevent explosion
    const safeDt = Math.min(dt, 0.1);

    const displacement = current - target;
    const springForce = -stiffness * displacement;

    // Calculate critical damping coefficient
    const criticalDamping = 2 * Math.sqrt(stiffness * mass);
    const dampingForce = -damping * criticalDamping * velocity;

    const acceleration = (springForce + dampingForce) / mass;
    const newVelocity = velocity + acceleration * safeDt;
    const newValue = current + newVelocity * safeDt;

    return { value: newValue, velocity: newVelocity };
};

