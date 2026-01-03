import { ClickData, MoveData, EffectEvent } from "../../pages/Recorder";
import { getCursorPos, solveSpring, getCursorVelocity, getCursorVelocityVector } from "./math";

// Camera mode enum
export enum CameraMode {
    IDLE = "IDLE",
    SPOTLIGHT = "SPOTLIGHT",
    SETTLING = "SETTLING",
}

export interface CameraState {
    scale: number;
    translateX: number;
    translateY: number;
    rotation?: number;
    vignette?: number;
}

export interface CameraSystemState {
    mode: CameraMode;
    transform: CameraState;
    targetTransform: CameraState;
    activeEvent: ClickData | null;
    focusStartTime: number;
    startTargetTransform: CameraState;
    currentZoom: number;
    blur: number;
    spotlight: boolean;
    velocity: {
        scale: number;
        translateX: number;
        translateY: number;
        rotation: number;
    };
    lastClickTime: number;
    clickHistory: Array<{ timestamp: number; x: number; y: number }>;
    activityLevel: number;
    focusPoint: { x: number; y: number } | null;
    // Enhanced smoothing state
    smoothedCursorPos: { x: number; y: number } | null;
    cursorVelocitySmoothed: { x: number; y: number };
    lastSpotlightState: boolean;
    transitionStartTime: number;
}

export interface Viewport {
    width: number;
    height: number;
}

// 🎬 ENHANCED SPOTLIGHT CAMERA CONFIGURATION
const CAMERA_CONFIG = {
    // Zoom levels - more subtle for professional feel
    ZOOM_IDLE: 1.0,
    ZOOM_SPOTLIGHT: 1.35, // Slightly reduced for less aggressive zoom

    // Spotlight Logic
    SPOTLIGHT_TRIGGER_WINDOW: 3.0,
    SPOTLIGHT_DURATION: 5.0,
    SPOTLIGHT_ANTICIPATION: 0.15, // Slightly more anticipation for smoother start

    // Enhanced Physics - smoother, more natural motion
    ZOOM_STIFFNESS: 8.0, // Reduced for smoother zoom
    ZOOM_DAMPING: 0.92, // Increased damping for less overshoot
    CAMERA_STIFFNESS: 10.0, // Slightly reduced for fluid motion
    CAMERA_DAMPING: 0.95, // Higher damping for stability
    SETTLING_STIFFNESS: 6.0, // Gentler return to idle

    // Cursor smoothing - prevents jitter
    CURSOR_SMOOTHING: 0.15, // Exponential smoothing factor (0-1, lower = smoother)

    // Smart lookahead - predicts cursor movement
    LOOKAHEAD_FACTOR: 0.12, // Subtle prediction
    LOOKAHEAD_SPEED_THRESHOLD: 0.5, // Only apply lookahead above this velocity

    // Subtle rotation for dynamism
    ROTATION_FACTOR: 0.8, // Degrees per unit of horizontal velocity
    ROTATION_MAX: 1.2, // Max rotation in degrees
    ROTATION_DAMPING: 0.88,

    // Edge padding - keeps cursor away from viewport edges
    EDGE_PADDING: 0.15, // Percentage of screen (15%)
    EDGE_PUSH_STRENGTH: 0.3, // How strongly to push away from edges

    // Transition smoothing
    TRANSITION_DURATION: 0.3, // Smooth fade in/out of spotlight
} as const;

export const getInitialCameraState = (): CameraSystemState => ({
    mode: CameraMode.IDLE,
    transform: {
        scale: CAMERA_CONFIG.ZOOM_IDLE,
        translateX: 0,
        translateY: 0,
        rotation: 0,
        vignette: 0
    },
    targetTransform: {
        scale: CAMERA_CONFIG.ZOOM_IDLE,
        translateX: 0,
        translateY: 0,
        rotation: 0,
        vignette: 0
    },
    activeEvent: null,
    focusStartTime: 0,
    startTargetTransform: {
        scale: CAMERA_CONFIG.ZOOM_IDLE,
        translateX: 0,
        translateY: 0,
        rotation: 0,
        vignette: 0
    },
    currentZoom: CAMERA_CONFIG.ZOOM_IDLE,
    blur: 0,
    spotlight: false,
    velocity: {
        scale: 0,
        translateX: 0,
        translateY: 0,
        rotation: 0,
    },
    lastClickTime: -1,
    clickHistory: [],
    activityLevel: 0,
    focusPoint: null,
    smoothedCursorPos: null,
    cursorVelocitySmoothed: { x: 0, y: 0 },
    lastSpotlightState: false,
    transitionStartTime: 0,
});

/**
 * Exponential smoothing for cursor position
 */
const smoothCursorPosition = (
    current: { x: number; y: number } | null,
    target: { x: number; y: number } | null,
    alpha: number
): { x: number; y: number } | null => {
    if (!target) return current;
    if (!current) return target;

    return {
        x: current.x + alpha * (target.x - current.x),
        y: current.y + alpha * (target.y - current.y),
    };
};

