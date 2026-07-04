import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Stage } from "@/components/editor/Stage";
import { CameraDebugOverlay } from "@/components/editor/CameraDebugOverlay";
import { editorStore, useEditorState, generateId } from "@/lib/editor/store";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { VideoControls } from "@/components/editor/VideoControls";
import { Timeline } from "@/components/editor/Timeline";
import { VoiceoverAudioLayer } from "@/components/editor/VoiceoverAudioLayer";
import { MusicAudioLayer } from "@/components/editor/MusicAudioLayer";

import { useNavigate, useParams, useLocation, useSearchParams, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import type { EditorTabId } from "@/lib/studio/pipeline";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Video,
  Share2,
  Undo2,
  Redo2,
  LayoutDashboard,
  ChevronUp,
  ChevronDown,
  Clock,
  ZoomIn,
  Type,
  Mic2,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ShareDialog } from "@/components/ShareDialog";
import { projectsApi, type ProjectDetail } from "@/lib/api/projects";
import { hydrateEditorFromProject, serializeEditorState, scriptSegmentsFromState } from "@/lib/projectPersistence";
import { useDebouncedProjectSave } from "@/hooks/useDebouncedProjectSave";
import { useAuth } from "@/contexts/AuthContext";
import { runAutoPipeline } from "@/lib/editor/autoPipeline";
import { editorAccessFor, editorTabLocks } from "@/lib/entitlements";
import { useGuestSignIn } from "@/hooks/useGuestSignIn";
import { UpgradeDialog } from "@/components/UpgradeDialog";

