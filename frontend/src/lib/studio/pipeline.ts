import type { LucideIcon } from "lucide-react";
import {
  MonitorPlay,
  Wand2,
  Mic2,
  MousePointerClick,
  Share2,
  Download,
} from "lucide-react";

export type PipelineStepId =
  | "record"
  | "script"
  | "voice"
  | "frame"
  | "export"
  | "share";

export type EditorTabId =
  | "script"
  | "voice"
  | "design"
  | "text"
  | "camera"
  | "effects"
  | "timeline";

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  description: string;
  icon: LucideIcon;
  editorTab?: EditorTabId;
}

/** Core product pipeline — matches landing & recorder. */
export const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "record",
    label: "Record",
    description: "Capture your screen",
    icon: MonitorPlay,
  },
  {
    id: "script",
    label: "Script",
    description: "AI writes narration",
    icon: Wand2,
    editorTab: "script",
  },
  {
    id: "voice",
    label: "Voice",
    description: "Natural AI voiceover",
    icon: Mic2,
    editorTab: "voice",
  },
  {
    id: "frame",
    label: "Frame",
    description: "Auto-zoom & camera",
    icon: MousePointerClick,
    editorTab: "camera",
  },
  {
    id: "share",
    label: "Share",
    description: "Link + analytics",
    icon: Share2,
  },
];

/** Export sits between frame and share on the render page. */
export const EXPORT_STEP: PipelineStep = {
  id: "export",
  label: "Export",
  description: "Render & download",
  icon: Download,
};

export const PIPELINE_WITH_EXPORT: PipelineStep[] = [
  ...PIPELINE_STEPS.slice(0, 4),
  EXPORT_STEP,
  PIPELINE_STEPS[4],
];

export function stepIndex(steps: PipelineStep[], id: PipelineStepId): number {
  return steps.findIndex((s) => s.id === id);
}

export function editorHref(projectId: string | null | undefined, tab?: EditorTabId): string {
  const base = `/editor/${projectId || "new"}`;
  return tab ? `${base}?tab=${tab}` : base;
}

export function recorderHref(projectId: string | null | undefined): string {
  return projectId ? `/recorder?project=${projectId}` : "/recorder";
}