/**
 * Calculate edge avoidance offset
 */
const calculateEdgeAvoidance = (
    cursorPos: { x: number; y: number },
    viewport: Viewport
): { x: number; y: number } => {
    const padding = CAMERA_CONFIG.EDGE_PADDING;
    const strength = CAMERA_CONFIG.EDGE_PUSH_STRENGTH;

    let pushX = 0;
    let pushY = 0;

    // Left edge
    if (cursorPos.x < padding) {
        pushX = (padding - cursorPos.x) * strength * viewport.width;
    }
    // Right edge
    else if (cursorPos.x > 1 - padding) {
        pushX = -((cursorPos.x - (1 - padding)) * strength * viewport.width);
    }

    // Top edge
    if (cursorPos.y < padding) {
        pushY = (padding - cursorPos.y) * strength * viewport.height;
    }
    // Bottom edge
    else if (cursorPos.y > 1 - padding) {
        pushY = -((cursorPos.y - (1 - padding)) * strength * viewport.height);
    }

    return { x: pushX, y: pushY };
};

/**
 * 🎬 ENHANCED SPOTLIGHT CAMERA SYSTEM
 * 
 * Improvements:
 * - Smoother cursor tracking with exponential smoothing
 * - Intelligent lookahead based on cursor velocity
 * - Subtle rotation for cinematic feel
 * - Edge avoidance to keep cursor away from viewport boundaries
 * - Smoother transitions with adaptive spring physics
 */
