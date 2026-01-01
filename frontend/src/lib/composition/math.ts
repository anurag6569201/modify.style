import { ClickData, MoveData } from "../../pages/Recorder";

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

// Interpolate with optional easing
export const interpolate = (
    a: number,
    b: number,
    t: number,
    ease: (x: number) => number = (x) => x
) => a + (b - a) * ease(t);

// Clamp vector magnitude
export const clampVec = (v: number, max = 5) =>
    Math.sign(v) * Math.min(Math.abs(v), max);

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
        let idx = -1;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (sortedEvents[mid].timestamp <= time) {
                // Potential prev, try to find a later one
                idx = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        if (idx !== -1) {
            prevEvent = sortedEvents[idx];
            nextEvent = sortedEvents[idx + 1] ?? null;
        } else {
            // Time is before the first event or not found suitably (should catch first event if time < first)
            // If idx is -1, it means all timestamps > time (time is BEFORE everything)
            // So prevEvent is null, nextEvent is sortedEvents[0]
            nextEvent = sortedEvents[0];
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

    const eased = easeOutCubic(progress);

    // Using interpolate helper now
    return {
        x: interpolate(prevEvent.x, nextEvent.x, eased),
        y: interpolate(prevEvent.y, nextEvent.y, eased),
    };
};

/**
 * Calculate cursor velocity in pixels/second (normalized units/second)
 * Returns 0 if cannot determine. Stable version.
 */
export const getCursorVelocity = (
    time: number,
    events: (ClickData | MoveData)[],
    window: number = 0.08
): number => {
    const p1 = getCursorPos(time - window, events);
    const p2 = getCursorPos(time + window, events);
    if (!p1 || !p2) return 0;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.hypot(dx, dy) / (2 * window);
};

// Calculate camera follow strength based on padding zones - NORMALIZED FORCE
export const paddedFollow = (
    d: number,
    inner: number,
    outer: number
): number => {
    const abs = Math.abs(d);
    if (abs <= inner) return 0;

    const t = clamp((abs - inner) / (outer - inner), 0, 1);
    return Math.sign(d) * easeInOutCubic(t);
};

/**
 * Calculate cursor velocity vector in component normalized units/second
 * Returns {x: 0, y: 0} if cannot determine. Clamped.
 */
export const getCursorVelocityVector = (
    time: number,
    events: (ClickData | MoveData)[],
    dt: number = 0.05
): { x: number; y: number } => {
    const p1 = getCursorPos(time - dt, events);
    const p2 = getCursorPos(time + dt, events);

    if (!p1 || !p2) return { x: 0, y: 0 };

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    // Use clampVec to prevent spikes
    return {
        x: clampVec(dx / (2 * dt)),
        y: clampVec(dy / (2 * dt)),
    };
};

/**
 * Filter out micro-movements (jitter) from a sequence of moves
 * Time + Distance aware.
 */
export const cleanJitter = (
    moves: MoveData[],
    distThreshold: number = 0.005,
    timeThresholdMs: number = 300
): MoveData[] => {
    if (moves.length < 2) return moves;

    const result: MoveData[] = [moves[0]];
    let lastValid = moves[0];

    for (let i = 1; i < moves.length; i++) {
        const current = moves[i];
        const dx = current.x - lastValid.x;
        const dy = current.y - lastValid.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const timeDiff = (current.timestamp - lastValid.timestamp) * 1000;

        // Keep if moved enough OR if significant time passed (intentional stop/slow move)
        if (dist >= distThreshold || timeDiff > timeThresholdMs) {
            result.push(current);
            lastValid = current;
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
    // Safety clamp for dt to prevent explosion
    const safeDt = Math.min(dt, 0.1);

    const displacement = current - target;
    const springForce = -stiffness * displacement;

    // Calculate damping coefficient based on ratio (zeta)
    // critical damping c = 2 * sqrt(k * m)
    const criticalDamping = 2 * Math.sqrt(stiffness * mass);
    const c = damping * criticalDamping;
    const dampingForce = -c * velocity;

    const acceleration = (springForce + dampingForce) / mass;
    const newVelocity = velocity + acceleration * safeDt;
    const newValue = current + newVelocity * safeDt;

    return { value: newValue, velocity: newVelocity };
};

// Preset for critical damping
export const springCritical = (
    current: number,
    target: number,
    velocity: number,
    k: number, // Stiffness (e.g., 120)
    dt: number
) => solveSpring(current, target, velocity, k, 1.0, 1.0, dt);

// Cache for exact cursor position calculation
let exactCachedEvents: (ClickData | MoveData)[] | null = null;
let exactCachedSortedEvents: (ClickData | MoveData)[] | null = null;

/**
 * Get exact cursor position using pure linear interpolation
 * Time-locked to video.currentTime, no easing, no smoothing
 */
export const getExactCursorPos = (
    time: number,
    events: (ClickData | MoveData)[]
): { x: number; y: number } | null => {
    if (!events || events.length === 0) return null;

    let sortedEvents: (ClickData | MoveData)[];
    if (events === exactCachedEvents && exactCachedSortedEvents) {
        sortedEvents = exactCachedSortedEvents;
    } else {
        sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
        exactCachedEvents = events;
        exactCachedSortedEvents = sortedEvents;
    }

    let prevEvent: ClickData | MoveData | null = null;
    let nextEvent: ClickData | MoveData | null = null;

    let left = 0;
    let right = sortedEvents.length - 1;
    let idx = -1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (sortedEvents[mid].timestamp <= time) {
            idx = mid;
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    if (idx !== -1) {
        prevEvent = sortedEvents[idx];
        nextEvent = sortedEvents[idx + 1] ?? null;
    } else {
        nextEvent = sortedEvents[0] ?? null;
    }

    if (!nextEvent) {
        return prevEvent ? { x: prevEvent.x, y: prevEvent.y } : null;
    }

    if (!prevEvent) {
        return { x: nextEvent.x, y: nextEvent.y };
    }

    const duration = nextEvent.timestamp - prevEvent.timestamp;
    if (duration <= 0) {
        return { x: nextEvent.x, y: nextEvent.y };
    }

    const progress = clamp((time - prevEvent.timestamp) / duration, 0, 1);
    const x = lerp(prevEvent.x, nextEvent.x, progress);
    const y = lerp(prevEvent.y, nextEvent.y, progress);

    return { x, y };
};

/**
 * Check if click event should trigger at current playback time
 * Triggers when abs(event.timestamp - playbackTime) < 1/60
 */
export const shouldTriggerClickEffect = (
    event: ClickData,
    playbackTime: number
): boolean => {
    return Math.abs(event.timestamp - playbackTime) < 1 / 60;
};

/**
 * Render cursor overlay using requestAnimationFrame + translate3d
 * Applies one-frame lookahead (1/60s) to compensate for video decoding latency
 */
export const renderCursorOverlay = (
    video: HTMLVideoElement,
    events: (ClickData | MoveData)[],
    cursorElement: HTMLElement,
    onFrame?: (pos: { x: number; y: number } | null) => void
): () => void => {
    let animationFrameId: number | null = null;
    const FRAME_LOOKAHEAD = 1 / 60;

    const render = () => {
        const playbackTime = video.currentTime;
        const lookaheadTime = playbackTime + FRAME_LOOKAHEAD;
        
        const pos = getExactCursorPos(lookaheadTime, events);
        
        if (pos && cursorElement) {
            const rect = cursorElement.parentElement?.getBoundingClientRect();
            if (rect) {
                const x = pos.x * rect.width;
                const y = pos.y * rect.height;
                cursorElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            }
        }
        
        if (onFrame) {
            onFrame(pos);
        }
        
        animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
        }
    };
};

