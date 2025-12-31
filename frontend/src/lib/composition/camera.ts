import { ClickData, MoveData, EffectEvent } from "../../pages/Recorder";
import { getCursorPos, getCursorVelocityVector, clamp, paddedFollow, lerp, smoothstep } from "./math";
import { createSmoothPath, bezierPoint, easeInOutCubic, Point } from "../effects/bezier";

export enum CameraMode {
    IDLE = "IDLE",
    SOFT_FOCUS = "SOFT_FOCUS",
    FOCUSED = "FOCUSED",
    LOCKED_FOCUS = "LOCKED_FOCUS",
    HOLD = "HOLD",
    DECAY = "DECAY",
    CINEMATIC_SWEEP = "CINEMATIC_SWEEP", // NEW: Smooth sweeping transitions
    ANTICIPATION = "ANTICIPATION" // NEW: Pre-movement wind-up
}

// Enhanced interpolation with anticipation
const anticipationCurve = (t: number): number => {
    // Slight overshoot for more dynamic feel
    return t < 0.5 
        ? 2 * t * t 
        : 1 - Math.pow(-2 * t + 2, 2) / 2 + 0.05 * Math.sin(t * Math.PI);
};

const dist = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
};

export interface CameraState {
    scale: number;
    translateX: number;
    translateY: number;
    rotation?: number; // NEW: Subtle rotation
    vignette?: number; // NEW: Dynamic vignette
}

export interface CameraSystemState {
    mode: CameraMode;
    transform: CameraState;
    targetTransform: CameraState;
    velocity: CameraState;
    lastIntentTime: number;
    activeEvent: ClickData | null;
    focusStartTime: number;
    startTargetTransform: CameraState;
    currentZoom: number;
    blur: number;
    spotlight: boolean;
    
    // Enhanced features
    bezierPath?: Point[];
    bezierPathTime?: number;
    useBezierPath?: boolean;
    handleHoldTimer: number;
    
    // NEW: Advanced cinematics
    momentum: { x: number, y: number }; // Inertial movement
    anticipationPhase: number; // 0-1, for wind-up animations
    cinematicMode: boolean; // Toggle for extra polish
    focusHistory: Array<{ x: number, y: number, time: number }>; // Path memory
    smoothingBuffer: Array<CameraState>; // Multi-frame smoothing
    microShake: { x: number, y: number, intensity: number }; // Subtle life
    transitionCurve?: (t: number) => number; // Custom easing per transition
}

export interface Viewport {
    width: number;
    height: number;
}

// Enhanced Configuration
const ZOOM_IDLE = 1.0;
const ZOOM_SOFT = 1.15; // Slightly more aggressive
const ZOOM_CLICK_BASE = 1.5;
const ZOOM_FAST_BASE = 1.08;
const DWELL_VELOCITY_THRESHOLD = 0.12;
const CLICK_FOCUS_DURATION = 2.2; // Longer hold
const IDLE_TIMEOUT = 2.5;
const HOLD_DURATION = 0.6;
const PREDICTIVE_LEAD_TIME = 0.18; // More aggressive prediction

// NEW: Cinematic constants
const MOMENTUM_DECAY = 0.92; // Inertial drag
const MICRO_SHAKE_AMPLITUDE = 0.001; // Barely perceptible life
const ANTICIPATION_DURATION = 0.15; // Wind-up time
const FOCUS_HISTORY_LENGTH = 10; // Remember last 10 focus points
const SMOOTHING_BUFFER_SIZE = 5; // Multi-frame average

// Padding (slightly tighter for more dynamic feel)
const INNER_PADDING_X_PCT = 0.10;
const INNER_PADDING_Y_PCT = 0.10;
const OUTER_PADDING_X_PCT = 0.30;
const OUTER_PADDING_Y_PCT = 0.30;

// NEW: Perlin-like noise for micro-shake
let noisePhase = 0;
const microNoise = (phase: number): number => {
    return Math.sin(phase * 2.3) * 0.5 + Math.sin(phase * 3.7) * 0.3 + Math.sin(phase * 5.1) * 0.2;
};

