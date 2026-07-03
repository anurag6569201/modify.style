import type { ProjectDetail } from "@/lib/api/projects";
import type { PipelineStepId } from "@/lib/studio/pipeline";
import { PIPELINE_STEPS, PIPELINE_WITH_EXPORT } from "@/lib/studio/pipeline";

export type StepAccess = "complete" | "current" | "available" | "locked";

export interface StepGate {
  access: StepAccess;
  /** Shown on locked steps */
  lockReason?: string;
}

export interface LivePipelineSnapshot {
  hasVideo?: boolean;
  hasScript?: boolean;
  hasVoice?: boolean;
  frameVisited?: boolean;
}

export interface PipelineGateState {
  gates: Record<PipelineStepId, StepGate>;
  /** First step that is not complete (used for redirects) */
  nextStep: PipelineStepId;
  recordComplete: boolean;
  canExport: boolean;
  canShare: boolean;
}

function scriptDone(project: ProjectDetail | null | undefined, live?: LivePipelineSnapshot): boolean {
  if (live?.hasScript) return true;
  const segments = project?.script_segments ?? [];
  if (segments.some((s) => s.text?.trim())) return true;
  const edit = project?.edit_data as
    | { voiceover?: { script?: string; scriptSegments?: Array<{ text?: string }> } }
    | undefined;
  if (edit?.voiceover?.script?.trim()) return true;
  return (edit?.voiceover?.scriptSegments ?? []).some((s) => s.text?.trim());
}

function voiceDone(project: ProjectDetail | null | undefined, live?: LivePipelineSnapshot): boolean {
  if (live?.hasVoice) return true;
  const edit = project?.edit_data as
    | { voiceover?: { isGenerated?: boolean; scriptSegments?: Array<{ isGenerated?: boolean }> } }
    | undefined;
  if (edit?.voiceover?.isGenerated) return true;
  return (edit?.voiceover?.scriptSegments ?? []).some((s) => s.isGenerated);
}

function frameDone(project: ProjectDetail | null | undefined, live?: LivePipelineSnapshot): boolean {
  if (live?.frameVisited) return true;
  const edit = project?.edit_data as { pipeline?: { frameVisited?: boolean } } | undefined;
  return !!edit?.pipeline?.frameVisited;
}

function recordDone(project: ProjectDetail | null | undefined, live?: LivePipelineSnapshot): boolean {
  return !!(live?.hasVideo || project?.video_url);
}

function exportDone(project: ProjectDetail | null | undefined): boolean {
  return project?.status === "ready";
}

/** Sequential gates: each step unlocks only after the previous is complete. */
export function computePipelineGates(
  project: ProjectDetail | null | undefined,
  options: {
    currentStep?: PipelineStepId;
    includeExport?: boolean;
    live?: LivePipelineSnapshot;
  } = {}
): PipelineGateState {
  const { currentStep, includeExport = false, live } = options;
  const steps = includeExport ? PIPELINE_WITH_EXPORT : PIPELINE_STEPS;

  const done: Record<string, boolean> = {
    record: recordDone(project, live),
    script: scriptDone(project, live),
    voice: voiceDone(project, live),
    frame: frameDone(project, live),
    export: exportDone(project),
    share: exportDone(project),
  };

  const gates = {} as Record<PipelineStepId, StepGate>;
  let previousComplete = true;

  for (const step of steps) {
    const id = step.id;
    const isComplete = done[id] ?? false;
    const isCurrent = currentStep === id;

    if (isComplete) {
      gates[id] = { access: isCurrent ? "current" : "complete" };
      previousComplete = true;
      continue;
    }

    if (isCurrent && previousComplete) {
      gates[id] = { access: "current" };
      previousComplete = false;
      continue;
    }

    if (previousComplete) {
      gates[id] = { access: "available" };
      previousComplete = false;
      continue;
    }

    gates[id] = {
      access: "locked",
      lockReason: lockReasonFor(id, done),
    };
    previousComplete = false;
  }

  const nextStep =
    (steps.find((s) => !done[s.id])?.id as PipelineStepId | undefined) ?? "share";

  return {
    gates,
    nextStep,
    recordComplete: done.record,
    canExport: done.record && done.script && done.voice && done.frame,
    canShare: done.share,
  };
}

function lockReasonFor(stepId: PipelineStepId, _done: Record<string, boolean>): string {
  switch (stepId) {
    case "script":
      return "Record your screen first";
    case "voice":
      return "Add a script before generating voice";
    case "frame":
      return "Generate voiceover before framing";
    case "export":
      return "Review script, voice, and frame first";
    case "share":
      return "Export your demo before sharing";
    default:
      return "Complete the previous step first";
  }
}

export function stepLockReason(
  gates: Record<PipelineStepId, StepGate>,
  stepId: PipelineStepId
): string {
  return gates[stepId]?.lockReason ?? lockReasonFor(stepId, {});
}

/** Whether a pipeline step can be navigated to (sidebar, pipeline bar, URL). */
export function isStepNavigable(gate: StepGate | undefined): boolean {
  if (!gate) return false;
  return gate.access === "complete" || gate.access === "current" || gate.access === "available";
}

/** Map editor tab to pipeline step for guard redirects */
export function tabToPipelineStep(tab: string): PipelineStepId {
  if (tab === "script") return "script";
  if (tab === "voice") return "voice";
  if (["camera", "design", "text", "effects", "timeline"].includes(tab)) return "frame";
  return "frame";
}

export function firstUnlockedEditorTab(
  gates: Record<PipelineStepId, StepGate>
): "script" | "voice" | "camera" {
  if (gates.script.access !== "locked") {
    if (gates.voice.access === "locked") return "script";
    if (gates.frame.access === "locked") return "voice";
    return "camera";
  }
  return "script";
}