const VALID_EDITOR_TABS = new Set<EditorTabId>([
  "script",
  "voice",
  "design",
  "text",
  "camera",
  "effects",
  "polish",
  "music",
  "timeline",
]);

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const tabParam = searchParams.get("tab");
  const requestedTab =
    tabParam && VALID_EDITOR_TABS.has(tabParam as EditorTabId)
      ? (tabParam as EditorTabId)
      : null;

  const setEditorTab = useCallback(
    (tab: EditorTabId) => {
      setSearchParams({ tab }, { replace: true });
    },
    [setSearchParams]
  );

  // --- Server-side project (persistence + sharing) ---
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [projectLoading, setProjectLoading] = useState(() => !!id && id !== "new");
  const [shareOpen, setShareOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const hydratedFromDbRef = useRef(false);
  const [autoSaveReady, setAutoSaveReady] = useState(false);
  const [frameVisited, setFrameVisited] = useState(false);

  useDebouncedProjectSave(project?.id, autoSaveReady, frameVisited);

  useEffect(() => {
    setAutoSaveReady(false);
    if (!project?.id) return;
    const t = setTimeout(() => setAutoSaveReady(true), 3000);
    return () => clearTimeout(t);
  }, [project?.id]);

  useEffect(() => {
    if (!id || id === "new") {
      setProjectLoading(false);
      return;
    }
    hydratedFromDbRef.current = false;
    setProjectLoading(true);
    projectsApi
      .get(id)
      .then((p) => {
        setProject(p);
        setTitleDraft(p.title);
      })
      .catch(() => {
        // Local-only session — sharing disabled, editing still works from nav state.
      })
      .finally(() => setProjectLoading(false));
  }, [id]);

  // Hydrate editor from DB when reopening a project (no fresh navigation state).
  useEffect(() => {
    if (!project || hydratedFromDbRef.current) return;
    if (location.state?.videoUrl) {
      hydratedFromDbRef.current = true;
      return;
    }
    if (hydrateEditorFromProject(project)) {
      hydratedFromDbRef.current = true;
    }
  }, [project, location.state?.videoUrl]);

  const saveTitle = async () => {
    if (!project || !titleDraft.trim() || titleDraft === project.title) return;
    const title = titleDraft.trim();
    setProject((p) => (p ? { ...p, title } : p));
    try {
      await projectsApi.update(project.id, { title });
    } catch {
      toast({ title: "Couldn't save the title", variant: "destructive" });
    }
  };

  const editorState = useEditorState();

  const videoUrl =
    location.state?.videoUrl ??
    project?.video_url ??
    editorState.video.url ??
    null;

  // --- Tier-based editing access (no more pipeline ordering) ---
  const { isAuthenticated, plan } = useAuth();
  const signIn = useGuestSignIn();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const editorAccess = editorAccessFor(isAuthenticated, plan);
  const tabLocks = useMemo(
    () => editorTabLocks(editorAccess) as Partial<Record<EditorTabId, string>>,
    [editorAccess]
  );

  // Land on the first tab this user can actually edit (so free users don't open
  // straight onto a locked panel). Guests have nothing editable → default to
  // "script", shown as a locked preview with a login CTA.
  const firstEditableTab = useMemo<EditorTabId>(() => {
    const order: EditorTabId[] = [
      "text", "timeline", "script", "voice",
      "design", "camera", "effects", "polish", "music",
    ];
    return order.find((t) => !tabLocks[t]) ?? "script";
  }, [tabLocks]);

  const editorTab: EditorTabId = requestedTab ?? firstEditableTab;

  const lockedCtaLabel = editorAccess === "guest" ? "Log in to edit" : "Upgrade to Pro";
  const handleLockedCta = useCallback(() => {
    if (editorAccess === "guest") signIn();
    else setUpgradeOpen(true);
  }, [editorAccess, signIn]);

  const setEditorTabGuarded = useCallback(
    (tab: EditorTabId) => {
      const reason = tabLocks[tab];
      if (reason) {
        toast({ title: "Editing locked", description: reason });
        handleLockedCta();
        return;
      }
      setEditorTab(tab);
    },
    [tabLocks, setEditorTab, toast, handleLockedCta]
  );

  useEffect(() => {
    const fromDb = (project?.edit_data as { pipeline?: { frameVisited?: boolean } } | undefined)
      ?.pipeline?.frameVisited;
    if (fromDb) setFrameVisited(true);
  }, [project?.edit_data]);

  useEffect(() => {
    if (["camera", "design", "text", "effects", "polish", "timeline"].includes(editorTab)) {
      setFrameVisited(true);
    }
  }, [editorTab]);

  const clickData = location.state?.clickData || [];
  const moveData = location.state?.moveData || [];
  const capturedEffects = location.state?.effects || [];
  const rawRecording =
    location.state?.rawRecording ??
    (project?.recording_data as { rawRecording?: boolean } | undefined)?.rawRecording ??
    false;
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Initialize store from navigation state (fresh recording)
  useEffect(() => {
    if (editorState.video.url !== videoUrl && videoUrl) {
      editorStore.setVideo({ url: videoUrl });
    }
    if (clickData.length > 0 && editorState.events.clicks.length === 0) {
      editorStore.setState(prev => ({
        events: {
          ...prev.events,
          clicks: clickData,
          moves: moveData,
          effects: capturedEffects,
        }
      }), { history: false });
    }
  }, [videoUrl, clickData, moveData, capturedEffects, editorState.video.url, editorState.events.clicks.length]);

  // Auto-apply the polished starter template once, on a fresh recording, so the
  // demo looks finished with zero effort (guests get this too — it's the
  // "record and we do everything" experience).
  const templateAppliedRef = useRef(false);
  useEffect(() => {
    const isFreshRecording = !!location.state?.videoUrl;
    if (isFreshRecording && !templateAppliedRef.current) {
      templateAppliedRef.current = true;
      editorStore.applyDefaultTemplate();
    }
  }, [location.state?.videoUrl]);

  // Auto-generate the AI script + voiceover for signed-in users on a fresh
  // recording — the "we do everything" magic. Guests are skipped (the AI
  // endpoints need a login and we don't call paid AI for anonymous visitors);
  // they get the visual template only and are nudged to sign in.
  const [autoGenerating, setAutoGenerating] = useState(false);
  const autoPipelineRanRef = useRef(false);
  useEffect(() => {
    const isFreshRecording = !!location.state?.videoUrl;
    if (!isFreshRecording || autoPipelineRanRef.current) return;
    if (!isAuthenticated) return;
    // Don't re-run if a script already exists (e.g. reopened project).
    const hasScript = editorStore.getState().voiceover.scriptSegments.length > 0;
    if (hasScript) return;

    autoPipelineRanRef.current = true;
    setAutoGenerating(true);
    toast({
      title: "Creating your demo…",
      description: "Writing the script and voiceover from your recording.",
    });
    runAutoPipeline()
      .then((r) => {
        if (r.scriptGenerated) {
          toast({
            title: "Your demo is ready",
            description: `Script${r.voiceGenerated > 0 ? " and voiceover" : ""} generated — preview it, then export.`,
          });
        }
      })
      .finally(() => setAutoGenerating(false));
  }, [location.state?.videoUrl, isAuthenticated, toast]);

  // --- Selection state (shared between timeline and panels) ---
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null);
  const [selectedTextLayerId, setSelectedTextLayerId] = useState<string | null>(null);
  const [selectedClickIndex, setSelectedClickIndex] = useState<number | null>(null);
  const [isLoopingEffect, setIsLoopingEffect] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const loopIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const effectsSeededRef = useRef(false);

  const duration = editorState.video.duration || 0;

  const togglePlay = useCallback(() => {
    const state = editorStore.getState();
    const newIsPlaying = !state.playback.isPlaying;
    // Restart from the top if pressing play at the very end
    if (newIsPlaying && state.video.duration > 0 && state.playback.currentTime >= state.video.duration - 0.05) {
      editorStore.setPlayback({ currentTime: 0, isPlaying: true });
      return;
    }
    editorStore.setPlayback({ isPlaying: newIsPlaying });
  }, []);

  const toggleMute = () => {
    editorStore.setPlayback({ isMuted: !editorState.playback.isMuted });
  };

  // Seed zoom moments from clicks on first load of a fresh recording
  const deriveSpotlightEffectsFromClicks = useCallback(() => {
    const dur = editorStore.getState().video.duration || 0;
    const clicks = [...editorStore.getState().events.clicks].sort((a, b) => a.timestamp - b.timestamp);
    if (!dur || clicks.length === 0) return [];
    const effects: Array<ReturnType<typeof Object>> & any[] = [];
    let lastEnd = -1;
    for (const click of clicks) {
      const start = Math.max(0, click.timestamp - 0.2);
      if (start < lastEnd + 1) continue;
      const end = Math.min(dur, start + 2.8);
      effects.push({
        id: generateId('effect'),
        type: 'spotlight',
        start,
        end,
        zoom: editorStore.getState().camera.zoomStrength,
        label: 'Auto zoom',
        panX: Math.round((click.x * 2 - 1) * 100) / 100,
        panY: Math.round((click.y * 2 - 1) * 100) / 100,
        easing: 'ease-out' as const,
        transitionSpeed: 1.0,
      });
      lastEnd = end;
    }
    return effects;
  }, []);

  useEffect(() => {
    if (effectsSeededRef.current) return;
    if (editorState.events.effects.length > 0) {
      effectsSeededRef.current = true;
      return;
    }
    if (duration > 0 && editorState.events.clicks.length > 1) {
      const derived = deriveSpotlightEffectsFromClicks();
      if (derived.length > 0) {
        editorStore.setState(prev => ({
          events: { ...prev.events, effects: derived },
        }), { history: false });
        effectsSeededRef.current = true;
      }
    }
  }, [deriveSpotlightEffectsFromClicks, editorState.events.effects.length, editorState.events.clicks.length, duration]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Undo / redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) editorStore.redo();
        else editorStore.undo();
        return;
      }

      // Focus (edit view) mode
      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setFocusMode((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setFocusMode(false);
        return;
      }

      const state = editorStore.getState();
      const dur = state.video.duration || 0;
      if (dur <= 0) return;
      const currentTime = state.playback.currentTime;
      const frameTime = 1 / 30;

      switch (e.key) {
        case 'ArrowLeft': {
          e.preventDefault();
          const step = e.shiftKey ? frameTime : 1;
          editorStore.setPlayback({ currentTime: Math.max(0, currentTime - step) });
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const step = e.shiftKey ? frameTime : 1;
          editorStore.setPlayback({ currentTime: Math.min(dur, currentTime + step) });
          break;
        }
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedEffectId) {
            e.preventDefault();
            editorStore.deleteEffect(selectedEffectId);
            setSelectedEffectId(null);
          } else if (selectedTextLayerId) {
            e.preventDefault();
            editorStore.deleteTextOverlay(selectedTextLayerId);
            setSelectedTextLayerId(null);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedEffectId, selectedTextLayerId, togglePlay]);

  // --- Loop-preview the selected zoom moment ---
  useEffect(() => {
    if (loopIntervalRef.current) {
      clearInterval(loopIntervalRef.current);
      loopIntervalRef.current = null;
    }

    if (!selectedEffectId) {
      setIsLoopingEffect(false);
      return;
    }

    const effect = editorState.events.effects.find(e => e.id === selectedEffectId);
    if (!effect) return;

    const start = Number.isFinite(effect.start) ? effect.start : (effect.timestamp || 0);
    const end = Number.isFinite(effect.end) ? effect.end : (start + 3);

    loopIntervalRef.current = setInterval(() => {
      const state = editorStore.getState();
      if (!state.playback.isPlaying) {
        setIsLoopingEffect(false);
        return;
      }
      setIsLoopingEffect(true);
      if (state.playback.currentTime >= end || state.playback.currentTime < start - 0.25) {
        editorStore.setPlayback({ currentTime: start });
      }
    }, 100);

    return () => {
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
        loopIntervalRef.current = null;
      }
      setIsLoopingEffect(false);
    };
  }, [selectedEffectId, editorState.events.effects]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loopIntervalRef.current) clearInterval(loopIntervalRef.current);
      editorStore.setPlayback({ isPlaying: false });
    };
  }, []);

  // --- Selection → tab routing ---
  const handleTimelineTextSelect = useCallback((layerId: string | null) => {
    setSelectedTextLayerId(layerId);
    if (layerId) setEditorTabGuarded('text');
  }, [setEditorTabGuarded]);

  const handleTimelineEffectSelect = useCallback((effectId: string | null) => {
    setSelectedEffectId(effectId);
    if (effectId) setEditorTabGuarded('camera');
  }, [setEditorTabGuarded]);

  // Selecting a zoom moment from the panel should reveal it on the timeline
  useEffect(() => {
    if (selectedEffectId) setTimelineOpen(true);
  }, [selectedEffectId]);

  const handleRender = async () => {
    if (!videoUrl) {
      toast({
        title: "Nothing to export yet",
        description: "Record a demo first.",
        variant: "destructive",
      });
      return;
    }

    const presentationConfig = {
      ...editorState.presentation,
      layeredRendering: rawRecording ? true : (editorState.presentation.layeredRendering !== false),
    };

    if (project?.id) {
      try {
        await projectsApi.saveEditData(
          project.id,
          serializeEditorState(editorState, { frameVisited }),
          scriptSegmentsFromState(editorState)
        );
        await projectsApi.update(project.id, { status: "rendering" });
      } catch {
        toast({ title: "Couldn't save before export", variant: "destructive" });
      }
    }

    // Burned-in captions: synthesize text overlays from script segments
    const captionOverlays = (() => {
      const c = editorState.voiceover.captions;
      if (!c?.enabled) return [];
      const segs = editorState.voiceover.scriptSegments;
      return segs
        .filter((s) => s.text.trim())
        .map((s, i) => {
          const next = segs[i + 1];
          const end =
            s.duration && s.duration > 0
              ? s.timestamp + s.duration
              : next
                ? next.timestamp
                : editorState.video.duration || s.timestamp + 4;
          return {
            id: `caption-${i}`,
            text: s.text,
            x: 0.5,
            y: c.position === "top" ? 0.08 : 0.92,
            rotation: 0,
            scale: 1,
            opacity: 1,
            fontSize: c.size,
            fontFamily: "Inter",
            fontWeight: "500",
            fontStyle: "normal" as const,
            textAlign: "center" as const,
            lineHeight: 1.3,
            letterSpacing: 0,
            color: "#ffffff",
            backgroundColor:
              c.style === "boxed"
                ? "rgba(0,0,0,0.75)"
                : c.style === "gradient"
                  ? "rgba(232,80,110,0.9)"
                  : "transparent",
            padding: c.style === "clean" ? 0 : 12,
            borderRadius: 8,
            borderWidth: 0,
            borderColor: "transparent",
            shadowColor: "rgba(0,0,0,0.85)",
            shadowBlur: c.style === "clean" ? 8 : 0,
            shadowOffsetX: 0,
            shadowOffsetY: 1,
            backdropBlur: 0,
            textTransform: "none" as const,
            gradient: { enabled: false, colors: [], angle: 45 },
            blendMode: "normal" as const,
            startTime: s.timestamp,
            endTime: Math.max(s.timestamp + 0.5, end),
            animation: "fade" as const,
          };
        });
    })();

    navigate("/render", {
      state: {
        projectId: project?.id,
        videoUrl,
        clickData: editorState.events.clicks,
        moveData: editorState.events.moves,
        effects: editorState.events.effects,
        camera: editorState.camera,
        colorGrading: editorState.colorGrading,
        textOverlays: [...editorState.textOverlays, ...captionOverlays],
        presentation: presentationConfig,
        effectsConfig: editorState.effects,
        cursorConfig: editorState.cursor,
        rawRecording,
        voiceover: editorState.voiceover,
        music: editorState.music,
      }
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!focusMode && <Header />}
      <VoiceoverAudioLayer />
      <MusicAudioLayer />

      {/* Floating controls in focus mode */}
      {focusMode && (
        <div className="fixed right-3 top-3 z-50 flex items-center gap-1 rounded-full border border-border/60 bg-card/90 p-1 shadow-lg backdrop-blur-md animate-in fade-in">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Undo (⌘Z)" onClick={() => editorStore.undo()}>
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Redo (⇧⌘Z)" onClick={() => editorStore.redo()}>
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <div className="h-4 w-px bg-border/60" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!videoUrl}
            onClick={handleRender}
            title={!videoUrl ? "Record a demo first" : "Export"}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Export
          </Button>
          <div className="h-4 w-px bg-border/60" />
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Exit edit view (Esc)" onClick={() => setFocusMode(false)}>
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <main className="flex-1">
        <div
          className={cn(
            "mx-auto flex flex-col gap-3 px-4 py-3",
            focusMode ? "h-dvh max-w-none px-3 py-2" : "h-[calc(100dvh-4rem)] max-w-[1800px]"
          )}
        >
          {/* ---- Compact top bar: title · steps · actions ---- */}
          {!focusMode && (
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                to="/dashboard"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Back to demos"
              >
                <LayoutDashboard className="h-4 w-4" />
              </Link>
              {project ? (
                <input
                  value={titleDraft || (id === "new" ? "New demo" : "Untitled demo")}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  aria-label="Project title"
                  className="w-full max-w-[280px] truncate rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-base font-semibold tracking-tight outline-none transition-colors hover:border-border focus:border-primary"
                />
              ) : (
                <h1 className="truncate px-1 font-display text-base font-semibold tracking-tight">
                  {titleDraft || (id === "new" ? "New demo" : "Untitled demo")}
                </h1>
              )}
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-center">
              {autoGenerating && (
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Creating your demo…
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Undo (⌘Z)"
                  onClick={() => editorStore.undo()}
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Redo (⇧⌘Z)"
                  onClick={() => editorStore.redo()}
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Edit view — distraction-free (F)"
                  onClick={() => setFocusMode(true)}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShareOpen(true)}
                disabled={!project}
                title={!project ? "Sign in to share your demo" : undefined}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button
                variant="hero"
                size="sm"
                onClick={handleRender}
                disabled={!videoUrl}
                title={!videoUrl ? "Record a demo first" : undefined}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
          )}

          {/* ---- Workspace: preview + panel, 50/50 (fills remaining height) ---- */}
          <div className={cn("grid min-h-0 flex-1 gap-3 lg:grid-cols-2", !focusMode && "pb-10")}>
            {/* Left — video preview */}
            <div className="flex min-h-[320px] flex-col justify-between overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex min-h-0 flex-1 items-center justify-center p-3">
                <div
                  ref={videoContainerRef}
                  className="main_video_stream group relative flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-black shadow-2xl"
                  style={{
                    isolation: 'isolate',
                    aspectRatio: editorState.presentation.outputWidth > 0 && editorState.presentation.outputHeight > 0
                      ? `${editorState.presentation.outputWidth} / ${editorState.presentation.outputHeight}`
                      : (editorState.video.width > 0 && editorState.video.height > 0
                        ? `${editorState.video.width} / ${editorState.video.height}`
                        : '16 / 9'),
                    width: '100%',
                  }}
                >
                  {videoUrl ? (
                    <>
                      <Stage />
                      <CameraDebugOverlay />
                    </>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-secondary">
                      <Video className="h-8 w-8 text-primary" />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border/40 px-2 pb-1 pt-2">
                <VideoControls
                  isPlaying={editorState.playback.isPlaying}
                  isMuted={editorState.playback.isMuted}
                  volume={editorState.playback.volume}
                  currentTime={editorState.playback.currentTime}
                  duration={duration}
                  playbackSpeed={editorState.playback.playbackRate}
                  onPlayPause={togglePlay}
                  onSeek={(time) => editorStore.setPlayback({ currentTime: time })}
                  onVolumeChange={(vol) => editorStore.setPlayback({ volume: vol, isMuted: vol === 0 })}
                  onToggleMute={toggleMute}
                  onSpeedChange={(speed) => editorStore.setPlayback({ playbackRate: speed })}
                  onFrameStep={(direction) => {
                    const frameTime = 1 / 30;
                    const newTime = direction === 'forward'
                      ? editorState.playback.currentTime + frameTime
                      : editorState.playback.currentTime - frameTime;
                    editorStore.setPlayback({ currentTime: Math.max(0, Math.min(newTime, duration)) });
                  }}
                  onFullscreen={() => {
                    if (videoContainerRef.current) {
                      if (!document.fullscreenElement) {
                        videoContainerRef.current.requestFullscreen();
                      } else {
                        document.exitFullscreen();
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Right — control panel */}
            <div className="min-h-[320px] overflow-hidden rounded-xl border border-border bg-card">
              <EditorPanel
                selectedEffectId={selectedEffectId}
                onEffectSelect={setSelectedEffectId}
                isLoopingEffect={isLoopingEffect}
                selectedClickIndex={selectedClickIndex}
                onClickSelect={setSelectedClickIndex}
                selectedTextLayerId={selectedTextLayerId}
                onTextLayerSelect={setSelectedTextLayerId}
                activeTab={editorTab}
                onTabChange={setEditorTabGuarded}
                tabLocks={tabLocks}
                lockedCtaLabel={lockedCtaLabel}
                onLockedCta={handleLockedCta}
              />
            </div>
          </div>

          {/* ---- Timeline ---- */}
          {focusMode ? (
            /* Focus mode: timeline is a third layout region at the bottom, not an overlay */
            <div className="shrink-0">
              <Timeline
                selectedEffectId={selectedEffectId}
                onEffectSelect={handleTimelineEffectSelect}
                selectedTextLayerId={selectedTextLayerId}
                onTextLayerSelect={handleTimelineTextSelect}
                selectedClickIndex={selectedClickIndex}
                onClickSelect={setSelectedClickIndex}
              />
            </div>
          ) : (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
            <div className="mx-auto max-w-[1800px] px-4">
              {timelineOpen ? (
                <div className="pointer-events-auto animate-in fade-in slide-in-from-bottom-4 rounded-t-xl border border-b-0 border-border/60 bg-card/95 shadow-2xl backdrop-blur-md duration-200">
                  {/* Sheet handle */}
                  <button
                    className="group flex w-full items-center justify-center gap-2 rounded-t-xl py-1.5 transition-colors hover:bg-muted/30"
                    onClick={() => setTimelineOpen(false)}
                    title="Hide timeline"
                  >
                    <div className="h-1 w-10 rounded-full bg-border transition-colors group-hover:bg-muted-foreground/40" />
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <div className="max-h-[42vh] overflow-y-auto px-2 pb-1">
                    <Timeline
                      selectedEffectId={selectedEffectId}
                      onEffectSelect={handleTimelineEffectSelect}
                      selectedTextLayerId={selectedTextLayerId}
                      onTextLayerSelect={handleTimelineTextSelect}
                      selectedClickIndex={selectedClickIndex}
                      onClickSelect={setSelectedClickIndex}
                    />
                  </div>
                  <p className="pb-1.5 pt-1 text-center text-[10px] text-muted-foreground/70">
                    Space to play · ←/→ to step (⇧ for frames) · ⌘Z undo · drag blocks to re-time · ⌘-scroll to zoom
                  </p>
                </div>
              ) : (
                <button
                  className="pointer-events-auto flex w-full items-center gap-3 rounded-t-xl border border-b-0 border-border/60 bg-card/95 px-4 py-2 shadow-lg backdrop-blur-md transition-colors hover:bg-card"
                  onClick={() => setTimelineOpen(true)}
                  title="Show timeline"
                >
                  <span className="flex items-center gap-1.5 font-mono text-xs text-foreground">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {Math.floor(editorState.playback.currentTime / 60)}:{Math.floor(editorState.playback.currentTime % 60).toString().padStart(2, '0')}
                    <span className="text-muted-foreground">/ {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
                  </span>
                  {/* Mini progress */}
                  <div className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/70"
                      style={{ width: duration > 0 ? `${(editorState.playback.currentTime / duration) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="hidden items-center gap-3 text-[10px] text-muted-foreground sm:flex">
                    <span className="flex items-center gap-1"><ZoomIn className="h-3 w-3 text-purple-400" />{editorState.events.effects.length}</span>
                    <span className="flex items-center gap-1"><Type className="h-3 w-3 text-emerald-400" />{editorState.textOverlays.length}</span>
                    <span className="flex items-center gap-1"><Mic2 className="h-3 w-3 text-orange-400" />{editorState.voiceover.scriptSegments.filter(s => s.isGenerated).length}/{editorState.voiceover.scriptSegments.length}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium text-primary">
                    Timeline
                    <ChevronUp className="h-3.5 w-3.5" />
                  </span>
                </button>
              )}
            </div>
          </div>
          )}
        </div>
      </main>

      {project && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          projectId={project.id}
          shareSlug={project.share_slug}
          visibility={project.visibility}
          viewCount={project.view_count}
          onVisibilityChange={(v) =>
            setProject((p) => (p ? { ...p, visibility: v } : p))
          }
        />
      )}

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