export const getInitialCameraState = (): CameraSystemState => ({
    mode: CameraMode.IDLE,
    transform: { scale: 1, translateX: 0, translateY: 0, rotation: 0, vignette: 0 },
    targetTransform: { scale: 1, translateX: 0, translateY: 0, rotation: 0, vignette: 0 },
    velocity: { scale: 0, translateX: 0, translateY: 0, rotation: 0 },
    lastIntentTime: 0,
    activeEvent: null,
    focusStartTime: 0,
    startTargetTransform: { scale: 1, translateX: 0, translateY: 0, rotation: 0, vignette: 0 },
    currentZoom: 1,
    blur: 0,
    spotlight: false,
    bezierPath: undefined,
    bezierPathTime: undefined,
    useBezierPath: false,
    handleHoldTimer: 0,
    
    // NEW fields
    momentum: { x: 0, y: 0 },
    anticipationPhase: 0,
    cinematicMode: true, // Enable by default
    focusHistory: [],
    smoothingBuffer: [],
    microShake: { x: 0, y: 0, intensity: 0 },
    transitionCurve: undefined
});

// NEW: Intelligent path prediction based on history
const predictNextFocus = (history: Array<{ x: number, y: number, time: number }>, currentTime: number): { x: number, y: number } | null => {
    if (history.length < 3) return null;
    
    // Use last 3 points to predict trajectory
    const recent = history.slice(-3);
    const velocities = [];
    
    for (let i = 1; i < recent.length; i++) {
        const dt = recent[i].time - recent[i - 1].time;
        if (dt > 0) {
            velocities.push({
                x: (recent[i].x - recent[i - 1].x) / dt,
                y: (recent[i].y - recent[i - 1].y) / dt
            });
        }
    }
    
    if (velocities.length === 0) return null;
    
    // Average velocity
    const avgVel = velocities.reduce((acc, v) => ({
        x: acc.x + v.x / velocities.length,
        y: acc.y + v.y / velocities.length
    }), { x: 0, y: 0 });
    
    const last = recent[recent.length - 1];
    const lookAhead = 0.3; // 300ms prediction
    
    return {
        x: clamp(last.x + avgVel.x * lookAhead, 0, 1),
        y: clamp(last.y + avgVel.y * lookAhead, 0, 1)
    };
};

