import { ClickData, MoveData } from "../../pages/Recorder";

// ===== INTERPOLATION & EASING =====

// Linear interpolation
export const lerp = (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
};

// Cubic ease-out for smooth natural motion
export const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
};

// Cubic ease-in for smooth acceleration
export const easeInCubic = (t: number): number => {
    return t * t * t;
};

// Cubic ease-in-out for balanced motion
export const easeInOutCubic = (t: number): number => {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

// Quartic ease-out for extra smooth deceleration
export const easeOutQuart = (t: number): number => {
    return 1 - Math.pow(1 - t, 4);
};

// Quintic ease-out for ultra smooth motion (best for camera)
export const easeOutQuint = (t: number): number => {
    return 1 - Math.pow(1 - t, 5);
};

// Exponential ease-out for natural decay
export const easeOutExpo = (t: number): number => {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

// Sine ease-in-out for gentle, organic motion
export const easeInOutSine = (t: number): number => {
    return -(Math.cos(Math.PI * t) - 1) / 2;
};

// Clamp a value between min and max
export const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};

// Smoothstep interpolation (Hermite interpolation)
export const smoothstep = (min: number, max: number, value: number): number => {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
};

// Smoother step (Ken Perlin's improved version)
export const smootherStep = (min: number, max: number, value: number): number => {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * x * (x * (x * 6 - 15) + 10);
};

// Interpolate with optional easing
export const interpolate = (
    a: number,
    b: number,
    t: number,
    ease: (x: number) => number = (x) => x
): number => a + (b - a) * ease(t);

// Clamp vector magnitude
export const clampVec = (v: number, max = 5): number =>
    Math.sign(v) * Math.min(Math.abs(v), max);

// Remap value from one range to another
export const remap = (
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number
): number => {
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
};

// ===== CURSOR POSITION TRACKING =====

// Cache for sorted events to avoid re-sorting
let cachedEvents: (ClickData | MoveData)[] | null = null;
let cachedSortedEvents: (ClickData | MoveData)[] | null = null;

/**
 * Get interpolated cursor position at a specific time (OPTIMIZED)
 * Uses quintic easing for ultra-smooth camera-friendly motion
 */
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
        sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
        cachedEvents = events;
        cachedSortedEvents = sortedEvents;
    }

    let prevEvent: ClickData | MoveData | null = null;
    let nextEvent: ClickData | MoveData | null = null;

    // Binary search for large arrays, linear for small
    if (sortedEvents.length > 50) {
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
            nextEvent = sortedEvents[0];
        }
    } else {
        for (const event of sortedEvents) {
            if (event.timestamp <= time) {
                prevEvent = event;
            } else {
                nextEvent = event;
                break;
            }
        }
    }

    // Handle edge cases
    if (!nextEvent) {
        return prevEvent ? { x: prevEvent.x, y: prevEvent.y } : null;
    }

    if (!prevEvent) {
        return { x: nextEvent.x, y: nextEvent.y };
    }

    // Interpolate with ultra-smooth quintic easing
    const duration = nextEvent.timestamp - prevEvent.timestamp;
    if (duration <= 0) return { x: nextEvent.x, y: nextEvent.y };

    const elapsed = time - prevEvent.timestamp;
    const progress = clamp(elapsed / duration, 0, 1);

    // Use quintic easing for maximum smoothness
    const eased = easeOutQuint(progress);

    return {
        x: interpolate(prevEvent.x, nextEvent.x, eased),
        y: interpolate(prevEvent.y, nextEvent.y, eased),
    };
};

/**
 * Calculate cursor velocity in normalized units/second
 * Returns 0 if cannot determine. Stable version with smoothing.
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
    const distance = Math.hypot(dx, dy);

    return distance / (2 * window);
};

/**
 * Calculate cursor velocity vector in normalized units/second
 * Returns {x: 0, y: 0} if cannot determine. 
 * Enhanced with adaptive window and clamping.
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

    const timeWindow = 2 * dt;

    // Clamp to prevent velocity spikes
    return {
        x: clampVec(dx / timeWindow, 10),
        y: clampVec(dy / timeWindow, 10),
    };
};

/**
 * Get smoothed cursor velocity using multiple samples
 * More stable for camera systems
 */
