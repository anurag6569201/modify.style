import { ClickData, MoveData } from "../../pages/Recorder";
import { getCursorPos, getCursorVelocity, clamp, paddedFollow } from "./math";
import { createSmoothPath, bezierPoint, easeInOutCubic, Point } from "../effects/bezier";

export enum CameraMode {
    IDLE = "IDLE",
    SOFT_FOCUS = "SOFT_FOCUS",
    FOCUSED = "FOCUSED",
    LOCKED_FOCUS = "LOCKED_FOCUS",
    DECAY = "DECAY"
}

// Helper for distance between two points normalized
const dist = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
};

export interface CameraState {
    scale: number;
    translateX: number;
    translateY: number;
}

export interface CameraSystemState {
    mode: CameraMode;
    transform: CameraState;       // Current physical position
    targetTransform: CameraState; // Where we want to be
    velocity: CameraState;        // For physics (dampening)
    lastIntentTime: number;       // When was the last interesting thing?
    activeEvent: ClickData | null;

    focusStartTime: number;
    startTargetTransform: CameraState;
    currentZoom: number;
    
    // Bezier curve path for smooth camera movements
    bezierPath?: Point[];
    bezierPathTime?: number;
    useBezierPath?: boolean;
}

export interface Viewport {
    width: number;
    height: number;
}

// Configuration Constants
const ZOOM_IDLE = 1.0;
const ZOOM_SOFT = 1.1;
const ZOOM_CLICK = 1.35; // Standard good meaningful zoom
const DWELL_VELOCITY_THRESHOLD = 0.15; // Normalized units per second
const CLICK_FOCUS_DURATION = 1.8;      // How long to stay zoomed after click
const IDLE_TIMEOUT = 2.0;              // Time before starting decay
// const PAN_TRANSITION_DURATION = 0.6;   // removed, relying on adaptive speed

// Padded Follow Constants
const INNER_PADDING_X_PCT = 0.12;
const INNER_PADDING_Y_PCT = 0.12;
const OUTER_PADDING_X_PCT = 0.28;
const OUTER_PADDING_Y_PCT = 0.28;

// Helper: Get initial state
export const getInitialCameraState = (): CameraSystemState => ({
    mode: CameraMode.IDLE,
    transform: { scale: 1, translateX: 0, translateY: 0 },
    targetTransform: { scale: 1, translateX: 0, translateY: 0 },
    velocity: { scale: 0, translateX: 0, translateY: 0 },
    lastIntentTime: 0,
    activeEvent: null,
    focusStartTime: 0,
    startTargetTransform: { scale: 1, translateX: 0, translateY: 0 },
    currentZoom: 1,
    bezierPath: undefined,
    bezierPathTime: undefined,
    useBezierPath: false,
});

/**
 * Main Camera Update Loop
 * Calculates next frame state based on previous state and inputs.
 */
