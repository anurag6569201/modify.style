import { ClickData, MoveData, EffectEvent } from "../../pages/Recorder";
import { CameraEffect } from "../editor/types";
import { getCursorPos, solveSpring, getCursorVelocity, getCursorVelocityVector } from "./math";

// Camera mode enum
export enum CameraMode {
    IDLE = "IDLE",
    SPOTLIGHT = "SPOTLIGHT",
    SETTLING = "SETTLING",
    MANUAL = "MANUAL",
    ANCHORED_ZOOM = "ANCHORED_ZOOM", // New mode for click-to-zoom
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
    smoothedCursorPos: { x: number; y: number } | null;
    cursorVelocitySmoothed: { x: number; y: number };
    lastSpotlightState: boolean;
    transitionStartTime: number;
    // Anchored zoom state
    anchorPoint: { x: number; y: number } | null;
    anchoredZoomStartTime: number;
}

export interface Viewport {
    width: number;
    height: number;
}

const CAMERA_CONFIG = {
    // Zoom levels
    ZOOM_IDLE: 1.0,
    ZOOM_SPOTLIGHT: 1.5,

    // Anchored zoom settings
    ANCHORED_ZOOM_LEVEL: 2.0, // How much to zoom on click
    ANCHORED_ZOOM_DURATION: 1.5, // How long to hold the zoom
    ANCHORED_ZOOM_STIFFNESS: 12.0, // Responsive spring
    ANCHORED_ZOOM_DAMPING: 0.95,

    // Spotlight Logic
    SPOTLIGHT_TRIGGER_WINDOW: 3.0,
    SPOTLIGHT_DURATION: 5.0,
    SPOTLIGHT_ANTICIPATION: 0.10,

    // Enhanced Physics
    ZOOM_STIFFNESS: 8.0,
    ZOOM_DAMPING: 0.92,
    CAMERA_STIFFNESS: 10.0,
    CAMERA_DAMPING: 0.95,
    SETTLING_STIFFNESS: 6.0,

    // Cursor smoothing
    CURSOR_SMOOTHING: 0.15,

    // Smart lookahead
    LOOKAHEAD_FACTOR: 0.12,
    LOOKAHEAD_SPEED_THRESHOLD: 0.5,

    // Rotation
    ROTATION_FACTOR: 0.8,
    ROTATION_MAX: 1.2,
    ROTATION_DAMPING: 0.88,

    // Edge padding
    EDGE_PADDING: 0.15,
    EDGE_PUSH_STRENGTH: 0.3,

    // Transition smoothing
    TRANSITION_DURATION: 0.3,
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
    anchorPoint: null,
    anchoredZoomStartTime: 0,
});

/**
 * Calculate anchored zoom translation
 * This keeps the anchor point fixed in viewport space during zoom
 */
const calculateAnchoredZoomTranslation = (
    anchorX: number, // Viewport coordinates (pixels)
    anchorY: number,
    oldScale: number,
    newScale: number,
    oldTranslateX: number,
    oldTranslateY: number
): { x: number; y: number } => {
    // Formula: newTranslate = anchor - (anchor - oldTranslate) * (newScale / oldScale)
    const translateX = anchorX - (anchorX - oldTranslateX) * (newScale / oldScale);
    const translateY = anchorY - (anchorY - oldTranslateY) * (newScale / oldScale);

    return { x: translateX, y: translateY };
};

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
 * 🎬 ENHANCED SPOTLIGHT CAMERA SYSTEM WITH ANCHORED ZOOM
 */
