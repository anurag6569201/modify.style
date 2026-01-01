/**
 * Video Stabilization System
 * Provides smooth, stable video by tracking and compensating for camera shake
 */

export interface StabilizationState {
    // Position history for smoothing
    positionHistory: Array<{ x: number; y: number; timestamp: number }>;
    // Smoothed position
    smoothedPosition: { x: number; y: number };
    // Velocity tracking
    velocity: { x: number; y: number };
    // Maximum history length
    maxHistoryLength: number;
}

export interface StabilizationConfig {
    enabled: boolean;
    strength: number; // 0.0 to 1.0 - how much to stabilize
    smoothing: number; // 0.0 to 1.0 - smoothing factor (higher = more smoothing)
    windowSize?: number; // Number of frames to average over (optional, defaults to 15)
}

const DEFAULT_CONFIG: StabilizationConfig = {
    enabled: true,
    strength: 0.7,
    smoothing: 0.8,
    windowSize: 15, // ~0.25s at 60fps
};

/**
 * Initialize stabilization state
 */
export function initStabilization(): StabilizationState {
    return {
        positionHistory: [],
        smoothedPosition: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        maxHistoryLength: 30, // Keep last 30 positions
    };
}

/**
 * Update stabilization state with new position
 * Returns stabilized position offset
 */
export function updateStabilization(
    state: StabilizationState,
    currentPosition: { x: number; y: number },
    config: StabilizationConfig = DEFAULT_CONFIG,
    timestamp: number = Date.now()
): { offsetX: number; offsetY: number; state: StabilizationState } {
    if (!config.enabled) {
        return { offsetX: 0, offsetY: 0, state };
    }

    // Use windowSize from config or default
    const windowSize = config.windowSize ?? DEFAULT_CONFIG.windowSize;

    // Add current position to history
    const updatedHistory = [...state.positionHistory, { ...currentPosition, timestamp }];
    
    // Keep only recent history
    const trimmedHistory = updatedHistory.slice(-state.maxHistoryLength);

    // Calculate average position over window
    const window = trimmedHistory.slice(-windowSize);
    if (window.length === 0) {
        return { offsetX: 0, offsetY: 0, state: { ...state, positionHistory: trimmedHistory } };
    }

    const avgX = window.reduce((sum, p) => sum + p.x, 0) / window.length;
    const avgY = window.reduce((sum, p) => sum + p.y, 0) / window.length;

    // Calculate deviation from average (camera shake)
    const deviationX = currentPosition.x - avgX;
    const deviationY = currentPosition.y - avgY;

    // Smooth the deviation using exponential smoothing
    const smoothedDeviationX = state.smoothedPosition.x * config.smoothing + deviationX * (1 - config.smoothing);
    const smoothedDeviationY = state.smoothedPosition.y * config.smoothing + deviationY * (1 - config.smoothing);

    // Apply strength multiplier
    const offsetX = -smoothedDeviationX * config.strength;
    const offsetY = -smoothedDeviationY * config.strength;

    // Update velocity
    const lastPosition = trimmedHistory.length > 1 ? trimmedHistory[trimmedHistory.length - 2] : currentPosition;
    const dt = timestamp - lastPosition.timestamp;
    const velocityX = dt > 0 ? (currentPosition.x - lastPosition.x) / dt : 0;
    const velocityY = dt > 0 ? (currentPosition.y - lastPosition.y) / dt : 0;

    return {
        offsetX,
        offsetY,
        state: {
            ...state,
            positionHistory: trimmedHistory,
            smoothedPosition: { x: smoothedDeviationX, y: smoothedDeviationY },
            velocity: { x: velocityX, y: velocityY },
        },
    };
}

/**
 * Stabilize camera transform
 * Takes camera transform and applies stabilization offset
 */
export function stabilizeTransform(
    transform: { translateX: number; translateY: number; scale: number },
    stabilizationOffset: { offsetX: number; offsetY: number }
): { translateX: number; translateY: number; scale: number } {
    return {
        translateX: transform.translateX + stabilizationOffset.offsetX,
        translateY: transform.translateY + stabilizationOffset.offsetY,
        scale: transform.scale,
    };
}

/**
 * Reset stabilization state
 */
export function resetStabilization(state: StabilizationState): StabilizationState {
    return initStabilization();
}

