import { ClickData, MoveData, EffectEvent } from "@/pages/Recorder";

/** A zoom/spotlight moment on the timeline (alias of the recorded effect event). */
export type ZoomEffect = EffectEvent;

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

export type CursorStyle = 'arrow' | 'halo' | 'dot' | 'spotlight' | 'hidden';

export interface CursorConfig {
    size: number;        // Scale multiplier (1.0 default)
    color: string;
    glow: boolean;
    trail: boolean;
    trailLength: number; // Number of history points to keep
    style: CursorStyle;  // Cursor rendering style
    theme: 'light' | 'dark' | 'auto'; // Color theme (legacy)
    animation: boolean;  // Enable cursor animations (legacy)
    completePath: boolean; // Enable complete path capture and visualization (legacy)
    clickPulse: boolean; // Pulse/scale animation on every click
    smoothing: number;   // 0 = raw recorded path, 1 = heavy smoothing
    haloColor: string;   // Ring/highlight color for halo & spotlight styles
}

export interface ClickEffectConfig {
    enabled: boolean;
    animationStyle: 'ripple' | 'orb' | 'pulse' | 'ring' | 'splash' | 'particles' | 'glow' | 'shockwave' | 'trail' | 'burst' | 
                   'neon-burst' | 'glitch' | 'cyber-pulse' | 'implosion' | 'magnetic' | 'hologram' | 'shock-blur' | 
                   'liquid' | 'time-freeze' | 'depth-pop' | 'heat-ripple' | 'none';
    size: number; // 0.5 to 3.0
    color: string; // Hex color
    secondaryColor?: string; // Secondary color for gradients
    force: number; // 0.0 to 1.5 - strength/intensity multiplier
    easing: 'linear' | 'ease-out' | 'ease-in-out' | 'bounce' | 'elastic' | 'spring';
    emphasis: boolean; // Double click emphasis
    particleCount?: number; // Number of particles (for particle effects)
    glowIntensity?: number; // Glow intensity (0-1)
    trailLength?: number; // Trail length in frames
    animationDuration?: number; // Custom animation duration
    glitchIntensity?: number; // Glitch RGB split intensity (0-1)
    blurStrength?: number; // Blur strength for shock-blur (0-20)
    distortionStrength?: number; // Distortion strength for liquid/heat (0-1)
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
    // Per-click effect configurations (keyed by click timestamp)
    clickEffects: Record<string, ClickEffectConfig>;
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
    // Video style
    videoStyle: {
        borderEnabled: boolean;
        borderColor: string;
        borderWidth: number;
        shadowEnabled: boolean;
        shadowColor: string;
        shadowBlur: number;
        shadowOffsetX: number;
        shadowOffsetY: number;
        rotation: number;
    };
}

export interface TimelineEvent {
    id: string;
    type: 'click';
    time: number;
    label?: string;
}

export interface PlaybackState {
    currentTime: number;
    isPlaying: boolean;
    volume: number;
    isMuted: boolean;
    /** Playback speed multiplier (0.25–2). Applied to video + voiceover audio. */
    playbackRate: number;
}

export interface ScriptSegment {
    id?: string;
    text: string;
    timestamp: number;
    audioUrl?: string | null;
    audioBlob?: Blob | null;
    duration?: number;
    isGenerated?: boolean;
}

export type ScriptTone = 'professional' | 'friendly' | 'energetic' | 'calm' | 'playful';

export type CaptionStyle = 'clean' | 'boxed' | 'gradient';

export interface CaptionsConfig {
    enabled: boolean;
    style: CaptionStyle;
    position: 'bottom' | 'top';
    size: number; // font size in px at 1080p reference
}

export interface MusicConfig {
    enabled: boolean;
    name: string;            // display name of the loaded file
    url: string | null;      // object/data URL (blob URLs are session-only)
    blob: Blob | null;       // in-memory audio for preview + export
    volume: number;          // 0–100 base music volume
    ducking: number;         // 0–100 → how much volume drops under narration
    loop: boolean;
    fadeIn: number;          // seconds
    fadeOut: number;         // seconds
}

export interface ScriptStyleConfig {
    template: string;   // template id, e.g. 'walkthrough'
    tone: ScriptTone;
    audience: string;   // free text, e.g. "new users"
    instructions: string; // extra guidance for the AI
}