export const updateCameraSystem = (
    state: CameraSystemState,
    time: number,
    dt: number,
    clicks: ClickData[],
    moves: MoveData[],
    effects: EffectEvent[] = [],
    cameraEffects: CameraEffect[] = [],
    viewport: Viewport,
    duration: number = 0,
    config?: {
        zoomStrength: number;
        speed: number;
        padding: number;
        enableAnchoredZoom?: boolean; // New config option
    }
): CameraSystemState => {
    const safeDt = Math.min(dt, 0.1);

    const ZOOM_STRENGTH = config ? config.zoomStrength : CAMERA_CONFIG.ZOOM_SPOTLIGHT;
    const SPEED_MULTIPLIER = config ? config.speed : 1.0;
    const EDGE_PADDING = config ? config.padding : CAMERA_CONFIG.EDGE_PADDING;
    const ENABLE_ANCHORED_ZOOM = config?.enableAnchoredZoom ?? false;

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

    // --- DETECT ANCHORED ZOOM (Single Clicks) ---
    let anchoredZoomActive = false;
    let newAnchorPoint = state.anchorPoint;
    let anchoredZoomStartTime = state.anchoredZoomStartTime;

    if (ENABLE_ANCHORED_ZOOM && clicks.length > 0) {
        // Find the most recent click
        const recentClick = clicks[clicks.length - 1];

        // Check if this is a new click (not part of a cluster)
        const isIsolatedClick = !clicks.some((c, i) =>
            i !== clicks.length - 1 &&
            Math.abs(c.timestamp - recentClick.timestamp) <= CAMERA_CONFIG.SPOTLIGHT_TRIGGER_WINDOW
        );

        if (isIsolatedClick) {
            const clickStartTime = recentClick.timestamp;
            const clickEndTime = clickStartTime + CAMERA_CONFIG.ANCHORED_ZOOM_DURATION;

            if (time >= clickStartTime && time <= clickEndTime) {
                anchoredZoomActive = true;

                // Set anchor point on first frame of zoom
                if (!state.anchorPoint || state.anchoredZoomStartTime !== clickStartTime) {
                    newAnchorPoint = {
                        x: recentClick.x * viewport.width,
                        y: recentClick.y * viewport.height
                    };
                    anchoredZoomStartTime = clickStartTime;
                }
            }
        }
    }

    // Clear anchor point when zoom ends
    if (!anchoredZoomActive && state.anchorPoint) {
        newAnchorPoint = null;
    }

    // --- DETECT SPOTLIGHT WINDOWS (Multi-click clusters) ---
    let inSpotlight = false;

    if (!ENABLE_ANCHORED_ZOOM || !anchoredZoomActive) {
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
    }

    // Track transition state
    const transitionStartTime = (inSpotlight !== state.lastSpotlightState) ? time : state.transitionStartTime;
    const transitionProgress = Math.min(1, (time - transitionStartTime) / CAMERA_CONFIG.TRANSITION_DURATION);

    // --- DETERMINE TARGET STATE ---
    let targetScale: number = CAMERA_CONFIG.ZOOM_IDLE;
    let targetTranslateX = 0;
    let targetTranslateY = 0;
    let targetRotation = 0;
    let mode: CameraMode = CameraMode.IDLE;

    // Helper to calculate spotlight tracking position
    const calculateSpotlightTarget = (zoomLevel: number) => {
        if (!smoothedCursor) return { x: 0, y: 0, r: 0 };

        const PADDING = 50;
        const maxTx = (viewport.width * zoomLevel - viewport.width) / 2;
        const maxTy = (viewport.height * zoomLevel - viewport.height) / 2;

        const effectivePaddingX = Math.min(PADDING, maxTx);
        const effectivePaddingY = Math.min(PADDING, maxTy);

        let tx = 0;
        let ty = 0;

        if (smoothedCursor.x < 0.5) {
            tx = maxTx - effectivePaddingX;
        } else {
            tx = -maxTx + effectivePaddingX;
        }

        if (smoothedCursor.y < 0.5) {
            ty = maxTy - effectivePaddingY;
        } else {
            ty = -maxTy + effectivePaddingY;
        }

        return { x: tx, y: ty, r: 0 };
    };

    // PRIORITY 1: Anchored Zoom (overrides spotlight)
    if (anchoredZoomActive && newAnchorPoint) {
        mode = CameraMode.ANCHORED_ZOOM;
        targetScale = CAMERA_CONFIG.ANCHORED_ZOOM_LEVEL;

        // Calculate anchored zoom translation
        const anchored = calculateAnchoredZoomTranslation(
            newAnchorPoint.x,
            newAnchorPoint.y,
            state.transform.scale,
            targetScale,
            state.transform.translateX,
            state.transform.translateY
        );

        targetTranslateX = anchored.x;
        targetTranslateY = anchored.y;
        targetRotation = 0;

        // PRIORITY 2: Spotlight mode
    } else if (inSpotlight && smoothedCursor) {
        mode = CameraMode.SPOTLIGHT;

        const zoomProgress = easeOutCubic(transitionProgress);
        targetScale = CAMERA_CONFIG.ZOOM_IDLE + (ZOOM_STRENGTH - CAMERA_CONFIG.ZOOM_IDLE) * zoomProgress;

        const { x, y, r } = calculateSpotlightTarget(targetScale);
        targetTranslateX = x;
        targetTranslateY = y;
        targetRotation = r;

        // PRIORITY 3: Settling back to idle
    } else if (state.lastSpotlightState && !inSpotlight) {
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

    // --- TIMELINE EFFECTS OVERRIDE ---
    const activeEffect = cameraEffects
        .filter(e => time >= e.startTime && time <= e.startTime + e.duration)
        .sort((a, b) => b.startTime - a.startTime)[0];

    if (activeEffect) {
        mode = CameraMode.MANUAL;

        if (activeEffect.type === 'zoom' && activeEffect.zoomLevel) {
            targetScale = activeEffect.zoomLevel;
        }

        if (typeof activeEffect.x === 'number' && typeof activeEffect.y === 'number') {
            const viewportCenterX = viewport.width / 2;
            const viewportCenterY = viewport.height / 2;

            const targetPixelX = activeEffect.x * viewport.width;
            const targetPixelY = activeEffect.y * viewport.height;

            targetTranslateX = (viewportCenterX - targetPixelX) * targetScale;
            targetTranslateY = (viewportCenterY - targetPixelY) * targetScale;
        } else if (activeEffect.type === 'zoom') {
            if (smoothedCursor) {
                const { x, y, r } = calculateSpotlightTarget(targetScale);
                targetTranslateX = x;
                targetTranslateY = y;
                targetRotation = r;
            }
        }
    }

    // --- EDGE CLAMPING ---
    const maxTranslateX = (viewport.width * targetScale - viewport.width) / 2;
    const maxTranslateY = (viewport.height * targetScale - viewport.height) / 2;

    const limitX = Math.max(0, maxTranslateX);
    const limitY = Math.max(0, maxTranslateY);

    targetTranslateX = clamp(targetTranslateX, -limitX, limitX);
    targetTranslateY = clamp(targetTranslateY, -limitY, limitY);

    // --- ADAPTIVE SPRING PHYSICS ---
    const baseScaleStiffness = mode === CameraMode.SETTLING ? CAMERA_CONFIG.SETTLING_STIFFNESS :
        mode === CameraMode.ANCHORED_ZOOM ? CAMERA_CONFIG.ANCHORED_ZOOM_STIFFNESS :
            CAMERA_CONFIG.ZOOM_STIFFNESS;
    const baseTranslateStiffness = mode === CameraMode.SETTLING ? CAMERA_CONFIG.SETTLING_STIFFNESS :
        mode === CameraMode.ANCHORED_ZOOM ? CAMERA_CONFIG.ANCHORED_ZOOM_STIFFNESS :
            CAMERA_CONFIG.CAMERA_STIFFNESS;

    const scaleStiffness = baseScaleStiffness * SPEED_MULTIPLIER;
    const translateStiffness = baseTranslateStiffness * SPEED_MULTIPLIER;

    const scaleSpring = solveSpring(
        state.transform.scale,
        targetScale,
        state.velocity.scale,
        scaleStiffness,
        mode === CameraMode.ANCHORED_ZOOM ? CAMERA_CONFIG.ANCHORED_ZOOM_DAMPING : CAMERA_CONFIG.ZOOM_DAMPING,
        1.0,
        safeDt
    );

    const translateXSpring = solveSpring(
        state.transform.translateX,
        targetTranslateX,
        state.velocity.translateX,
        translateStiffness,
        mode === CameraMode.ANCHORED_ZOOM ? CAMERA_CONFIG.ANCHORED_ZOOM_DAMPING : CAMERA_CONFIG.CAMERA_DAMPING,
        1.0,
        safeDt
    );

    const translateYSpring = solveSpring(
        state.transform.translateY,
        targetTranslateY,
        state.velocity.translateY,
        translateStiffness,
        mode === CameraMode.ANCHORED_ZOOM ? CAMERA_CONFIG.ANCHORED_ZOOM_DAMPING : CAMERA_CONFIG.CAMERA_DAMPING,
        1.0,
        safeDt
    );

    const rotationSpring = solveSpring(
        state.transform.rotation || 0,
        targetRotation,
        state.velocity.rotation,
        CAMERA_CONFIG.CAMERA_STIFFNESS * SPEED_MULTIPLIER,
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

    // --- DYNAMIC CLAMPING ---
    const currentMaxTx = Math.max(0, (viewport.width * newTransform.scale - viewport.width) / 2);
    const currentMaxTy = Math.max(0, (viewport.height * newTransform.scale - viewport.height) / 2);

    newTransform.translateX = clamp(newTransform.translateX, -currentMaxTx, currentMaxTx);
    newTransform.translateY = clamp(newTransform.translateY, -currentMaxTy, currentMaxTy);

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
        focusPoint: (inSpotlight || anchoredZoomActive) && smoothedCursor ? { x: smoothedCursor.x, y: smoothedCursor.y } : null,
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
        anchorPoint: newAnchorPoint,
        anchoredZoomStartTime,
    };
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}