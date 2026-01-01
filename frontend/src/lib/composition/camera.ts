import { ClickData, MoveData, EffectEvent } from "../../pages/Recorder";
import { getCursorPos, solveSpring, getCursorVelocity, getCursorVelocityVector } from "./math";

// Camera mode enum - expanded for better state management
export enum CameraMode {
    IDLE = "IDLE",
    FOCUSED = "FOCUSED",
    ANTICIPATING = "ANTICIPATING", // Pre-moving before cursor reaches edge
    PANNING = "PANNING", // Smooth panning without zoom
    SETTLING = "SETTLING", // Returning to neutral after action
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
    // Spring physics state
    velocity: {
        scale: number;
        translateX: number;
        translateY: number;
    };
    // Advanced state tracking
    lastClickTime: number;
    clickHistory: Array<{ timestamp: number; x: number; y: number }>;
    activityLevel: number; // 0-1, tracks how active the user is
    focusPoint: { x: number; y: number } | null;
}

export interface Viewport {
    width: number;
    height: number;
}

// 🎬 NEXT-LEVEL CAMERA CONFIGURATION
// Designed by thinking like a professional demo creator
const CAMERA_CONFIG = {
    // Base zoom levels
    ZOOM_MIN: 1.0 as number,
    ZOOM_MAX: 2.2 as number, // Slightly higher for dramatic moments
    ZOOM_BASE_CLICK: 1.3 as number, // Standard click zoom
    ZOOM_SMALL_TARGET: 1.6 as number, // For small UI elements
    ZOOM_LARGE_TARGET: 1.15 as number, // For large areas (less zoom needed)
    ZOOM_DRAMATIC: 1.8 as number, // For important moments
    
    // Dynamic zoom calculation thresholds
    SMALL_TARGET_SIZE: 0.05, // 5% of viewport = small target
    LARGE_TARGET_SIZE: 0.3, // 30% of viewport = large target
    
    // Timing - context-aware durations
    ZOOM_HOLD_MIN: 0.4 as number, // Minimum hold (fast interactions)
    ZOOM_HOLD_MAX: 1.2 as number, // Maximum hold (important moments)
    ZOOM_HOLD_DEFAULT: 0.7 as number, // Default hold
    ZOOM_DECAY_MIN: 0.5 as number, // Fast decay for rapid clicks
    ZOOM_DECAY_MAX: 1.2 as number, // Slow decay for important moments
    ZOOM_DECAY_DEFAULT: 0.9 as number, // Default decay
    
    // Zoom suppression logic
    RAPID_CLICK_THRESHOLD: 0.3, // Seconds between clicks = rapid
    RAPID_CLICK_SUPPRESS: true, // Suppress zoom on rapid clicks
    MIN_CLICKS_FOR_ZOOM: 1, // Minimum clicks before zooming (can be 1 for single important clicks)
    CLICK_CLUSTER_WINDOW: 2.0, // Seconds to consider clicks as cluster
    
    // Velocity-based decisions
    VELOCITY_SLOW_THRESHOLD: 0.3, // Normalized units/sec - slow = zoom more
    VELOCITY_FAST_THRESHOLD: 1.5, // Fast = don't zoom
    VELOCITY_ZOOM_MULTIPLIER: 0.3, // How much velocity affects zoom
    
    // Activity level tracking
    ACTIVITY_DECAY_RATE: 0.95, // Per second
    ACTIVITY_CLICK_BOOST: 0.3, // Boost per click
    ACTIVITY_MOVE_BOOST: 0.05, // Boost per significant move
    
    // Smart framing - Rule of Thirds
    USE_RULE_OF_THIRDS: true,
    RULE_OF_THIRDS_STRENGTH: 0.3, // How much to bias toward rule of thirds (0-1)
    
    // Anticipatory movement
    ANTICIPATION_ENABLED: true,
    ANTICIPATION_DISTANCE: 0.15, // Start moving when cursor is 15% from edge
    ANTICIPATION_STRENGTH: 0.6, // How much to anticipate (0-1)
    
    // Safe box for camera movement (center area where camera doesn't move)
    SAFE_BOX_SIZE: 0.35, // 35% center area (slightly tighter for more responsive feel)
    SAFE_BOX_FALLOFF: 0.2, // Smooth falloff zone
    
    // Edge padding and boundary detection
    EDGE_PADDING: 0.08, // 8% padding from edges
    EDGE_DAMPING: 0.7, // Reduce movement near edges
    
    // Spring physics - tuned for cinematic feel
    ZOOM_STIFFNESS: 10.0, // Slightly higher for snappier zoom
    ZOOM_DAMPING: 0.88, // High damping = smooth, no bounce
    CAMERA_STIFFNESS_MIN: 8.0, // Minimum stiffness (slow movements)
    CAMERA_STIFFNESS_MAX: 18.0, // Maximum stiffness (fast movements)
    CAMERA_DAMPING: 0.85, // Smooth camera movement
    
    // Composition awareness
    COMPOSITION_WEIGHT: 0.4, // How much composition matters vs direct centering
    MIN_FOCUS_DISTANCE: 0.05, // Minimum distance to trigger focus change
    
    // Pacing and rhythm
    SETTLE_DURATION: 0.3, // Time to settle after action
    IDLE_THRESHOLD: 1.5, // Seconds of inactivity = idle
} as const;