export const updateCameraSystem = (
    state: CameraSystemState,
    time: number,
    dt: number,
    clicks: ClickData[],
    moves: MoveData[],
    effects: EffectEvent[] = [],
    viewport: Viewport,
    duration: number = 0
): CameraSystemState => {
    const safeDt = Math.min(dt, 0.1);

    // Get raw cursor position
    const rawCursorPos = getCursorPos(time, moves);

    // Apply exponential smoothing to cursor position
    const smoothedCursor = smoothCursorPosition(
        state.smoothedCursorPos,
        rawCursorPos,
        CAMERA_CONFIG.CURSOR_SMOOTHING
    );

    // Get velocity and smooth it
    const rawVelocity = rawCursorPos ? getCursorVelocityVector(time, moves, 0.08) : { x: 0, y: 0 };
    const smoothedVelocity = {
        x: state.cursorVelocitySmoothed.x + 0.2 * (rawVelocity.x - state.cursorVelocitySmoothed.x),
        y: state.cursorVelocitySmoothed.y + 0.2 * (rawVelocity.y - state.cursorVelocitySmoothed.y),
    };

    // --- DETECT SPOTLIGHT WINDOWS ---
    let inSpotlight = false;

    for (let i = 0; i < clicks.length; i++) {
        const c1 = clicks[i];
        let isClusterStart = false;

        for (let j = i + 1; j < clicks.length; j++) {
            const c2 = clicks[j];
            if (c2.timestamp - c1.timestamp <= CAMERA_CONFIG.SPOTLIGHT_TRIGGER_WINDOW) {
                isClusterStart = true;
                break;
            } else {
                break;
            }
        }

        if (isClusterStart) {
            const start = c1.timestamp - CAMERA_CONFIG.SPOTLIGHT_ANTICIPATION;
            const end = start + CAMERA_CONFIG.SPOTLIGHT_DURATION;

            if (time >= start && time <= end) {
                inSpotlight = true;
                break;
            }
        }
    }

    // Track transition state
    const transitionStartTime = (inSpotlight !== state.lastSpotlightState) ? time : state.transitionStartTime;
    const transitionProgress = Math.min(1, (time - transitionStartTime) / CAMERA_CONFIG.TRANSITION_DURATION);

    // --- DETERMINE TARGET STATE ---
    let targetScale = CAMERA_CONFIG.ZOOM_IDLE;
    let targetTranslateX = 0;
    let targetTranslateY = 0;
    let targetRotation = 0;
    let mode: CameraMode = CameraMode.IDLE;

    if (inSpotlight && smoothedCursor) {
        mode = CameraMode.SPOTLIGHT;

        // Smooth zoom transition
        const zoomProgress = easeOutCubic(transitionProgress);
        targetScale = CAMERA_CONFIG.ZOOM_IDLE + (CAMERA_CONFIG.ZOOM_SPOTLIGHT - CAMERA_CONFIG.ZOOM_IDLE) * zoomProgress;

        const centerX = viewport.width / 2;
        const centerY = viewport.height / 2;
        const cursorX = smoothedCursor.x * viewport.width;
        const cursorY = smoothedCursor.y * viewport.height;

        // Smart lookahead - only apply when moving fast enough
        const speed = Math.hypot(smoothedVelocity.x, smoothedVelocity.y);
        const lookaheadActive = speed > CAMERA_CONFIG.LOOKAHEAD_SPEED_THRESHOLD;

        const lookaheadX = lookaheadActive ? smoothedVelocity.x * CAMERA_CONFIG.LOOKAHEAD_FACTOR * viewport.width : 0;
        const lookaheadY = lookaheadActive ? smoothedVelocity.y * CAMERA_CONFIG.LOOKAHEAD_FACTOR * viewport.height : 0;

        // Calculate edge avoidance
        const edgeAvoidance = calculateEdgeAvoidance(smoothedCursor, viewport);

        const focusX = cursorX + lookaheadX;
        const focusY = cursorY + lookaheadY;

        // Calculate camera offset with edge avoidance
        targetTranslateX = (centerX - focusX) + edgeAvoidance.x;
        targetTranslateY = (centerY - focusY) + edgeAvoidance.y;

        // Subtle rotation based on horizontal movement
        const rotationFromVelocity = smoothedVelocity.x * CAMERA_CONFIG.ROTATION_FACTOR;
        targetRotation = clamp(rotationFromVelocity, -CAMERA_CONFIG.ROTATION_MAX, CAMERA_CONFIG.ROTATION_MAX);

    } else if (state.lastSpotlightState && !inSpotlight) {
        // Settling back to idle
        mode = CameraMode.SETTLING;
        targetScale = CAMERA_CONFIG.ZOOM_IDLE;
        targetTranslateX = 0;
        targetTranslateY = 0;
        targetRotation = 0;
    } else {
        mode = CameraMode.IDLE;
        targetScale = CAMERA_CONFIG.ZOOM_IDLE;
        targetTranslateX = 0;
        targetTranslateY = 0;
        targetRotation = 0;
    }

    // --- EDGE CLAMPING ---
    // Ensure the camera never reveals the background by clamping translation
    // Max translation is half the "excess" width/height created by zooming
    const maxTranslateX = (viewport.width * targetScale - viewport.width) / 2;
    const maxTranslateY = (viewport.height * targetScale - viewport.height) / 2;

    // Strict clamping
    // We use Math.max(0, ...) to ensure we don't invert if scale < 1 (though logic prevents scale < 1 usually)
    const limitX = Math.max(0, maxTranslateX);
    const limitY = Math.max(0, maxTranslateY);

    targetTranslateX = clamp(targetTranslateX, -limitX, limitX);
    targetTranslateY = clamp(targetTranslateY, -limitY, limitY);

    // --- ADAPTIVE SPRING PHYSICS ---

    // Adjust stiffness based on mode for optimal feel
    const scaleStiffness = mode === CameraMode.SETTLING ? CAMERA_CONFIG.SETTLING_STIFFNESS : CAMERA_CONFIG.ZOOM_STIFFNESS;
    const translateStiffness = mode === CameraMode.SETTLING ? CAMERA_CONFIG.SETTLING_STIFFNESS : CAMERA_CONFIG.CAMERA_STIFFNESS;

    const scaleSpring = solveSpring(
        state.transform.scale,
        targetScale,
        state.velocity.scale,
        scaleStiffness,
        CAMERA_CONFIG.ZOOM_DAMPING,
        1.0,
        safeDt
    );

    const translateXSpring = solveSpring(
        state.transform.translateX,
        targetTranslateX,
        state.velocity.translateX,
        translateStiffness,
        CAMERA_CONFIG.CAMERA_DAMPING,
        1.0,
        safeDt
    );

    const translateYSpring = solveSpring(
        state.transform.translateY,
        targetTranslateY,
        state.velocity.translateY,
        translateStiffness,
        CAMERA_CONFIG.CAMERA_DAMPING,
        1.0,
        safeDt
    );

    const rotationSpring = solveSpring(
        state.transform.rotation || 0,
        targetRotation,
        state.velocity.rotation,
        CAMERA_CONFIG.CAMERA_STIFFNESS,
        CAMERA_CONFIG.ROTATION_DAMPING,
        1.0,
        safeDt
    );

    const newTransform: CameraState = {
        scale: scaleSpring.value,
        translateX: translateXSpring.value,
        translateY: translateYSpring.value,
        rotation: rotationSpring.value,
        vignette: 0,
    };

    const newTargetTransform: CameraState = {
        scale: targetScale,
        translateX: targetTranslateX,
        translateY: targetTranslateY,
        rotation: targetRotation,
        vignette: 0,
    };

    return {
        ...state,
        mode,
        transform: newTransform,
        targetTransform: newTargetTransform,
        activeEvent: null,
        focusPoint: inSpotlight && smoothedCursor ? { x: smoothedCursor.x, y: smoothedCursor.y } : null,
        currentZoom: newTransform.scale,
        spotlight: inSpotlight,
        velocity: {
            scale: scaleSpring.velocity,
            translateX: translateXSpring.velocity,
            translateY: translateYSpring.velocity,
            rotation: rotationSpring.velocity,
        },
        smoothedCursorPos: smoothedCursor,
        cursorVelocitySmoothed: smoothedVelocity,
        lastSpotlightState: inSpotlight,
        transitionStartTime,
        blur: 0,
        lastClickTime: -1,
        clickHistory: [],
        activityLevel: 0,
    };
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}