
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
// import { VisualEffectsLayer } from "@/components/editor/VisualEffectsLayer"; // Deprecated
// import { CanvasOverlay } from "@/components/editor/CanvasOverlay"; // Deprecated
import { getInitialCameraState, updateCameraSystem } from "@/lib/composition/camera";
import { ClickData, MoveData } from "@/pages/Recorder";
import { FilterEngine } from "@/lib/effects/filters";
import { Stage } from "@/components/editor/Stage";
import { CameraDebugOverlay } from "@/components/editor/CameraDebugOverlay";
import { editorStore, useEditorState } from "@/lib/editor/store";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { TransitionEngine, TransitionType, easings } from "@/lib/effects/transitions";
import { calculateOutputDimensions } from "@/lib/composition/aspectRatio";
import { VideoControls } from "@/components/editor/VideoControls";





import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Pause,
  Wand2,
  Mic2,
  Sparkles,
  MousePointer2,
  ZoomIn,
  Move,
  Clock,
  Loader2,
  Video,
  GripVertical,
  Volume2,
  VolumeX,
  Plus,
  Search,
  Scissors,
  Trash2,
  Undo2,
  Redo2,
  RotateCcw,
  Minus,
  Monitor,
  Image,
  Palette,
  Frame,
  Upload,
  X,
  Repeat,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const mockUser = {
  name: "Alex Johnson",
  email: "alex@company.com",
};