export interface VoiceoverConfig {
    script: string;
    scriptSegments: ScriptSegment[];
    scriptStyle: ScriptStyleConfig;
    captions: CaptionsConfig;
    voiceId: string;
    audioUrl: string | null;
    audioBlob: Blob | null;
    duration: number;
    speed: number;
    pitch: number;
    volume: number;
    isGenerated: boolean;
    generatedAt: number | null;
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
    textOverlays: Array<TextOverlay>;
    voiceover: VoiceoverConfig;
    music: MusicConfig;
    events: {
        clicks: ClickData[];
        moves: MoveData[];
        effects: EffectEvent[];
    };
    playback: PlaybackState;
}

export interface TextOverlay {
        id: string;
        text: string;
        // Position & Transform
        x: number;
        y: number;
        rotation: number;
        scale: number;
        opacity: number;
        // Typography
        fontSize: number;
        fontFamily: string;
        fontWeight: string;
        fontStyle: 'normal' | 'italic';
        textAlign: 'left' | 'center' | 'right';
        lineHeight: number;
        letterSpacing: number;
        color: string;
        // Box Styling
        backgroundColor: string;
        padding: number;
        borderRadius: number;
        borderWidth: number;
        borderColor: string;
        // Shadow
        shadowColor: string;
        shadowBlur: number;
        shadowOffsetX: number;
        shadowOffsetY: number;
        // Advanced Styling
        backdropBlur: number;
        textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
        gradient: {
            enabled: boolean;
            colors: string[];
            angle: number;
        };
        blendMode: 'normal' | 'overlay' | 'screen' | 'multiply' | 'difference' | 'plus-lighter';
        // Timing & Animation
        startTime: number;
        endTime: number;
        animation: 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'typewriter' | 'scale' | 'pop' | 'blur-in' | 'glitch' | 'spin-3d';
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
        zoomStrength: 1.3,
        speed: 1.0,
        padding: 0.2, // 20% deadzone
        mode: 'cinematic',
    },
    cursor: {
        size: 1.0,
        color: '#000000', // Simple black cursor
        glow: false,
        trail: false,
        trailLength: 12,
        style: 'arrow',
        theme: 'dark',
        animation: true,
        completePath: false,
        clickPulse: true,
        smoothing: 0.35,
        haloColor: '#e8506e',
    },
    effects: {
        clickRipple: false,
        clickSize: 1.0,
        clickColor: 'rgba(235, 64, 52, 0.5)',
        clickEmphasis: false,
        clickAnimationStyle: 'ripple',
        clickForce: 1.0,
        clickEasing: 'ease-out',
        clickEffects: {}, // Per-click effect configurations
    },
    presentation: {
        aspectRatio: 'native',
        outputWidth: 1920,
        outputHeight: 1080,
        backgroundMode: 'solid',
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
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            roundedCorners: true,
            cornerRadius: 8,
        },
        screenDPR: 1.0,
        videoPadding: {
            enabled: true,
            top: 50,
            right: 50,
            bottom: 50,
            left: 50,
            uniform: true,
        },
        videoStyle: {
            borderEnabled: true,
            borderColor: '#ffffff',
            borderWidth: 2,
            shadowEnabled: true,
            shadowColor: 'rgba(255, 255, 255, 0.9)',
            shadowBlur: 30,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            rotation: 0,
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
    voiceover: {
        script: '',
        scriptSegments: [],
        scriptStyle: {
            template: 'walkthrough',
            tone: 'professional',
            audience: '',
            instructions: '',
        },
        captions: {
            enabled: false,
            style: 'boxed',
            position: 'bottom',
            size: 32,
        },
        voiceId: 'en-US-EmmaMultilingualNeural',
        audioUrl: null,
        audioBlob: null,
        duration: 0,
        speed: 1.0,
        pitch: 0,
        volume: 100,
        isGenerated: false,
        generatedAt: null,
    },
    music: {
        enabled: false,
        name: '',
        url: null,
        blob: null,
        volume: 30,
        ducking: 70,
        loop: true,
        fadeIn: 1,
        fadeOut: 2,
    },
    events: {
        clicks: [],
        moves: [],
        effects: [],
    },
    playback: {
        currentTime: 0,
        isPlaying: false,
        volume: 1,
        isMuted: false,
        playbackRate: 1,
    },
};
