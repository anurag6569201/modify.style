import { ClickData, MoveData, EffectEvent } from "../../pages/Recorder";

// Minimal camera mode enum
export enum CameraMode {
    IDLE = "IDLE",
    FOCUSED = "FOCUSED", // Kept just in case we need to know if interacting, but logic will be static
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

    // Kept for interface compatibility but unused
    activeEvent: ClickData | null;
    focusStartTime: number;
    startTargetTransform: CameraState;
    currentZoom: number;
    blur: number;
    spotlight: boolean;
}

export interface Viewport {
    width: number;
    height: number;
}

// Static configuration
const ZOOM_LEVEL = 1.0;

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
});

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
    // 1. Static State
    // No physics, no tracking, no zooming. Just return the initial static state.
    // We maintain the signature so Stage.tsx doesn't break.

    // Optional: We could support simple "Spotlight" toggle if an effect demands it, 
    // but the user asked to "simply record", implying a raw feed. 
    // We'll keep the logic extremely simple: Static.

    const staticState: CameraState = {
        scale: ZOOM_LEVEL,
        translateX: 0,
        translateY: 0,
        rotation: 0,
        vignette: 0
    };

    return {
        ...state,
        mode: CameraMode.IDLE,
        transform: staticState,
        targetTransform: staticState,
        currentZoom: ZOOM_LEVEL,
        blur: 0,
        // We can keep spotlight off for "simple recording" or strictly follow effects.
        // Let's keep it simple: No effects for now unless requested.
        spotlight: false
    };
};