const ZOOM_LEVEL = 1.0;

// Helper: Calculate target size from click data
function getTargetSize(click: ClickData, viewport: Viewport): number {
    if (click.elementInfo?.rect) {
        const rect = click.elementInfo.rect;
        const width = rect.width * viewport.width;
        const height = rect.height * viewport.height;
        const area = width * height;
        const viewportArea = viewport.width * viewport.height;
        return area / viewportArea; // Normalized 0-1
    }
    // Default: assume small target if no info
    return 0.03;
}

// Helper: Calculate dynamic zoom level based on context
function calculateDynamicZoom(
    click: ClickData,
    viewport: Viewport,
    cursorVelocity: number,
    activityLevel: number,
    timeSinceLastClick: number
): number {
    const targetSize = getTargetSize(click, viewport);
    
    // Base zoom from target size
    let zoom = CAMERA_CONFIG.ZOOM_BASE_CLICK;
    
    if (targetSize < CAMERA_CONFIG.SMALL_TARGET_SIZE) {
        // Small target - zoom more
        zoom = CAMERA_CONFIG.ZOOM_SMALL_TARGET;
    } else if (targetSize > CAMERA_CONFIG.LARGE_TARGET_SIZE) {
        // Large target - zoom less
        zoom = CAMERA_CONFIG.ZOOM_LARGE_TARGET;
    }
    
    // Adjust based on cursor velocity (slow = zoom more, fast = zoom less)
    const velocityFactor = 1.0 - (Math.min(cursorVelocity, CAMERA_CONFIG.VELOCITY_FAST_THRESHOLD) / CAMERA_CONFIG.VELOCITY_FAST_THRESHOLD) * CAMERA_CONFIG.VELOCITY_ZOOM_MULTIPLIER;
    zoom *= velocityFactor;
    
    // Adjust based on activity level (high activity = less dramatic zoom)
    const activityFactor = 1.0 - (activityLevel * 0.2); // Reduce zoom by up to 20% for high activity
    zoom *= activityFactor;
    
    // Boost for important clicks (double clicks, right clicks)
    if (click.type === 'doubleClick') {
        zoom *= 1.15; // 15% boost for double clicks
    }
    
    // Clamp to valid range
    return Math.max(CAMERA_CONFIG.ZOOM_MIN, Math.min(CAMERA_CONFIG.ZOOM_MAX, zoom));
}

