import { ClickData, MoveData, EffectEvent } from "@/pages/Recorder";

export interface VideoConfig {
    url: string | null;
    duration: number;
    width: number;
    height: number;
    aspectRatio: number;
}

export interface CameraConfig {
    zoomStrength: number; // 1.0 to 5.0
    speed: number;        // 0.1 to 2.0 multiplier
    padding: number;      // 0.0 to 0.5 (percentage of screen)
    mode: 'cinematic' | 'fast' | 'manual';
}

export interface CursorConfig {
    size: number;        // Scale multiplier (1.0 default)
    color: string;
    glow: boolean;
    trail: boolean;
    trailLength: number; // Number of history points to keep
}

export interface EffectsConfig {
    clickRipple: boolean;
    clickSize: number;
    clickColor: string;
    clickEmphasis: boolean; // Double click emphasis
    // Click animation styles
    clickAnimationStyle: 'ripple' | 'orb' | 'pulse' | 'ring' | 'splash' | 'none';
    clickForce: number; // 0.0 to 1.0 - strength/intensity multiplier
    clickEasing: 'linear' | 'ease-out' | 'ease-in-out' | 'bounce' | 'elastic';
}

export type AspectRatioPreset = 'native' | '16:9' | '9:16' | '1:1' | '4:3' | '21:9' | 'custom';

export interface PresentationConfig {
    // Aspect ratio and output dimensions
    aspectRatio: AspectRatioPreset;
    customAspectRatio?: { width: number; height: number }; // For custom preset
    outputWidth: number;
    outputHeight: number;

    // Background settings
    backgroundMode: 'hidden' | 'solid' | 'gradient' | 'image';
    backgroundColor: string; // Hex color for solid
    backgroundGradient: {
        type: 'linear' | 'radial';
        angle?: number; // For linear (degrees)
        stops: Array<{ color: string; position: number }>; // 0-1 positions
    };
    backgroundImage?: string; // URL or data URL
    backgroundBlur: number; // 0-100 - blur radius in pixels
    backgroundBlurType: 'gaussian' | 'stack'; // Blur algorithm

    // Video cropping
    videoCrop: {
        enabled: boolean;
        top: number; // Pixels to crop from top (browser chrome)
        bottom: number; // Pixels to crop from bottom
        left: number; // Pixels to crop from left
        right: number; // Pixels to crop from right
        roundedCorners: boolean; // Add rounded corners (minimal mode)
        cornerRadius: number; // Corner radius in pixels
    };

    // Render quality
    screenDPR: number; // Device pixel ratio multiplier (1.0 = native, 2.0 = 2x, etc.)

    // Video padding (inside container, makes background visible)
    videoPadding: {
        enabled: boolean;
        top: number; // Pixels
        right: number; // Pixels
        bottom: number; // Pixels
        left: number; // Pixels
        uniform: boolean; // If true, all sides use the same value
    };

    // Layered rendering settings
    layeredRendering?: boolean; // Enable layered rendering with stable outer container
    stabilization?: {
        enabled: boolean;
        strength: number; // 0.0 to 1.0 - how much to stabilize
        smoothing: number; // 0.0 to 1.0 - smoothing factor for stabilization
        windowSize?: number; // Number of frames to average over for stabilization
    };
    effectContainers?: {
        enabled: boolean;
        zoomContainer?: boolean; // Apply zoom in its own container
        effectsContainer?: boolean; // Apply other effects in their container
    };
}

export interface TimelineEvent {
    id: string;
    type: 'click' | 'marker';
    time: number;
    label?: string;
}

export interface PlaybackState {
    currentTime: number;
    isPlaying: boolean;
    volume: number;
    isMuted: boolean;
}

export interface EditorState {
    video: VideoConfig;
    camera: CameraConfig;
    cursor: CursorConfig;
    effects: EffectsConfig;
    presentation: PresentationConfig;
    // Feature Parity
    colorGrading: {
        brightness: number;
        contrast: number;
        saturation: number;
        hue: number;
        temperature: number;
        vignette: number;
    };
    textOverlays: Array<{
        id: string;
        text: string;
        x: number;
        y: number;
        fontSize: number;
        color: string;
        startTime: number;
        endTime: number;
        animation: 'fade' | 'slide' | 'typewriter';
    }>;

    events: {
        clicks: ClickData[];
        moves: MoveData[];
        effects: EffectEvent[];
        markers: TimelineEvent[];
    };
    playback: PlaybackState;
}

export const DEFAULT_EDITOR_STATE: EditorState = {
    video: {
        url: null,
        duration: 0,
        width: 1920,
        height: 1080,
        aspectRatio: 16 / 9,
    },
    camera: {
        zoomStrength: 2.5,
        speed: 1.0,
        padding: 0.2, // 20% deadzone
        mode: 'cinematic',
    },
    cursor: {
        size: 1.0,
        color: '#000000', // Simple black cursor
        glow: false,
        trail: false,
        trailLength: 0,
    },
    effects: {
        clickRipple: false,
        clickSize: 1.0,
        clickColor: 'rgba(235, 64, 52, 0.5)',
        clickEmphasis: false,
        clickAnimationStyle: 'ripple',
        clickForce: 1.0,
        clickEasing: 'ease-out',
    },
    presentation: {
        aspectRatio: 'native',
        outputWidth: 1920,
        outputHeight: 1080,
        backgroundMode: 'hidden',
        backgroundColor: '#000000',
        backgroundGradient: {
            type: 'linear',
            angle: 135,
            stops: [
                { color: '#667eea', position: 0 },
                { color: '#764ba2', position: 1 },
            ],
        },
        backgroundBlur: 0,
        backgroundBlurType: 'gaussian',
        videoCrop: {
            enabled: false,
            top: 100, // Default browser chrome height
            bottom: 0,
            left: 0,
            right: 0,
            roundedCorners: false,
            cornerRadius: 12,
        },
        screenDPR: 1.0,
        videoPadding: {
            enabled: false,
            top: 50,
            right: 50,
            bottom: 50,
            left: 50,
            uniform: true,
        },
    },
    colorGrading: {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        hue: 0,
        temperature: 0,
        vignette: 0,
    },
    textOverlays: [],
    events: {
        clicks: [],
        moves: [],
        effects: [],
        markers: [],
    },
    playback: {
        currentTime: 0,
        isPlaying: false,
        volume: 1,
        isMuted: false,
    },
};
