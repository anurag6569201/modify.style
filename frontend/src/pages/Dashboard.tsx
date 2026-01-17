import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Project {
  id: string;
  title: string;
  status: "draft" | "rendering" | "ready";
  updatedAt: string;
  thumbnail?: string;
}

const statusConfig = {
  draft: {
    label: "Draft",
    className: "bg-secondary text-secondary-foreground",
  },
  rendering: {
    label: "Rendering",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  ready: {
    label: "Ready",
    className: "bg-success/10 text-success border-success/20",
  },
};

import { AudioGenerator } from "@/components/AudioGenerator";

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<{ name: string; email: string } | undefined>(
    undefined
  );
  const [showEmpty, setShowEmpty] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) {
          navigate("/auth");
          return;
        }

        const response = await fetch("http://localhost:8000/api/auth/profile/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // We map username to name for the UI for now, or use username as name
          setUser({ name: data.username, email: data.email });
        } else {
          // Handle token expiry or invalid token
          if (response.status === 401) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            navigate("/auth");
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile", error);
      }
    };

    fetchProfile();
  }, [navigate]);

  const displayProjects = projects;

  const handleDelete = (id: string) => {
    setProjects(projects.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated user={user} />
      <AudioGenerator />
      <main className="container py-8">
        {/* Page Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Projects</h1>
            <p className="mt-1 text-muted-foreground">
              Create and manage your demo videos
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="hero" asChild>
              <Link to="/recorder">
                <Plus className="mr-2 h-4 w-4" />
                Create New Demo
              </Link>
            </Button>
          </div>
        </div>

        {displayProjects.length === 0 ? (
          /* Empty State */
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/20 p-12 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
              <FolderOpen className="h-10 w-10 text-primary" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">No projects yet</h2>
            <p className="mb-8 max-w-sm text-muted-foreground">
              Create your first demo video by recording your screen. Our AI will
              handle the rest.
            </p>
            <Button variant="hero" size="lg" asChild>
              <Link to="/recorder">
                <Plus className="mr-2 h-5 w-5" />
                Create Your First Demo
              </Link>
            </Button>
          </div>
        ) : (
          /* Project Grid */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayProjects.map((project) => (
              <Link
                key={project.id}
                to={`/editor/${project.id}`}
                className="group relative rounded-xl border border-border bg-card transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden rounded-t-xl bg-gradient-subtle">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Video className="h-10 w-10 text-muted-foreground/30" />
                  </div>
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
                    <Badge
                      variant="outline"
                      className={statusConfig[project.status].className}
                    >
                      {statusConfig[project.status].label}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {project.updatedAt}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