// Helper: Calculate dynamic hold duration
function calculateHoldDuration(
    click: ClickData,
    cursorVelocity: number,
    activityLevel: number
): number {
    let duration = CAMERA_CONFIG.ZOOM_HOLD_DEFAULT;
    
    // Fast cursor = shorter hold (user is moving quickly)
    if (cursorVelocity > CAMERA_CONFIG.VELOCITY_FAST_THRESHOLD) {
        duration = CAMERA_CONFIG.ZOOM_HOLD_MIN;
    } else if (cursorVelocity < CAMERA_CONFIG.VELOCITY_SLOW_THRESHOLD) {
        // Slow cursor = longer hold (user is being deliberate)
        duration = CAMERA_CONFIG.ZOOM_HOLD_MAX;
    }
    
    // High activity = shorter holds (keep pace with user)
    duration *= (1.0 - activityLevel * 0.3);
    
    // Important clicks get longer holds
    if (click.type === 'doubleClick') {
        duration *= 1.3;
    }
    
    return Math.max(CAMERA_CONFIG.ZOOM_HOLD_MIN, Math.min(CAMERA_CONFIG.ZOOM_HOLD_MAX, duration));
}

// Helper: Check if zoom should be suppressed
function shouldSuppressZoom(
    click: ClickData,
    clickHistory: Array<{ timestamp: number; x: number; y: number }>,
    currentZoom: number
): boolean {
    // Suppress if already zoomed significantly
    if (currentZoom > 1.25) {
        return true;
    }
    
    // Suppress rapid clicks
    if (CAMERA_CONFIG.RAPID_CLICK_SUPPRESS && clickHistory.length > 0) {
        const lastClick = clickHistory[clickHistory.length - 1];
        const timeSinceLastClick = click.timestamp - lastClick.timestamp;
        
        if (timeSinceLastClick < CAMERA_CONFIG.RAPID_CLICK_THRESHOLD) {
            // Rapid click - check if it's in a different area
            const distance = Math.hypot(
                click.x - lastClick.x,
                click.y - lastClick.y
            );
            
            // If rapid click in same area, suppress
            if (distance < 0.1) {
                return true;
            }
        }
    }
    
    return false;
}

// Helper: Apply rule of thirds positioning
function applyRuleOfThirds(
    x: number,
    y: number,
    viewport: Viewport
): { x: number; y: number } {
    if (!CAMERA_CONFIG.USE_RULE_OF_THIRDS) {
        return { x, y };
    }
    
    // Rule of thirds lines are at 1/3 and 2/3
    const thirdX = viewport.width / 3;
    const thirdY = viewport.height / 3;
    
    // Find nearest third line
    const nearestThirdX = Math.abs(x - thirdX) < Math.abs(x - 2 * thirdX) ? thirdX : 2 * thirdX;
    const nearestThirdY = Math.abs(y - thirdY) < Math.abs(y - 2 * thirdY) ? thirdY : 2 * thirdY;
    
    // Blend between actual position and rule of thirds position
    const blendedX = x * (1 - CAMERA_CONFIG.RULE_OF_THIRDS_STRENGTH) + nearestThirdX * CAMERA_CONFIG.RULE_OF_THIRDS_STRENGTH;
    const blendedY = y * (1 - CAMERA_CONFIG.RULE_OF_THIRDS_STRENGTH) + nearestThirdY * CAMERA_CONFIG.RULE_OF_THIRDS_STRENGTH;
    
    return { x: blendedX, y: blendedY };
}

// Helper: Calculate anticipatory movement
function calculateAnticipation(
    cursorPos: { x: number; y: number },
    cursorVelocity: { x: number; y: number },
    viewport: Viewport
): { x: number; y: number } {
    if (!CAMERA_CONFIG.ANTICIPATION_ENABLED) {
        return { x: 0, y: 0 };
    }
    
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    
    // Convert normalized cursor to pixel coordinates
    const cursorX = cursorPos.x * viewport.width;
    const cursorY = cursorPos.y * viewport.height;
    
    // Calculate distance from center
    const dx = cursorX - centerX;
    const dy = cursorY - centerY;
    
    // Distance from center (normalized)
    const distanceFromCenter = Math.hypot(dx, dy) / Math.min(viewport.width, viewport.height);
    
    // Only anticipate if cursor is moving toward edge
    const movingTowardEdge = 
        (dx > 0 && cursorVelocity.x > 0) || (dx < 0 && cursorVelocity.x < 0) ||
        (dy > 0 && cursorVelocity.y > 0) || (dy < 0 && cursorVelocity.y < 0);
    
    if (!movingTowardEdge || distanceFromCenter < CAMERA_CONFIG.ANTICIPATION_DISTANCE) {
        return { x: 0, y: 0 };
    }
    
    // Calculate anticipation offset
    const anticipationX = cursorVelocity.x * CAMERA_CONFIG.ANTICIPATION_STRENGTH * viewport.width * 0.1;
    const anticipationY = cursorVelocity.y * CAMERA_CONFIG.ANTICIPATION_STRENGTH * viewport.height * 0.1;
    
    return { x: anticipationX, y: anticipationY };
}

