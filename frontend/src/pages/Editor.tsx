import { useState, useRef, useEffect, useCallback, useMemo } from "react";
// import { VisualEffectsLayer } from "@/components/editor/VisualEffectsLayer"; // Deprecated
// import { CanvasOverlay } from "@/components/editor/CanvasOverlay"; // Deprecated
import { getInitialCameraState, updateCameraSystem } from "@/lib/composition/camera";
import { ClickData, MoveData } from "@/pages/Recorder";
import { FilterEngine } from "@/lib/effects/filters";
import { Stage } from "@/components/editor/Stage";
import { CameraDebugOverlay } from "@/components/editor/CameraDebugOverlay";
import { editorStore, useEditorState } from "@/lib/editor/store";
import { TransitionEngine, TransitionType, easings } from "@/lib/effects/transitions";
import { calculateOutputDimensions } from "@/lib/composition/aspectRatio";





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

  // --- Restored State for UI Features ---
  const [script, setScript] = useState(
    "Welcome to our product demo. In this video, we'll walk you through the key features that make our platform stand out. Let's start by clicking on the Get Started button to begin the onboarding process..."
  );
  const [selectedVoice, setSelectedVoice] = useState("emma");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);

  // Sync effects with store - use store state as source of truth
  const effects = {
    zoomOnClick: editorState.effects.clickRipple, // Use clickRipple as proxy for zoom
    cursorHighlight: editorState.cursor.glow,
    smoothPan: true, // Always enabled when zoom is on
  };

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

  const handleGenerateScript = async () => {
    setIsGeneratingScript(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setScript(
      "Welcome to our platform walkthrough. Today, I'll show you how to get started in just a few simple steps.\n\nFirst, we'll click on the Get Started button to begin the onboarding process. Notice how intuitive the interface is.\n\nNext, let's scroll down to explore the features section. Here you can see all the powerful tools at your disposal.\n\nNow, click on the Dashboard tab to access your analytics. The dashboard provides real-time insights into your performance.\n\nFinally, use the search functionality to find exactly what you need. Just type your query and click the search icon."
    );
    setIsGeneratingScript(false);
    toast({
      title: "Script generated!",
      description: "AI has created a script based on your recording.",
    });
  };

  const handleGenerateVoice = async () => {
    setIsGeneratingVoice(true);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    setIsGeneratingVoice(false);
    toast({
      title: "Voice generated!",
      description: "AI voiceover has been added to your video.",
    });
  };

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
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left - Video Preview */}
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {/* Browser Chrome */}
                <div className="flex items-center gap-3 border-b border-border/50 bg-secondary/30 px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                  </div>
                  <div className="flex-1 text-center">
                    <div className="inline-flex items-center gap-1.5 rounded bg-background/50 px-2 py-0.5 text-xs text-muted-foreground font-medium">
                      <Video className="h-3 w-3" />
                      Preview
                    </div>
                  </div>
                  <div className="w-12" /> {/* Spacer for centering */}
                </div>

                {/* Video Preview */}
                <div
                  ref={videoContainerRef}
                  className="main_video_stream relative bg-black flex items-center justify-center overflow-hidden rounded-lg shadow-2xl border border-border/50"
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

                      {/* Text Overlays */}
                      {editorState.textOverlays.map((overlay) => {
                        const currentTime = editorState.playback.currentTime;
                        const isVisible = currentTime >= overlay.startTime && currentTime <= overlay.endTime;
                        if (!isVisible) return null;

                        const progress = (currentTime - overlay.startTime) / (overlay.endTime - overlay.startTime);
                        let opacity = 1;
                        let translateY = 0;

                        if (overlay.animation === "fade") {
                          const fadeIn = Math.min(1, progress * 5);
                          const fadeOut = Math.min(1, (1 - progress) * 5);
                          opacity = Math.min(fadeIn, fadeOut);
                        } else if (overlay.animation === "slide") {
                          opacity = Math.min(1, progress * 3);
                          translateY = (1 - progress) * 20;
                        }

                        return (
                          <div
                            key={overlay.id}
                            className="absolute pointer-events-none z-50"
                            style={{
                              left: `${overlay.x * 100}%`,
                              top: `${overlay.y * 100}%`,
                              transform: `translate(-50%, -50%) translateY(${translateY}px)`,
                              opacity,
                              fontSize: `${overlay.fontSize}px`,
                              color: overlay.color,
                              fontWeight: 'bold',
                              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                              transition: 'opacity 0.1s, transform 0.1s',
                            }}
                          >
                            {overlay.text}
                          </div>
                        );
                      })}


                    </>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-hero shadow-glow">
                      <Video className="h-8 w-8 text-primary-foreground" />
                    </div>
                  )}
                </div>

                {/* Playback Controls */}
                <div className="flex flex-col gap-2 border-t border-border bg-secondary/30 p-4">
                  {/* Progress Bar */}
                  <div className="relative h-1.5 w-full cursor-pointer">
                    <input
                      type="range"
                      min="0"
                      max={editorState.video.duration || 100}
                      value={editorState.playback.currentTime}
                      onChange={handleSeek}
                      className="absolute inset-0 z-10 w-full opacity-0 cursor-pointer"
                    />
                    <div className="absolute inset-0 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-gradient-hero transition-all duration-100 ease-linear"
                        style={{ width: `${(editorState.playback.currentTime / (editorState.video.duration || 1)) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-white/10"
                        onClick={togglePlay}
                      >
                        {editorState.playback.isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>

                      <span className="text-sm font-medium text-muted-foreground w-24">
                        {formatTime(editorState.playback.currentTime)} / {editorState.video.duration > 0 && isFinite(editorState.video.duration) ? formatTime(editorState.video.duration) : "--:--"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-white/10"
                        onClick={toggleMute}
                      >
                        {editorState.playback.isMuted || editorState.playback.volume === 0 ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                      {/* Volume Slider - using range input for simplicity for now, can upgrade to shadcn slider later */}
                      <div className="w-20">
                        <Slider
                          defaultValue={[1]}
                          max={1}
                          step={0.1}
                          value={[editorState.playback.isMuted ? 0 : editorState.playback.volume]}
                          onValueChange={handleVolumeChange}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Control Panel */}
            <div className="rounded-xl border border-border bg-card">
              <Tabs defaultValue="script" className="flex h-full flex-col">
                <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4">
                  <TabsTrigger value="script" className="gap-2">
                    <Wand2 className="h-4 w-4" />
                    Script
                  </TabsTrigger>
                  <TabsTrigger value="voice" className="gap-2">
                    <Mic2 className="h-4 w-4" />
                    Voice
                  </TabsTrigger>
                  <TabsTrigger value="effects" className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Effects
                  </TabsTrigger>
                  <TabsTrigger value="color" className="gap-2">
                    <Video className="h-4 w-4" />
                    Color
                  </TabsTrigger>
                  <TabsTrigger value="text" className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Text
                  </TabsTrigger>
                  <TabsTrigger value="presentation" className="gap-2">
                    <Monitor className="h-4 w-4" />
                    Presentation
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="script" className="flex-1 p-4">
                  <div className="flex h-full flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Video Script</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateScript}
                        disabled={isGeneratingScript}
                      >
                        {isGeneratingScript ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        Generate Script
                      </Button>
                    </div>
                    <Textarea
                      value={script}
                      onChange={(e) => setScript(e.target.value)}
                      placeholder="Enter your video script here..."
                      className="min-h-[200px] flex-1 resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      {script.split(" ").length} words • ~{Math.ceil(script.split(" ").length / 2.5)}s read time
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="voice" className="flex-1 p-4">
                  <div className="flex h-full flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">AI Voice</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateVoice}
                        disabled={isGeneratingVoice}
                      >
                        {isGeneratingVoice ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Mic2 className="mr-2 h-4 w-4" />
                        )}
                        Generate Voice
                      </Button>
                    </div>

                    <div>
                      <Label className="mb-2 block text-sm">Select Voice</Label>
                      <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {voiceOptions.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              <div className="flex flex-col">
                                <span>{voice.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {voice.description}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1 rounded-lg border border-dashed border-border bg-secondary/30 p-6">
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <Mic2 className="mb-3 h-10 w-10 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          Click "Generate Voice" to create AI voiceover
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="effects" className="flex-1 p-4">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <ZoomIn className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <Label className="text-base font-medium">Automatic Zoom & Pan</Label>
                          <p className="text-sm text-muted-foreground">
                            Silky-smooth pans and zooms that guide viewer focus based on clicks
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={effects.zoomOnClick}
                        onCheckedChange={(checked) => {
                          editorStore.setState({
                            effects: {
                              ...editorState.effects,
                              clickRipple: checked,
                            }
                          });
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <MousePointer2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <Label className="text-base font-medium">Cursor Highlight</Label>
                          <p className="text-sm text-muted-foreground">
                            Highlight cursor with glow effect
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={effects.cursorHighlight}
                        onCheckedChange={(checked) => {
                          editorStore.setState({
                            cursor: {
                              ...editorState.cursor,
                              glow: checked,
                            }
                          });
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between opacity-60">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Move className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <Label className="text-base font-medium">Smooth Pan</Label>
                          <p className="text-sm text-muted-foreground">
                            Enabled automatically with zoom
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={effects.smoothPan}
                        disabled
                      />
                    </div>

                    {/* Camera Padding Control */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Frame className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <Label className="text-base font-medium">Camera Padding</Label>
                          <p className="text-sm text-muted-foreground">
                            Deadzone around edges where camera doesn't move (0-50%)
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 pl-13">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Padding: {(editorState.camera.padding * 100).toFixed(0)}%</Label>
                          <span className="text-xs text-muted-foreground">
                            {editorState.camera.padding < 0.15 ? 'Tight' : editorState.camera.padding > 0.35 ? 'Loose' : 'Balanced'}
                          </span>
                        </div>
                        <Slider
                          min={0}
                          max={0.5}
                          step={0.01}
                          value={[editorState.camera.padding]}
                          onValueChange={([value]) => {
                            editorStore.setState({
                              camera: {
                                ...editorState.camera,
                                padding: value,
                              }
                            });
                          }}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => editorStore.setState({
                              camera: { ...editorState.camera, padding: 0.1 }
                            })}
                          >
                            Tight (10%)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => editorStore.setState({
                              camera: { ...editorState.camera, padding: 0.2 }
                            })}
                          >
                            Balanced (20%)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => editorStore.setState({
                              camera: { ...editorState.camera, padding: 0.35 }
                            })}
                          >
                            Loose (35%)
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Camera Speed Control */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <Label className="text-base font-medium">Camera Speed</Label>
                          <p className="text-sm text-muted-foreground">
                            How fast the camera responds to movements (0.1x - 2.0x)
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 pl-13">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Speed: {editorState.camera.speed.toFixed(1)}x</Label>
                          <span className="text-xs text-muted-foreground">
                            {editorState.camera.speed < 0.5 ? 'Slow' : editorState.camera.speed > 1.5 ? 'Fast' : 'Normal'}
                          </span>
                        </div>
                        <Slider
                          min={0.1}
                          max={2.0}
                          step={0.1}
                          value={[editorState.camera.speed]}
                          onValueChange={([value]) => {
                            editorStore.setState({
                              camera: {
                                ...editorState.camera,
                                speed: value,
                              }
                            });
                          }}
                        />
                      </div>
                    </div>

                    {/* Zoom Strength Control */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <ZoomIn className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <Label className="text-base font-medium">Zoom Strength</Label>
                          <p className="text-sm text-muted-foreground">
                            Maximum zoom level when clicking (1.0x - 5.0x)
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 pl-13">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Strength: {editorState.camera.zoomStrength.toFixed(1)}x</Label>
                          <span className="text-xs text-muted-foreground">
                            {editorState.camera.zoomStrength < 1.5 ? 'Subtle' : editorState.camera.zoomStrength > 3.0 ? 'Dramatic' : 'Moderate'}
                          </span>
                        </div>
                        <Slider
                          min={1.0}
                          max={5.0}
                          step={0.1}
                          value={[editorState.camera.zoomStrength]}
                          onValueChange={([value]) => {
                            editorStore.setState({
                              camera: {
                                ...editorState.camera,
                                zoomStrength: value,
                              }
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="color" className="flex-1 p-4">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Color Grading</Label>
                      <Switch
                        checked={showColorGrading}
                        onCheckedChange={setShowColorGrading}
                      />
                    </div>

                    {showColorGrading && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Brightness</Label>
                            <span className="text-sm text-muted-foreground">{editorState.colorGrading.brightness.toFixed(2)}</span>
                          </div>
                          <Slider
                            min={-1}
                            max={1}
                            step={0.1}
                            value={[editorState.colorGrading.brightness]}
                            onValueChange={([value]) => editorStore.setState({ colorGrading: { ...editorState.colorGrading, brightness: value } })}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Contrast</Label>
                            <span className="text-sm text-muted-foreground">{editorState.colorGrading.contrast.toFixed(2)}</span>
                          </div>
                          <Slider
                            min={-1}
                            max={1}
                            step={0.1}
                            value={[editorState.colorGrading.contrast]}
                            onValueChange={([value]) => editorStore.setState({ colorGrading: { ...editorState.colorGrading, contrast: value } })}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Saturation</Label>
                            <span className="text-sm text-muted-foreground">{editorState.colorGrading.saturation.toFixed(2)}</span>
                          </div>
                          <Slider
                            min={-1}
                            max={1}
                            step={0.1}
                            value={[editorState.colorGrading.saturation]}
                            onValueChange={([value]) => editorStore.setState({ colorGrading: { ...editorState.colorGrading, saturation: value } })}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Hue</Label>
                            <span className="text-sm text-muted-foreground">{Math.round(editorState.colorGrading.hue)}°</span>
                          </div>
                          <Slider
                            min={-180}
                            max={180}
                            step={1}
                            value={[editorState.colorGrading.hue]}
                            onValueChange={([value]) => editorStore.setState({ colorGrading: { ...editorState.colorGrading, hue: value } })}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Temperature</Label>
                            <span className="text-sm text-muted-foreground">{editorState.colorGrading.temperature.toFixed(2)}</span>
                          </div>
                          <Slider
                            min={-1}
                            max={1}
                            step={0.1}
                            value={[editorState.colorGrading.temperature]}
                            onValueChange={([value]) => editorStore.setState({ colorGrading: { ...editorState.colorGrading, temperature: value } })}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Vignette</Label>
                            <span className="text-sm text-muted-foreground">{editorState.colorGrading.vignette.toFixed(2)}</span>
                          </div>
                          <Slider
                            min={0}
                            max={1}
                            step={0.1}
                            value={[editorState.colorGrading.vignette]}
                            onValueChange={([value]) => editorStore.setState({ colorGrading: { ...editorState.colorGrading, vignette: value } })}
                          />
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => editorStore.setState({
                            colorGrading: {
                              brightness: 0,
                              contrast: 0,
                              saturation: 0,
                              hue: 0,
                              temperature: 0,
                              vignette: 0,
                            }
                          })}
                          className="w-full"
                        >
                          Reset All
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="text" className="flex-1 p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Text Overlays</Label>
                      <Button size="sm" onClick={addTextOverlay}>
                        {/* <Plus className="h-4 w-4 mr-2" /> icon not imported? assume okay or fix later */}
                        <span className="mr-2">+</span>
                        Add Text
                      </Button>
                    </div>

                    {editorState.textOverlays.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
                        <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No text overlays yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Click "Add Text" to create one</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {editorState.textOverlays.map((overlay) => (
                          <div
                            key={overlay.id}
                            className="p-3 border rounded-lg space-y-2 hover:bg-secondary/50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <input
                                type="text"
                                value={overlay.text}
                                onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
                                className="flex-1 bg-transparent font-medium outline-none"
                                placeholder="Enter text..."
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => deleteTextOverlay(overlay.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <Label className="text-xs">Font Size</Label>
                                <Slider
                                  min={12}
                                  max={72}
                                  step={1}
                                  value={[overlay.fontSize]}
                                  onValueChange={([value]) => updateTextOverlay(overlay.id, { fontSize: value })}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Color</Label>
                                <input
                                  type="color"
                                  value={overlay.color}
                                  onChange={(e) => updateTextOverlay(overlay.id, { color: e.target.value })}
                                  className="w-full h-8 rounded border"
                                />
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatTime(overlay.startTime)} - {formatTime(overlay.endTime)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="presentation" className="flex-1 p-4 overflow-y-auto">
                  <div className="space-y-6">
                    {/* Aspect Ratio */}
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Aspect Ratio</Label>
                      <Select
                        value={editorState.presentation.aspectRatio}
                        onValueChange={(value: any) => {
                          const dims = calculateOutputDimensions(
                            value,
                            editorState.video.width,
                            editorState.video.height,
                            editorState.presentation.customAspectRatio
                          );
                          editorStore.setState({
                            presentation: {
                              ...editorState.presentation,
                              aspectRatio: value,
                              outputWidth: dims.width,
                              outputHeight: dims.height,
                            }
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="native">Native ({editorState.video.width}x{editorState.video.height})</SelectItem>
                          <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                          <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                          <SelectItem value="1:1">1:1 (Square)</SelectItem>
                          <SelectItem value="4:3">4:3 (Classic)</SelectItem>
                          <SelectItem value="21:9">21:9 (Ultrawide)</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      {editorState.presentation.aspectRatio === 'custom' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Width</Label>
                            <input
                              type="number"
                              value={editorState.presentation.customAspectRatio?.width || 1920}
                              onChange={(e) => {
                                const width = parseInt(e.target.value) || 1920;
                                const height = editorState.presentation.customAspectRatio?.height || 1080;
                                const dims = calculateOutputDimensions('custom', width, height, { width, height });
                                editorStore.setState({
                                  presentation: {
                                    ...editorState.presentation,
                                    customAspectRatio: { width, height },
                                    outputWidth: dims.width,
                                    outputHeight: dims.height,
                                  }
                                });
                              }}
                              className="w-full px-2 py-1 text-sm border rounded"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Height</Label>
                            <input
                              type="number"
                              value={editorState.presentation.customAspectRatio?.height || 1080}
                              onChange={(e) => {
                                const height = parseInt(e.target.value) || 1080;
                                const width = editorState.presentation.customAspectRatio?.width || 1920;
                                const dims = calculateOutputDimensions('custom', width, height, { width, height });
                                editorStore.setState({
                                  presentation: {
                                    ...editorState.presentation,
                                    customAspectRatio: { width, height },
                                    outputWidth: dims.width,
                                    outputHeight: dims.height,
                                  }
                                });
                              }}
                              className="w-full px-2 py-1 text-sm border rounded"
                            />
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Output: {editorState.presentation.outputWidth}x{editorState.presentation.outputHeight}
                      </p>
                    </div>

                    {/* Background */}
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Background</Label>
                      <Select
                        value={editorState.presentation.backgroundMode}
                        onValueChange={(value: any) => {
                          editorStore.setState({
                            presentation: {
                              ...editorState.presentation,
                              backgroundMode: value,
                            }
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hidden">Hidden (Black)</SelectItem>
                          <SelectItem value="solid">Solid Color</SelectItem>
                          <SelectItem value="gradient">Gradient</SelectItem>
                          <SelectItem value="image">Image</SelectItem>
                        </SelectContent>
                      </Select>

                      {editorState.presentation.backgroundMode === 'solid' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Color</Label>
                          <input
                            type="color"
                            value={editorState.presentation.backgroundColor}
                            onChange={(e) => {
                              editorStore.setState({
                                presentation: {
                                  ...editorState.presentation,
                                  backgroundColor: e.target.value,
                                }
                              });
                            }}
                            className="w-full h-10 rounded border"
                          />
                        </div>
                      )}

                      {editorState.presentation.backgroundMode === 'gradient' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Type</Label>
                            <Select
                              value={editorState.presentation.backgroundGradient.type}
                              onValueChange={(value: 'linear' | 'radial') => {
                                editorStore.setState({
                                  presentation: {
                                    ...editorState.presentation,
                                    backgroundGradient: {
                                      ...editorState.presentation.backgroundGradient,
                                      type: value,
                                    }
                                  }
                                });
                              }}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="linear">Linear</SelectItem>
                                <SelectItem value="radial">Radial</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {editorState.presentation.backgroundGradient.type === 'linear' && (
                            <div>
                              <Label className="text-xs">Angle: {editorState.presentation.backgroundGradient.angle}°</Label>
                              <Slider
                                min={0}
                                max={360}
                                step={1}
                                value={[editorState.presentation.backgroundGradient.angle || 135]}
                                onValueChange={([value]) => {
                                  editorStore.setState({
                                    presentation: {
                                      ...editorState.presentation,
                                      backgroundGradient: {
                                        ...editorState.presentation.backgroundGradient,
                                        angle: value,
                                      }
                                    }
                                  });
                                }}
                              />
                            </div>
                          )}
                          <div className="space-y-1">
                            {editorState.presentation.backgroundGradient.stops.map((stop, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <input
                                  type="color"
                                  value={stop.color}
                                  onChange={(e) => {
                                    const newStops = [...editorState.presentation.backgroundGradient.stops];
                                    newStops[idx] = { ...stop, color: e.target.value };
                                    editorStore.setState({
                                      presentation: {
                                        ...editorState.presentation,
                                        backgroundGradient: {
                                          ...editorState.presentation.backgroundGradient,
                                          stops: newStops,
                                        }
                                      }
                                    });
                                  }}
                                  className="w-12 h-8 rounded border"
                                />
                                <Slider
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  value={[stop.position]}
                                  onValueChange={([value]) => {
                                    const newStops = [...editorState.presentation.backgroundGradient.stops];
                                    newStops[idx] = { ...stop, position: value };
                                    editorStore.setState({
                                      presentation: {
                                        ...editorState.presentation,
                                        backgroundGradient: {
                                          ...editorState.presentation.backgroundGradient,
                                          stops: newStops,
                                        }
                                      }
                                    });
                                  }}
                                  className="flex-1"
                                />
                                <span className="text-xs w-12 text-right">{Math.round(stop.position * 100)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {editorState.presentation.backgroundMode === 'image' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Image</Label>
                          {editorState.presentation.backgroundImage ? (
                            <div className="relative">
                              <img
                                src={editorState.presentation.backgroundImage}
                                alt="Background"
                                className="w-full h-32 object-cover rounded border"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => {
                                  editorStore.setState({
                                    presentation: {
                                      ...editorState.presentation,
                                      backgroundImage: undefined,
                                    }
                                  });
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary/50">
                              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                              <span className="text-sm text-muted-foreground">Upload Image</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      editorStore.setState({
                                        presentation: {
                                          ...editorState.presentation,
                                          backgroundImage: event.target?.result as string,
                                        }
                                      });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}

                      {(editorState.presentation.backgroundMode === 'image' ||
                        editorState.presentation.backgroundMode === 'gradient' ||
                        editorState.presentation.backgroundMode === 'solid') && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Blur</Label>
                              <span className="text-xs text-muted-foreground">{editorState.presentation.backgroundBlur}px</span>
                            </div>
                            <Slider
                              min={0}
                              max={100}
                              step={1}
                              value={[editorState.presentation.backgroundBlur]}
                              onValueChange={([value]) => {
                                editorStore.setState({
                                  presentation: {
                                    ...editorState.presentation,
                                    backgroundBlur: value,
                                  }
                                });
                              }}
                            />
                            <Select
                              value={editorState.presentation.backgroundBlurType}
                              onValueChange={(value: 'gaussian' | 'stack') => {
                                editorStore.setState({
                                  presentation: {
                                    ...editorState.presentation,
                                    backgroundBlurType: value,
                                  }
                                });
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gaussian">Gaussian Blur</SelectItem>
                                <SelectItem value="stack">Stack Blur</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                    </div>

                    {/* Video Padding */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-medium">Video Padding</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Add padding around video to show background
                          </p>
                        </div>
                        <Switch
                          checked={editorState.presentation.videoPadding.enabled}
                          onCheckedChange={(checked) => {
                            editorStore.setState({
                              presentation: {
                                ...editorState.presentation,
                                videoPadding: {
                                  ...editorState.presentation.videoPadding,
                                  enabled: checked,
                                }
                              }
                            });
                          }}
                        />
                      </div>

                      {editorState.presentation.videoPadding.enabled && (
                        <div className="space-y-4 pl-2 border-l-2 border-primary/20">
                          {/* Uniform Toggle */}
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Uniform Padding</Label>
                            <Switch
                              checked={editorState.presentation.videoPadding.uniform}
                              onCheckedChange={(checked) => {
                                // When enabling uniform, sync all values to the top value
                                const syncValue = editorState.presentation.videoPadding.top;
                                editorStore.setState({
                                  presentation: {
                                    ...editorState.presentation,
                                    videoPadding: {
                                      ...editorState.presentation.videoPadding,
                                      uniform: checked,
                                      // Sync all values when enabling uniform
                                      ...(checked ? {
                                        top: syncValue,
                                        right: syncValue,
                                        bottom: syncValue,
                                        left: syncValue,
                                      } : {})
                                    }
                                  }
                                });
                              }}
                            />
                          </div>

                          {editorState.presentation.videoPadding.uniform ? (
                            /* Uniform Padding Control */
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Padding: {editorState.presentation.videoPadding.top}px</Label>
                                <span className="text-xs text-muted-foreground">
                                  All sides: {editorState.presentation.videoPadding.top}px
                                </span>
                              </div>
                              <Slider
                                min={0}
                                max={500}
                                step={5}
                                value={[editorState.presentation.videoPadding.top]}
                                onValueChange={([value]) => {
                                  editorStore.setState({
                                    presentation: {
                                      ...editorState.presentation,
                                      videoPadding: {
                                        ...editorState.presentation.videoPadding,
                                        top: value,
                                        right: value,
                                        bottom: value,
                                        left: value,
                                        uniform: true, // Ensure uniform stays true
                                      }
                                    }
                                  });
                                }}
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-xs"
                                  onClick={() => {
                                    editorStore.setState({
                                      presentation: {
                                        ...editorState.presentation,
                                        videoPadding: {
                                          ...editorState.presentation.videoPadding,
                                          top: 0,
                                          right: 0,
                                          bottom: 0,
                                          left: 0,
                                        }
                                      }
                                    });
                                  }}
                                >
                                  Reset
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-xs"
                                  onClick={() => {
                                    editorStore.setState({
                                      presentation: {
                                        ...editorState.presentation,
                                        videoPadding: {
                                          ...editorState.presentation.videoPadding,
                                          top: 50,
                                          right: 50,
                                          bottom: 50,
                                          left: 50,
                                        }
                                      }
                                    });
                                  }}
                                >
                                  50px
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 text-xs"
                                  onClick={() => {
                                    editorStore.setState({
                                      presentation: {
                                        ...editorState.presentation,
                                        videoPadding: {
                                          ...editorState.presentation.videoPadding,
                                          top: 100,
                                          right: 100,
                                          bottom: 100,
                                          left: 100,
                                        }
                                      }
                                    });
                                  }}
                                >
                                  100px
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* Individual Padding Controls */
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm">Top</Label>
                                  <span className="text-xs text-muted-foreground">{editorState.presentation.videoPadding.top}px</span>
                                </div>
                                <Slider
                                  min={0}
                                  max={500}
                                  step={5}
                                  value={[editorState.presentation.videoPadding.top]}
                                  onValueChange={([value]) => {
                                    editorStore.setState({
                                      presentation: {
                                        ...editorState.presentation,
                                        videoPadding: {
                                          ...editorState.presentation.videoPadding,
                                          top: value,
                                        }
                                      }
                                    });
                                  }}
                                />
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm">Right</Label>
                                  <span className="text-xs text-muted-foreground">{editorState.presentation.videoPadding.right}px</span>
                                </div>
                                <Slider
                                  min={0}
                                  max={500}
                                  step={5}
                                  value={[editorState.presentation.videoPadding.right]}
                                  onValueChange={([value]) => {
                                    editorStore.setState({
                                      presentation: {
                                        ...editorState.presentation,
                                        videoPadding: {
                                          ...editorState.presentation.videoPadding,
                                          right: value,
                                        }
                                      }
                                    });
                                  }}
                                />
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm">Bottom</Label>
                                  <span className="text-xs text-muted-foreground">{editorState.presentation.videoPadding.bottom}px</span>
                                </div>
                                <Slider
                                  min={0}
                                  max={500}
                                  step={5}
                                  value={[editorState.presentation.videoPadding.bottom]}
                                  onValueChange={([value]) => {
                                    editorStore.setState({
                                      presentation: {
                                        ...editorState.presentation,
                                        videoPadding: {
                                          ...editorState.presentation.videoPadding,
                                          bottom: value,
                                        }
                                      }
                                    });
                                  }}
                                />
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm">Left</Label>
                                  <span className="text-xs text-muted-foreground">{editorState.presentation.videoPadding.left}px</span>
                                </div>
                                <Slider
                                  min={0}
                                  max={500}
                                  step={5}
                                  value={[editorState.presentation.videoPadding.left]}
                                  onValueChange={([value]) => {
                                    editorStore.setState({
                                      presentation: {
                                        ...editorState.presentation,
                                        videoPadding: {
                                          ...editorState.presentation.videoPadding,
                                          left: value,
                                        }
                                      }
                                    });
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Visual Preview */}
                          <div className="mt-4 p-3 bg-secondary/30 rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground mb-2">Preview</div>
                            <div className="relative w-full h-24 bg-gradient-to-br from-primary/20 to-primary/10 rounded border-2 border-dashed border-primary/30">
                              {/* Reference size for preview: 200px width */}
                              {(() => {
                                const refWidth = 200;
                                const refHeight = 96; // h-24 = 96px
                                const paddingTopPct = (editorState.presentation.videoPadding.top / refHeight) * 100;
                                const paddingBottomPct = (editorState.presentation.videoPadding.bottom / refHeight) * 100;
                                const paddingLeftPct = (editorState.presentation.videoPadding.left / refWidth) * 100;
                                const paddingRightPct = (editorState.presentation.videoPadding.right / refWidth) * 100;
                                return (
                                  <div
                                    className="bg-primary/40 rounded border border-primary/50 absolute"
                                    style={{
                                      width: `${100 - paddingLeftPct - paddingRightPct}%`,
                                      height: `${100 - paddingTopPct - paddingBottomPct}%`,
                                      top: `${paddingTopPct}%`,
                                      left: `${paddingLeftPct}%`,
                                    }}
                                  />
                                );
                              })()}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 text-center">
                              Video area (background visible around edges)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Click Animations */}
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Click Animations</Label>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Enable Click Effects</Label>
                        <Switch
                          checked={editorState.effects.clickRipple}
                          onCheckedChange={(checked) => {
                            editorStore.setState({
                              effects: {
                                ...editorState.effects,
                                clickRipple: checked,
                              }
                            });
                          }}
                        />
                      </div>
                      {editorState.effects.clickRipple && (
                        <>
                          <div>
                            <Label className="text-xs">Style</Label>
                            <Select
                              value={editorState.effects.clickAnimationStyle}
                              onValueChange={(value: any) => {
                                editorStore.setState({
                                  effects: {
                                    ...editorState.effects,
                                    clickAnimationStyle: value,
                                  }
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ripple">Ripple</SelectItem>
                                <SelectItem value="orb">Orb</SelectItem>
                                <SelectItem value="pulse">Pulse</SelectItem>
                                <SelectItem value="ring">Ring</SelectItem>
                                <SelectItem value="splash">Splash</SelectItem>
                                <SelectItem value="none">None</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Force</Label>
                              <span className="text-xs text-muted-foreground">{(editorState.effects.clickForce * 100).toFixed(0)}%</span>
                            </div>
                            <Slider
                              min={0}
                              max={1}
                              step={0.1}
                              value={[editorState.effects.clickForce]}
                              onValueChange={([value]) => {
                                editorStore.setState({
                                  effects: {
                                    ...editorState.effects,
                                    clickForce: value,
                                  }
                                });
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Easing</Label>
                            <Select
                              value={editorState.effects.clickEasing}
                              onValueChange={(value: any) => {
                                editorStore.setState({
                                  effects: {
                                    ...editorState.effects,
                                    clickEasing: value,
                                  }
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="linear">Linear</SelectItem>
                                <SelectItem value="ease-out">Ease Out</SelectItem>
                                <SelectItem value="ease-in-out">Ease In Out</SelectItem>
                                <SelectItem value="bounce">Bounce</SelectItem>
                                <SelectItem value="elastic">Elastic</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Screen DPR */}
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Render Quality</Label>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Device Pixel Ratio (DPR)</Label>
                          <span className="text-xs text-muted-foreground">{editorState.presentation.screenDPR}x</span>
                        </div>
                        <Slider
                          min={0.5}
                          max={3}
                          step={0.1}
                          value={[editorState.presentation.screenDPR]}
                          onValueChange={([value]) => {
                            editorStore.setState({
                              presentation: {
                                ...editorState.presentation,
                                screenDPR: value,
                              }
                            });
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Higher values produce sharper output for high-resolution displays
                        </p>
                      </div>
                    </div>

                    {/* Video Crop */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">Video Crop</Label>
                        <Switch
                          checked={editorState.presentation.videoCrop.enabled}
                          onCheckedChange={(checked) => {
                            editorStore.setState({
                              presentation: {
                                ...editorState.presentation,
                                videoCrop: {
                                  ...editorState.presentation.videoCrop,
                                  enabled: checked,
                                }
                              }
                            });
                          }}
                        />
                      </div>
                      {editorState.presentation.videoCrop.enabled && (
                        <div className="space-y-3 pl-4 border-l-2 border-border">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Top: {editorState.presentation.videoCrop.top}px</Label>
                              <Slider
                                min={0}
                                max={500}
                                step={1}
                                value={[editorState.presentation.videoCrop.top]}
                                onValueChange={([value]) => {
                                  editorStore.setState({
                                    presentation: {
                                      ...editorState.presentation,
                                      videoCrop: {
                                        ...editorState.presentation.videoCrop,
                                        top: value,
                                      }
                                    }
                                  });
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Bottom: {editorState.presentation.videoCrop.bottom}px</Label>
                              <Slider
                                min={0}
                                max={500}
                                step={1}
                                value={[editorState.presentation.videoCrop.bottom]}
                                onValueChange={([value]) => {
                                  editorStore.setState({
                                    presentation: {
                                      ...editorState.presentation,
                                      videoCrop: {
                                        ...editorState.presentation.videoCrop,
                                        bottom: value,
                                      }
                                    }
                                  });
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Left: {editorState.presentation.videoCrop.left}px</Label>
                              <Slider
                                min={0}
                                max={500}
                                step={1}
                                value={[editorState.presentation.videoCrop.left]}
                                onValueChange={([value]) => {
                                  editorStore.setState({
                                    presentation: {
                                      ...editorState.presentation,
                                      videoCrop: {
                                        ...editorState.presentation.videoCrop,
                                        left: value,
                                      }
                                    }
                                  });
                                }}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Right: {editorState.presentation.videoCrop.right}px</Label>
                              <Slider
                                min={0}
                                max={500}
                                step={1}
                                value={[editorState.presentation.videoCrop.right]}
                                onValueChange={([value]) => {
                                  editorStore.setState({
                                    presentation: {
                                      ...editorState.presentation,
                                      videoCrop: {
                                        ...editorState.presentation.videoCrop,
                                        right: value,
                                      }
                                    }
                                  });
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Rounded Corners</Label>
                            <Switch
                              checked={editorState.presentation.videoCrop.roundedCorners}
                              onCheckedChange={(checked) => {
                                editorStore.setState({
                                  presentation: {
                                    ...editorState.presentation,
                                    videoCrop: {
                                      ...editorState.presentation.videoCrop,
                                      roundedCorners: checked,
                                    }
                                  }
                                });
                              }}
                            />
                          </div>
                          {editorState.presentation.videoCrop.roundedCorners && (
                            <div>
                              <Label className="text-xs">Corner Radius: {editorState.presentation.videoCrop.cornerRadius}px</Label>
                              <Slider
                                min={0}
                                max={50}
                                step={1}
                                value={[editorState.presentation.videoCrop.cornerRadius]}
                                onValueChange={([value]) => {
                                  editorStore.setState({
                                    presentation: {
                                      ...editorState.presentation,
                                      videoCrop: {
                                        ...editorState.presentation.videoCrop,
                                        cornerRadius: value,
                                      }
                                    }
                                  });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Advanced Timeline */}
          <div className="mt-6 rounded-xl border border-border bg-card">
            {/* Timeline Controls */}
            <div className="flex items-center gap-2 border-b border-border bg-secondary/30 p-4 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newMarker: TimelineEvent = {
                    id: Date.now().toString(),
                    type: 'marker',
                    time: editorState.playback.currentTime,
                    label: `Marker at ${formatTime(editorState.playback.currentTime)}`,
                  };
                  editorStore.setState({
                    events: {
                      ...editorState.events,
                      markers: [...editorState.events.markers, newMarker],
                    }
                  });
                  toast({
                    title: "Marker added",
                    description: `Added at ${formatTime(editorState.playback.currentTime)}`,
                  });
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Marker
              </Button>

              {/* Frame Navigation */}
              <div className="h-6 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const duration = editorState.video.duration || 0;
                  if (duration <= 0) return;
                  const frameTime = 1 / 30; // Assuming 30fps
                  const newTime = Math.max(0, editorState.playback.currentTime - frameTime);
                  if (isFinite(newTime)) {
                    editorStore.setPlayback({ currentTime: newTime });
                  }
                }}
                title="Previous Frame (←)"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const duration = editorState.video.duration || 0;
                  if (duration <= 0) return;
                  const frameTime = 1 / 30; // Assuming 30fps
                  const newTime = Math.min(duration, editorState.playback.currentTime + frameTime);
                  if (isFinite(newTime)) {
                    editorStore.setPlayback({ currentTime: newTime });
                  }
                }}
                title="Next Frame (→)"
              >
                <Plus className="h-4 w-4" />
              </Button>

              {/* Zoom Controls */}
              <div className="h-6 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTimelineZoom(Math.max(0.1, timelineZoom - 0.1))}
                title="Zoom out"
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTimelineZoom(Math.min(5, timelineZoom + 0.1))}
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>

              {/* Playback Speed */}
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Speed:</Label>
                <Select
                  value={playbackSpeed.toString()}
                  onValueChange={(value) => {
                    const speed = parseFloat(value);
                    setPlaybackSpeed(speed);
                    // Note: Actual playback speed would need video element modification
                    toast({
                      title: "Playback speed",
                      description: `Set to ${speed}x (requires video element support)`,
                    });
                  }}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.25">0.25x</SelectItem>
                    <SelectItem value="0.5">0.5x</SelectItem>
                    <SelectItem value="0.75">0.75x</SelectItem>
                    <SelectItem value="1.0">1.0x</SelectItem>
                    <SelectItem value="1.25">1.25x</SelectItem>
                    <SelectItem value="1.5">1.5x</SelectItem>
                    <SelectItem value="2.0">2.0x</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Minus className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={[timelineZoom]}
                  min={0.1}
                  max={5}
                  step={0.1}
                  onValueChange={(value) => setTimelineZoom(value[0])}
                  className="w-24"
                />
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground ml-2 min-w-[3rem]">
                  {Math.round(timelineZoom * 100)}%
                </span>
              </div>
            </div>

            {/* Timeline Canvas */}
            <div className="relative p-6">
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