export const getSmoothedCursorVelocity = (
    time: number,
    events: (ClickData | MoveData)[],
    samples: number = 3
): { x: number; y: number } => {
    const velocities: { x: number; y: number }[] = [];
    const baseWindow = 0.04;

    for (let i = 0; i < samples; i++) {
        const offset = (i - samples / 2) * baseWindow;
        const vel = getCursorVelocityVector(time + offset, events, baseWindow);
        velocities.push(vel);
    }

    // Average the samples
    const avgX = velocities.reduce((sum, v) => sum + v.x, 0) / samples;
    const avgY = velocities.reduce((sum, v) => sum + v.y, 0) / samples;

    return { x: avgX, y: avgY };
};

// ===== SPRING PHYSICS SYSTEM =====

/**
 * Critically Damped Spring Solver (Enhanced)
 * Perfect for smooth, natural camera motion without overshoot
 * 
 * @param current Current value
 * @param target Target value
 * @param velocity Current velocity
 * @param stiffness Spring stiffness (k). Higher = faster. Range: 5-200.
 * @param damping Damping ratio (zeta). 1 = critical (no overshoot), <1 = bouncy, >1 = sluggish
 * @param mass Mass (m). Usually 1. Higher = more inertia.
 * @param dt Delta time in seconds
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

    // Early exit if already at target with no velocity
    const displacement = current - target;
    if (Math.abs(displacement) < 0.0001 && Math.abs(velocity) < 0.0001) {
        return { value: target, velocity: 0 };
    }

    // Calculate forces
    const springForce = -stiffness * displacement;

    // Calculate damping coefficient based on ratio (zeta)
    const criticalDamping = 2 * Math.sqrt(stiffness * mass);
    const dampingCoefficient = damping * criticalDamping;
    const dampingForce = -dampingCoefficient * velocity;

    // Apply forces
    const acceleration = (springForce + dampingForce) / mass;
    const newVelocity = velocity + acceleration * safeDt;
    const newValue = current + newVelocity * safeDt;

    return { value: newValue, velocity: newVelocity };
};

/**
 * Preset: Critically damped spring (no overshoot)
 */
export const springCritical = (
    current: number,
    target: number,
    velocity: number,
    k: number,
    dt: number
): { value: number; velocity: number } =>
    solveSpring(current, target, velocity, k, 1.0, 1.0, dt);

/**
 * Preset: Bouncy spring (slight overshoot for playful feel)
 */
export const springBouncy = (
    current: number,
    target: number,
    velocity: number,
    k: number,
    dt: number
): { value: number; velocity: number } =>
    solveSpring(current, target, velocity, k, 0.7, 1.0, dt);

/**
 * Preset: Smooth spring (overdamped, very gentle)
 */
export const springSmooth = (
    current: number,
    target: number,
    velocity: number,
    k: number,
    dt: number
): { value: number; velocity: number } =>
    solveSpring(current, target, velocity, k, 1.2, 1.0, dt);

// ===== PADDING & FOLLOW LOGIC =====

/**
 * Calculate camera follow strength based on padding zones
 * Returns normalized force [-1, 1]
 */
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
 * Enhanced padded follow with configurable easing
 */
export const paddedFollowCustom = (
    d: number,
    inner: number,
    outer: number,
    ease: (t: number) => number = easeInOutCubic
): number => {
    const abs = Math.abs(d);
    if (abs <= inner) return 0;
    if (abs >= outer) return Math.sign(d);

    const t = (abs - inner) / (outer - inner);
    return Math.sign(d) * ease(t);
};

// ===== JITTER FILTERING =====

/**
 * Filter out micro-movements (jitter) from a sequence of moves
 * Time + Distance aware with adaptive thresholds
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

        // Keep if moved enough OR if significant time passed
        if (dist >= distThreshold || timeDiff > timeThresholdMs) {
            result.push(current);
            lastValid = current;
        }
    }

    // Always keep the last one
    if (result[result.length - 1] !== moves[moves.length - 1]) {
        result.push(moves[moves.length - 1]);
    }

    return result;
};

/**
 * Advanced jitter cleaning with velocity consideration
 */