const voiceOptions = [
  { id: "emma", name: "Emma", description: "Professional, warm female voice" },
  { id: "james", name: "James", description: "Clear, confident male voice" },
  { id: "sarah", name: "Sarah", description: "Friendly, casual female voice" },
];

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Use new Store
  const editorState = useEditorState();

  const videoUrl = location.state?.videoUrl;
  const clickData = location.state?.clickData || [];
  const moveData = location.state?.moveData || [];
  const capturedEffects = location.state?.effects || [];
  const rawRecording = location.state?.rawRecording || false;
  const videoRef = useRef<HTMLVideoElement>(null); // Kept for legacy ref passing to old components if any remain
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Store
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
      }));
    }
  }, [videoUrl, clickData, moveData, capturedEffects, editorState.video.url, editorState.events.clicks.length]);


  // --- GOD LEVEL REACTIVE CAMERA ENGINE (Spring-Based) ---
  // Camera state is now managed by Stage and EditorStore



  // Timeline State
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [timelineWindow, setTimelineWindow] = useState({ start: 0, end: 1 });
  const [timelineHoverTime, setTimelineHoverTime] = useState<number | null>(null);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [selectionRange, setSelectionRange] = useState<{ start: number | null; end: number | null }>({ start: null, end: null });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  
  // Professional Timeline Editor State
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null);
  const [draggingEffect, setDraggingEffect] = useState<{ id: string; startOffset: number } | null>(null);
  const [resizingEffect, setResizingEffect] = useState<{ id: string; edge: 'left' | 'right'; startTime: number } | null>(null);
  const [isLoopingEffect, setIsLoopingEffect] = useState(false);
  const loopIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Editor UI State
  const [showColorGrading, setShowColorGrading] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const effectsSeededRef = useRef(false);

  // Helpers
  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time) || time < 0) {
      return "0:00";
    }
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const duration = editorState.video.duration || 0;
  const visibleDuration = Math.max(0.1, timelineWindow.end - timelineWindow.start);

  const clampTime = (t: number) => Math.max(0, Math.min(t, duration || 0));

  const collectSnapPoints = useCallback(() => {
    const points: number[] = [];
    editorState.events.clicks.forEach(c => points.push(c.timestamp));
    editorState.events.effects.forEach(e => {
      const s = Number.isFinite(e.start) ? e.start : (e.timestamp ?? 0);
      const en = Number.isFinite(e.end) ? e.end : s + 5;
      points.push(s, en);
    });
    points.push(editorState.playback.currentTime);
    return points.filter((p) => Number.isFinite(p));
  }, [editorState.events.clicks, editorState.events.effects, editorState.playback.currentTime]);

  const getSnappedTime = useCallback((time: number) => {
    if (!snapEnabled || duration <= 0) return time;
    const points = collectSnapPoints();
    if (points.length === 0) return time;
    const SNAP_TOLERANCE = Math.max(0.05, visibleDuration * 0.01); // scales with zoom
    let closest = time;
    let bestDelta = Number.MAX_VALUE;
    points.forEach((p) => {
      const delta = Math.abs(p - time);
      if (delta < bestDelta && delta <= SNAP_TOLERANCE) {
        bestDelta = delta;
        closest = p;
      }
    });
    return clampTime(closest);
  }, [collectSnapPoints, duration, snapEnabled, visibleDuration]);

  // Keep timeline window centered on playhead when zooming or as playhead moves
  useEffect(() => {
    if (duration <= 0) {
      setTimelineWindow({ start: 0, end: 1 });
      return;
    }

    const windowLength = Math.min(duration, Math.max(duration / timelineZoom, 1));
    let start = editorState.playback.currentTime - windowLength / 2;
    start = Math.max(0, Math.min(start, duration - windowLength));
    const end = Math.min(duration, start + windowLength);

    setTimelineWindow((prev) => {
      if (Math.abs(prev.start - start) < 0.01 && Math.abs(prev.end - end) < 0.01) {
        return prev;
      }
      return { start, end };
    });
  }, [duration, timelineZoom, editorState.playback.currentTime]);

  const timeToPercent = (time: number) => {
    if (duration <= 0) return 0;
    const clamped = Math.max(timelineWindow.start, Math.min(time, timelineWindow.end));
    return ((clamped - timelineWindow.start) / visibleDuration) * 100;
  };

  const percentToTime = (percent: number) => {
    const normalized = Math.max(0, Math.min(percent, 100)) / 100;
    return timelineWindow.start + normalized * visibleDuration;
  };

  const jumpToNextEvent = () => {
    const points = collectSnapPoints().filter((p) => p > editorState.playback.currentTime + 0.001).sort((a, b) => a - b);
    if (points.length > 0) editorStore.setPlayback({ currentTime: points[0] });
  };

  const jumpToPrevEvent = () => {
    const points = collectSnapPoints().filter((p) => p < editorState.playback.currentTime - 0.001).sort((a, b) => b - a);
    if (points.length > 0) editorStore.setPlayback({ currentTime: points[0] });
  };

  const togglePlay = () => {
    const newIsPlaying = !editorState.playback.isPlaying;
    editorStore.setPlayback({ isPlaying: newIsPlaying });

    // Ensure video continues playing if it reaches the end
    if (newIsPlaying && editorState.playback.currentTime >= editorState.video.duration - 0.1) {
      editorStore.setPlayback({ currentTime: 0 });
    }
  };

  // Handle video end - loop or stop
  useEffect(() => {
    if (!editorState.playback.isPlaying &&
      editorState.video.duration > 0 &&
      editorState.playback.currentTime >= editorState.video.duration - 0.1) {
      // Video ended, reset to start
      editorStore.setPlayback({ currentTime: 0 });
    }
  }, [editorState.playback.isPlaying, editorState.playback.currentTime, editorState.video.duration]);




  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    // Validate time is finite and valid
    if (isFinite(time) && !isNaN(time) && time >= 0) {
      const duration = editorState.video.duration || 0;
      const clampedTime = duration > 0 ? Math.min(time, duration) : time;
      editorStore.setPlayback({ currentTime: clampedTime });
    }
  };

  const toggleMute = () => {
    editorStore.setPlayback({ isMuted: !editorState.playback.isMuted });
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    editorStore.setPlayback({ volume: newVolume, isMuted: newVolume === 0 });
  };

  // ... [keep handleGenerateScript, handleGenerateVoice, handleRender, updateStepDescription, typeIcons]



  const handleRender = () => {
    // Enable layered rendering if raw recording was used
    const presentationConfig = {
      ...editorState.presentation,
      layeredRendering: rawRecording ? true : (editorState.presentation.layeredRendering !== false),
    };

    navigate("/render", {
      state: {
        videoUrl,
        clickData,
        moveData,
        effects: editorState.events.effects,
        colorGrading: editorState.colorGrading,
        textOverlays: editorState.textOverlays,
        presentation: presentationConfig,
        effectsConfig: editorState.effects,
        cursorConfig: editorState.cursor,
        rawRecording, // Pass raw recording flag
      }
    });
  };

  const addTextOverlay = () => {
    const newOverlay = {
      id: Date.now().toString(),
      text: "New Text",
      x: 0.5,
      y: 0.5,
      fontSize: 24,
      color: "#ffffff",
      startTime: editorState.playback.currentTime,
      endTime: Math.min(editorState.playback.currentTime + 3, editorState.video.duration),
      animation: "fade" as const,
      // Default Advanced Properties
      rotation: 0,
      scale: 1,
      opacity: 1,
      fontFamily: "Inter",
      fontWeight: "normal",
      fontStyle: "normal" as const,
      textAlign: "center" as const,
      lineHeight: 1.2,
      letterSpacing: 0,
      backgroundColor: "transparent",
      padding: 0,
      borderRadius: 0,
      borderWidth: 0,
      borderColor: "transparent",
      shadowColor: "transparent",
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      backdropBlur: 0,
      textTransform: "none" as const,
      gradient: {
        enabled: false,
        colors: [],
        angle: 45
      },
      blendMode: "normal" as const
    };
    editorStore.setState({
      textOverlays: [...editorState.textOverlays, newOverlay]
    });
    setShowTextEditor(true);
  };

  const updateTextOverlay = (id: string, updates: Partial<typeof editorState.textOverlays[0]>) => {
    editorStore.setState({
      textOverlays: editorState.textOverlays.map(overlay =>
        overlay.id === id ? { ...overlay, ...updates } : overlay
      )
    });
  };

  const deleteTextOverlay = (id: string) => {
    editorStore.setState({
      textOverlays: editorState.textOverlays.filter(overlay => overlay.id !== id)
    });
  };

  // --- Effect timeline helpers ---
  const generateEffectId = () => {
    const hasRandomUUID = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function";
    return `effect-${hasRandomUUID ? crypto.randomUUID() : Date.now()}`;
  };

  const deriveSpotlightEffectsFromClicks = useCallback(() => {
    const duration = editorState.video.duration || 0;
    if (!duration || editorState.events.clicks.length < 2) return [];

    const sortedClicks = [...editorState.events.clicks].sort((a, b) => a.timestamp - b.timestamp);
    const effects: Array<{
      id: string;
      type: 'spotlight';
      start: number;
      end: number;
      zoom: number;
      label: string;
    }> = [];

    const WINDOW = 3; // seconds between two clicks to trigger zoom
    const ANTICIPATION = 0.15;
    const EFFECT_DURATION = 5;

    for (let i = 0; i < sortedClicks.length - 1; i++) {
      const current = sortedClicks[i];
      const next = sortedClicks[i + 1];
      if (next.timestamp - current.timestamp <= WINDOW) {
        const start = Math.max(0, current.timestamp - ANTICIPATION);
        const end = Math.min(duration, start + EFFECT_DURATION);
        effects.push({
          id: generateEffectId(),
          type: 'spotlight',
          start,
          end,
          zoom: editorState.camera.zoomStrength,
          label: 'Auto Zoom',
        });
        // Skip overlapping detection starting from next click to reduce duplicates
        i++;
      }
    }

    return effects;
  }, [editorState.camera.zoomStrength, editorState.events.clicks, editorState.video.duration]);

  useEffect(() => {
    if (effectsSeededRef.current) return;
    if (editorState.events.effects.length > 0) {
      effectsSeededRef.current = true;
      return;
    }

    if (editorState.events.effects.length === 0) {
      const derived = deriveSpotlightEffectsFromClicks();
      if (derived.length > 0) {
        editorStore.setState(prev => ({
          events: {
            ...prev.events,
            effects: derived,
          },
        }));
        effectsSeededRef.current = true;
      }
    }
  }, [deriveSpotlightEffectsFromClicks, editorState.events.effects.length]);

  const addSpotlightEffect = () => {
    const start = editorState.playback.currentTime;
    const duration = editorState.video.duration || start + 5;
    const end = Math.min(duration, start + 5);
    const newEffect = {
      id: generateEffectId(),
      type: 'spotlight' as const,
      start,
      end,
      zoom: editorState.camera.zoomStrength,
      label: 'Zoom',
      panX: 0,
      panY: 0,
      easing: 'ease-out' as const,
      transitionSpeed: 1.0,
    };
    editorStore.setState(prev => ({
      events: {
        ...prev.events,
        effects: [...prev.events.effects, newEffect],
      },
    }));
  };

  const updateEffect = (id: string, updates: Partial<{ 
    start: number; 
    end: number; 
    zoom: number; 
    label: string;
    panX: number;
    panY: number;
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce';
    transitionSpeed: number;
  }>) => {
    const duration = editorState.video.duration || 0;
    editorStore.setState(prev => ({
      events: {
        ...prev.events,
        effects: prev.events.effects.map(effect => {
          if (effect.id !== id) return effect;
          const nextStartRaw = updates.start ?? effect.start;
          const nextEndRaw = updates.end ?? effect.end;
          const clampedStart = Math.max(0, Math.min(nextStartRaw, duration || nextStartRaw));
          let clampedEnd = Math.max(0, Math.min(nextEndRaw, duration || nextEndRaw));
          if (clampedEnd < clampedStart) {
            clampedEnd = Math.min(duration || clampedStart + 0.1, clampedStart + 0.1);
          }
          return {
            ...effect,
            ...updates,
            start: clampedStart,
            end: clampedEnd,
          };
        }),
      },
    }));
  };

  const deleteEffect = (id: string) => {
    editorStore.setState(prev => ({
      events: {
        ...prev.events,
        effects: prev.events.effects.filter(effect => effect.id !== id),
      },
    }));
  };

  // Keyboard shortcuts for timeline navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const duration = editorState.video.duration || 0;
      if (duration <= 0) return; // Don't handle shortcuts if video not loaded

      const step = 1; // 1 second step
      const currentTime = editorState.playback.currentTime;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            // Frame-by-frame backward
            const frameTime = 1 / 30; // 30fps
            const prevTime = Math.max(0, currentTime - frameTime);
            if (isFinite(prevTime) && !isNaN(prevTime)) {
              editorStore.setPlayback({ currentTime: prevTime });
            }
          } else {
            // 1 second backward
            const prevTime = Math.max(0, currentTime - step);
            if (isFinite(prevTime) && !isNaN(prevTime)) {
              editorStore.setPlayback({ currentTime: prevTime });
            }
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            // Frame-by-frame forward
            const frameTime = 1 / 30; // 30fps
            const nextTime = Math.min(duration, currentTime + frameTime);
            if (isFinite(nextTime) && !isNaN(nextTime)) {
              editorStore.setPlayback({ currentTime: nextTime });
            }
          } else {
            // 1 second forward
            const nextTime = Math.min(duration, currentTime + step);
            if (isFinite(nextTime) && !isNaN(nextTime)) {
              editorStore.setPlayback({ currentTime: nextTime });
            }
          }
          break;
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedEffectId) {
            e.preventDefault();
            deleteEffect(selectedEffectId);
            setSelectedEffectId(null);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [editorState.playback.currentTime, editorState.video.duration, selectedEffectId, deleteEffect]);

  // Auto-loop effect preview when selected
  useEffect(() => {
    // Clear any existing loop
    if (loopIntervalRef.current) {
      clearInterval(loopIntervalRef.current);
      loopIntervalRef.current = null;
    }

    if (selectedEffectId) {
      const effect = editorState.events.effects.find(e => e.id === selectedEffectId);
      if (effect) {
        const start = Number.isFinite(effect.start) ? effect.start : (effect.timestamp || 0);
        const end = Number.isFinite(effect.end) ? effect.end : (start + 5);

        // Jump to effect start and start playing
        editorStore.setPlayback({ 
          currentTime: start,
          isPlaying: true 
        });
        setIsLoopingEffect(true);

        // Set up loop check interval - monitors playback and loops when needed
        loopIntervalRef.current = setInterval(() => {
          const state = editorStore.getState();
          const currentTime = state.playback.currentTime;
          const isPlaying = state.playback.isPlaying;
          
          // Only loop if playing
          if (isPlaying) {
            // If we've reached or passed the end, loop back to start
            if (currentTime >= end) {
              editorStore.setPlayback({ currentTime: start });
            } else if (currentTime < start) {
              editorStore.setPlayback({ currentTime: start });
            }
          }
        }, 100); // Check every 100ms for smooth looping

        return () => {
          if (loopIntervalRef.current) {
            clearInterval(loopIntervalRef.current);
            loopIntervalRef.current = null;
          }
          setIsLoopingEffect(false);
        };
      }
    } else {
      setIsLoopingEffect(false);
      // Stop playback when effect is deselected
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
        loopIntervalRef.current = null;
      }
    }
  }, [selectedEffectId, editorState.events.effects]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
        loopIntervalRef.current = null;
      }
    };
  }, []);


  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header isAuthenticated user={mockUser} />

      <main className="flex-1">
        <div className="container py-6">

          {/* Split Layout */}
          <div className="grid gap-6 lg:grid-cols-2" >
            {/* Left - Video Preview */}
            <div className="space-y-4 h-[500px]" >
              <div className="h-[500px] overflow-hidden rounded-xl border border-border bg-card" style={{display:'flex',justifyContent:'space-between',flexDirection:'column'}}>
                {/* Video Preview */}
                <div
                  ref={videoContainerRef}
                  className="main_video_stream relative bg-black flex items-center justify-center overflow-hidden rounded-lg shadow-2xl border border-border/50 group"
                  style={{
                    isolation: 'isolate',
                    aspectRatio: editorState.presentation.outputWidth > 0 && editorState.presentation.outputHeight > 0
                      ? `${editorState.presentation.outputWidth} / ${editorState.presentation.outputHeight}`
                      : (editorState.video.width > 0 && editorState.video.height > 0
                        ? `${editorState.video.width} / ${editorState.video.height}`
                        : '16 / 9'),
                  }}
                >
                  {videoUrl ? (
                    <>
                      <Stage />
                      <CameraDebugOverlay />

                    </>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-hero shadow-glow">
                      <Video className="h-8 w-8 text-primary-foreground" />
                    </div>
                  )}
                </div>

                {/* New Video Controls Component */}
                <div className="pt-2">
                  <VideoControls
                    isPlaying={editorState.playback.isPlaying}
                    isMuted={editorState.playback.isMuted}
                    volume={editorState.playback.volume}
                    currentTime={editorState.playback.currentTime}
                    duration={editorState.video.duration || 0}
                    playbackSpeed={playbackSpeed}
                    onPlayPause={togglePlay}
                    onSeek={(time) => editorStore.setPlayback({ currentTime: time })}
                    onVolumeChange={(vol) => editorStore.setPlayback({ volume: vol, isMuted: vol === 0 })}
                    onToggleMute={toggleMute}
                    onSpeedChange={setPlaybackSpeed}
                    onFrameStep={(direction) => {
                      const frameTime = 1 / 30;
                      const newTime = direction === 'forward'
                        ? editorState.playback.currentTime + frameTime
                        : editorState.playback.currentTime - frameTime;
                      editorStore.setPlayback({ currentTime: Math.max(0, Math.min(newTime, editorState.video.duration)) });
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
            </div>

            {/* Right - Control Panel */}
            <div className="rounded-xl border border-border bg-card overflow-hidden font-sans h-[500px]">
              <EditorPanel 
                selectedEffectId={selectedEffectId}
                onEffectSelect={setSelectedEffectId}
                isLoopingEffect={isLoopingEffect}
              />
            </div>
          </div>

          {/* Compact Timeline Design */}
          <div className="mt-6 rounded-lg border border-border/40 bg-card shadow-sm overflow-hidden">
            {/* Compact Header Bar */}
            <div className="bg-background/50 border-b border-border/30 px-4 py-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">
                      {formatTime(editorState.playback.currentTime)} / {formatTime(duration)}
                    </span>
                    {selectedEffectId && (() => {
                      const effect = editorState.events.effects.find(e => e.id === selectedEffectId);
                      return effect ? (
                        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/25 text-purple-400 text-[10px]">
                          <Sparkles className="h-2.5 w-2.5" />
                          {effect.label || "Zoom Effect"}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  
                  <div className="h-4 w-px bg-border/40" />
                  
                  <div className="flex items-center gap-1.5">
                    <ZoomIn className="h-3 w-3 text-muted-foreground" />
                    <Slider
                      className="w-24"
                      min={1}
                      max={6}
                      step={0.1}
                      value={[timelineZoom]}
                      onValueChange={([val]) => setTimelineZoom(val)}
                    />
                    <span className="text-[10px] font-mono bg-background px-1.5 py-0.5 rounded border border-border/40 min-w-[2.5rem] text-center">
                      {timelineZoom.toFixed(1)}x
                    </span>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6" 
                      onClick={() => setTimelineZoom((z) => Math.min(6, z + 0.2))}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6" 
                      onClick={() => setTimelineZoom((z) => Math.max(1, z - 0.2))}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 text-[10px] px-2"
                      onClick={() => setTimelineZoom(1)}
                    >
                      Fit
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Add Effect Button */}
                  <Button
                    size="sm"
                    variant="default"
                    className="h-6 text-[10px] px-2 bg-purple-500 hover:bg-purple-600"
                    onClick={() => {
                      addSpotlightEffect();
                      toast({
                        title: "Effect added",
                        description: "New zoom effect created at current time",
                      });
                    }}
                    disabled={duration <= 0}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Add Effect
                  </Button>

                  {/* Delete Selected Effect Button */}
                  {selectedEffectId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        deleteEffect(selectedEffectId);
                        setSelectedEffectId(null);
                        toast({
                          title: "Effect deleted",
                          description: "Effect has been removed",
                        });
                      }}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  )}

                  <div className="h-4 w-px bg-border/40" />

                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-background/60 border border-border/30">
                    <Switch
                      checked={snapEnabled}
                      onCheckedChange={setSnapEnabled}
                      className="scale-75"
                    />
                    <span className="text-[10px] font-medium">Snap</span>
                  </div>
                  
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 text-[10px] px-2"
                    onClick={jumpToPrevEvent}
                  >
                    ←
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 text-[10px] px-2"
                    onClick={jumpToNextEvent}
                  >
                    →
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] px-2"
                    disabled={!selectionRange.start || !selectionRange.end}
                    onClick={() => {
                      if (!selectionRange.start || !selectionRange.end) return;
                      const start = Math.min(selectionRange.start, selectionRange.end);
                      const end = Math.max(selectionRange.start, selectionRange.end);
                      const windowLength = Math.max(0.1, end - start);
                      setTimelineWindow({
                        start: Math.max(0, start - windowLength * 0.05),
                        end: Math.min(duration || end, end + windowLength * 0.05),
                      });
                    }}
                  >
                    Zoom
                  </Button>
                </div>
              </div>
            </div>

            {/* Timeline Canvas - Compact Design */}
            <div className="relative bg-background">
              {/* Mini Navigation Bar */}
              {duration > 0 && (
                <div className="px-4 py-1.5 border-b border-border/30 bg-background/40">
                  <div className="relative h-2 rounded-full bg-secondary/30 overflow-hidden">
                    {/* Effect indicators on minimap */}
                    {editorState.events.effects.map((effect) => {
                      const s = Number.isFinite(effect.start) ? effect.start : (effect.timestamp ?? 0);
                      const en = Number.isFinite(effect.end) ? effect.end : s + 5;
                      const left = Math.max(0, Math.min(100, (s / duration) * 100));
                      const width = Math.max(0.5, Math.min(100, ((en - s) / duration) * 100));
                      return (
                        <div
                          key={`nav-effect-${effect.id}`}
                          className="absolute top-0 bottom-0 bg-purple-500/50 rounded-full"
                          style={{ left: `${left}%`, width: `${width}%` }}
                        />
                      );
                    })}
                    {/* Visible window indicator */}
                    <div
                      className="absolute top-0 bottom-0 border border-primary/60 bg-primary/8 rounded-full"
                      style={{
                        left: `${Math.max(0, Math.min(100, (timelineWindow.start / duration) * 100))}%`,
                        width: `${Math.max(2, Math.min(100, (visibleDuration / duration) * 100))}%`,
                      }}
                    />
                    {/* Playhead on minimap */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                      style={{ left: `${Math.max(0, Math.min(100, (editorState.playback.currentTime / duration) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              <div
                className={`relative h-[200px] cursor-pointer overflow-x-hidden overflow-y-auto ${isDraggingTimeline ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={(e) => {
                  if (e.shiftKey) {
                    setIsSelectingRange(true);
                  } else {
                    setIsDraggingTimeline(true);
                  }
                  if (duration <= 0 || !isFinite(duration)) return;

                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const width = rect.width;
                  const clickTime = percentToTime((x / width) * 100);
                  const finalTime = getSnappedTime(clickTime);
                  if (isFinite(finalTime) && !isNaN(finalTime)) {
                    editorStore.setPlayback({ currentTime: finalTime });
                  }
                  if (e.shiftKey) {
                    setSelectionRange({ start: finalTime, end: finalTime });
                  }
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const width = rect.width;
                  const hoverTime = percentToTime((x / width) * 100);
                  setTimelineHoverTime(hoverTime);

                  if (isSelectingRange) {
                    const snapped = getSnappedTime(hoverTime);
                    setSelectionRange((prev) => ({
                      start: prev.start ?? snapped,
                      end: snapped,
                    }));
                  } else if (isDraggingTimeline) {
                    if (duration <= 0 || !isFinite(duration)) return;
                    const snapped = getSnappedTime(hoverTime);
                    if (isFinite(snapped) && !isNaN(snapped)) {
                      editorStore.setPlayback({ currentTime: snapped });
                    }
                  }
                }}
                onMouseUp={() => {
                  setIsDraggingTimeline(false);
                  setIsSelectingRange(false);
                }}
                onMouseLeave={() => {
                  setIsDraggingTimeline(false);
                  setIsSelectingRange(false);
                  setTimelineHoverTime(null);
                }}
                onClick={(e) => {
                  if (!isDraggingTimeline && !isSelectingRange && !draggingEffect && !resizingEffect) {
                    if (duration <= 0 || !isFinite(duration)) return;

                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const width = rect.width;
                    const clickTime = percentToTime((x / width) * 100);
                    const finalTime = getSnappedTime(clickTime);
                    if (isFinite(finalTime) && !isNaN(finalTime)) {
                      editorStore.setPlayback({ currentTime: finalTime });
                      setSelectedEffectId(null); // Deselect on timeline click
                    }
                  }
                }}
              >
                {/* Compact Time Ruler */}
                <div className="sticky top-0 z-40 bg-background/95 border-b border-border/40">
                  <div className="relative h-8 flex items-end px-3 pb-1">
                    {(() => {
                      if (duration <= 0 || !isFinite(duration)) {
                        return (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1.5" />
                            No video loaded
                          </div>
                        );
                      }

                      const baseInterval = 5;
                      const interval = Math.max(0.5, baseInterval / timelineZoom);
                      const maxMarkers = Math.ceil(visibleDuration / interval) + 2;

                      return Array.from({ length: maxMarkers }).map((_, i) => {
                        const time = timelineWindow.start + i * interval;
                        if (time > timelineWindow.end + interval) return null;
                        const position = timeToPercent(time);
                        const isMajorTick = i % Math.ceil(5 / interval) === 0;

                        return (
                          <div
                            key={i}
                            className="absolute bottom-0 flex flex-col items-center pointer-events-none"
                            style={{ left: `${position}%` }}
                          >
                            <div className={`w-[1px] ${isMajorTick ? 'h-4 bg-primary/50' : 'h-2 bg-border/50'}`} />
                            {isMajorTick && (
                              <span className="text-[10px] font-medium text-foreground mt-0.5 bg-background/95 px-1 py-0.5 rounded border border-border/30">
                                {formatTime(time)}
                              </span>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Compact Timeline Tracks */}
                <div className="relative" style={{ minHeight: '120px' }}>
                  {/* Playback Position Indicator */}
                  {editorState.video.duration > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-[1.5px] bg-primary z-50 pointer-events-none"
                      style={{
                        left: `${timeToPercent(editorState.playback.currentTime)}%`,
                      }}
                    >
                      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background shadow-md" />
                    </div>
                  )}

                  {/* Selection Range Overlay */}
                  {selectionRange.start !== null && selectionRange.end !== null && (
                    <div
                      className="absolute top-0 bottom-0 bg-primary/8 border-l border-r border-primary/40 pointer-events-none z-40"
                      style={{
                        left: `${timeToPercent(Math.min(selectionRange.start, selectionRange.end))}%`,
                        width: `${Math.max(1, timeToPercent(Math.max(selectionRange.start, selectionRange.end)) - timeToPercent(Math.min(selectionRange.start, selectionRange.end)))}%`,
                      }}
                    />
                  )}

                  {/* Track Container */}
                  <div className="space-y-0.5 pt-1">
                    {/* Effects Track - Two Layer Style */}
                    <div className="relative h-16 bg-secondary/20 border border-border/40 rounded overflow-hidden group">
                      {/* Track Header */}
                      <div className="absolute left-0 top-0 bottom-0 w-20 bg-secondary/30 border-r border-border/40 flex items-center justify-center z-10">
                        <div className="flex items-center gap-0.5">
                          <Sparkles className="h-3 w-3 text-purple-400" />
                          <span className="text-[10px] font-medium text-foreground">Effects</span>
                          <span className="text-[8px] text-muted-foreground">({editorState.events.effects.length})</span>
                        </div>
                      </div>
                      
                      {/* Track Content Area */}
                      <div 
                        className="absolute left-20 right-0 top-0 bottom-0"
                        onMouseMove={(e) => {
                          if (draggingEffect || resizingEffect) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const width = rect.width;
                            const percent = (x / width) * 100;
                            const time = percentToTime(percent);
                            const snappedTime = getSnappedTime(time);
                            
                            if (draggingEffect) {
                              const effect = editorState.events.effects.find(e => e.id === draggingEffect.id);
                              if (effect) {
                                const start = Number.isFinite(effect.start) ? effect.start : (effect.timestamp ?? 0);
                                const end = Number.isFinite(effect.end) ? effect.end : start + 5;
                                const effectDuration = end - start;
                                const newStart = clampTime(snappedTime - draggingEffect.startOffset);
                                const newEnd = clampTime(newStart + effectDuration);
                                updateEffect(draggingEffect.id, { start: newStart, end: newEnd });
                              }
                            } else if (resizingEffect) {
                              const effect = editorState.events.effects.find(e => e.id === resizingEffect.id);
                              if (effect) {
                                const start = Number.isFinite(effect.start) ? effect.start : (effect.timestamp ?? 0);
                                const end = Number.isFinite(effect.end) ? effect.end : start + 5;
                                if (resizingEffect.edge === 'left') {
                                  const newStart = clampTime(Math.min(snappedTime, end - 0.5));
                                  updateEffect(resizingEffect.id, { start: newStart });
                                } else {
                                  const newEnd = clampTime(Math.max(snappedTime, start + 0.5));
                                  updateEffect(resizingEffect.id, { end: newEnd });
                                }
                              }
                            }
                          }
                        }}
                        onMouseUp={() => {
                          setDraggingEffect(null);
                          setResizingEffect(null);
                        }}
                        onMouseLeave={() => {
                          setDraggingEffect(null);
                          setResizingEffect(null);
                        }}
                      >
                        {/* Row Divider */}
                        <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-border/30 z-0" />
                        
                        {editorState.events.effects.map((effect, index) => {
                          const startSeconds = Number.isFinite(effect.start) ? effect.start : (effect.timestamp ?? 0);
                          const endSeconds = Number.isFinite(effect.end) ? effect.end : startSeconds + 5;
                          const startPercent = timeToPercent(startSeconds);
                          const endPercent = timeToPercent(endSeconds);
                          const width = Math.max(4, endPercent - startPercent);
                          const isSelected = selectedEffectId === effect.id;
                          
                          // Alternate between top and bottom row
                          const rowIndex = index % 2;
                          const isTopRow = rowIndex === 0;
                          
                          return (
                            <div
                              key={effect.id}
                              className={`absolute rounded border cursor-move transition-all group ${
                                isSelected 
                                  ? 'bg-purple-500 border-purple-400 shadow-md ring-1 ring-purple-400/40 z-20' 
                                  : draggingEffect?.id === effect.id
                                  ? 'bg-purple-500/90 border-purple-400 shadow-md z-20 opacity-90'
                                  : resizingEffect?.id === effect.id
                                  ? 'bg-purple-500/90 border-purple-400 shadow-md z-20'
                                  : 'bg-purple-500/80 border-purple-500/40 hover:border-purple-400 hover:shadow-sm z-10'
                              }`}
                              style={{ 
                                left: `${startPercent}%`, 
                                width: `${width}%`,
                                minWidth: '60px',
                                top: isTopRow ? '2px' : '50%',
                                bottom: isTopRow ? '50%' : '2px',
                                height: 'calc(50% - 4px)'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEffectId(effect.id);
                                editorStore.setPlayback({ currentTime: startSeconds });
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const effectWidth = rect.width;
                                
                                // Check if clicking on resize handle (first/last 8px)
                                if (clickX < 8) {
                                  setResizingEffect({ id: effect.id, edge: 'left', startTime: startSeconds });
                                } else if (clickX > effectWidth - 8) {
                                  setResizingEffect({ id: effect.id, edge: 'right', startTime: endSeconds });
                                } else {
                                  // Calculate time offset within the effect
                                  const effectDuration = endSeconds - startSeconds;
                                  const clickPercent = clickX / effectWidth;
                                  const timeOffset = effectDuration * clickPercent;
                                  setDraggingEffect({ 
                                    id: effect.id, 
                                    startOffset: timeOffset
                                  });
                                }
                              }}
                            >
                              {/* Resize Handles */}
                              <div className={`absolute left-0 top-0 bottom-0 w-2 rounded-l transition-all ${
                                resizingEffect?.id === effect.id && resizingEffect.edge === 'left'
                                  ? 'bg-white/50 cursor-ew-resize'
                                  : 'bg-white/15 hover:bg-white/30 cursor-ew-resize'
                              }`} />
                              <div className={`absolute right-0 top-0 bottom-0 w-2 rounded-r transition-all ${
                                resizingEffect?.id === effect.id && resizingEffect.edge === 'right'
                                  ? 'bg-white/50 cursor-ew-resize'
                                  : 'bg-white/15 hover:bg-white/30 cursor-ew-resize'
                              }`} />
                              
                              {/* Content */}
                              <div className="absolute inset-0 flex items-center px-2 pointer-events-none">
                                <Sparkles className="h-2.5 w-2.5 text-white flex-shrink-0" />
                                <span className="text-[10px] font-medium text-white truncate ml-1">
                                  {effect.label || "Zoom"}
                                </span>
                                <span className="text-[8px] text-white/70 ml-auto font-mono bg-white/10 px-1 py-0.5 rounded">
                                  {formatTime(startSeconds)}→{formatTime(endSeconds)}
                                </span>
                              </div>
                              
                              {/* Selection Indicator */}
                              {isSelected && (
                                <div className={`absolute ${isTopRow ? '-top-0.5' : '-bottom-0.5'} left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-300 border border-background shadow-sm`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Clicks Track */}
                    {editorState.events.clicks.length > 0 && (
                      <div className="relative h-5 bg-secondary/20 border border-border/40 rounded overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-20 bg-secondary/30 border-r border-border/40 flex items-center justify-center">
                          <div className="flex items-center gap-0.5">
                            <MousePointer2 className="h-3 w-3 text-blue-400" />
                            <span className="text-[10px] font-medium text-foreground">Clicks</span>
                            <span className="text-[8px] text-muted-foreground">({editorState.events.clicks.length})</span>
                          </div>
                        </div>
                        <div className="absolute left-20 right-0 top-0 bottom-0 px-1.5 flex items-center">
                          {editorState.events.clicks.map((click, index) => {
                            const position = timeToPercent(click.timestamp);
                            return (
                              <div
                                key={`click-${index}`}
                                className="absolute flex items-center group cursor-pointer"
                                style={{ left: `${position}%` }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  editorStore.setPlayback({ currentTime: click.timestamp });
                                }}
                              >
                                <div className="w-2 h-2 rounded-full bg-blue-500 border border-background shadow-sm hover:scale-125 transition-transform" />
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 px-1 py-0.5 bg-blue-500 text-white text-[8px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-md">
                                  {formatTime(click.timestamp)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Hover Time Indicator */}
                  {timelineHoverTime !== null && duration > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-[1px] bg-primary/30 z-45 pointer-events-none"
                      style={{ left: `${timeToPercent(timelineHoverTime)}%` }}
                    >
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-medium text-foreground bg-background/95 backdrop-blur-sm px-1.5 py-0.5 rounded shadow-md border border-border/40 whitespace-nowrap">
                        {formatTime(timelineHoverTime)}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {editorState.events.clicks.length === 0 && editorState.events.effects.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
                      <div className="text-center">
                        <Clock className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
                        <p className="text-xs">Timeline Ready</p>
                        <p className="text-[10px] mt-0.5 opacity-70">Events will appear here</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Top Bar */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {id === "new" ? "New Demo" : "Product Onboarding Demo"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Edit your demo video • {editorState.events.clicks.length} clicks
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground hidden lg:flex items-center gap-1">
                <span className="px-2 py-0.5 bg-secondary rounded border border-border">Space</span>
                <span>Play/Pause</span>
                <span>•</span>
                <span className="px-2 py-0.5 bg-secondary rounded border border-border">←</span>
                <span className="px-2 py-0.5 bg-secondary rounded border border-border">→</span>
                <span>Seek</span>
                <span>•</span>
                <span className="px-2 py-0.5 bg-secondary rounded border border-border">Shift+←</span>
                <span className="px-2 py-0.5 bg-secondary rounded border border-border">Shift+→</span>
                <span>Frame</span>
              </div>
              <Button variant="hero" onClick={handleRender}>
                <Sparkles className="mr-2 h-4 w-4" />
                Render Video
              </Button>
            </div>
          </div>
        </div >
      </main >
    </div >
  );
}
