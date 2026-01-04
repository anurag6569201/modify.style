
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
          markers: []
        }
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
              <EditorPanel />
            </div>
          </div>

          < div className="mt-6 rounded-xl border border-border bg-card" >
            {/* Timeline Canvas */}
            < div className="relative p-6" >
              <div
                className={`relative h-48 rounded-lg border border-border bg-secondary/20 cursor-pointer overflow-hidden ${isDraggingTimeline ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={(e) => {
                  setIsDraggingTimeline(true);
                  const duration = editorState.video.duration || 0;
                  if (duration <= 0 || !isFinite(duration)) return;

                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const width = rect.width;
                  const clickTime = (x / width) * duration;
                  const clampedTime = Math.max(0, Math.min(clickTime, duration));
                  if (isFinite(clampedTime) && !isNaN(clampedTime)) {
                    editorStore.setPlayback({ currentTime: clampedTime });
                  }
                }}
                onMouseMove={(e) => {
                  if (isDraggingTimeline) {
                    const duration = editorState.video.duration || 0;
                    if (duration <= 0 || !isFinite(duration)) return;

                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const width = rect.width;
                    const clickTime = (x / width) * duration;
                    const clampedTime = Math.max(0, Math.min(clickTime, duration));
                    if (isFinite(clampedTime) && !isNaN(clampedTime)) {
                      editorStore.setPlayback({ currentTime: clampedTime });
                    }
                  }
                }}
                onMouseUp={() => setIsDraggingTimeline(false)}
                onMouseLeave={() => setIsDraggingTimeline(false)}
                onClick={(e) => {
                  if (!isDraggingTimeline) {
                    const duration = editorState.video.duration || 0;
                    if (duration <= 0 || !isFinite(duration)) return;

                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const width = rect.width;
                    const clickTime = (x / width) * duration;
                    const clampedTime = Math.max(0, Math.min(clickTime, duration));
                    if (isFinite(clampedTime) && !isNaN(clampedTime)) {
                      editorStore.setPlayback({ currentTime: clampedTime });
                    }
                  }
                }}
              >
                {/* Time Ruler - Enhanced */}
                <div className="absolute top-0 left-0 right-0 h-8 border-b border-border bg-secondary/50 flex items-center px-2">
                  {(() => {
                    const duration = editorState.video.duration || 0;
                    if (duration <= 0 || !isFinite(duration)) {
                      return (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                          No video loaded
                        </div>
                      );
                    }

                    // Dynamic interval based on zoom
                    const baseInterval = 5;
                    const interval = baseInterval / timelineZoom;
                    const maxMarkers = Math.min(Math.ceil(duration / interval) + 1, 200);
                    const safeLength = Math.max(1, Math.min(maxMarkers, 200));

                    return Array.from({ length: safeLength }).map((_, i) => {
                      const time = (i * interval);
                      if (time > duration) return null;
                      const position = (time / duration) * 100;
                      const isMajorTick = i % Math.ceil(5 / interval) === 0;

                      return (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
                          style={{ left: `${position}%` }}
                        >
                          <div className={`w-px bg-border ${isMajorTick ? 'h-3' : 'h-1.5'}`} />
                          {isMajorTick && (
                            <span className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                              {formatTime(time)}
                            </span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Waveform-like Visualization */}
                {editorState.video.duration > 0 && editorState.events.clicks.length > 0 && (
                  <div className="absolute top-8 left-0 right-0 h-12 pointer-events-none">
                    {Array.from({ length: Math.min(100, Math.floor(editorState.video.duration * 2)) }).map((_, i) => {
                      const time = (i / 2);
                      if (time > editorState.video.duration) return null;
                      const position = (time / editorState.video.duration) * 100;

                      // Check if there's a click near this time
                      const hasClick = editorState.events.clicks.some(
                        click => Math.abs(click.timestamp - time) < 0.1
                      );

                      const height = hasClick ? 8 : Math.random() * 3 + 1;

                      return (
                        <div
                          key={i}
                          className="absolute bottom-0 w-px bg-primary/20"
                          style={{
                            left: `${position}%`,
                            height: `${height}px`,
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Playback Position Indicator - Enhanced */}
                {editorState.video.duration > 0 && (
                  <>
                    <div
                      className="absolute top-8 bottom-0 w-0.5 bg-primary z-30 pointer-events-none shadow-lg"
                      style={{
                        left: `${Math.min(100, Math.max(0, (editorState.playback.currentTime / editorState.video.duration) * 100))}%`,
                      }}
                    >
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background shadow-md" />
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] text-primary font-bold bg-background px-1 rounded whitespace-nowrap">
                        {formatTime(editorState.playback.currentTime)}
                      </div>
                    </div>
                    {/* Time indicator line */}
                    <div
                      className="absolute top-8 bottom-0 w-px bg-primary/30 z-25 pointer-events-none"
                      style={{
                        left: `${Math.min(100, Math.max(0, (editorState.playback.currentTime / editorState.video.duration) * 100))}%`,
                      }}
                    />
                  </>
                )}

                {/* Click Events - Enhanced */}
                {editorState.video.duration > 0 && (
                  <div className="absolute top-20 left-0 right-0 bottom-0">
                    {editorState.events.clicks.map((click, index) => {
                      const position = Math.min(100, Math.max(0, (click.timestamp / editorState.video.duration) * 100));
                      return (
                        <div
                          key={`click-${index}`}
                          className="absolute top-1/2 -translate-y-1/2 z-10 cursor-pointer group"
                          style={{ left: `${position}%` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const timestamp = click.timestamp;
                            if (isFinite(timestamp) && !isNaN(timestamp) && timestamp >= 0) {
                              editorStore.setPlayback({ currentTime: timestamp });
                            }
                          }}
                        >
                          <div className="w-2 h-2 rounded-full bg-blue-500 border-2 border-background hover:scale-150 transition-transform shadow-md" />
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 bg-blue-500 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                            {formatTime(click.timestamp)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Markers - Enhanced */}
                {editorState.video.duration > 0 && (
                  <div className="absolute top-20 left-0 right-0 bottom-0">
                    {editorState.events.markers.map((marker) => {
                      const position = Math.min(100, Math.max(0, (marker.time / editorState.video.duration) * 100));
                      return (
                        <div
                          key={marker.id}
                          className="absolute top-0 bottom-0 flex flex-col items-center z-15 group"
                          style={{ left: `${position}%` }}
                        >
                          <div className="w-0.5 h-full bg-yellow-500/50" />
                          <div className="absolute top-0 -translate-y-1/2 w-3 h-3 rounded-full bg-yellow-500 border-2 border-background cursor-pointer hover:scale-150 transition-transform shadow-md"
                            onClick={(e) => {
                              e.stopPropagation();
                              const markerTime = marker.time;
                              if (isFinite(markerTime) && !isNaN(markerTime) && markerTime >= 0) {
                                editorStore.setPlayback({ currentTime: markerTime });
                              }
                            }}
                            title={marker.label || `Marker at ${formatTime(marker.time)}`}
                          />
                          {marker.label && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 bg-yellow-500 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity max-w-[120px] truncate">
                              {marker.label}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Video Progress Bar - Enhanced */}
                {editorState.video.duration > 0 && (
                  <div className="absolute top-20 left-0 right-0 h-3 bg-primary/10 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary/60 to-primary/40 transition-all duration-100"
                      style={{ width: `${Math.min(100, Math.max(0, (editorState.playback.currentTime / editorState.video.duration) * 100))}%` }}
                    />
                  </div>
                )}

                {/* Empty State */}
                {editorState.events.clicks.length === 0 && editorState.events.markers.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
                    <div className="text-center">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No events yet. Click on timeline to scrub.</p>
                      <p className="text-xs mt-1">Click events and markers will appear here</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Events List */}
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {/* Clicks */}
                {editorState.events.clicks.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Clicks ({editorState.events.clicks.length})</Label>
                    {editorState.events.clicks.slice(0, 10).map((click, index) => (
                      <div
                        key={`click-list-${index}`}
                        className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-2 hover:bg-secondary/50 transition-colors cursor-pointer group"
                        onClick={() => editorStore.setPlayback({ currentTime: click.timestamp })}
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20">
                          <MousePointer2 className="h-3 w-3 text-blue-500" />
                        </div>
                        <div className="flex-1 text-sm">
                          <div className="font-medium">Click #{index + 1}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatTime(click.timestamp)} • ({Math.round(click.x * 100)}%, {Math.round(click.y * 100)}%)
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            const timestamp = click.timestamp;
                            if (isFinite(timestamp) && !isNaN(timestamp) && timestamp >= 0) {
                              editorStore.setPlayback({ currentTime: timestamp });
                            }
                          }}
                        >
                          <Play className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {editorState.events.clicks.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        +{editorState.events.clicks.length - 10} more clicks
                      </p>
                    )}
                  </div>
                )}

                {/* Markers */}
                {editorState.events.markers.length > 0 && (
                  <div className="space-y-1 mt-4">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Markers ({editorState.events.markers.length})</Label>
                    {editorState.events.markers.map((marker) => (
                      <div
                        key={marker.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-2 hover:bg-secondary/50 transition-colors cursor-pointer group"
                        onClick={() => editorStore.setPlayback({ currentTime: marker.time })}
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500/20">
                          <Clock className="h-3 w-3 text-yellow-500" />
                        </div>
                        <input
                          type="text"
                          value={marker.label || ''}
                          onChange={(e) => {
                            editorStore.setState({
                              events: {
                                ...editorState.events,
                                markers: editorState.events.markers.map(m =>
                                  m.id === marker.id ? { ...m, label: e.target.value } : m
                                ),
                              }
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Marker label"
                          className="flex-1 bg-transparent text-sm outline-none"
                        />
                        <div className="text-xs text-muted-foreground">
                          {formatTime(marker.time)}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            editorStore.setState({
                              events: {
                                ...editorState.events,
                                markers: editorState.events.markers.filter(m => m.id !== marker.id),
                              }
                            });
                            toast({
                              title: "Marker deleted",
                              description: "Marker has been removed",
                            });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {editorState.events.clicks.length === 0 && editorState.events.markers.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed rounded-lg">
                    <Clock className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No events recorded</p>
                    <p className="text-xs text-muted-foreground mt-1">Click "Add Marker" to mark important moments</p>
                  </div>
                )}
              </div>
            </div >
          </div >

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
        </div >
      </main >
    </div >
  );
}
