import { Link } from "react-router-dom";
import { ChevronRight, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudioProjectBarProps {
  title: string;
  titleEditable?: boolean;
  onTitleChange?: (value: string) => void;
  onTitleSave?: () => void;
  projectId?: string | null;
  className?: string;
  actions?: React.ReactNode;
}

export function StudioProjectBar({
  title,
  titleEditable = false,
  onTitleChange,
  onTitleSave,
  projectId,
  className,
  actions,
}: StudioProjectBarProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Demos
          </Link>
          {projectId && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
              <span className="truncate font-mono text-xs">{projectId.slice(0, 8)}…</span>
            </>
          )}
        </div>

        {titleEditable ? (
          <input
            value={title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            onBlur={onTitleSave}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-label="Project title"
            className="w-full max-w-lg truncate rounded-lg border border-transparent bg-transparent px-1 py-0.5 font-display text-2xl font-semibold tracking-tight outline-none transition-colors hover:border-border focus:border-primary"
          />
        ) : (
          <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{title}</h1>
        )}
      </div>

      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
