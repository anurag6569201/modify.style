/**
 * ShareDialog — the "send it" moment.
 *
 * Lets the owner flip a demo from private → unlisted/public, copy the
 * share link, and grab a responsive iframe embed snippet. Used from the
 * Dashboard card menu and the Editor top bar.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Code2, Globe, Link2, Lock, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { projectsApi, type ProjectVisibility } from "@/lib/api/projects";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  shareSlug: string;
  visibility: ProjectVisibility;
  viewCount?: number;
  onVisibilityChange?: (v: ProjectVisibility) => void;
}

const visibilityOptions: Array<{
  value: ProjectVisibility;
  label: string;
  hint: string;
  icon: typeof Lock;
}> = [
  { value: "private", label: "Private", hint: "Only you", icon: Lock },
  { value: "unlisted", label: "Unlisted", hint: "Anyone with the link", icon: Link2 },
  { value: "public", label: "Public", hint: "Link + embeddable anywhere", icon: Globe },
];

export function ShareDialog({
  open,
  onOpenChange,
  projectId,
  shareSlug,
  visibility,
  viewCount,
  onVisibilityChange,
}: ShareDialogProps) {
  const [current, setCurrent] = useState<ProjectVisibility>(visibility);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<"link" | "embed" | null>(null);

  useEffect(() => {
    if (open) setCurrent(visibility);
  }, [open, visibility]);

  const shareUrl = `${window.location.origin}/v/${shareSlug}`;
  const embedCode = `<div style="position:relative;padding-bottom:56.25%;height:0;"><iframe src="${shareUrl}?embed=1" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:12px;" allow="fullscreen" loading="lazy" title="DemoForge demo"></iframe></div>`;

  const isShareable = current !== "private";

  const setVisibility = async (v: ProjectVisibility) => {
    if (v === current || saving) return;
    const prev = current;
    setCurrent(v); // optimistic
    setSaving(true);
    try {
      await projectsApi.update(projectId, { visibility: v });
      onVisibilityChange?.(v);
      toast.success(
        v === "private" ? "Demo is now private" : "Share link is live"
      );
    } catch {
      setCurrent(prev);
      toast.error("Couldn't update visibility.");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string, which: "link" | "embed") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,640px)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg sm:w-full">
        <DialogHeader className="shrink-0 space-y-1.5 px-6 pb-4 pt-6 pr-12">
          <DialogTitle className="font-display">Share this demo</DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block">
              Choose who can watch, then send the link or embed the player.
            </span>
            {typeof viewCount === "number" && viewCount > 0 && (
              <span className="inline-flex items-center gap-1 text-foreground">
                <Eye className="h-3.5 w-3.5 shrink-0" />
                {viewCount.toLocaleString()} views so far
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
          {/* Visibility picker */}
          <div className="grid gap-2 sm:grid-cols-3">
            {visibilityOptions.map(({ value, label, hint, icon: Icon }) => {
              const active = current === value;
              return (
                <button
                  key={value}
                  onClick={() => setVisibility(value)}
                  disabled={saving}
                  className={`min-w-0 rounded-xl border p-3 text-left transition-all ${
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <Icon
                    className={`mb-2 h-4 w-4 shrink-0 ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <div className="text-sm font-medium leading-tight">{label}</div>
                  <div className="text-xs leading-snug text-muted-foreground">{hint}</div>
                </button>
              );
            })}
          </div>

          {/* Share link */}
          <div className={isShareable ? "min-w-0" : "pointer-events-none min-w-0 opacity-40"}>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Share link
            </Label>
            <div className="flex min-w-0 gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="min-w-0 font-mono text-xs"
              />
              <Button
                variant="secondary"
                size="icon"
                className="shrink-0"
                onClick={() => copy(shareUrl, "link")}
                aria-label="Copy share link"
              >
                {copied === "link" ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Embed code */}
          <div className={isShareable ? "min-w-0" : "pointer-events-none min-w-0 opacity-40"}>
            <Label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Code2 className="h-3.5 w-3.5 shrink-0" /> Embed on your site
            </Label>
            <div className="flex min-w-0 gap-2">
              <pre className="min-w-0 flex-1 max-h-28 overflow-auto break-all whitespace-pre-wrap rounded-lg border border-border bg-secondary/50 p-3 text-[11px] leading-relaxed">
                {embedCode}
              </pre>
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 shrink-0 self-start"
                onClick={() => copy(embedCode, "embed")}
                aria-label="Copy embed code"
              >
                {copied === "embed" ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {!isShareable && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              This demo is private. Switch to <strong>Unlisted</strong> or{" "}
              <strong>Public</strong> to activate the link.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