// Helper: Calculate smart camera position with composition awareness
function calculateSmartPosition(
    focusPoint: { x: number; y: number },
    zoom: number,
    viewport: Viewport,
    cursorVelocity: { x: number; y: number }
): { x: number; y: number } {
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    
    // Convert normalized to pixel coordinates
    const focusX = focusPoint.x * viewport.width;
    const focusY = focusPoint.y * viewport.height;
    
    // Apply rule of thirds
    const composed = applyRuleOfThirds(focusX, focusY, viewport);
    
    // Blend between direct centering and rule of thirds
    const targetX = composed.x * CAMERA_CONFIG.COMPOSITION_WEIGHT + focusX * (1 - CAMERA_CONFIG.COMPOSITION_WEIGHT);
    const targetY = composed.y * CAMERA_CONFIG.COMPOSITION_WEIGHT + focusY * (1 - CAMERA_CONFIG.COMPOSITION_WEIGHT);
    
    // Calculate offset needed to center this point
    const offsetX = (targetX - centerX) * (zoom - 1) / zoom;
    const offsetY = (targetY - centerY) * (zoom - 1) / zoom;
    
    // Add anticipatory movement
    const anticipation = calculateAnticipation(focusPoint, cursorVelocity, viewport);
    
    return {
        x: offsetX + anticipation.x,
        y: offsetY + anticipation.y,
    };
}

// Helper: Update activity level
function updateActivityLevel(
    currentLevel: number,
    dt: number,
    hasClick: boolean,
    hasSignificantMove: boolean
): number {
    // Decay activity level
    let newLevel = currentLevel * Math.pow(CAMERA_CONFIG.ACTIVITY_DECAY_RATE, dt);
    
    // Boost on interactions
    if (hasClick) {
        newLevel = Math.min(1.0, newLevel + CAMERA_CONFIG.ACTIVITY_CLICK_BOOST);
    }
    if (hasSignificantMove) {
        newLevel = Math.min(1.0, newLevel + CAMERA_CONFIG.ACTIVITY_MOVE_BOOST);
    }
    
    return newLevel;
}

export const getInitialCameraState = (): CameraSystemState => ({
    mode: CameraMode.IDLE,
    transform: { scale: ZOOM_LEVEL, translateX: 0, translateY: 0, rotation: 0, vignette: 0 },
    targetTransform: { scale: ZOOM_LEVEL, translateX: 0, translateY: 0, rotation: 0, vignette: 0 },
    activeEvent: null,
    focusStartTime: 0,
    startTargetTransform: { scale: ZOOM_LEVEL, translateX: 0, translateY: 0, rotation: 0, vignette: 0 },
    currentZoom: ZOOM_LEVEL,
    blur: 0,
    spotlight: false,
    velocity: {
        scale: 0,
        translateX: 0,
        translateY: 0,
    },
    lastClickTime: -1,
    clickHistory: [],
    activityLevel: 0,
    focusPoint: null,
});