export const updateCameraSystem = (
    state: CameraSystemState,
    time: number,
    dt: number, // Delta time in seconds (e.g. 1/60)
    clicks: ClickData[],
    moves: MoveData[],
    viewport: Viewport
): CameraSystemState => {
    // 1. Detect Intent
    // -------------------------------------------------------------------------
    let nextMode = state.mode;
    let activeEvent = state.activeEvent;
    let intentTime = state.lastIntentTime;
    let focusStartTime = state.focusStartTime;

    // Check for recent clicks (Strongest Signal)
    const recentClick = clicks.find(e => {
        const diff = time - e.timestamp;
        // Look for click that happened just now or slightly in future (lookahead)
        return diff >= -0.1 && diff < CLICK_FOCUS_DURATION;
    });

    // Check for cursor dwell (Soft Signal)
    const cursorVel = getCursorVelocity(time, moves);
    const isDwelling = cursorVel < DWELL_VELOCITY_THRESHOLD && cursorVel > 0;

    // State Transitions
    if (recentClick) {
        // [POLISH] Click Clustering: If close to existing active click, ignore?
        let isCluster = false;
        if (state.activeEvent) {
            const d = dist(state.activeEvent, recentClick);
            const tDiff = Math.abs(recentClick.timestamp - state.activeEvent.timestamp);
            if (d < 0.15 && tDiff < 1.2) {
                isCluster = true;
            }
        }

        if (nextMode !== CameraMode.FOCUSED) {
            nextMode = CameraMode.FOCUSED;
            focusStartTime = time;
            state.startTargetTransform = { ...state.targetTransform };
        }

        if (!isCluster || !activeEvent) {
            activeEvent = recentClick;
        }

        intentTime = time;
    } else if (time - intentTime > IDLE_TIMEOUT) {
        if (state.mode === CameraMode.FOCUSED || state.mode === CameraMode.SOFT_FOCUS) {
            nextMode = CameraMode.DECAY;
        } else {
            nextMode = CameraMode.IDLE;
        }
    } else if (isDwelling && state.mode === CameraMode.IDLE) {
        nextMode = CameraMode.SOFT_FOCUS;
        intentTime = time;
    }

    // 2. Calculate Target Transform
    // -------------------------------------------------------------------------
    let targetScale = ZOOM_IDLE;

    // Scale Logic
    switch (nextMode) {
        case CameraMode.FOCUSED:
            // Velocity-Based Zoom
            let velocityZoom = ZOOM_CLICK;
            if (cursorVel > 0.8) velocityZoom = 1.05;
            else if (cursorVel > 0.5) velocityZoom = 1.2;
            else if (cursorVel < 0.1) velocityZoom = 1.45;
            else velocityZoom = 1.35;
            targetScale = velocityZoom;
            break;
        case CameraMode.SOFT_FOCUS:
            targetScale = ZOOM_SOFT;
            break;
        default:
            targetScale = ZOOM_IDLE;
            break;
    }

    // Position Logic (Padded Follow Zone)
    // -------------------------------------------------------------------------
    let targetTx = state.transform.translateX;
    let targetTy = state.transform.translateY;
    let shiftX = 0;
    let shiftY = 0;

    const isTracking = nextMode === CameraMode.FOCUSED || nextMode === CameraMode.SOFT_FOCUS;

    if (isTracking) {
        const cursor = getCursorPos(time, moves);
        if (cursor) {
            // A. Calculate Cursor in Screen Pixels (Apply current Transform)
            // ScreenPos = ContentPos * Scale + Translate
            const currentScale = state.transform.scale;
            const currentTx = state.transform.translateX;
            const currentTy = state.transform.translateY;

            const cursorScreenX = (cursor.x * viewport.width) * currentScale + currentTx;
            const cursorScreenY = (cursor.y * viewport.height) * currentScale + currentTy;

            // B. Calculate Offset from Viewport Center
            const centerX = viewport.width / 2;
            const centerY = viewport.height / 2;

            const dx = cursorScreenX - centerX;
            const dy = cursorScreenY - centerY;

            // C. Define Padding in Pixels (Screen Space)
            // This is naturally "Zoom-Aware" because we are working in Viewport Pixels
            const innerPadX = viewport.width * INNER_PADDING_X_PCT;
            const innerPadY = viewport.height * INNER_PADDING_Y_PCT;
            const outerPadX = viewport.width * OUTER_PADDING_X_PCT;
            const outerPadY = viewport.height * OUTER_PADDING_Y_PCT;

            // D. Calculate Shift "Force" using Padded Follow Logic
            // This returns how many pixels we are "over" the limit
            shiftX = paddedFollow(dx, innerPadX, outerPadX);
            shiftY = paddedFollow(dy, innerPadY, outerPadY);
        }
    } else {
        // IDLE / DECAY -> Target is Center Screen
        const targetXNorm = 0.5;
        const targetYNorm = 0.5;
        // Target global translation (to center content)
        // Center content means: viewport center aligns with content center (if scale 1)
        // With scale:
        const idealTx = (0.5 * viewport.width) - (targetXNorm * viewport.width * targetScale);
        const idealTy = (0.5 * viewport.height) - (targetYNorm * viewport.height * targetScale);

        targetTx = idealTx;
        targetTy = idealTy;

        // Treat difference as a shift for the smoothing logic below
        shiftX = targetTx - state.transform.translateX;
        shiftY = targetTy - state.transform.translateY;
    }

    // 3. Adaptive Smoothing (Distance-Based)
    // -------------------------------------------------------------------------

    const timeScale = dt * 60;

    // Zoom Smoothing
    const currentScale = state.transform.scale;
    const dScale = targetScale - currentScale;
    const zoomDelta = clamp(dScale * 0.15, -0.05, 0.05);
    const newScale = currentScale + zoomDelta * timeScale;
    const finalScale = Math.max(1, newScale);

    // Pan Smoothing (Adaptive with Bezier Curve Support)
    const forceDistance = Math.hypot(shiftX, shiftY);

    // User's Adaptive Speed Logic
    // speed = clamp(distance * 0.15, 2, 40);
    const panSpeed = clamp(forceDistance * 0.15, 2, 40);

    let newTx = state.transform.translateX;
    let newTy = state.transform.translateY;

    // Use Bezier curve path if available and enabled
    if (state.useBezierPath && state.bezierPath && state.bezierPath.length > 1) {
        const pathTime = state.bezierPathTime || 0;
        const pathDuration = 0.5; // Duration for path traversal
        const normalizedTime = Math.min(1, pathTime / pathDuration);
        const easedTime = easeInOutCubic(normalizedTime);
        
        // Sample point along bezier path
        const curves = createSmoothPath(state.bezierPath);
        if (curves.length > 0) {
            const curveIndex = Math.min(Math.floor(easedTime * curves.length), curves.length - 1);
            const curve = curves[curveIndex];
            const curveT = (easedTime * curves.length) % 1;
            const point = bezierPoint(curveT, curve);
            
            // Convert normalized point to screen coordinates
            newTx = point.x * viewport.width - viewport.width / 2;
            newTy = point.y * viewport.height - viewport.height / 2;
            
            // Update path time
            const newPathTime = (state.bezierPathTime || 0) + dt;
            if (newPathTime >= pathDuration) {
                // Path complete, disable bezier path
                state.useBezierPath = false;
                state.bezierPath = undefined;
                state.bezierPathTime = undefined;
            } else {
                state.bezierPathTime = newPathTime;
            }
        }
    } else if (forceDistance > 0.1) {
        const moveStep = panSpeed * timeScale;
        const safeStep = Math.min(forceDistance, moveStep);

        // If Tracking: shiftX is how much we WANT to have moved.
        // But since it's a "force", we move in that direction.
        // Direction: shiftX positive -> Cursor is Right -> Camera should move Right -> TranslateX should Decrease.
        // Wait, 'shiftX' from paddedFollow is (Cur - Center).
        // If Cur > Center (Right), shiftX > 0.
        // To move Camera Right, we subtract from TranslateX.

        // If Idle: shiftX was (Target - Current).
        // If Target > Current, shiftX > 0.
        // We want to add to Current to get to Target.
        // So Direction depends on source of Shift!

        if (isTracking) {
            // Inverted for Camera Movement (Content Shift)
            newTx -= (shiftX / forceDistance) * safeStep;
            newTy -= (shiftY / forceDistance) * safeStep;

            // Update target to current state so we don't snap back later
            targetTx = newTx;
            targetTy = newTy;
        } else {
            // Direct Interpolation towards Target
            newTx += (shiftX / forceDistance) * safeStep;
            newTy += (shiftY / forceDistance) * safeStep;
        }

    } else {
        // Settled
        if (!isTracking) {
            newTx = targetTx;
            newTy = targetTy;
        }
    }

    // Clamp Translation to Bounds
    const minTx = viewport.width * (1 - finalScale);
    const maxTx = 0;
    const minTy = viewport.height * (1 - finalScale);
    const maxTy = 0;

    if (finalScale <= 1.001) {
        newTx = 0;
        newTy = 0;
    } else {
        newTx = Math.max(minTx, Math.min(maxTx, newTx));
        newTy = Math.max(minTy, Math.min(maxTy, newTy));
    }

    // Implicit Velocities
    const vScale = (finalScale - currentScale) / dt;
    const vTx = (newTx - state.transform.translateX) / dt;
    const vTy = (newTy - state.transform.translateY) / dt;

    return {
        mode: nextMode,
        activeEvent,
        lastIntentTime: intentTime,
        focusStartTime,
        startTargetTransform: state.startTargetTransform,
        currentZoom: finalScale,
        transform: {
            scale: finalScale,
            translateX: newTx,
            translateY: newTy
        },
        targetTransform: {
            scale: targetScale,
            translateX: targetTx,
            translateY: targetTy
        },
        velocity: {
            scale: vScale,
            translateX: vTx,
            translateY: vTy
        }
    };
};
