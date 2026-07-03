/**
 * Serialize / hydrate editor state for Project.edit_data and recording_data.
 * Blobs and blob: URLs stay in memory only — persisted media uses server URLs.
 */
import { editorStore } from "@/lib/editor/store";
import type { EditorState } from "@/lib/editor/types";
import type { ProjectDetail } from "@/lib/api/projects";

export interface RecordingPayload {
  clicks: unknown[];
  moves: unknown[];
  markers?: unknown[];
  metadata?: Record<string, unknown>;
  rawRecording?: boolean;
  visualEffects?: Record<string, unknown>;
}

function stripBlobUrls(url: string | null | undefined): string | null {
  if (!url || url.startsWith("blob:")) return null;
  return url;
}

/** Editor fields worth persisting (excludes transient playback). */
export function serializeEditorState(
  state: EditorState,
  options?: { frameVisited?: boolean }
): Record<string, unknown> {
  return {
    pipeline: {
      frameVisited: options?.frameVisited ?? false,
    },
    camera: state.camera,
    cursor: state.cursor,
    effects: state.effects,
    presentation: state.presentation,
    colorGrading: state.colorGrading,
    textOverlays: state.textOverlays,
    voiceover: {
      script: state.voiceover.script,
      scriptSegments: state.voiceover.scriptSegments.map((seg) => ({
        text: seg.text,
        timestamp: seg.timestamp,
        duration: seg.duration,
        isGenerated: seg.isGenerated,
        audioUrl: stripBlobUrls(seg.audioUrl),
      })),
      voiceId: state.voiceover.voiceId,
      audioUrl: stripBlobUrls(state.voiceover.audioUrl),
      duration: state.voiceover.duration,
      speed: state.voiceover.speed,
      pitch: state.voiceover.pitch,
      volume: state.voiceover.volume,
      isGenerated: state.voiceover.isGenerated,
      generatedAt: state.voiceover.generatedAt,
    },
    events: {
      clicks: state.events.clicks,
      moves: state.events.moves,
      effects: state.events.effects,
    },
  };
}

export function hydrateEditorFromProject(project: ProjectDetail): boolean {
  let hydrated = false;
  const recording = project.recording_data as RecordingPayload | undefined;
  const edit = project.edit_data as Partial<EditorState> | undefined;

  if (project.video_url) {
    editorStore.setVideo({ url: project.video_url });
    hydrated = true;
  }

  if (recording?.clicks?.length || recording?.moves?.length) {
    editorStore.setState((prev) => ({
      events: {
        ...prev.events,
        clicks: (recording.clicks as EditorState["events"]["clicks"]) ?? prev.events.clicks,
        moves: (recording.moves as EditorState["events"]["moves"]) ?? prev.events.moves,
      },
    }));
    hydrated = true;
  }

  if (edit && Object.keys(edit).length > 0) {
    editorStore.setState((prev) => ({
      ...(edit.camera ? { camera: { ...prev.camera, ...edit.camera } } : {}),
      ...(edit.cursor ? { cursor: { ...prev.cursor, ...edit.cursor } } : {}),
      ...(edit.effects ? { effects: { ...prev.effects, ...edit.effects } } : {}),
      ...(edit.presentation
        ? { presentation: { ...prev.presentation, ...edit.presentation } }
        : {}),
      ...(edit.colorGrading
        ? { colorGrading: { ...prev.colorGrading, ...edit.colorGrading } }
        : {}),
      ...(edit.textOverlays ? { textOverlays: edit.textOverlays } : {}),
      ...(edit.voiceover
        ? {
            voiceover: {
              ...prev.voiceover,
              ...edit.voiceover,
              scriptSegments:
                edit.voiceover.scriptSegments ?? prev.voiceover.scriptSegments,
            },
          }
        : {}),
      ...(edit.events
        ? {
            events: {
              ...prev.events,
              clicks: edit.events.clicks ?? prev.events.clicks,
              moves: edit.events.moves ?? prev.events.moves,
              effects: edit.events.effects ?? prev.events.effects,
            },
          }
        : {}),
    }));
    hydrated = true;
  }

  if (project.script_segments?.length) {
    editorStore.setState((prev) => ({
      voiceover: {
        ...prev.voiceover,
        scriptSegments: project.script_segments.map((s) => ({
          text: s.text,
          timestamp: s.timestamp,
          isGenerated: false,
        })),
      },
    }));
    hydrated = true;
  }

  return hydrated;
}

export function buildRecordingPayload(input: {
  clicks: unknown[];
  moves: unknown[];
  markers?: unknown[];
  duration?: number;
  rawRecording?: boolean;
  visualEffects?: Record<string, unknown>;
}): RecordingPayload {
  return {
    clicks: input.clicks,
    moves: input.moves,
    markers: input.markers ?? [],
    metadata: {
      duration: input.duration ?? 0,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    },
    rawRecording: input.rawRecording,
    visualEffects: input.visualEffects,
  };
}

export function scriptSegmentsFromState(state: EditorState) {
  return state.voiceover.scriptSegments.map((s) => ({
    text: s.text,
    timestamp: s.timestamp,
  }));
}