/**
 * 🎬 NEXT-LEVEL CAMERA SYSTEM
 * 
 * Designed with professional demo creator mindset:
 * - Intelligent zoom decisions based on context
 * - Smart framing with rule of thirds
 * - Anticipatory movement
 * - Dynamic timing based on user activity
 * - Composition awareness
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
    // Clamp dt to prevent large jumps
    const safeDt = Math.min(dt, 0.1);
    
    // Get current cursor position and velocity
    const cursorPos = getCursorPos(time, moves);
    const cursorVelocity = cursorPos ? getCursorVelocity(time, moves, 0.1) : 0;
    const cursorVelocityVec = cursorPos ? getCursorVelocityVector(time, moves, 0.1) : { x: 0, y: 0 };
    
    // Update activity level
    const recentClicks = clicks.filter(c => time - c.timestamp < 2.0);
    const hasRecentClick = recentClicks.length > 0 && recentClicks[recentClicks.length - 1].timestamp === time - safeDt;
    const hasSignificantMove = cursorVelocity > 0.5;
    
    const newActivityLevel = updateActivityLevel(
        state.activityLevel,
        safeDt,
        hasRecentClick,
        hasSignificantMove
    );
    
    // Update click history (keep last 5 clicks)
    const updatedClickHistory = [...state.clickHistory];
    recentClicks.forEach(click => {
        if (!updatedClickHistory.find(c => Math.abs(c.timestamp - click.timestamp) < 0.01)) {
            updatedClickHistory.push({ timestamp: click.timestamp, x: click.x, y: click.y });
        }
    });
    // Keep only recent clicks
    const filteredClickHistory = updatedClickHistory
        .filter(c => time - c.timestamp < CAMERA_CONFIG.CLICK_CLUSTER_WINDOW)
        .slice(-5);
    
    // Calculate target camera transform
    let targetScale = ZOOM_LEVEL;
    let targetTranslateX = 0;
    let targetTranslateY = 0;
    let mode = CameraMode.IDLE;
    let activeEvent: ClickData | null = null;
    let focusPoint: { x: number; y: number } | null = null;
    
    // Find active click (within zoom window)
    const activeClicks = clicks.filter(c => {
        const timeSinceClick = time - c.timestamp;
        // Use dynamic hold duration
        const holdDuration = calculateHoldDuration(c, cursorVelocity, newActivityLevel);
        const decayDuration = CAMERA_CONFIG.ZOOM_DECAY_DEFAULT;
        return timeSinceClick >= 0 && timeSinceClick < holdDuration + decayDuration;
    });
    
    if (activeClicks.length > 0) {
        // Sort by timestamp (most recent first)
        activeClicks.sort((a, b) => b.timestamp - a.timestamp);
        const latestClick = activeClicks[0];
        const timeSinceClick = time - latestClick.timestamp;
        
        // Check if we should zoom
        const shouldZoom = !shouldSuppressZoom(latestClick, filteredClickHistory, state.currentZoom);
        
        if (shouldZoom) {
            const holdDuration = calculateHoldDuration(latestClick, cursorVelocity, newActivityLevel);
            const decayDuration = CAMERA_CONFIG.ZOOM_DECAY_DEFAULT;
            
            if (timeSinceClick < holdDuration) {
                // Zoom in phase - move camera to focus on click position
                mode = CameraMode.FOCUSED;
                activeEvent = latestClick;
                focusPoint = { x: latestClick.x, y: latestClick.y };
                
                // Calculate dynamic zoom
                targetScale = calculateDynamicZoom(
                    latestClick,
                    viewport,
                    cursorVelocity,
                    newActivityLevel,
                    timeSinceClick
                );
                
                // Move camera to focus on click position (intelligent framing)
                const smartPos = calculateSmartPosition(
                    focusPoint,
                    targetScale,
                    viewport,
                    cursorVelocityVec
                );
                
                targetTranslateX = smartPos.x;
                targetTranslateY = smartPos.y;
            } else {
                // Decay phase - smoothly zoom out and return to center
                const decayProgress = (timeSinceClick - holdDuration) / decayDuration;
                const easedDecay = 1 - Math.pow(1 - decayProgress, 3); // Ease out cubic
                
                // Calculate zoom level during decay
                const zoomInLevel = calculateDynamicZoom(
                    latestClick,
                    viewport,
                    cursorVelocity,
                    newActivityLevel,
                    holdDuration
                );
                targetScale = lerp(zoomInLevel, ZOOM_LEVEL, easedDecay);
                
                // Smoothly return camera to center during decay
                const currentFocus = focusPoint || { x: latestClick.x, y: latestClick.y };
                const smartPos = calculateSmartPosition(
                    currentFocus,
                    zoomInLevel,
                    viewport,
                    cursorVelocityVec
                );
                
                targetTranslateX = lerp(smartPos.x, 0, easedDecay);
                targetTranslateY = lerp(smartPos.y, 0, easedDecay);
                
                mode = CameraMode.SETTLING;
            }
        } else {
            // Suppressed zoom - zoom out and return to center
            mode = CameraMode.SETTLING;
            targetScale = ZOOM_LEVEL;
            // Smoothly return to center
            const returnStrength = 0.15;
            targetTranslateX = state.transform.translateX * (1 - returnStrength);
            targetTranslateY = state.transform.translateY * (1 - returnStrength);
        }
    } else if (state.currentZoom > ZOOM_LEVEL + 0.01) {
        // Zoomed but no active click - zoom out and return to center
        mode = CameraMode.SETTLING;
        targetScale = ZOOM_LEVEL;
        // Smoothly return to center when just moving (no clicks)
        const returnStrength = 0.15;
        targetTranslateX = state.transform.translateX * (1 - returnStrength);
        targetTranslateY = state.transform.translateY * (1 - returnStrength);
    } else {
        // No active click and not zoomed - keep centered, no movement
        mode = CameraMode.IDLE;
        targetScale = ZOOM_LEVEL;
        targetTranslateX = 0;
        targetTranslateY = 0;
    }
    
    // Clamp scale
    targetScale = Math.max(CAMERA_CONFIG.ZOOM_MIN, Math.min(CAMERA_CONFIG.ZOOM_MAX, targetScale));
    
    // Update target transform
    const newTargetTransform: CameraState = {
        scale: targetScale,
        translateX: targetTranslateX,
        translateY: targetTranslateY,
        rotation: 0,
        vignette: 0,
    };
    
    // Dynamic spring stiffness based on movement speed
    const movementSpeed = Math.hypot(
        targetTranslateX - state.transform.translateX,
        targetTranslateY - state.transform.translateY
    );
    const normalizedSpeed = Math.min(1, movementSpeed / (viewport.width * 0.1));
    const dynamicStiffness = lerp(
        CAMERA_CONFIG.CAMERA_STIFFNESS_MIN,
        CAMERA_CONFIG.CAMERA_STIFFNESS_MAX,
        normalizedSpeed
    );
    
    // Apply spring physics to smoothly interpolate to target
    const scaleSpring = solveSpring(
        state.transform.scale,
        targetScale,
        state.velocity.scale,
        CAMERA_CONFIG.ZOOM_STIFFNESS,
        CAMERA_CONFIG.ZOOM_DAMPING,
        1.0,
        safeDt
    );
    
    const translateXSpring = solveSpring(
        state.transform.translateX,
        targetTranslateX,
        state.velocity.translateX,
        dynamicStiffness,
        CAMERA_CONFIG.CAMERA_DAMPING,
        1.0,
        safeDt
    );
    
    const translateYSpring = solveSpring(
        state.transform.translateY,
        targetTranslateY,
        state.velocity.translateY,
        dynamicStiffness,
        CAMERA_CONFIG.CAMERA_DAMPING,
        1.0,
        safeDt
    );
    
    // Update transform with spring results
    const newTransform: CameraState = {
        scale: scaleSpring.value,
        translateX: translateXSpring.value,
        translateY: translateYSpring.value,
        rotation: 0,
        vignette: 0,
    };
    
    return {
        ...state,
        mode,
        transform: newTransform,
        targetTransform: newTargetTransform,
        activeEvent,
        focusPoint,
        currentZoom: newTransform.scale,
        velocity: {
            scale: scaleSpring.velocity,
            translateX: translateXSpring.velocity,
            translateY: translateYSpring.velocity,
        },
        blur: 0,
        spotlight: false,
        lastClickTime: activeClicks.length > 0 ? activeClicks[0].timestamp : state.lastClickTime,
        clickHistory: filteredClickHistory,
        activityLevel: newActivityLevel,
    };
};

// Helper function for linear interpolation
function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}
