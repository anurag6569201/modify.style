import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { ProjectDetail } from "@/lib/api/projects";
import {
  computePipelineGates,
  firstUnlockedEditorTab,
  tabToPipelineStep,
  type LivePipelineSnapshot,
} from "@/lib/studio/pipelineProgress";
import { editorHref, recorderHref } from "@/lib/studio/pipeline";

/** Redirect if user hits a route or tab before completing prior pipeline steps. */
export function useEditorFlowGuard(
  project: ProjectDetail | null | undefined,
  projectId: string | undefined,
  editorTab: string,
  live: LivePipelineSnapshot,
  setEditorTab: (tab: "script" | "voice" | "camera") => void,
  options?: { projectLoading?: boolean }
) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!projectId) return;
    if (options?.projectLoading) return;

    const gates = computePipelineGates(project, {
      currentStep: tabToPipelineStep(editorTab),
      live,
    });
    const step = tabToPipelineStep(editorTab);
    const gate = gates.gates[step];

    if (!gates.recordComplete) {
      if (live.hasVideo) return;
      toast.message("Record your demo first", {
        description: "Capture your screen before editing.",
      });
      navigate(recorderHref(projectId === "new" ? null : projectId), { replace: true });
      return;
    }

    if (gate?.access === "locked") {
      const allowed = firstUnlockedEditorTab(gates.gates);
      toast.message("Step locked", { description: gate.lockReason });
      if (allowed !== editorTab) {
        setEditorTab(allowed);
      }
    }
  }, [project, projectId, editorTab, live, navigate, setEditorTab, options?.projectLoading]);
}

export function useRenderFlowGuard(
  projectId: string | undefined,
  project: ProjectDetail | null | undefined,
  hasVideo: boolean,
  /** Skip when user arrived from Editor export with full render payload */
  fromEditor = false
) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!projectId || fromEditor) return;

    const gates = computePipelineGates(project, { includeExport: true, currentStep: "export" });

    if (!hasVideo && !gates.recordComplete) {
      toast.message("Nothing to export yet", { description: "Record a demo first." });
      navigate(recorderHref(projectId), { replace: true });
      return;
    }

    if (!gates.canExport) {
      toast.message("Finish editing first", {
        description: "Complete script, voice, and frame before exporting.",
      });
      navigate(editorHref(projectId, firstUnlockedEditorTab(gates.gates)), { replace: true });
    }
  }, [projectId, project, hasVideo, fromEditor, navigate]);
}
