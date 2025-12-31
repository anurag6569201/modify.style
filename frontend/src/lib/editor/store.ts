import { useSyncExternalStore } from 'react';
import { EditorState, DEFAULT_EDITOR_STATE, VideoConfig, PlaybackState } from './types';

// Simple Event Emitter Store
class EditorStore {
    private state: EditorState;
    private listeners: Set<() => void> = new Set();

    constructor() {
        this.state = DEFAULT_EDITOR_STATE;
    }

    getState() {
        return this.state;
    }

    setState(partial: Partial<EditorState> | ((prev: EditorState) => Partial<EditorState>)) {
        const update = typeof partial === 'function' ? partial(this.state) : partial;
        this.state = { ...this.state, ...update };
        this.notify();
    }

    // Specialized setters
    setVideo(config: Partial<VideoConfig>) {
        this.setState(prev => ({
            video: { ...prev.video, ...config }
        }));
    }

    setPlayback(config: Partial<PlaybackState>) {
        this.setState(prev => ({
            playback: { ...prev.playback, ...config }
        }));
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach(l => l());
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
