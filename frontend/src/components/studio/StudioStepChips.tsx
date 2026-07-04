import { Link } from "react-router-dom";
import { Check, Lock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectDetail } from "@/lib/api/projects";
import {
  PIPELINE_STEPS,
  type PipelineStepId,
  editorHref,
  recorderHref,
} from "@/lib/studio/pipeline";
import {
  computePipelineGates,
  type LivePipelineSnapshot,
  isStepNavigable,
} from "@/lib/studio/pipelineProgress";

interface StudioStepChipsProps {
  currentStep?: PipelineStepId;
  project?: ProjectDetail | null;
  projectId?: string | null;
  onShareClick?: () => void;
  live?: LivePipelineSnapshot;
  className?: string;
}

/**
 * Compact, single-line pipeline indicator — replaces the big card grid
 * inside the editor. Shows progress at a glance without eating space.
 */
export function StudioStepChips({
  currentStep,
  project,
  projectId,
  onShareClick,
  live,
  className,
}: StudioStepChipsProps) {
  const { gates } = computePipelineGates(project, { currentStep, live });

  return (
    <nav aria-label="Demo pipeline" className={cn("flex items-center", className)}>
      {PIPELINE_STEPS.map((step, i) => {
        const Icon = step.icon;
        const gate = gates[step.id];
        const isLocked = gate.access === "locked";
        const isComplete = gate.access === "complete";
        const isCurrent = gate.access === "current";
        const isShare = step.id === "share";

        const chip = (
          <span
            className={cn(
              "flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-medium transition-colors",
              isCurrent && "border-primary/50 bg-primary/10 text-primary",
              isComplete && "border-success/30 bg-success/10 text-success",
              !isCurrent && !isComplete && !isLocked && "border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground",
              isLocked && "border-border/40 text-muted-foreground/50"
            )}
          >
            {isLocked ? (
              <Lock className="h-2.5 w-2.5" />
            ) : isComplete ? (
              <Check className="h-2.5 w-2.5" />
            ) : (
              <Icon className="h-2.5 w-2.5" />
            )}
            <span className="hidden md:inline">{step.label}</span>
          </span>
        );

        let node: React.ReactNode = chip;
        if (!isLocked) {
          if (isShare && onShareClick) {
            node = (
              <button type="button" onClick={onShareClick} title={step.description}>
                {chip}
              </button>
            );
          } else {
            let href: string | null = null;
            if (step.id === "record") href = recorderHref(projectId);
            else if (step.editorTab) href = editorHref(projectId, step.editorTab);
            if (href && isStepNavigable(gate)) {
              node = (
                <Link to={href} title={step.description}>
                  {chip}
                </Link>
              );
            }
          }
        } else {
          node = <span title={gate.lockReason}>{chip}</span>;
        }

        return (
          <span key={step.id} className="flex items-center">
            {i > 0 && <ChevronRight className="mx-0.5 h-3 w-3 shrink-0 text-muted-foreground/30" />}
            {node}
          </span>
        );
      })}
    </nav>
  );
}