export const cleanJitterAdvanced = (
    moves: MoveData[],
    distThreshold: number = 0.005,
    timeThresholdMs: number = 300,
    velocityThreshold: number = 0.1
): MoveData[] => {
    if (moves.length < 3) return moves;

    const result: MoveData[] = [moves[0]];
    let lastValid = moves[0];

    for (let i = 1; i < moves.length; i++) {
        const current = moves[i];
        const dx = current.x - lastValid.x;
        const dy = current.y - lastValid.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const timeDiff = (current.timestamp - lastValid.timestamp) * 1000;

        // Calculate velocity
        const velocity = timeDiff > 0 ? (dist / timeDiff) * 1000 : 0;

        // Keep if: moved enough, time passed, or moving fast (intentional movement)
        if (dist >= distThreshold || timeDiff > timeThresholdMs || velocity > velocityThreshold) {
            result.push(current);
            lastValid = current;
        }
    }

    if (result[result.length - 1] !== moves[moves.length - 1]) {
        result.push(moves[moves.length - 1]);
    }

    return result;
};

// ===== EXACT CURSOR POSITIONING =====

// Cache for exact cursor position calculation
let exactCachedEvents: (ClickData | MoveData)[] | null = null;
let exactCachedSortedEvents: (ClickData | MoveData)[] | null = null;

/**
 * Get exact cursor position using pure linear interpolation
 * Time-locked to video.currentTime, no easing, no smoothing
 * Perfect for UI overlays that need frame-perfect accuracy
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

    // Binary search
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

    // Pure linear interpolation
    const duration = nextEvent.timestamp - prevEvent.timestamp;
    if (duration <= 0) {
        return { x: nextEvent.x, y: nextEvent.y };
    }

    const progress = clamp((time - prevEvent.timestamp) / duration, 0, 1);
    const x = lerp(prevEvent.x, nextEvent.x, progress);
    const y = lerp(prevEvent.y, nextEvent.y, progress);

    return { x, y };
};

// ===== EVENT TRIGGERING =====

/**
 * Check if click event should trigger at current playback time
 * Triggers when abs(event.timestamp - playbackTime) < 1/60
 */
export const shouldTriggerClickEffect = (
    event: ClickData,
    playbackTime: number,
    tolerance: number = 1 / 60
): boolean => {
    return Math.abs(event.timestamp - playbackTime) < tolerance;
};

// ===== CURSOR OVERLAY RENDERING =====

/**
 * Render cursor overlay using requestAnimationFrame + translate3d
 * Applies one-frame lookahead (1/60s) to compensate for video decoding latency
 * Hardware-accelerated for 60fps performance
 */
export const renderCursorOverlay = (
    video: HTMLVideoElement,
    events: (ClickData | MoveData)[],
    cursorElement: HTMLElement,
    onFrame?: (pos: { x: number; y: number } | null) => void
): (() => void) => {
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

                // Use translate3d for hardware acceleration
                cursorElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            }
        }

        if (onFrame) {
            onFrame(pos);
        }

        animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    // Return cleanup function
    return () => {
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
        }
    };
};

// ===== VECTOR MATH UTILITIES =====

/**
 * Calculate distance between two points
 */
export const distance = (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Normalize a vector to unit length
 */
export const normalize = (
    v: { x: number; y: number }
): { x: number; y: number } => {
    const mag = Math.sqrt(v.x * v.x + v.y * v.y);
    if (mag === 0) return { x: 0, y: 0 };
    return { x: v.x / mag, y: v.y / mag };
};

/**
 * Calculate dot product of two vectors
 */
export const dot = (
    v1: { x: number; y: number },
    v2: { x: number; y: number }
): number => {
    return v1.x * v2.x + v1.y * v2.y;
};

/**
 * Linear interpolation between two 2D points
 */
export const lerpVec = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    t: number
): { x: number; y: number } => {
    return {
        x: lerp(p1.x, p2.x, t),
        y: lerp(p1.y, p2.y, t),
    };
};