import { useEffect, useRef } from "react";
import { editorStore } from "@/lib/editor/store";
import { projectsApi } from "@/lib/api/projects";
import {
  serializeEditorState,
  scriptSegmentsFromState,
} from "@/lib/projectPersistence";

const SAVE_DEBOUNCE_MS = 2500;

/** Auto-save editor state to Project.edit_data (debounced). */
export function useDebouncedProjectSave(
  projectId: string | undefined | null,
  enabled = true,
  frameVisited = false
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId || projectId === "new" || !enabled) return;

    const flush = () => {
      const state = editorStore.getState();
      projectsApi
        .saveEditData(
          projectId,
          serializeEditorState(state, { frameVisited }),
          scriptSegmentsFromState(state)
        )
        .catch((err) => console.warn("[Editor] Auto-save failed:", err));
    };

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    };

    const unsub = editorStore.subscribe(schedule);
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [projectId, enabled, frameVisited]);
}

/** Persist recording immediately (e.g. on blur / beforeunload). */
export function flushProjectSave(projectId: string) {
  const state = editorStore.getState();
  return projectsApi.saveEditData(
    projectId,
    serializeEditorState(state),
    scriptSegmentsFromState(state)
  );
}