// NEW: Calculate optimal zoom based on content density
const calculateContentAwareZoom = (
    activeEvent: ClickData | null,
    cursorSpeed: number,
    baseZoom: number
): number => {
    if (!activeEvent?.elementInfo?.rect) return baseZoom;
    
    const rect = activeEvent.elementInfo.rect;
    const area = rect.width * rect.height;
    
    // Smaller elements get more zoom
    const areaFactor = smoothstep(0.01, 0.2, area);
    const sizeBoost = lerp(1.3, 1.0, areaFactor);
    
    // Text elements get slight zoom boost for readability
    const typeBoost = activeEvent.elementInfo.semanticType === 'text' ? 1.1 : 1.0;
    
    // Fast movement reduces zoom
    const speedFactor = smoothstep(0.05, 1.0, cursorSpeed);
    const speedPenalty = lerp(1.0, 0.85, speedFactor);
    
    return clamp(baseZoom * sizeBoost * typeBoost * speedPenalty, 1.05, 1.8);
};

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
    
    // Update micro-shake (subtle life)
    noisePhase += dt * 2;
    const shakeIntensity = state.mode === CameraMode.FOCUSED ? 0.3 : 0.1;
    state.microShake = {
        x: microNoise(noisePhase) * MICRO_SHAKE_AMPLITUDE * shakeIntensity,
        y: microNoise(noisePhase + 100) * MICRO_SHAKE_AMPLITUDE * shakeIntensity,
        intensity: shakeIntensity
    };
    
    // 1. Enhanced Intent Detection
    let nextMode = state.mode;
    let activeEvent = state.activeEvent;
    let intentTime = state.lastIntentTime;
    let focusStartTime = state.focusStartTime;
    
    const recentClick = clicks.find(e => {
        const diff = time - e.timestamp;
        return diff >= -0.1 && diff < CLICK_FOCUS_DURATION;
    });
    
    const cursorVelVec = getCursorVelocityVector(time, moves);
    const cursorSpeed = Math.hypot(cursorVelVec.x, cursorVelVec.y);
    const isMoving = cursorSpeed > 0.04;
    
    // NEW: Detect rapid direction changes (anticipation trigger)
    let needsAnticipation = false;
    if (state.focusHistory.length >= 2) {
        const recent = state.focusHistory.slice(-2);
        const oldDir = { 
            x: recent[1].x - recent[0].x,
            y: recent[1].y - recent[0].y 
        };
        const newDir = { x: cursorVelVec.x, y: cursorVelVec.y };
        
        const oldMag = Math.hypot(oldDir.x, oldDir.y);
        const newMag = Math.hypot(newDir.x, newDir.y);
        
        if (oldMag > 0.1 && newMag > 0.1) {
            const dot = (oldDir.x * newDir.x + oldDir.y * newDir.y) / (oldMag * newMag);
            if (dot < 0.3) { // Sharp turn
                needsAnticipation = true;
            }
        }
    }
    
    // State Transitions with Anticipation
    if (recentClick) {
        let isCluster = false;
        if (state.activeEvent) {
            const d = dist(state.activeEvent, recentClick);
            const tDiff = Math.abs(recentClick.timestamp - state.activeEvent.timestamp);
            if (d < 0.12 && tDiff < 1.0) {
                isCluster = true;
            }
        }
        
        if (nextMode !== CameraMode.FOCUSED) {
            // NEW: Enter anticipation first for dramatic effect
            if (state.cinematicMode && !isCluster) {
                nextMode = CameraMode.ANTICIPATION;
                state.anticipationPhase = 0;
            } else {
                nextMode = CameraMode.FOCUSED;
            }
            focusStartTime = time;
            state.startTargetTransform = { ...state.targetTransform };
            state.handleHoldTimer = 0;
            
            // Custom transition curve for clicks
            state.transitionCurve = anticipationCurve;
        }
        
        if (!isCluster || !activeEvent) {
            activeEvent = recentClick;
        }
        intentTime = time;
        
    } else if (needsAnticipation && state.mode !== CameraMode.ANTICIPATION) {
        nextMode = CameraMode.ANTICIPATION;
        state.anticipationPhase = 0;
        intentTime = time;
        
    } else if (isMoving) {
        if (state.mode === CameraMode.ANTICIPATION) {
            state.anticipationPhase += dt / ANTICIPATION_DURATION;
            if (state.anticipationPhase >= 1.0) {
                nextMode = CameraMode.SOFT_FOCUS;
            }
        } else if (state.mode !== CameraMode.FOCUSED) {
            nextMode = CameraMode.SOFT_FOCUS;
        }
        intentTime = time;
        
    } else if (time - intentTime > IDLE_TIMEOUT) {
        if (state.mode === CameraMode.FOCUSED || state.mode === CameraMode.SOFT_FOCUS) {
            nextMode = CameraMode.HOLD;
            state.handleHoldTimer = HOLD_DURATION;
        } else if (state.mode === CameraMode.HOLD) {
            state.handleHoldTimer -= dt;
            if (state.handleHoldTimer <= 0) {
                nextMode = CameraMode.DECAY;
            }
        } else if (state.mode === CameraMode.DECAY) {
            nextMode = CameraMode.DECAY;
        } else {
            nextMode = CameraMode.IDLE;
        }
    }
    
    // End-of-video settle
    if (duration > 0 && time > duration - 2.0) {
        nextMode = CameraMode.IDLE;
        state.transitionCurve = (t: number) => t * t * (3 - 2 * t); // Smooth ease
    }
    
    // Effect Engine Integration
    let activeEffectZoom: number | undefined = undefined;
    let activeEffectBlur = 0;
    let activeEffectSpotlight = false;
    
    const pastEffects = effects.filter(e => e.timestamp <= time);
    if (pastEffects.length > 0) {
        const lastEffect = pastEffects[pastEffects.length - 1];
        if (lastEffect.type === 'enter' && lastEffect.action) {
            if (lastEffect.action.zoom) activeEffectZoom = lastEffect.action.zoom;
            if (lastEffect.action.blurBackground) activeEffectBlur = lastEffect.action.blurBackground;
            if (lastEffect.action.spotlight) activeEffectSpotlight = lastEffect.action.spotlight;
        }
    }
    
    // 2. Enhanced Target Transform Calculation
    let targetScale = ZOOM_IDLE;
    let targetRotation = 0;
    let targetVignette = 0;
    
    switch (nextMode) {
        case CameraMode.ANTICIPATION:
            // Slight zoom out during wind-up
            targetScale = state.transform.scale * 0.98;
            targetRotation = Math.sin(state.anticipationPhase * Math.PI) * 0.5; // Subtle tilt
            break;
            
        case CameraMode.FOCUSED:
            {
                const baseZoom = ZOOM_CLICK_BASE;
                targetScale = calculateContentAwareZoom(activeEvent, cursorSpeed, baseZoom);
                targetVignette = 0.15; // Subtle focus emphasis
                
                // Slight rotation based on position (parallax effect)
                if (activeEvent) {
                    const offsetX = (activeEvent.x - 0.5) * 2; // -1 to 1
                    targetRotation = offsetX * 0.3; // Max ±0.3 degrees
                }
            }
            break;
            
        case CameraMode.SOFT_FOCUS:
            {
                const speedFactor = smoothstep(0.08, 1.8, cursorSpeed);
                targetScale = lerp(ZOOM_SOFT, ZOOM_FAST_BASE, speedFactor);
                
                // Dynamic rotation based on movement direction
                if (cursorSpeed > 0.2) {
                    const angle = Math.atan2(cursorVelVec.y, cursorVelVec.x);
                    targetRotation = Math.sin(angle) * 0.4 * cursorSpeed;
                }
            }
            break;
            
        case CameraMode.HOLD:
            targetScale = state.targetTransform.scale;
            targetRotation = state.targetTransform.rotation || 0;
            targetVignette = state.targetTransform.vignette || 0;
            break;
            
        default:
            targetScale = ZOOM_IDLE;
            targetRotation = 0;
            targetVignette = 0;
    }
    
    // Effect override
    if (activeEffectZoom !== undefined && nextMode !== CameraMode.FOCUSED) {
        targetScale = activeEffectZoom;
    }
    
    // 3. Enhanced Position Tracking
    let targetTx = state.transform.translateX;
    let targetTy = state.transform.translateY;
    let shiftX = 0;
    let shiftY = 0;
    
    const isTracking = nextMode === CameraMode.FOCUSED || 
                       nextMode === CameraMode.SOFT_FOCUS || 
                       nextMode === CameraMode.ANTICIPATION ||
                       nextMode === CameraMode.HOLD;
    
    if (isTracking) {
        let cursor = getCursorPos(time, moves);
        
        // Enhanced Magnetic Focus with prediction
        let usingMagneticFocus = false;
        if (nextMode === CameraMode.FOCUSED && activeEvent?.elementInfo?.rect) {
            const rect = activeEvent.elementInfo.rect;
            const center = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            
            if (cursor) {
                const distToCenter = Math.hypot(cursor.x - center.x, cursor.y - center.y);
                if (distToCenter < 0.35) {
                    cursor = center;
                    usingMagneticFocus = true;
                }
            }
        }
        
        if (cursor) {
            // Update focus history
            state.focusHistory.push({ x: cursor.x, y: cursor.y, time });
            if (state.focusHistory.length > FOCUS_HISTORY_LENGTH) {
                state.focusHistory.shift();
            }
            
            // Predictive lead with path prediction
            if (!usingMagneticFocus) {
                const predicted = predictNextFocus(state.focusHistory, time);
                if (predicted && cursorSpeed > 0.3) {
                    // Blend prediction with current velocity
                    const predWeight = clamp(cursorSpeed / 2, 0, 0.4);
                    cursor = {
                        x: lerp(cursor.x + cursorVelVec.x * PREDICTIVE_LEAD_TIME, predicted.x, predWeight),
                        y: lerp(cursor.y + cursorVelVec.y * PREDICTIVE_LEAD_TIME, predicted.y, predWeight)
                    };
                } else {
                    cursor = {
                        x: cursor.x + cursorVelVec.x * PREDICTIVE_LEAD_TIME,
                        y: cursor.y + cursorVelVec.y * PREDICTIVE_LEAD_TIME
                    };
                }
            }
            
            // Screen space calculations
            const currentScale = state.transform.scale;
            const currentTx = state.transform.translateX;
            const currentTy = state.transform.translateY;
            
            const cursorScreenX = (cursor.x * viewport.width) * currentScale + currentTx;
            const cursorScreenY = (cursor.y * viewport.height) * currentScale + currentTy;
            
            const centerX = viewport.width / 2;
            const centerY = viewport.height / 2;
            
            const dx = cursorScreenX - centerX;
            const dy = cursorScreenY - centerY;
            
            // Adaptive padding based on speed
            const speedBoost = clamp(cursorSpeed * 0.5, 0, 0.1);
            const innerPadX = viewport.width * (INNER_PADDING_X_PCT - speedBoost);
            const innerPadY = viewport.height * (INNER_PADDING_Y_PCT - speedBoost);
            const outerPadX = viewport.width * (OUTER_PADDING_X_PCT + speedBoost);
            const outerPadY = viewport.height * (OUTER_PADDING_Y_PCT + speedBoost);
            
            shiftX = paddedFollow(dx, innerPadX, outerPadX);
            shiftY = paddedFollow(dy, innerPadY, outerPadY);
            
            // Apply momentum
            state.momentum.x = state.momentum.x * MOMENTUM_DECAY + shiftX * 0.1;
            state.momentum.y = state.momentum.y * MOMENTUM_DECAY + shiftY * 0.1;
        }
    } else {
        // Idle centering with imperfection
        const targetXNorm = 0.5;
        const targetYNorm = 0.5;
        const idealTx = (0.5 * viewport.width) - (targetXNorm * viewport.width * targetScale);
        const idealTy = (0.5 * viewport.height) - (targetYNorm * viewport.height * targetScale);
        
        const driftFactor = duration > 0 && time > duration - 2.0 ? 0 : 0.08;
        
        targetTx = lerp(idealTx, state.transform.translateX, driftFactor);
        targetTy = lerp(idealTy, state.transform.translateY, driftFactor);
        
        shiftX = targetTx - state.transform.translateX;
        shiftY = targetTy - state.transform.translateY;
        
        // Decay momentum
        state.momentum.x *= MOMENTUM_DECAY;
        state.momentum.y *= MOMENTUM_DECAY;
    }
    
    // 4. Multi-Frame Smoothing & Physics
    const timeScale = dt * 60;
    
    // Zoom smoothing with anticipation
    const currentScale = state.transform.scale;
    const dScale = targetScale - currentScale;
    const zoomSpeed = state.mode === CameraMode.ANTICIPATION ? 0.25 : 0.18;
    const zoomDelta = clamp(dScale * zoomSpeed, -0.06, 0.06);
    const newScale = Math.max(1, currentScale + zoomDelta * timeScale);
    
    // Rotation smoothing
    const currentRotation = state.transform.rotation || 0;
    const dRotation = (targetRotation || 0) - currentRotation;
    const rotationDelta = dRotation * 0.15 * timeScale;
    const newRotation = currentRotation + rotationDelta;
    
    // Vignette smoothing
    const currentVignette = state.transform.vignette || 0;
    const dVignette = (targetVignette || 0) - currentVignette;
    const vignetteDelta = dVignette * 0.2 * timeScale;
    const newVignette = clamp(currentVignette + vignetteDelta, 0, 0.3);
    
    // Pan with enhanced physics
    const forceDistance = Math.hypot(shiftX, shiftY);
    const distFactor = clamp(forceDistance / 350, 0, 1);
    const baseStiffness = lerp(0.14, 0.25, distFactor);
    
    // Boost stiffness during anticipation
    const stiffness = state.mode === CameraMode.ANTICIPATION 
        ? baseStiffness * 0.7 
        : baseStiffness;
    
    const alpha = 1 - Math.pow(1 - stiffness, timeScale);
    
    let newTx = state.transform.translateX;
    let newTy = state.transform.translateY;
    
    // Bezier path handling (unchanged)
    if (state.useBezierPath && state.bezierPath && state.bezierPath.length > 1) {
        const pathTime = state.bezierPathTime || 0;
        const pathDuration = 0.5;
        const normalizedTime = Math.min(1, pathTime / pathDuration);
        const easedTime = easeInOutCubic(normalizedTime);
        
        const curves = createSmoothPath(state.bezierPath);
        if (curves.length > 0) {
            const curveIndex = Math.min(Math.floor(easedTime * curves.length), curves.length - 1);
            const curve = curves[curveIndex];
            const curveT = (easedTime * curves.length) % 1;
            const point = bezierPoint(curveT, curve);
            
            newTx = point.x * viewport.width - viewport.width / 2;
            newTy = point.y * viewport.height - viewport.height / 2;
            
            const newPathTime = (state.bezierPathTime || 0) + dt;
            if (newPathTime >= pathDuration) {
                state.useBezierPath = false;
                state.bezierPath = undefined;
                state.bezierPathTime = undefined;
            } else {
                state.bezierPathTime = newPathTime;
            }
        }
    } else if (forceDistance > 0.08) {
        const stepX = shiftX * alpha + state.momentum.x;
        const stepY = shiftY * alpha + state.momentum.y;
        
        if (isTracking) {
            newTx -= stepX;
            newTy -= stepY;
            targetTx = newTx;
            targetTy = newTy;
        } else {
            newTx += stepX;
            newTy += stepY;
        }
    } else {
        if (!isTracking) {
            newTx = targetTx;
            newTy = targetTy;
        }
    }
    
    // Apply micro-shake
    newTx += state.microShake.x * viewport.width;
    newTy += state.microShake.y * viewport.height;
    
    // Multi-frame smoothing buffer
    const currentTransform = {
        scale: newScale,
        translateX: newTx,
        translateY: newTy,
        rotation: newRotation,
        vignette: newVignette
    };
    
    state.smoothingBuffer.push(currentTransform);
    if (state.smoothingBuffer.length > SMOOTHING_BUFFER_SIZE) {
        state.smoothingBuffer.shift();
    }
    
    // Average buffer for ultra-smooth result
    const smoothed = state.smoothingBuffer.reduce((acc, t) => ({
        scale: acc.scale + t.scale / state.smoothingBuffer.length,
        translateX: acc.translateX + t.translateX / state.smoothingBuffer.length,
        translateY: acc.translateY + t.translateY / state.smoothingBuffer.length,
        rotation: acc.rotation + (t.rotation || 0) / state.smoothingBuffer.length,
        vignette: acc.vignette + (t.vignette || 0) / state.smoothingBuffer.length
    }), { scale: 0, translateX: 0, translateY: 0, rotation: 0, vignette: 0 });
    
    // Bounds clamping
    const finalScale = smoothed.scale;
    const minTx = viewport.width * (1 - finalScale);
    const maxTx = 0;
    const minTy = viewport.height * (1 - finalScale);
    const maxTy = 0;
    
    if (finalScale <= 1.001) {
        smoothed.translateX = 0;
        smoothed.translateY = 0;
    } else {
        smoothed.translateX = Math.max(minTx, Math.min(maxTx, smoothed.translateX));
        smoothed.translateY = Math.max(minTy, Math.min(maxTy, smoothed.translateY));
    }
    
    // Calculate velocities
    const vScale = (finalScale - currentScale) / dt;
    const vTx = (smoothed.translateX - state.transform.translateX) / dt;
    const vTy = (smoothed.translateY - state.transform.translateY) / dt;
    const vRotation = ((smoothed.rotation || 0) - (state.transform.rotation || 0)) / dt;
    
    return {
        mode: nextMode,
        activeEvent,
        lastIntentTime: intentTime,
        focusStartTime,
        startTargetTransform: state.startTargetTransform,
        currentZoom: finalScale,
        blur: activeEffectBlur,
        spotlight: activeEffectSpotlight,
        transform: smoothed,
        targetTransform: {
            scale: targetScale,
            translateX: targetTx,
            translateY: targetTy,
            rotation: targetRotation,
            vignette: targetVignette
        },
        velocity: {
            scale: vScale,
            translateX: vTx,
            translateY: vTy,
            rotation: vRotation
        },
        handleHoldTimer: state.handleHoldTimer,
        momentum: state.momentum,
        anticipationPhase: state.anticipationPhase,
        cinematicMode: state.cinematicMode,
        focusHistory: state.focusHistory,
        smoothingBuffer: state.smoothingBuffer,
        microShake: state.microShake,
        transitionCurve: state.transitionCurve,
        bezierPath: state.bezierPath,
        bezierPathTime: state.bezierPathTime,
        useBezierPath: state.useBezierPath
    };
};