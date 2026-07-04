import { useSyncExternalStore } from 'react';
import {
    EditorState,
    DEFAULT_EDITOR_STATE,
    VideoConfig,
    PlaybackState,
    CameraConfig,
    PresentationConfig,
    VoiceoverConfig,
    ScriptSegment,
    ZoomEffect,
    TextOverlay,
} from './types';

const HISTORY_LIMIT = 60;
const HISTORY_DEBOUNCE_MS = 400;

/** Fields excluded from undo/redo history (transient runtime state). */
type HistorySnapshot = Omit<EditorState, 'playback'>;

function snapshotOf(state: EditorState): HistorySnapshot {
    const { playback, ...rest } = state;
    return rest;
}

// Event emitter store with undo/redo history
class EditorStore {
    private state: EditorState;
    private listeners: Set<() => void> = new Set();

    private past: HistorySnapshot[] = [];
    private future: HistorySnapshot[] = [];
    private pendingSnapshot: HistorySnapshot | null = null;
    private historyTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.state = DEFAULT_EDITOR_STATE;
    }

    getState() {
        return this.state;
    }

    /**
     * Update state. History is recorded automatically for non-playback
     * changes (debounced so slider drags collapse into one undo step).
     */
    setState(
        partial: Partial<EditorState> | ((prev: EditorState) => Partial<EditorState>),
        options: { history?: boolean } = {}
    ) {
        const update = typeof partial === 'function' ? partial(this.state) : partial;
        const keys = Object.keys(update);
        const onlyPlayback = keys.length > 0 && keys.every((k) => k === 'playback');
        const recordHistory = options.history ?? !onlyPlayback;

        if (recordHistory) this.recordHistory();

        this.state = { ...this.state, ...update };
        this.notify();
    }

    // ---- History -------------------------------------------------------

    private recordHistory() {
        if (!this.pendingSnapshot) {
            this.pendingSnapshot = snapshotOf(this.state);
        }
        if (this.historyTimer) clearTimeout(this.historyTimer);
        this.historyTimer = setTimeout(() => this.commitHistory(), HISTORY_DEBOUNCE_MS);
    }

    private commitHistory() {
        if (this.pendingSnapshot) {
            this.past.push(this.pendingSnapshot);
            if (this.past.length > HISTORY_LIMIT) this.past.shift();
            this.pendingSnapshot = null;
            this.future = [];
        }
        this.historyTimer = null;
    }

    /** Flush any pending (debounced) snapshot so undo works immediately. */
    private flushHistory() {
        if (this.historyTimer) {
            clearTimeout(this.historyTimer);
            this.historyTimer = null;
        }
        if (this.pendingSnapshot) {
            this.past.push(this.pendingSnapshot);
            if (this.past.length > HISTORY_LIMIT) this.past.shift();
            this.pendingSnapshot = null;
            this.future = [];
        }
    }

    canUndo() {
        return this.past.length > 0 || this.pendingSnapshot !== null;
    }

    canRedo() {
        return this.future.length > 0;
    }

    undo() {
        this.flushHistory();
        const prev = this.past.pop();
        if (!prev) return;
        this.future.push(snapshotOf(this.state));
        this.state = { ...this.state, ...prev };
        this.notify();
    }

    redo() {
        const next = this.future.pop();
        if (!next) return;
        this.past.push(snapshotOf(this.state));
        if (this.past.length > HISTORY_LIMIT) this.past.shift();
        this.state = { ...this.state, ...next };
        this.notify();
    }

    // ---- Specialized setters --------------------------------------------

    setVideo(config: Partial<VideoConfig>) {
        this.setState((prev) => ({ video: { ...prev.video, ...config } }), { history: false });
    }

    setPlayback(config: Partial<PlaybackState>) {
        this.setState((prev) => ({ playback: { ...prev.playback, ...config } }), { history: false });
    }

    updateCamera(config: Partial<CameraConfig>) {
        this.setState((prev) => ({ camera: { ...prev.camera, ...config } }));
    }

    updatePresentation(config: Partial<PresentationConfig>) {
        this.setState((prev) => ({ presentation: { ...prev.presentation, ...config } }));
    }

    updateVoiceover(config: Partial<VoiceoverConfig>) {
        this.setState((prev) => ({ voiceover: { ...prev.voiceover, ...config } }));
    }

    /**
     * Apply the "auto-magic" starter template to a fresh recording so the demo
     * looks finished with zero effort. This is the first impression, so it's
     * tuned to look premium out of the box:
     *   - a soft, warm neutral backdrop (not the loud default purple),
     *   - the video floating with rounded corners + a realistic soft shadow
     *     (no hard white border),
     *   - punchy-but-smooth auto-zoom on clicks,
     *   - subtle cursor glow + click ripples,
     *   - captions on (they light up once a script exists).
     * Everyone gets this on record; members/Pro can override any of it.
     * No history entry — it's the baseline, not an edit.
     */
    applyDefaultTemplate() {
        this.setState(
            (prev) => ({
                camera: { ...prev.camera, mode: 'cinematic', zoomStrength: 1.5, speed: 1.0 },
                cursor: { ...prev.cursor, glow: true, clickPulse: true, smoothing: 0.4 },
                effects: {
                    ...prev.effects,
                    clickRipple: true,
                    clickEmphasis: true,
                    clickAnimationStyle: 'ripple',
                },
                presentation: {
                    ...prev.presentation,
                    backgroundMode: 'gradient',
                    backgroundColor: '#e9dfce',
                    backgroundGradient: {
                        type: 'linear',
                        angle: 145,
                        stops: [
                            { color: '#f4ece0', position: 0 },
                            { color: '#e2d2ba', position: 0.55 },
                            { color: '#c7ad8c', position: 1 },
                        ],
                    },
                    backgroundBlur: 0,
                    videoPadding: { enabled: true, top: 60, right: 60, bottom: 60, left: 60, uniform: true },
                    videoCrop: {
                        ...prev.presentation.videoCrop,
                        enabled: false,
                        roundedCorners: true,
                        cornerRadius: 16,
                    },
                    videoStyle: {
                        ...prev.presentation.videoStyle,
                        borderEnabled: false,
                        borderWidth: 0,
                        shadowEnabled: true,
                        shadowColor: 'rgba(74, 52, 30, 0.32)',
                        shadowBlur: 55,
                        shadowOffsetX: 0,
                        shadowOffsetY: 26,
                        rotation: 0,
                    },
                },
                voiceover: {
                    ...prev.voiceover,
                    captions: { ...prev.voiceover.captions, enabled: true },
                },
            }),
            { history: false }
        );
    }

    // ---- Script segments -------------------------------------------------

    setScriptSegments(segments: ScriptSegment[]) {
        this.setState((prev) => ({
            voiceover: {
                ...prev.voiceover,
                scriptSegments: segments,
                script: segments.map((s) => s.text).join('\n\n'),
            },
        }));
    }

    updateSegment(index: number, updates: Partial<ScriptSegment>) {
        this.setState((prev) => {
            const segments = prev.voiceover.scriptSegments.map((seg, i) =>
                i === index ? { ...seg, ...updates } : seg
            );
            return {
                voiceover: {
                    ...prev.voiceover,
                    scriptSegments: segments,
                    script: segments.map((s) => s.text).join('\n\n'),
                },
            };
        });
    }

    addSegment(segment: ScriptSegment) {
        this.setState((prev) => {
            const segments = [...prev.voiceover.scriptSegments, segment].sort(
                (a, b) => a.timestamp - b.timestamp
            );
            return {
                voiceover: {
                    ...prev.voiceover,
                    scriptSegments: segments,
                    script: segments.map((s) => s.text).join('\n\n'),
                },
            };
        });
    }

    deleteSegment(index: number) {
        this.setState((prev) => {
            const segments = prev.voiceover.scriptSegments.filter((_, i) => i !== index);
            return {
                voiceover: {
                    ...prev.voiceover,
                    scriptSegments: segments,
                    script: segments.map((s) => s.text).join('\n\n'),
                },
            };
        });
    }

    // ---- Zoom effects ------------------------------------------------------

    addEffect(effect: ZoomEffect) {
        this.setState((prev) => ({
            events: { ...prev.events, effects: [...prev.events.effects, effect] },
        }));
    }

    updateEffect(id: string, updates: Partial<ZoomEffect>) {
        const duration = this.state.video.duration || 0;
        this.setState((prev) => ({
            events: {
                ...prev.events,
                effects: prev.events.effects.map((effect) => {
                    if (effect.id !== id) return effect;
                    const nextStartRaw = updates.start ?? effect.start ?? effect.timestamp ?? 0;
                    const nextEndRaw = updates.end ?? effect.end ?? nextStartRaw + 3;
                    const clampedStart = Math.max(0, duration > 0 ? Math.min(nextStartRaw, duration) : nextStartRaw);
                    let clampedEnd = Math.max(0, duration > 0 ? Math.min(nextEndRaw, duration) : nextEndRaw);
                    if (clampedEnd < clampedStart + 0.2) {
                        clampedEnd = Math.min(duration || clampedStart + 0.2, clampedStart + 0.2);
                    }
                    return { ...effect, ...updates, start: clampedStart, end: clampedEnd };
                }),
            },
        }));
    }

    deleteEffect(id: string) {
        this.setState((prev) => ({
            events: {
                ...prev.events,
                effects: prev.events.effects.filter((effect) => effect.id !== id),
            },
        }));
    }

    // ---- Text overlays ----------------------------------------------------

    addTextOverlay(overlay: TextOverlay) {
        this.setState((prev) => ({ textOverlays: [...prev.textOverlays, overlay] }));
    }

    updateTextOverlay(id: string, updates: Partial<TextOverlay>) {
        this.setState((prev) => ({
            textOverlays: prev.textOverlays.map((overlay) =>
                overlay.id === id ? { ...overlay, ...updates } : overlay
            ),
        }));
    }

    deleteTextOverlay(id: string) {
        this.setState((prev) => ({
            textOverlays: prev.textOverlays.filter((overlay) => overlay.id !== id),
        }));
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach((l) => l());
    }
}

export const editorStore = new EditorStore();

export function useEditorState(): EditorState {
    return useSyncExternalStore(
        editorStore.subscribe.bind(editorStore),
        editorStore.getState.bind(editorStore)
    );
}

// Selector hook for better performance
export function useEditorSelector<T>(selector: (state: EditorState) => T): T {
    return useSyncExternalStore(
        editorStore.subscribe.bind(editorStore),
        () => selector(editorStore.getState())
    );
}

export function generateId(prefix: string) {
    const hasRandomUUID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
    return `${prefix}-${hasRandomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}
