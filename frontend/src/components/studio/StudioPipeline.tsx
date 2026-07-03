import { Link } from "react-router-dom";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectDetail } from "@/lib/api/projects";
import {
  PIPELINE_STEPS,
  PIPELINE_WITH_EXPORT,
  type PipelineStep,
  type PipelineStepId,
  editorHref,
  recorderHref,
} from "@/lib/studio/pipeline";
import {
  computePipelineGates,
  type LivePipelineSnapshot,
  isStepNavigable,
} from "@/lib/studio/pipelineProgress";

interface StudioPipelineProps {
  currentStep?: PipelineStepId;
  project?: ProjectDetail | null;
  projectId?: string | null;
  includeExport?: boolean;
  onShareClick?: () => void;
  onExportClick?: () => void;
  overview?: boolean;
  live?: LivePipelineSnapshot;
  className?: string;
}

export function StudioPipeline({
  currentStep,
  project,
  projectId,
  includeExport = false,
  onShareClick,
  onExportClick,
  overview = false,
  live,
  className,
}: StudioPipelineProps) {
  const steps: PipelineStep[] = includeExport ? PIPELINE_WITH_EXPORT : PIPELINE_STEPS;
  const { gates } = computePipelineGates(project, {
    currentStep,
    includeExport,
    live,
  });

  return (
    <nav aria-label="Demo creation pipeline" className={cn("w-full", className)}>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-none lg:grid-flow-col lg:auto-cols-fr lg:gap-3">
        {steps.map((step) => {
          const Icon = step.icon;
          const gate = gates[step.id];
          const isShare = step.id === "share";
          const isLocked = gate.access === "locked";
          const isComplete = gate.access === "complete";
          const isCurrent = gate.access === "current";
          const isAvailable = gate.access === "available";

          const content = (
            <>
              <div
                className={cn(
                  "mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                  isCurrent && "bg-primary text-primary-foreground shadow-sm",
                  isComplete && "bg-success/15 text-success",
                  isAvailable && "bg-secondary text-foreground",
                  isLocked && "bg-muted text-muted-foreground/60"
                )}
              >
                {isLocked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : isComplete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div
                className={cn(
                  "text-sm font-medium",
                  isCurrent && "text-primary",
                  isComplete && "text-foreground",
                  isAvailable && "text-foreground",
                  isLocked && "text-muted-foreground/70"
                )}
              >
                {step.label}
              </div>
              <div className="mt-0.5 hidden text-[11px] leading-snug text-muted-foreground sm:block">
                {isLocked ? gate.lockReason : step.description}
              </div>
            </>
          );

          const stepClass = cn(
            "rounded-xl border p-3 text-center transition-colors",
            isCurrent && "border-primary/40 bg-primary/5 shadow-sm",
            isComplete && "border-border bg-card",
            isAvailable && "border-border bg-card hover:border-primary/30",
            isLocked && "cursor-not-allowed border-border/60 bg-muted/30 opacity-80"
          );

          if (isLocked) {
            return (
              <li key={step.id} title={gate.lockReason}>
                <div className={stepClass} aria-disabled="true">
                  {content}
                </div>
              </li>
            );
          }

          if (isShare && onShareClick && !isLocked) {
            return (
              <li key={step.id}>
                <button type="button" onClick={onShareClick} className={cn(stepClass, "w-full")}>
                  {content}
                </button>
              </li>
            );
          }

          if (step.id === "export" && onExportClick && !isLocked) {
            return (
              <li key={step.id}>
                <button type="button" onClick={onExportClick} className={cn(stepClass, "w-full")}>
                  {content}
                </button>
              </li>
            );
          }

          let href: string | null = null;
          if (step.id === "record") href = recorderHref(projectId);
          else if (step.editorTab) href = editorHref(projectId, step.editorTab);
          else if (isShare) href = null;

          if (overview && href && isStepNavigable(gate)) {
            return (
              <li key={step.id}>
                <Link to={href} className={cn(stepClass, "block")}>
                  {content}
                </Link>
              </li>
            );
          }

          if (href && isStepNavigable(gate)) {
            return (
              <li key={step.id}>
                <Link to={href} className={cn(stepClass, "block")}>
                  {content}
                </Link>
              </li>
            );
          }

          return (
            <li key={step.id} aria-current={isCurrent ? "step" : undefined}>
              <div className={stepClass}>{content}</div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
