import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestSignIn } from "@/hooks/useGuestSignIn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Video,
  MoreHorizontal,
  Clock,
  Trash2,
  Edit,
  FolderOpen,
  Eye,
  Share2,
  Sparkles,
} from "lucide-react";
import { ShareDialog } from "@/components/ShareDialog";
import { recorderHref, editorHref } from "@/lib/studio/pipeline";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  projectsApi,
  UnauthorizedError,
  type ProjectSummary,
} from "@/lib/api/projects";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
  rendering: {
    label: "Rendering",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  ready: {
    label: "Ready",
    className: "bg-success/10 text-success border-success/20",
  },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function projectResumeHref(project: ProjectSummary): string {
  // No pipeline ordering — open the editor directly. Brand-new drafts with no
  // duration recorded yet go to the recorder.
  if (project.status === "draft" && !project.duration) return recorderHref(project.id);
  return editorHref(project.id);
}

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState<ProjectSummary | null>(null);
  const navigate = useNavigate();
  const { signOut, isAuthenticated } = useAuth();
  const signIn = useGuestSignIn();

  useEffect(() => {
    // Guests have no server-side projects — skip the fetch and show the
    // guest home instead.
    if (!isAuthenticated) {
      setProjects([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const data = await projectsApi.list();
        setProjects(data);
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          signOut();
          return;
        }
        toast.error("Couldn't load your projects. Is the backend running?");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [navigate, signOut, isAuthenticated]);

  const handleCreate = () => {
    navigate("/recorder");
  };

  const handleDelete = async (id: string) => {
    const prev = projects;
    setProjects((p) => p.filter((x) => x.id !== id)); // optimistic
    try {
      await projectsApi.remove(id);
      toast.success("Project deleted");
    } catch (err) {
      setProjects(prev); // rollback
      if (err instanceof UnauthorizedError) {
        signOut();
        navigate("/auth");
        return;
      }
      toast.error("Couldn't delete that project.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container space-y-10 py-10">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Your demos
            </h1>
            <p className="mt-1 text-muted-foreground">
              Record once, refine in the studio, export, and share — all linked in one flow.
            </p>
          </div>
          <Button variant="hero" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create new demo
          </Button>
        </div>

        {!isAuthenticated && (
          <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  You're using DemoForge as a guest
                </p>
                <p className="text-sm text-muted-foreground">
                  Record, edit, and try one free render. Sign in to save your
                  work, share it, and render as much as you like.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="shrink-0"
              onClick={() => signIn({ onSuccess: () => navigate("/dashboard") })}
            >
              Sign in to save
            </Button>
          </div>
        )}


        {loading ? (
          /* Loading skeleton */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-border bg-card"
              >
                <div className="aspect-video rounded-t-xl bg-muted" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          /* Empty state */
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/40 p-12 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
              <FolderOpen className="h-10 w-10 text-primary" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">No demos yet</h2>
            <p className="mb-8 max-w-sm text-muted-foreground">
              Create your first demo by recording your screen. DemoForge's AI will
              handle the script, voice, and framing.
            </p>
            <Button variant="hero" size="lg" onClick={handleCreate}>
              <Plus className="mr-2 h-5 w-5" />
              Create your first demo
            </Button>
          </div>
        ) : (
          /* Project grid */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => {
              const cfg = statusConfig[project.status] ?? statusConfig.draft;
              const resumeHref = projectResumeHref(project);
              return (
                <Link
                  key={project.id}
                  to={resumeHref}
                  className="group relative rounded-xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video overflow-hidden rounded-t-xl bg-secondary">
                    {project.thumbnail_url ? (
                      <img
                        src={project.thumbnail_url}
                        alt={project.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-foreground/0 opacity-0 transition-all group-hover:bg-foreground/5 group-hover:opacity-100">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg">
                        <Edit className="h-5 w-5 text-primary-foreground" />
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 font-medium leading-snug">
                        {project.title}
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.preventDefault()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/recorder?project=${project.id}`);
                            }}
                          >
                            <Video className="mr-2 h-4 w-4" />
                            Re-record
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault();
                              setSharing(project);
                            }}
                          >
                            <Share2 className="mr-2 h-4 w-4" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault();
                              handleDelete(project.id);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={cfg.className}>
                        {cfg.label}
                      </Badge>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {project.view_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {project.view_count}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(project.updated_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {sharing && (
          <ShareDialog
            open
            onOpenChange={(o) => !o && setSharing(null)}
            projectId={sharing.id}
            shareSlug={sharing.share_slug}
            visibility={sharing.visibility}
            viewCount={sharing.view_count}
            onVisibilityChange={(v) =>
              setProjects((ps) =>
                ps.map((p) => (p.id === sharing.id ? { ...p, visibility: v } : p))
              )
            }
          />
        )}
      </main>
    </div>
  );
}
