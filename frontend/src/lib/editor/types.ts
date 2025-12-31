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
        color: '#eb4034', // Default red-ish cursor
        glow: true,
        trail: true,
        trailLength: 20,
    },
    effects: {
        clickRipple: true,
        clickSize: 1.0,
        clickColor: 'rgba(235, 64, 52, 0.5)',
        clickEmphasis: true,
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
