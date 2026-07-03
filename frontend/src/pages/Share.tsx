/**
 * Public share player — /v/:slug
 *
 * "The share link is the product." This page is what a prospect sees when
 * someone sends them a DemoForge link: a fast, clean player with AI-generated
 * chapters, a transcript, and a tasteful DemoForge CTA that drives signups.
 *
 * Also serves the embed view (?embed=1) used by the iframe snippet in
 * ShareDialog — same route, chrome stripped down to just the player.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Eye,
  Clock,
  ListOrdered,
  FileText,
  Video,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { projectsApi, type ProjectDetail } from "@/lib/api/projects";

type Segment = { text: string; timestamp: number };

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/** Turn narration segments into chapter titles (first ~6 words). */
function chapterTitle(text: string): string {
  const words = text.trim().split(/\s+/);
  const head = words.slice(0, 6).join(" ");
  return words.length > 6 ? `${head}…` : head;
}

export default function Share() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<"notfound" | "failed" | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!slug) return;
    projectsApi
      .getPublic(slug)
      .then(setProject)
      .catch((err: Error) =>
        setError(/404/.test(err.message) ? "notfound" : "failed")
      );
  }, [slug]);

  useEffect(() => {
    if (project?.title) document.title = `${project.title} · DemoForge`;
  }, [project?.title]);

  const segments: Segment[] = useMemo(
    () =>
      (project?.script_segments ?? []).filter(
        (s): s is Segment => typeof s?.text === "string"
      ),
    [project]
  );

  const activeSegment = useMemo(() => {
    let idx = -1;
    segments.forEach((s, i) => {
      if (time >= (s.timestamp ?? 0)) idx = i;
    });
    return idx;
  }, [segments, time]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setStarted(true);
    } else {
      v.pause();
    }
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    v.play();
    setStarted(true);
  };

  const enterFullscreen = () => {
    videoRef.current?.requestFullscreen?.();
  };

  /* ---------- Error / loading states ---------- */

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-warm p-8 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <Video className="h-10 w-10 text-primary" />
        </div>
        <h1 className="mb-2 font-display text-2xl font-semibold">
          {error === "notfound" ? "This demo isn't available" : "Something went wrong"}
        </h1>
        <p className="mb-8 max-w-sm text-muted-foreground">
          {error === "notfound"
            ? "The link may be wrong, or the owner may have made this demo private."
            : "We couldn't load this demo. Please try again in a moment."}
        </p>
        <Button variant="hero" asChild>
          <Link to="/">
            <Sparkles className="mr-2 h-4 w-4" />
            Make your own demo with DemoForge
          </Link>
        </Button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-warm">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const player = (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-foreground shadow-xl">
      {project.video_url ? (
        <>
          <video
            ref={videoRef}
            src={project.video_url}
            poster={project.thumbnail_url || undefined}
            className="aspect-video w-full"
            playsInline
            muted={muted}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onClick={togglePlay}
          />

          {/* Big play button before first play */}
          {!started && (
            <button
              onClick={togglePlay}
              aria-label="Play demo"
              className="absolute inset-0 flex items-center justify-center bg-foreground/30 transition-colors hover:bg-foreground/20"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-2xl transition-transform hover:scale-105">
                <Play className="ml-1 h-9 w-9 text-primary-foreground" />
              </span>
            </button>
          )}

          {/* Control bar */}
          <div
            className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10 transition-opacity ${
              started ? "opacity-0 group-hover:opacity-100" : "opacity-0"
            }`}
          >
            {/* Scrubber with chapter markers */}
            <div
              className="relative mb-3 h-1.5 cursor-pointer rounded-full bg-white/25"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const frac = (e.clientX - rect.left) / rect.width;
                seekTo(frac * (duration || 0));
              }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: `${duration ? (time / duration) * 100 : 0}%` }}
              />
              {duration > 0 &&
                segments.map((s, i) => (
                  <span
                    key={i}
                    className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded bg-white/70"
                    style={{ left: `${(s.timestamp / duration) * 100}%` }}
                  />
                ))}
            </div>
            <div className="flex items-center gap-3 text-white">
              <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button onClick={() => setMuted((m) => !m)} aria-label="Toggle mute">
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <span className="text-xs tabular-nums">
                {formatTime(time)} / {formatTime(duration || project.duration)}
              </span>
              <button onClick={enterFullscreen} className="ml-auto" aria-label="Fullscreen">
                <Maximize className="h-5 w-5" />
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Video not rendered yet */
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-gradient-subtle text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">This demo is still being rendered — check back soon.</p>
        </div>
      )}
    </div>
  );

  /* ---------- Embed mode: player only ---------- */
  if (embed) {
    return (
      <div className="relative min-h-screen bg-background p-0">
        {player}
        <a
          href={`${window.location.origin}/v/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white opacity-70 transition-opacity hover:opacity-100"
        >
          ⚡ DemoForge
        </a>
      </div>
    );
  }

  /* ---------- Full share page ---------- */
  return (
    <div className="min-h-screen bg-gradient-warm">
      {/* Minimal public header */}
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Video className="h-4 w-4" />
            </span>
            DemoForge
          </Link>
          <Button variant="hero" size="sm" asChild>
            <Link to="/auth">
              <Sparkles className="mr-2 h-4 w-4" />
              Make a demo like this — free
            </Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-6xl py-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Player + meta */}
          <div>
            {player}

            <div className="mt-5">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {project.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  {project.view_count.toLocaleString()} views
                </span>
                {project.duration > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {formatTime(project.duration)}
                  </span>
                )}
                <Badge variant="outline" className="uppercase">
                  {project.language}
                </Badge>
              </div>
              {project.description && (
                <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
                  {project.description}
                </p>
              )}
            </div>

            {/* Transcript */}
            {segments.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-4 w-4" /> Transcript
                </h2>
                <div className="space-y-2 rounded-xl border border-border bg-card p-5">
                  {segments.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => seekTo(s.timestamp)}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-sm leading-relaxed transition-colors hover:bg-secondary ${
                        i === activeSegment ? "bg-primary/10 text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <span className="mr-3 font-mono text-xs text-primary">
                        {formatTime(s.timestamp)}
                      </span>
                      {s.text}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Chapters sidebar */}
          <aside className="space-y-6">
            {segments.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <ListOrdered className="h-4 w-4" /> Chapters
                </h2>
                <ol className="space-y-1">
                  {segments.map((s, i) => (
                    <li key={i}>
                      <button
                        onClick={() => seekTo(s.timestamp)}
                        className={`flex w-full items-baseline gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-secondary ${
                          i === activeSegment
                            ? "bg-primary/10 font-medium text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span className="font-mono text-xs text-primary">
                          {formatTime(s.timestamp)}
                        </span>
                        <span className="line-clamp-2">{chapterTitle(s.text)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* CTA card — the growth loop */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="mb-1 font-medium">Made with DemoForge</p>
              <p className="mb-4 text-sm text-muted-foreground">
                Record once. AI writes the script, voices it, and frames every shot.
              </p>
              <Button variant="hero" size="sm" className="w-full" asChild>
                <Link to="/auth">Create your demo — free</Link>
              </Button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
