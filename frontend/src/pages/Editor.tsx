
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
} from "lucide-react";
import { TimelineEvent } from "@/lib/editor/types";
import { useToast } from "@/hooks/use-toast";
import { Timeline } from "@/components/editor/timeline/Timeline";

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
  // Robustly handle effects key (historical mismatch support)
  const capturedEffects = location.state?.capturedEffects || location.state?.effects || [];
  const rawRecording = location.state?.rawRecording || false;
  const videoRef = useRef<HTMLVideoElement>(null); // Kept for legacy ref passing to old components if any remain
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Store
  useEffect(() => {
    console.log('[Editor] 🚀 Initialization State:', {
      videoUrl,
      clickDataCount: clickData.length,
      moveDataCount: moveData.length,
      capturedEffectsCount: capturedEffects.length,
      allKeys: Object.keys(location.state || {})
    });

    if (editorState.video.url !== videoUrl && videoUrl) {
      editorStore.setVideo({ url: videoUrl });
    }

    // Process captured data only if we haven't already populated the events
    if (clickData.length > 0 && editorState.events.clicks.length === 0) {

      // Transform captured effects into timeline CameraEffects
      let mappedCameraEffects: any[] = [];
      if (capturedEffects.length > 0) {
        // Sort by time to be safe
        const sortedEffects = [...capturedEffects].sort((a, b) => a.timestamp - b.timestamp);

        mappedCameraEffects = sortedEffects
          .filter((e: any) => e.type === 'zoom' || e.type === 'manual_zoom') // Filter for zoom events
          .map((e: any, index: number) => {
            // Calculate duration based on next effect or default
            let duration = e.duration || e.data?.duration;

            if (!duration) {
              duration = 2.0;
              if (index < sortedEffects.length - 1) {
                const nextTime = sortedEffects[index + 1].timestamp;
                const diff = (nextTime - e.timestamp) / 1000; // Convert to seconds
                // Cap duration at reasonable limits (e.g. min 0.5s)
                duration = Math.max(0.5, diff);
              }
            }

            // Generate Name
            const charCode = 65 + (index % 26);
            const suffix = Math.floor(index / 26) > 0 ? Math.floor(index / 26) + 1 : '';
            const name = `Captured Zoom ${String.fromCharCode(charCode)}${suffix}`;

            return {
              id: `captured-${index}-${Date.now()}`,
              name: name,
              type: 'zoom',
              startTime: e.timestamp / 1000, // Convert to seconds
              duration: duration,
              zoomLevel: e.data?.zoomLevel || e.zoomLevel || 1.5,
              x: e.data?.x ?? e.x, // Allow undefined for tracking mode
              y: e.data?.y ?? e.y, // Allow undefined for tracking mode
              easing: 'ease-in-out'
            };
          })
          .filter(effect => Math.abs(effect.zoomLevel - 1.0) > 0.05); // Filter out 1x zooms

        console.log('[Editor] 📸 Mapped Camera Effects:', mappedCameraEffects);

        // Populate store with effects if we have them
        if (mappedCameraEffects.length > 0) {
          editorStore.setState({ cameraEffects: mappedCameraEffects });
        }
      }

      editorStore.setState(prev => ({
        events: {
          ...prev.events,
          clicks: clickData,
          moves: moveData,
          effects: capturedEffects,
          markers: []
        },
        cameraEffects: mappedCameraEffects.length > 0 ? mappedCameraEffects : prev.cameraEffects
      }));
    }
  }, [videoUrl, clickData, moveData, capturedEffects, editorState.video.url, editorState.events.clicks.length]);


  // --- GOD LEVEL REACTIVE CAMERA ENGINE (Spring-Based) ---
  // Camera state is now managed by Stage and EditorStore



  // Timeline State
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Editor UI State
  const [showColorGrading, setShowColorGrading] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);

  // Helpers
  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time) || time < 0) {
      return "0:00";
    }
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
        case 'm':
        case 'M':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const newMarker: TimelineEvent = {
              id: Date.now().toString(),
              type: 'marker',
              time: currentTime,
              label: `Marker at ${formatTime(currentTime)}`,
            };
            editorStore.setState({
              events: {
                ...editorState.events,
                markers: [...editorState.events.markers, newMarker],
              }
            });
            toast({
              title: "Marker added",
              description: `Added at ${formatTime(currentTime)}`,
            });
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [editorState.playback.currentTime, editorState.video.duration, editorState.events.markers]);


  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header isAuthenticated user={mockUser} />

      <main className="flex-1">
        <div className="container py-6">
          {/* Top Bar */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {id === "new" ? "New Demo" : "Product Onboarding Demo"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Edit your demo video • {editorState.events.clicks.length} clicks • {editorState.events.markers.length} markers
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
                <span>•</span>
                <span className="px-2 py-0.5 bg-secondary rounded border border-border">Ctrl+M</span>
                <span>Marker</span>
              </div>
              <Button variant="hero" onClick={handleRender}>
                <Sparkles className="mr-2 h-4 w-4" />
                Render Video
              </Button>
            </div>
          </div>

          {/* Split Layout */}
          <div className="grid gap-6 lg:grid-cols-2" >
            {/* Left - Video Preview */}
            <div className="space-y-4 h-[500px]" >
              <div className="h-[500px] overflow-hidden rounded-xl border border-border bg-card" style={{ display: 'flex', justifyContent: 'space-between', flexDirection: 'column' }}>
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
              <EditorPanel />
            </div>
          </div>

          {/* Unified Timeline */}
          <div className="mt-6 h-64">
            <Timeline />
          </div>
        </div>
      </main>
    </div>
  );
}
