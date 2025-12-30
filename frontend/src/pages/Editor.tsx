import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { VisualEffectsLayer, ClickData } from "@/components/editor/VisualEffectsLayer";
import { CanvasOverlay } from "@/components/editor/CanvasOverlay";
import { getInitialCameraState, updateCameraSystem } from "@/lib/composition/camera";
import { ClickData, MoveData } from "@/pages/Recorder";
import { FilterEngine } from "@/lib/effects/filters";
import { TransitionEngine, TransitionType, easings } from "@/lib/effects/transitions";





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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const mockUser = {
  name: "Alex Johnson",
  email: "alex@company.com",
};

interface TimelineStep {
  id: string;
  type: "click" | "scroll" | "type";
  duration: number;
  description: string;
}

const mockSteps: TimelineStep[] = [
  { id: "1", type: "click", duration: 1.2, description: "Click on 'Get Started' button" },
  { id: "2", type: "scroll", duration: 0.8, description: "Scroll down to features section" },
  { id: "3", type: "click", duration: 1.5, description: "Click on 'Dashboard' tab" },
  { id: "4", type: "type", duration: 2.0, description: "Type search query" },
  { id: "5", type: "click", duration: 0.6, description: "Click search icon" },
];

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

  const videoUrl = location.state?.videoUrl;
  const clickData = location.state?.clickData || [];
  const moveData = location.state?.moveData || [];
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [transform, setTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const lastTransformRef = useRef({ scale: 1, translateX: 0, translateY: 0 });

  // ... [states for script/voice/effects/steps remain same]
  const [script, setScript] = useState(
    "Welcome to our product demo. In this video, we'll walk you through the key features that make our platform stand out. Let's start by clicking on the Get Started button to begin the onboarding process..."
  );
  const [selectedVoice, setSelectedVoice] = useState("emma");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [effects, setEffects] = useState({
    zoomOnClick: true,
    cursorHighlight: true,
    smoothPan: true, // Enabled by default with zoom
  });
  const [steps, setSteps] = useState<TimelineStep[]>(mockSteps);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [history, setHistory] = useState<TimelineStep[][]>([mockSteps]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Advanced editing features
  const [colorGrading, setColorGrading] = useState({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    temperature: 0,
    vignette: 0,
  });
  const [textOverlays, setTextOverlays] = useState<Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
    startTime: number;
    endTime: number;
    animation: "fade" | "slide" | "typewriter";
  }>>([]);
  const [showColorGrading, setShowColorGrading] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const filterEngineRef = useRef<FilterEngine | null>(null);
  const transitionEngineRef = useRef<TransitionEngine | null>(null);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else {
      // Fallback for mock if needed, though mostly focused on video functionality
      setIsPlaying(!isPlaying);
    }
  };

  // Advanced easing functions for ultra-smooth animations
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  // Spring-like easing for natural motion
  const easeOutElastic = (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  };

  // Smooth ease-out for zoom out
  const easeOutExpo = (t: number): number => {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  };

  // Calculate optimal zoom level based on element size
  const calculateOptimalZoom = (
    elementSize: number | undefined,
    containerWidth: number,
    containerHeight: number,
    videoNaturalWidth: number,
    videoNaturalHeight: number
  ): number => {
    if (!elementSize) {
      // Default zoom for coordinate-based clicks
      return 2.5;
    }

    // Calculate how much of the screen the element occupies
    const elementAreaRatio = elementSize;

    // Target: zoom so element takes up ~40-60% of viewport
    const targetRatio = 0.5;

    // Calculate zoom needed to achieve target ratio
    // Smaller elements need more zoom, larger elements need less
    let zoomLevel = Math.sqrt(targetRatio / elementAreaRatio);

    // Clamp zoom between reasonable bounds
    zoomLevel = Math.max(1.5, Math.min(4.0, zoomLevel));

    return zoomLevel;
  };

  // --- GOD LEVEL REACTIVE CAMERA ENGINE (Spring-Based) ---
  const [videoDims, setVideoDims] = useState({ width: 1920, height: 1080 });
  const cameraStateRef = useRef(getInitialCameraState());

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);

      if (effects.zoomOnClick && videoContainerRef.current) {
        // Calculate the next camera state based on events and physics
        // Using a fixed dt for smoothness (approx 60fps)
        const newState = updateCameraSystem(
          cameraStateRef.current,
          time,
          0.016,
          clickData as ClickData[],
          moveData as MoveData[],
          {
            width: videoDims.width,
            height: videoDims.height
          }
        );
        cameraStateRef.current = newState;
        const newTransform = newState.transform;

        // Only update state if changed significantly to avoid re-renders
        const current = transform; // React state for rendering
        if (
          Math.abs(newTransform.scale - current.scale) > 0.001 ||
          Math.abs(newTransform.translateX - current.translateX) > 0.1 ||
          Math.abs(newTransform.translateY - current.translateY) > 0.1
        ) {
          setTransform(newTransform);
        }
      }
    }
  };


  const [videoAspect, setVideoAspect] = useState(16 / 9);

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoContainerRef.current) {
      setDuration(videoRef.current.duration);
      if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
        setVideoAspect(videoRef.current.videoWidth / videoRef.current.videoHeight);
        setVideoDims({
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        });
        
        // Initialize filter and transition engines
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          filterEngineRef.current = new FilterEngine(ctx, canvas.width, canvas.height);
          transitionEngineRef.current = new TransitionEngine(ctx, canvas.width, canvas.height);
        }
      }
      // Reset transform when video loads
      setTransform({ scale: 1, translateX: 0, translateY: 0 });
      lastTransformRef.current = { scale: 1, translateX: 0, translateY: 0 };
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    const error = video.error;
    if (error) {
      let errorMessage = "Unknown error";
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          errorMessage = "Video loading aborted";
          break;
        case error.MEDIA_ERR_NETWORK:
          errorMessage = "Network error while loading video";
          break;
        case error.MEDIA_ERR_DECODE:
          errorMessage = "Video decoding error";
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = "Video format not supported";
          break;
      }
      toast({
        title: "Video Error",
        description: errorMessage,
        variant: "destructive"
      });
      console.error("Video error:", error);
    }
  };

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Reset transform when video is paused or stopped
  useEffect(() => {
    if (!isPlaying) {
      // Smoothly reset when paused
      setTransform({ scale: 1, translateX: 0, translateY: 0 });
      lastTransformRef.current = { scale: 1, translateX: 0, translateY: 0 };
    }
  }, [isPlaying]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
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
    navigate("/render", {
      state: {
        videoUrl,
        clickData,
        moveData,
        colorGrading,
        textOverlays,
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
      startTime: currentTime,
      endTime: Math.min(currentTime + 3, duration),
      animation: "fade" as const,
    };
    setTextOverlays([...textOverlays, newOverlay]);
    setShowTextEditor(true);
  };
  
  const updateTextOverlay = (id: string, updates: Partial<typeof textOverlays[0]>) => {
    setTextOverlays(textOverlays.map(overlay => 
      overlay.id === id ? { ...overlay, ...updates } : overlay
    ));
  };
  
  const deleteTextOverlay = (id: string) => {
    setTextOverlays(textOverlays.filter(overlay => overlay.id !== id));
  };

  const updateStepDescription = (id: string, description: string) => {
    const newSteps = steps.map((s) => (s.id === id ? { ...s, description } : s));
    setSteps(newSteps);
    addToHistory(newSteps);
  };

  const addToHistory = (newSteps: TimelineStep[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSteps);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setSteps(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setSteps(history[historyIndex + 1]);
    }
  };

  const handleAddSegment = () => {
    const newStep: TimelineStep = {
      id: Date.now().toString(),
      type: "click",
      duration: 1.0,
      description: "New segment",
    };
    const newSteps = [...steps, newStep];
    setSteps(newSteps);
    addToHistory(newSteps);
  };

  const handleDeleteSegment = (id: string) => {
    const newSteps = steps.filter((s) => s.id !== id);
    setSteps(newSteps);
    addToHistory(newSteps);
  };

  const handleSplitSegment = (id: string) => {
    const index = steps.findIndex((s) => s.id === id);
    if (index !== -1) {
      const step = steps[index];
      const newStep1: TimelineStep = {
        ...step,
        id: `${step.id}-1`,
        duration: step.duration / 2,
      };
      const newStep2: TimelineStep = {
        ...step,
        id: `${step.id}-2`,
        duration: step.duration / 2,
      };
      const newSteps = [
        ...steps.slice(0, index),
        newStep1,
        newStep2,
        ...steps.slice(index + 1),
      ];
      setSteps(newSteps);
      addToHistory(newSteps);
    }
  };

  const handleResetTimeline = () => {
    setSteps(mockSteps);
    setHistory([mockSteps]);
    setHistoryIndex(0);
  };

  const typeIcons = {
    click: MousePointer2,
    scroll: Move,
    type: Sparkles,
  };


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
              <p className="text-sm text-muted-foreground">Edit your demo video</p>
            </div>
            <Button variant="hero" onClick={handleRender}>
              <Sparkles className="mr-2 h-4 w-4" />
              Render Video
            </Button>
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
                  className="relative aspect-video bg-gradient-subtle flex items-center justify-center overflow-hidden p-4 transition-all duration-300"
                >
                  {videoUrl ? (
                    <>
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] object-contain origin-center rounded-lg shadow-2xl border border-border/50 pointer-events-none"
                        style={{
                          transform: `scale(${transform.scale}) translate(${transform.translateX}px, ${transform.translateY}px)`,
                          transition: 'transform 0.08s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                          willChange: 'transform',
                          filter: showColorGrading ? `
                            brightness(${1 + colorGrading.brightness})
                            contrast(${1 + colorGrading.contrast})
                            saturate(${1 + colorGrading.saturation})
                            hue-rotate(${colorGrading.hue}deg)
                          ` : undefined,
                        }}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onError={handleVideoError}
                        preload="metadata"
                        playsInline
                        controls={false} // Custom controls below
                      />
                      
                      {/* Text Overlays */}
                      {textOverlays.map((overlay) => {
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

                      {/* God Level Visual Effects Layer */}
                      {(effects.cursorHighlight || effects.zoomOnClick) && (
                        <div 
                          className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] rounded-lg overflow-hidden pointer-events-none z-10"
                          style={{
                            transform: `scale(${transform.scale}) translate(${transform.translateX}px, ${transform.translateY}px)`,
                            transition: 'transform 0.08s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                            willChange: 'transform',
                            transformOrigin: 'center center',
                          }}
                        >
                          <CanvasOverlay
                            clickData={clickData as ClickData[]}
                            moveData={moveData as MoveData[]}
                            videoRef={videoRef}
                            width={videoDims.width}
                            height={videoDims.height}
                            isPlaying={isPlaying}
                          />
                        </div>
                      )}
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
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      className="absolute inset-0 z-10 w-full opacity-0 cursor-pointer"
                    />
                    <div className="absolute inset-0 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-gradient-hero transition-all duration-100 ease-linear"
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
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
                        {isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>

                      <span className="text-sm font-medium text-muted-foreground w-20">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-white/10"
                        onClick={toggleMute}
                      >
                        {isMuted || volume === 0 ? (
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
                          value={[isMuted ? 0 : volume]}
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
                        onCheckedChange={(checked) =>
                          setEffects({ ...effects, zoomOnClick: checked, smoothPan: checked })
                        }
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
                        onCheckedChange={(checked) =>
                          setEffects({ ...effects, cursorHighlight: checked })
                        }
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
                            <span className="text-sm text-muted-foreground">{colorGrading.brightness.toFixed(2)}</span>
                          </div>
                          <Slider
                            min={-1}
                            max={1}
                            step={0.1}
                            value={[colorGrading.brightness]}
                            onValueChange={([value]) => setColorGrading({ ...colorGrading, brightness: value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Contrast</Label>
                            <span className="text-sm text-muted-foreground">{colorGrading.contrast.toFixed(2)}</span>
                          </div>
                          <Slider
                            min={-1}
                            max={1}
                            step={0.1}
                            value={[colorGrading.contrast]}
                            onValueChange={([value]) => setColorGrading({ ...colorGrading, contrast: value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Saturation</Label>
                            <span className="text-sm text-muted-foreground">{colorGrading.saturation.toFixed(2)}</span>
                          </div>
                          <Slider
                            min={-1}
                            max={1}
                            step={0.1}
                            value={[colorGrading.saturation]}
                            onValueChange={([value]) => setColorGrading({ ...colorGrading, saturation: value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Hue</Label>
                            <span className="text-sm text-muted-foreground">{Math.round(colorGrading.hue)}°</span>
                          </div>
                          <Slider
                            min={-180}
                            max={180}
                            step={1}
                            value={[colorGrading.hue]}
                            onValueChange={([value]) => setColorGrading({ ...colorGrading, hue: value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Temperature</Label>
                            <span className="text-sm text-muted-foreground">{colorGrading.temperature.toFixed(2)}</span>
                          </div>
                          <Slider
                            min={-1}
                            max={1}
                            step={0.1}
                            value={[colorGrading.temperature]}
                            onValueChange={([value]) => setColorGrading({ ...colorGrading, temperature: value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Vignette</Label>
                            <span className="text-sm text-muted-foreground">{colorGrading.vignette.toFixed(2)}</span>
                          </div>
                          <Slider
                            min={0}
                            max={1}
                            step={0.1}
                            value={[colorGrading.vignette]}
                            onValueChange={([value]) => setColorGrading({ ...colorGrading, vignette: value })}
                          />
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setColorGrading({
                            brightness: 0,
                            contrast: 0,
                            saturation: 0,
                            hue: 0,
                            temperature: 0,
                            vignette: 0,
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
                        <Plus className="h-4 w-4 mr-2" />
                        Add Text
                      </Button>
                    </div>

                    {textOverlays.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
                        <Sparkles className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No text overlays yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Click "Add Text" to create one</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {textOverlays.map((overlay) => (
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
              </Tabs>
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-6 rounded-xl border border-border bg-card">
            {/* Timeline Controls */}
            <div className="flex items-center gap-2 border-b border-border bg-secondary/30 p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddSegment}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add a segment
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTimelineZoom(Math.max(0.5, timelineZoom - 0.1))}
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTimelineZoom(Math.min(2, timelineZoom + 0.1))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <div className="h-6 w-px bg-border" />
              <Button variant="ghost" size="icon" title="Split segment">
                <Scissors className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Delete segment">
                <Trash2 className="h-4 w-4" />
              </Button>
              <div className="h-6 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleUndo}
                disabled={historyIndex === 0}
                title="Undo"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRedo}
                disabled={historyIndex === history.length - 1}
                title="Redo"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetTimeline}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset timeline
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Minus className="h-4 w-4 text-muted-foreground" />
                <Slider
                  value={[timelineZoom]}
                  min={0.5}
                  max={2}
                  step={0.1}
                  onValueChange={(value) => setTimelineZoom(value[0])}
                  className="w-24"
                />
                <Plus className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Timeline Canvas */}
            <div className="relative p-6">
              <div className="relative h-32 rounded-lg border border-dashed border-border bg-secondary/20">
                {/* Trimming handles */}
                <div className="absolute left-0 top-0 h-full w-1 cursor-ew-resize bg-primary/50 hover:bg-primary">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 rounded bg-primary p-1">
                    <Scissors className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>
                <div className="absolute right-0 top-0 h-full w-1 cursor-ew-resize bg-primary/50 hover:bg-primary">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 rounded bg-primary p-1">
                    <Scissors className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>

                {/* Timeline segments visualization */}
                {steps.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <p className="text-sm">No segments yet. Click "Add a segment" to get started.</p>
                  </div>
                ) : (
                  <div className="flex h-full items-center gap-1 p-2">
                    {steps.map((step, index) => {
                      const totalDuration = Math.max(
                        steps.reduce((acc, s) => acc + s.duration, 0),
                        1
                      );
                      const width = Math.max((step.duration / totalDuration) * 100, 5);
                      const Icon = typeIcons[step.type];
                      return (
                        <div
                          key={step.id}
                          className="group relative flex h-full min-w-[40px] items-center justify-center rounded border border-border bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer"
                          style={{ width: `${width}%` }}
                          title={`${step.description} (${step.duration}s)`}
                        >
                          <Icon className="h-4 w-4 text-primary" />
                          <div className="absolute inset-x-0 top-0 h-1 bg-primary/30 rounded-t" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Steps List */}
              <div className="mt-4 space-y-2">
                {steps.map((step, index) => {
                  const Icon = typeIcons[step.type];
                  return (
                    <div
                      key={step.id}
                      className="group flex items-center gap-4 rounded-lg border border-border bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"
                    >
                      <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100" />
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                        <Icon className="h-4 w-4 text-accent" />
                      </div>
                      <input
                        type="text"
                        value={step.description}
                        onChange={(e) => updateStepDescription(step.id, e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleSplitSegment(step.id)}
                        title="Split segment"
                      >
                        <Scissors className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteSegment(step.id)}
                        title="Delete segment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {step.duration}s
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
