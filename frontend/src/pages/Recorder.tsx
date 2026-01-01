import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import {
  Circle,
  Square,
  Monitor,
  Video,
  CheckCircle2,
  AlertCircle,
  Pause,
  Sparkles,
  Settings,
  Mic,
  Keyboard,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Move,
  Lightbulb,
  TrendingUp,
  Info,
  X,
  Zap,
  Activity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { ParticleSystem } from "@/lib/effects/particles";

type RecordingState = "idle" | "selecting" | "ready" | "countdown" | "recording" | "paused" | "stopped";
type AudioSource = "system" | "microphone" | "both" | "none";
type RecordingQuality = "high" | "medium" | "low";

export interface ClickData {
  x: number;
  y: number;
  timestamp: number;
  screenWidth: number;
  screenHeight: number;
  type: "click" | "doubleClick" | "rightClick";
  elementInfo?: {
    tagName?: string;
    text?: string;
    className?: string;
    rect?: { // Normalized 0-1
      left: number;
      top: number;
      width: number;
      height: number;
    };
    semanticType?: "primary" | "secondary" | "danger" | "neutral";
  };
}

export interface MoveData {
  x: number;
  y: number;
  timestamp: number;
  screenWidth: number;
  screenHeight: number;
}

export interface ScrollData {
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  timestamp: number;
  screenWidth: number;
  screenHeight: number;
  type: "scroll" | "wheel";
}

export interface EffectEvent {
  type: string;
  timestamp: number;
  [key: string]: any;
}

interface RecordingMarker {
  timestamp: number;
  label: string;
}

// 🎯 PRODUCTION CONSTANTS - Centralized configuration for maintainability
const CAMERA_CONFIG = {
  // Zoom thresholds
  ZOOM_TARGET_CLICK: 1.3, // Base zoom (conservative) - can boost to 1.4 for small targets/slow cursor
  ZOOM_MAX: 2.0, // Cap at 2.0 for UI demos (ScreenStudio rarely exceeds ~1.8-2.0)
  ZOOM_MIN: 1.0,
  ZOOM_SUPPRESS_THRESHOLD: 1.25, // Don't zoom if already above this
  ZOOM_WELL_CENTERED_THRESHOLD: 1.1, // Don't zoom if below this and well-centered
  ZOOM_RAPID_CLICK_THRESHOLD: 1.15, // Suppress zoom for rapid clicks if above this

  // Zoom suppression distances (normalized 0-1)
  CENTER_DISTANCE_THRESHOLD: 0.3, // Within 30% of center = well-centered
  RAPID_CLICK_INTERVAL_MS: 300, // Rapid clicks within this time

  // Zoom state timing (ms)
  HOLD_DURATION_MS: 600, // Hold before zoom-out (ScreenStudio-style)
  INTENT_IDLE_MS: 1500, // Intent idle threshold
  CLICK_CLUSTER_MS: 3000, // Click cluster duration (3 seconds for 2+ clicks)
  CURSOR_LEAVE_FOCUS_MS: 400, // Cursor leave focus threshold
  CURSOR_LEAVE_DISTANCE: 0.45, // 45% viewport distance
  
  // Safe box for camera (center 40% - camera only moves when cursor leaves this area)
  SAFE_BOX_SIZE: 0.4, // 40% of viewport (center area)
  
  // Minimum clicks required for zoom
  MIN_CLICKS_FOR_ZOOM: 2,

  // Spring-damper physics
  ZOOM_STIFFNESS: 0.08, // Reduced for smoother zoom transitions
  ZOOM_DAMPING: 0.88, // Increased damping for calmer zoom
  CAMERA_STIFFNESS_MIN: 0.08, // Reduced for smoother camera movement
  CAMERA_STIFFNESS_MAX: 0.15, // Reduced for smoother camera movement
  CAMERA_DAMPING: 0.82, // Increased for calmer, less twitchy camera
  CURSOR_STIFFNESS: 0.35, // Higher = cursor leads camera
  CURSOR_DAMPING: 0.8,
  DISTANCE_STIFFNESS_THRESHOLD: 300, // px - reduced from 400 for snappier diagonal/top-to-bottom moves

  // Camera re-centering
  DECAY_BLEND_FACTOR: 0.1, // Re-center only 90% during zoom-out (less mechanical, more organic)

  // Edge behavior
  EDGE_PADDING: 50, // px - inner boundary for falloff

  // Probabilistic zoom suppression (ScreenStudio-style restraint)
  PROBABILISTIC_ZOOM_SUPPRESS_CHANCE: 0.25, // 25% chance to suppress zoom even if eligible

  // Animation
  TARGET_FPS: 60,
  FRAME_TIME_MS: 1000 / 60,
  DIMENSIONS_CACHE_MS: 500, // Cache dimensions for this duration

  // Position update thresholds
  ZOOM_UPDATE_THRESHOLD: 0.01,
  CAMERA_UPDATE_THRESHOLD: 0.5, // px
  CURSOR_UPDATE_THRESHOLD: 0.001, // normalized
  SPRING_SETTLE_THRESHOLD: 0.001,
} as const;

export default function Recorder() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | undefined>(undefined);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Recording settings
  const [countdownDuration, setCountdownDuration] = useState(5);
  const [audioSource, setAudioSource] = useState<AudioSource>("both");
  const [recordingQuality, setRecordingQuality] = useState<RecordingQuality>("high");
  const [rawRecording, setRawRecording] = useState(() => {
    const saved = localStorage.getItem("recorder_rawRecording");
    return saved !== null ? saved === "true" : false; // Default to false (canvas with effects)
  });
  const [containerPadding, setContainerPadding] = useState(() => {
    const saved = localStorage.getItem("recorder_containerPadding");
    return saved !== null ? parseInt(saved) : 40; // Default 40px padding
  });
  const [containerBackground, setContainerBackground] = useState(() => {
    const saved = localStorage.getItem("recorder_containerBackground");
    return saved !== null ? saved : "#f8f9fa"; // Default light gray background
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [markers, setMarkers] = useState<RecordingMarker[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [estimatedSize, setEstimatedSize] = useState(0);
  const [showSmartTips, setShowSmartTips] = useState(true);
  const [activeTip, setActiveTip] = useState<string | null>(null);
  const [interactionCount, setInteractionCount] = useState(0);
  const [avgClickInterval, setAvgClickInterval] = useState<number | null>(null);
  const [recordingQualityScore, setRecordingQualityScore] = useState<number>(100);

  // Visual effects settings
  const [cursorEffects, setCursorEffects] = useState(true);
  const [clickRipple, setClickRipple] = useState(true);
  const [cursorGlow, setCursorGlow] = useState(true);
  const [cursorTrail, setCursorTrail] = useState(false);
  const [showClickIndicator, setShowClickIndicator] = useState(true);

  // Zoom level (always 1.0 - zoom effects disabled)
  const [zoomLevel, setZoomLevel] = useState(1);
  const [currentCursorPos, setCurrentCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorIndicatorPos, setCursorIndicatorPos] = useState<{ x: number; y: number } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Zoom state machine: FOCUSED -> HOLD -> DECAY -> NEUTRAL
  type ZoomState = "FOCUSED" | "HOLD" | "DECAY" | "NEUTRAL";
  const [zoomState, setZoomState] = useState<ZoomState>("NEUTRAL");

  // Intent tracking refs
  const lastIntentTimeRef = useRef<number>(0);
  const lastClickClusterTimeRef = useRef<number>(0);
  const lastScrollTimeRef = useRef<number>(0);
  const focusPointRef = useRef<{ x: number; y: number } | null>(null);
  const cursorDwellStartRef = useRef<number | null>(null);
  const cursorDwellPositionRef = useRef<{ x: number; y: number } | null>(null);
  const zoomTargetRef = useRef<number>(1); // Target zoom level (for partial zoom-out)
  const holdStartTimeRef = useRef<number | null>(null);
  const cameraOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const neutralCameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isScrollingRef = useRef<boolean>(false);
  
  // Click cluster tracking for zoom detection (2+ clicks within 3 seconds)
  const clickClusterRef = useRef<Array<{ x: number; y: number; timestamp: number }>>([]);
  const lastZoomTimeRef = useRef<number>(0);
  const zoomDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Performance optimization refs for camera system
  const currentZoomRef = useRef<number>(1);
  const zoomStateRef = useRef<ZoomState>("NEUTRAL");
  const containerDimensionsRef = useRef<{ width: number; height: number } | null>(null);
  const videoDimensionsRef = useRef<{ width: number; height: number; aspect: number } | null>(null);
  const lastDimensionsUpdateRef = useRef<number>(0);
  const transformCacheRef = useRef<{ x: number; y: number; scale: number }>({ x: 0, y: 0, scale: 1 });
  const transitionStateRef = useRef<string | null>(null);

  // Spring-damper velocity tracking for smooth camera motion
  const cameraVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomVelocityRef = useRef<number>(0);

  // Cursor indicator smoothing refs (for cursor to lead camera)
  const cursorIndicatorSmoothPosRef = useRef<{ x: number; y: number } | null>(null);
  const cursorIndicatorVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Helper function: linear interpolation
  const lerp = (a: number, b: number, t: number): number => {
    return a + (b - a) * t;
  };

  // Helper function: clamp value between min and max
  const clamp = (value: number, min: number, max: number): number => {
    return Math.min(max, Math.max(min, value));
  };

  // Universal spring-damper smoothing function
  // Uses velocity + damping instead of basic easing for natural, responsive motion
  // 🛡️ PRODUCTION: Added validation and NaN protection
  const smoothSpring = (
    current: number,
    velocity: number,
    target: number,
    stiffness: number = 0.15,
    damping: number = 0.75
  ): { current: number; velocity: number } => {
    // Validate inputs to prevent NaN/Infinity
    if (!Number.isFinite(current) || !Number.isFinite(velocity) || !Number.isFinite(target)) {
      console.warn('smoothSpring: Invalid input detected', { current, velocity, target });
      return { current: Number.isFinite(current) ? current : target, velocity: 0 };
    }

    // Clamp stiffness and damping to valid ranges
    const safeStiffness = Math.max(0, Math.min(1, stiffness));
    const safeDamping = Math.max(0, Math.min(1, damping));

    const force = (target - current) * safeStiffness;
    const newVelocity = velocity * safeDamping + force;
    const newCurrent = current + newVelocity;

    // Validate output
    if (!Number.isFinite(newCurrent) || !Number.isFinite(newVelocity)) {
      console.warn('smoothSpring: Invalid output detected', { newCurrent, newVelocity });
      return { current: target, velocity: 0 };
    }

    return { current: newCurrent, velocity: newVelocity };
  };

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clicksRef = useRef<ClickData[]>([]);
  const movesRef = useRef<MoveData[]>([]);
  const scrollsRef = useRef<ScrollData[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const lastClickTimeRef = useRef<number>(0);
  const lastMoveTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Canvas recording refs - for recording the preview container
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const canvasAnimationFrameRef = useRef<number | null>(null);

  // Refs for canvas drawing to access current values
  const zoomLevelRef = useRef(zoomLevel);
  const currentCursorPosRef = useRef(currentCursorPos);
  const cursorIndicatorPosRef = useRef(cursorIndicatorPos);

  // Advanced particle system for cursor trails
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  const lastParticleUpdateRef = useRef<number>(0);
  const lastCursorPosForParticlesRef = useRef<{ x: number; y: number } | null>(null);
  const lastCursorMoveTimeRef = useRef<number>(0); // Track cursor movement timing for speed calculation
  const cursorSpeedRef = useRef<number>(0); // Normalized cursor speed (0-1)

  // Canvas performance optimization refs
  const canvasVideoDimensionsRef = useRef<{ width: number; height: number; aspect: number } | null>(null);
  const canvasGradientRef = useRef<CanvasGradient | null>(null);
  const lastCanvasResizeRef = useRef<number>(0);
  const canvasFrameTimeRef = useRef<number>(0);

  // Update refs when state changes
  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
    currentZoomRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    currentCursorPosRef.current = currentCursorPos;
  }, [currentCursorPos]);

  useEffect(() => {
    cursorIndicatorPosRef.current = cursorIndicatorPos;
  }, [cursorIndicatorPos]);

  useEffect(() => {
    zoomStateRef.current = zoomState;
  }, [zoomState]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (token) {
          const response = await fetch("http://localhost:8000/api/auth/profile/", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            setUser({ name: data.username, email: data.email });
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile", error);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === "recording") {
      interval = setInterval(() => {
        setTimer((t) => {
          const newTime = t + 1;
          // Estimate file size (rough calculation: ~1MB per minute for high quality)
          const sizeMultiplier = recordingQuality === "high" ? 1 : recordingQuality === "medium" ? 0.6 : 0.3;
          setEstimatedSize(Math.round(newTime * sizeMultiplier));

          // Calculate recording quality score based on interactions
          const clicksPerMinute = clicksRef.current.length / (newTime / 60);
          const movesPerMinute = movesRef.current.length / (newTime / 60);
          const hasMarkers = markers.length > 0;
          const hasGoodPacing = clicksPerMinute > 2 && clicksPerMinute < 15; // Good pacing
          const hasMovement = movesPerMinute > 30; // Active movement

          let score = 100;
          if (!hasGoodPacing) score -= 20;
          if (!hasMovement) score -= 15;
          if (!hasMarkers && newTime > 30) score -= 10; // Suggest markers for longer recordings
          if (micLevel < 5 && audioSource !== "none") score -= 10; // Low mic level

          setRecordingQualityScore(Math.max(0, Math.min(100, score)));

          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recordingState, recordingQuality, markers.length, micLevel, audioSource]);

  // Countdown Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === "countdown" && countdown !== null && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (recordingState === "countdown" && countdown === 0) {
      startRecordingActual();
    }
    return () => clearInterval(interval);
  }, [recordingState, countdown]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when recording
      if (recordingState !== "recording" && recordingState !== "paused") return;

      // Spacebar to pause/resume
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        if (recordingState === "recording") {
          handlePauseRecording();
        } else if (recordingState === "paused") {
          handleResumeRecording();
        }
      }

      // Escape to stop
      if (e.code === "Escape" && recordingState === "recording") {
        handleStopRecording();
      }

      // M key to add marker
      if (e.code === "KeyM" && recordingState === "recording" && e.target === document.body) {
        e.preventDefault();
        handleAddMarker();
      }

      // Follow cursor toggle removed
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [recordingState]);

  // Microphone level monitoring
  useEffect(() => {
    if (recordingState === "recording" && audioSource !== "system" && audioSource !== "none" && micStreamRef.current) {
      const updateMicLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setMicLevel(Math.min(100, (average / 255) * 100));
        }
        animationFrameRef.current = requestAnimationFrame(updateMicLevel);
      };
      updateMicLevel();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [recordingState, audioSource]);

  // Update video preview
  useEffect(() => {
    if (mediaStreamRef.current && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = mediaStreamRef.current;
    }
  }, [mediaStreamRef.current]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSelectScreen = async () => {
    try {
      // Request screen share with audio based on settings
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: recordingQuality === "high" ? 1920 : recordingQuality === "medium" ? 1280 : 854 },
          height: { ideal: recordingQuality === "high" ? 1080 : recordingQuality === "medium" ? 720 : 480 },
          frameRate: { ideal: recordingQuality === "high" ? 30 : recordingQuality === "medium" ? 24 : 15 },
        },
        audio: audioSource === "system" || audioSource === "both"
      });

      mediaStreamRef.current = displayStream;

      // Handle microphone if needed
      if (audioSource === "microphone" || audioSource === "both") {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = micStream;

          // Set up audio analysis for mic level
          audioContextRef.current = new AudioContext();
          const source = audioContextRef.current.createMediaStreamSource(micStream);
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          source.connect(analyserRef.current);

          // Add microphone tracks to display stream
          micStream.getAudioTracks().forEach(track => {
            displayStream.addTrack(track);
          });
        } catch (micError) {
          console.error("Microphone access denied:", micError);
          toast({
            title: "Microphone access denied",
            description: "Recording will continue without microphone audio.",
            variant: "destructive"
          });
        }
      }

      setRecordingState("selecting");

      // Handle stream ending (e.g. user clicks "Stop sharing" in browser UI)
      displayStream.getVideoTracks()[0].onended = () => {
        handleStopRecording();
      };

    } catch (err) {
      console.error("Error selecting screen:", err);
      toast({
        title: "Permission denied",
        description: "Could not access screen recording. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Setup canvas for recording the preview container (sync version)
  // Setup raw recording with container (padding + background)
  const setupRawRecordingWithContainer = useCallback((): MediaStream | null => {
    if (!videoPreviewRef.current || !mediaStreamRef.current) {
      return null;
    }

    const video = videoPreviewRef.current;
    
    // Wait for video metadata
    if (video.readyState < 2) {
      console.warn("Video metadata not ready for raw recording");
      return null;
    }

    // Get video dimensions
    const videoWidth = video.videoWidth || 1920;
    const videoHeight = video.videoHeight || 1080;
    
    // Calculate canvas size with padding
    const padding = containerPadding;
    const canvasWidth = videoWidth + (padding * 2);
    const canvasHeight = videoHeight + (padding * 2);

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvasRef.current = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    console.log(`Raw recording container: ${canvasWidth}x${canvasHeight} (video: ${videoWidth}x${videoHeight}, padding: ${padding}px)`);

    // Start drawing loop
    const drawFrame = (timestamp: number) => {
      if (!ctx || !video || recordingState !== "recording") {
        if (canvasAnimationFrameRef.current) {
          cancelAnimationFrame(canvasAnimationFrameRef.current);
          canvasAnimationFrameRef.current = null;
        }
        return;
      }

      // Throttle to 30fps
      const deltaTime = timestamp - canvasFrameTimeRef.current;
      const targetFrameTime = 1000 / 30;
      if (deltaTime < targetFrameTime) {
        canvasAnimationFrameRef.current = requestAnimationFrame(drawFrame);
        return;
      }
      canvasFrameTimeRef.current = timestamp;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background
      ctx.fillStyle = containerBackground;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw video centered with padding
      ctx.drawImage(video, padding, padding, videoWidth, videoHeight);

      canvasAnimationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    // Start drawing loop
    canvasAnimationFrameRef.current = requestAnimationFrame(drawFrame);

    // Capture canvas stream
    const stream = canvas.captureStream(30);
    canvasStreamRef.current = stream;

    return stream;
  }, [containerPadding, containerBackground, recordingState]);

  const setupCanvasRecordingSync = useCallback(() => {
    if (!previewContainerRef.current || !videoPreviewRef.current || !mediaStreamRef.current) {
      return null;
    }

    const container = previewContainerRef.current;
    const video = videoPreviewRef.current;

    // Wait for video metadata to get actual resolution
    if (video.readyState < 2) {
      console.warn("Video metadata not ready, using container dimensions as fallback");
    }

    // Use ACTUAL video resolution for high quality recording (not container size)
    // This ensures the canvas matches the screen recording size exactly
    const videoWidth = video.videoWidth || 1920; // Fallback to 1920p
    const videoHeight = video.videoHeight || 1080; // Fallback to 1080p

    // Create canvas with actual video resolution for best quality
    // No padding - canvas matches video size exactly
    const canvas = document.createElement('canvas');
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    canvasRef.current = canvas;

    console.log(`Canvas created with video resolution: ${videoWidth}x${videoHeight} (actual video: ${video.videoWidth}x${video.videoHeight}) - No padding, full frame recording`);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Initialize particle system if cursor trail is enabled
    if (cursorTrail && !particleSystemRef.current) {
      particleSystemRef.current = new ParticleSystem({
        particleCount: 100,
        particleLifetime: 1.2,
        particleSize: { min: 2, max: 5 },
        velocity: { min: 30, max: 100 },
        colors: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'],
        gravity: 0.2,
        friction: 0.97,
        trailLength: 15,
        spawnRate: 0.03,
      });
    }

    // Start capturing the preview container to canvas (OPTIMIZED)
    const drawFrame = (timestamp: number) => {
      // Check if we should continue drawing (recording state will be set before MediaRecorder starts)
      // Use a ref to track if we should continue drawing
      if (!ctx || !video || !container) {
        // Stop the loop if essential elements are missing
        if (canvasAnimationFrameRef.current) {
          cancelAnimationFrame(canvasAnimationFrameRef.current);
          canvasAnimationFrameRef.current = null;
        }
        return;
      }

      // Check recording state - but allow drawing during countdown/ready states too
      // The actual recording state check happens in startRecordingActual
      const shouldDraw = recordingState === "recording" || recordingState === "countdown" || recordingState === "ready";
      if (!shouldDraw) {
        // Stop the loop if not in a recording-related state
        if (canvasAnimationFrameRef.current) {
          cancelAnimationFrame(canvasAnimationFrameRef.current);
          canvasAnimationFrameRef.current = null;
        }
        return;
      }

      // Throttle canvas updates for better performance (target 30fps for canvas)
      const deltaTime = timestamp - canvasFrameTimeRef.current;
      const targetFrameTime = 1000 / 30; // 30fps for canvas recording
      if (deltaTime < targetFrameTime) {
        canvasAnimationFrameRef.current = requestAnimationFrame(drawFrame);
        return;
      }
      canvasFrameTimeRef.current = timestamp;

      // Canvas size should match video resolution exactly (not container size)
      // Only resize if video resolution changed
      const videoWidth = video.videoWidth || canvas.width;
      const videoHeight = video.videoHeight || canvas.height;
      const needsResize = canvas.width !== videoWidth || canvas.height !== videoHeight;

      if (needsResize && videoWidth > 0 && videoHeight > 0) {
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        lastCanvasResizeRef.current = Date.now();
        console.log(`Canvas resized to match video: ${videoWidth}x${videoHeight} - Full frame, no gaps`);
      }

      // Ensure video has valid dimensions
      if (!video.videoWidth || !video.videoHeight || video.videoWidth === 0 || video.videoHeight === 0) {
        // Video not ready yet, skip this frame
        canvasAnimationFrameRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      // Clear canvas with black background (minimal padding approach)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw video at full size - use actual video dimensions directly
      // Canvas should match video resolution, so draw video at full canvas size
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Cursor indicator removed - camera following disabled
      if (false && currentCursorPosRef.current && (recordingState === "recording" || recordingState === "countdown")) {
        // Convert normalized window coordinates to canvas coordinates
        const cursorX = currentCursorPosRef.current.x * canvas.width;
        const cursorY = currentCursorPosRef.current.y * canvas.height;

        // Draw cursor indicator
        ctx.save();
        ctx.translate(cursorX, cursorY);

        // Outer ring
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner dot
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6';
        ctx.fill();

        // Crosshair
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-32, 0);
        ctx.lineTo(32, 0);
        ctx.moveTo(0, -32);
        ctx.lineTo(0, 32);
        ctx.stroke();

        ctx.restore();
      }

      // Draw click ripples with enhanced effects (optimized - only draw visible ripples)
      const currentTime = (Date.now() - recordingStartTimeRef.current) / 1000;
      const maxRadius = Math.min(canvas.width, canvas.height) * 0.08;
      const RIPPLE_DELAY = 0.075; // 75ms delay - let zoom initiate first

      // Filter clicks to only those that are visible (performance optimization)
      const visibleClicks = clicksRef.current.filter((click) => {
        const timeSince = currentTime - click.timestamp;
        return timeSince >= RIPPLE_DELAY && timeSince < 0.8 + RIPPLE_DELAY;
      });

      visibleClicks.forEach((click) => {
        const timeSince = currentTime - click.timestamp;
        // Delay ripple start by 75ms to prevent sensory overload
        const adjustedTime = Math.max(0, timeSince - RIPPLE_DELAY);
        const progress = Math.min(1, adjustedTime / 0.6);
        const currentRadius = maxRadius * (0.2 + 0.8 * progress);
        const opacity = 1 - Math.pow(progress, 3);

        // Skip drawing if opacity is too low (performance optimization)
        if (opacity < 0.01) return;

        const clickX = click.x * canvas.width;
        const clickY = click.y * canvas.height;

        ctx.save();
        ctx.globalAlpha = opacity;

        // Determine color based on click type
        const isRightClick = click.type === "rightClick";
        const color = isRightClick ? "239, 68, 68" : "59, 130, 246";

        // Optimized ripple drawing - batch similar operations
        const colorRgba = `rgba(${color}, `;

        // Enhanced ripple with multiple rings (optimized)
        for (let ring = 0; ring < 3; ring++) {
          const ringProgress = progress + (ring * 0.2);
          if (ringProgress > 1) continue;
          const ringRadius = currentRadius * (1 + ring * 0.3);
          const ringOpacity = opacity * (1 - ring * 0.3);

          ctx.beginPath();
          ctx.arc(clickX, clickY, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `${colorRgba}${ringOpacity * 0.6})`;
          ctx.lineWidth = 2 - ring * 0.5;
          ctx.stroke();
        }

        // Outer ring
        ctx.beginPath();
        ctx.arc(clickX, clickY, currentRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `${colorRgba}${opacity})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = `${colorRgba}${opacity * 0.3})`;
        ctx.fill();

        // Inner ring with glow
        ctx.beginPath();
        ctx.arc(clickX, clickY, currentRadius * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = `${colorRgba}${opacity * 0.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(clickX, clickY, 3, 0, Math.PI * 2);
        ctx.fillStyle = `${colorRgba}${opacity})`;
        ctx.fill();

        ctx.restore();
      });

      // Draw particle trail if enabled
      if (cursorTrail && particleSystemRef.current && currentCursorPosRef.current) {
        const now = Date.now();
        const deltaTime = now - lastParticleUpdateRef.current;
        lastParticleUpdateRef.current = now;

        const cursorX = currentCursorPosRef.current.x;
        const cursorY = currentCursorPosRef.current.y;

        // Calculate velocity for particles
        let velocityX = 0;
        let velocityY = 0;
        if (lastCursorPosForParticlesRef.current) {
          const dx = cursorX - lastCursorPosForParticlesRef.current.x;
          const dy = cursorY - lastCursorPosForParticlesRef.current.y;
          const dt = deltaTime / 1000;
          if (dt > 0) {
            velocityX = dx / dt;
            velocityY = dy / dt;
          }
        }

        // Spawn particles at cursor position
        particleSystemRef.current.spawn(cursorX, cursorY, velocityX * 0.1, velocityY * 0.1);

        // Update and draw particles
        particleSystemRef.current.update(deltaTime);
        particleSystemRef.current.draw(ctx, canvas.width, canvas.height);

        lastCursorPosForParticlesRef.current = { x: cursorX, y: cursorY };
      }

      canvasAnimationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    // Get stream from canvas FIRST (before starting draw loop)
    // This ensures the stream is ready to receive frames
    // Use higher FPS for better quality recording
    const fps = recordingQuality === "high" ? 60 : recordingQuality === "medium" ? 30 : 24;
    const stream = canvas.captureStream(fps);
    canvasStreamRef.current = stream;

    // Verify stream has tracks
    if (stream.getVideoTracks().length === 0) {
      console.error("Canvas stream has no video tracks");
      return null;
    }

    // Start drawing loop AFTER stream is created
    // This ensures frames are immediately available to the stream
    // Use requestAnimationFrame to start the loop
    canvasAnimationFrameRef.current = requestAnimationFrame(drawFrame);

    console.log("Canvas recording setup complete:", {
      canvasSize: `${canvas.width}x${canvas.height}`,
      videoSize: `${video.videoWidth}x${video.videoHeight}`,
      streamTracks: stream.getVideoTracks().length,
      fps: fps,
      quality: recordingQuality
    });

    return stream;
  }, [recordingState, zoomLevel, currentCursorPos, cursorIndicatorPos, recordingQuality]);

  // Setup canvas for recording the preview container (async wrapper)
  const setupCanvasRecording = useCallback(() => {
    if (!previewContainerRef.current || !videoPreviewRef.current || !mediaStreamRef.current) {
      return null;
    }

    const container = previewContainerRef.current;
    const video = videoPreviewRef.current;

    // Ensure video is ready
    if (video.readyState < 2) {
      // Video metadata not loaded yet, wait for it
      return new Promise<MediaStream | null>((resolve) => {
        const onLoadedMetadata = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          const stream = setupCanvasRecordingSync();
          resolve(stream);
        };
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        // Timeout after 5 seconds
        setTimeout(() => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          console.error('Video metadata loading timeout');
          resolve(null);
        }, 5000);
      });
    }

    return setupCanvasRecordingSync();
  }, [setupCanvasRecordingSync, cursorTrail]);

  const handleConfirmHide = () => {
    setRecordingState("ready");
  };

  const handleStartCountdown = () => {
    if (!mediaStreamRef.current) return;
    setCountdown(countdownDuration);
    setRecordingState("countdown");
  };

  const handleAddMarker = () => {
    const timestamp = timer;
    const newMarker: RecordingMarker = {
      timestamp,
      label: `Marker ${markers.length + 1}`,
    };
    setMarkers([...markers, newMarker]);
    toast({
      title: "Marker added",
      description: `Marked at ${formatTime(timestamp)}`,
    });
  };

  // 🎯 Click cluster detection: Detects 2+ clicks within 3 seconds
  // Returns cluster center and whether zoom should trigger
  const detectClickCluster = useCallback((newClick: { x: number; y: number; timestamp: number }) => {
    const now = Date.now();
    const CLUSTER_WINDOW_MS = CAMERA_CONFIG.CLICK_CLUSTER_MS;
    
    // Add new click to cluster
    clickClusterRef.current.push(newClick);
    
    // Remove clicks older than cluster window
    clickClusterRef.current = clickClusterRef.current.filter(
      click => (now - click.timestamp) <= CLUSTER_WINDOW_MS
    );
    
    // Check if we have enough clicks for zoom
    if (clickClusterRef.current.length >= CAMERA_CONFIG.MIN_CLICKS_FOR_ZOOM) {
      // Calculate cluster center (average position)
      const centerX = clickClusterRef.current.reduce((sum, c) => sum + c.x, 0) / clickClusterRef.current.length;
      const centerY = clickClusterRef.current.reduce((sum, c) => sum + c.y, 0) / clickClusterRef.current.length;
      
      // Calculate cluster radius (max distance from center)
      let maxDistance = 0;
      for (const click of clickClusterRef.current) {
        const dx = click.x - centerX;
        const dy = click.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        maxDistance = Math.max(maxDistance, distance);
      }
      
      return {
        shouldZoom: true,
        center: { x: centerX, y: centerY },
        radius: maxDistance,
        clickCount: clickClusterRef.current.length
      };
    }
    
    return {
      shouldZoom: false,
      center: null,
      radius: 0,
      clickCount: clickClusterRef.current.length
    };
  }, []);

  // Get element information for visual highlights
  const getElementInfo = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target) return undefined;

    try {
      const rect = target.getBoundingClientRect();
      const clientWidth = window.innerWidth;
      const clientHeight = window.innerHeight;

      // Determine semantic type based on text content and element attributes
      const text = target.textContent?.toLowerCase() || "";
      const primaryKeywords = ["submit", "save", "create", "confirm", "login", "sign up", "continue", "next", "send"];
      const dangerKeywords = ["delete", "remove", "cancel", "destroy", "stop"];

      let semanticType: "primary" | "secondary" | "danger" | "neutral" = "neutral";
      if (primaryKeywords.some(k => text.includes(k))) semanticType = "primary";
      else if (dangerKeywords.some(k => text.includes(k))) semanticType = "danger";
      else if (target.tagName === "BUTTON" || target.tagName === "A" || target.getAttribute("role") === "button") semanticType = "secondary";

      // Safe processing of className which can be non-string for SVG elements
      const safeClassName = typeof target.className === 'string'
        ? target.className.slice(0, 50)
        : (target.getAttribute('class') || '').slice(0, 50);

      return {
        tagName: target.tagName.toLowerCase(),
        text: target.textContent?.slice(0, 50) || undefined,
        className: safeClassName || undefined,
        rect: {
          left: rect.left / clientWidth,
          top: rect.top / clientHeight,
          width: rect.width / clientWidth,
          height: rect.height / clientHeight
        },
        semanticType
      };
    } catch (e) {
      return undefined;
    }
  };

  // Pointer down handler - captures intentional clicks
  const handlePointerDown = useCallback((event: PointerEvent) => {
    if (recordingState !== "recording") return;

    // Filter validation: Primary button only, Mouse only
    if (event.button !== 0 || event.pointerType !== "mouse") return;

    // Hard debounce (180ms)
    const now = Date.now();
    if (now - lastClickTimeRef.current < 180) return;

    // Track interaction for smart insights
    setInteractionCount((prev) => prev + 1);
    if (lastClickTimeRef.current > 0) {
      const interval = now - lastClickTimeRef.current;
      setAvgClickInterval((prev) => prev === null ? interval : (prev + interval) / 2);
    }

    lastClickTimeRef.current = now;

    // Normalize coordinates relative to client viewport (video bounding box)
    const clientWidth = window.innerWidth;
    const clientHeight = window.innerHeight;

    const normalizedX = Math.max(0, Math.min(1, event.clientX / clientWidth));
    const normalizedY = Math.max(0, Math.min(1, event.clientY / clientHeight));

    const timestamp = (now - recordingStartTimeRef.current) / 1000;
    const elementInfo = getElementInfo(event);

    clicksRef.current.push({
      x: normalizedX,
      y: normalizedY,
      timestamp,
      screenWidth: clientWidth,
      screenHeight: clientHeight,
      type: "click",
      elementInfo,
    });

    // Update intent tracking (camera following disabled)
    lastIntentTimeRef.current = now;
    lastClickClusterTimeRef.current = now;
    focusPointRef.current = { x: normalizedX, y: normalizedY };
  }, [recordingState, zoomState]);

  // Pointer move handler - captures cursor movement
  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (recordingState !== "recording") return;

    // Throttling to ~30fps (33ms)
    const now = Date.now();
    if (now - lastMoveTimeRef.current < 33) return;
    lastMoveTimeRef.current = now;

    const clientWidth = window.innerWidth;
    const clientHeight = window.innerHeight;

    const normalizedX = Math.max(0, Math.min(1, event.clientX / clientWidth));
    const normalizedY = Math.max(0, Math.min(1, event.clientY / clientHeight));

    // [POLISH] Micro Jitter Removal
    // Ignore updates if cursor moved less than 0.5% of viewport
    let shouldRecord = true;
    if (movesRef.current.length > 0) {
      const lastMove = movesRef.current[movesRef.current.length - 1];
      const dist = Math.sqrt(
        Math.pow(normalizedX - lastMove.x, 2) +
        Math.pow(normalizedY - lastMove.y, 2)
      );
      if (dist < 0.005) { // 0.5% threshold
        shouldRecord = false;
      }
    }

    if (shouldRecord) {
      movesRef.current.push({
        x: normalizedX,
        y: normalizedY,
        timestamp: (now - recordingStartTimeRef.current) / 1000,
        screenWidth: clientWidth,
        screenHeight: clientHeight,
      });
    }

    // Update current cursor position for preview following
    setCurrentCursorPos({ x: normalizedX, y: normalizedY });

    // Track cursor speed for conditional zoom boost
    const nowForSpeed = Date.now();
    if (lastCursorPosForParticlesRef.current && lastCursorMoveTimeRef.current > 0) {
      const dt = Math.max(1, nowForSpeed - lastCursorMoveTimeRef.current) / 1000; // seconds
      const dx = normalizedX - lastCursorPosForParticlesRef.current.x;
      const dy = normalizedY - lastCursorPosForParticlesRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = distance / dt; // normalized units per second
      // Normalize speed (assuming max ~10 units/sec for typical mouse movement)
      cursorSpeedRef.current = Math.min(1, speed / 10);
    }
    lastCursorMoveTimeRef.current = nowForSpeed;

    // Intent tracking: Detect focused movement and cursor dwell (camera following disabled)
    {
      const currentPos = { x: normalizedX, y: normalizedY };

      // Check if cursor is moving (focused movement)
      const movementThreshold = 0.01; // 1% of viewport
      if (cursorDwellPositionRef.current) {
        const dx = Math.abs(currentPos.x - cursorDwellPositionRef.current.x);
        const dy = Math.abs(currentPos.y - cursorDwellPositionRef.current.y);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > movementThreshold) {
          // Cursor is moving - this is focused movement (intent active)
          lastIntentTimeRef.current = now;
          cursorDwellStartRef.current = null;
          cursorDwellPositionRef.current = currentPos;
        } else {
          // Cursor is dwelling (staying in place - could be reading)
          // Don't reset intent immediately, but track dwell start
          if (cursorDwellStartRef.current === null) {
            cursorDwellStartRef.current = now;
          }
          cursorDwellPositionRef.current = currentPos;
          // Note: Dwell doesn't reset intent - reading is valid intent
        }
      } else {
        // First position - initialize
        cursorDwellStartRef.current = now;
        cursorDwellPositionRef.current = currentPos;
        lastIntentTimeRef.current = now; // Initial position is intent
      }
    }
  }, [recordingState, zoomState]);

  // Set up pointer tracking
  useEffect(() => {
    if (recordingState === "recording") {
      // Track cursor movement
      window.addEventListener("pointerdown", handlePointerDown, true);
      window.addEventListener("pointermove", handlePointerMove, true);

      // Also track mouse movement (fallback)
      const handleMouseMove = (event: MouseEvent) => {
        if (recordingState !== "recording") return;

        const clientWidth = window.innerWidth;
        const clientHeight = window.innerHeight;
        const normalizedX = Math.max(0, Math.min(1, event.clientX / clientWidth));
        const normalizedY = Math.max(0, Math.min(1, event.clientY / clientHeight));

        // Update current cursor position even if not recording move data
        setCurrentCursorPos({ x: normalizedX, y: normalizedY });
      };

      window.addEventListener("mousemove", handleMouseMove, true);

      // 🧠 Scroll detection - hard intent reset + event tracking
      let scrollTimeout: NodeJS.Timeout | null = null;
      const handleScroll = (event?: Event) => {
        if (!rawRecording) return;

        const now = Date.now();
        const timestamp = (now - recordingStartTimeRef.current) / 1000;
        lastScrollTimeRef.current = now;
        isScrollingRef.current = true;

        // Track scroll event
        if (recordingState === "recording") {
          const clientWidth = window.innerWidth;
          const clientHeight = window.innerHeight;
          
          // Get scroll position
          const scrollX = window.scrollX || window.pageXOffset || 0;
          const scrollY = window.scrollY || window.pageYOffset || 0;
          
          // Normalize scroll position (0-1)
          const normalizedX = Math.max(0, Math.min(1, scrollX / Math.max(1, document.documentElement.scrollWidth - clientWidth)));
          const normalizedY = Math.max(0, Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - clientHeight)));
          
          // Get delta for wheel events
          let deltaX = 0;
          let deltaY = 0;
          let scrollType: "scroll" | "wheel" = "scroll";
          
          if (event && event instanceof WheelEvent) {
            deltaX = event.deltaX;
            deltaY = event.deltaY;
            scrollType = "wheel";
          }
          
          scrollsRef.current.push({
            x: normalizedX,
            y: normalizedY,
            deltaX,
            deltaY,
            timestamp,
            screenWidth: clientWidth,
            screenHeight: clientHeight,
            type: scrollType,
          });
        }

        // Clear scroll timeout
        if (scrollTimeout) clearTimeout(scrollTimeout);

        // Mark scroll as settled after 400ms
        scrollTimeout = setTimeout(() => {
          isScrollingRef.current = false;
        }, 400);
      };

      window.addEventListener("scroll", handleScroll, true);
      // Wheel events are still tracked for recording, but don't trigger zoom effects
      window.addEventListener("wheel", handleScroll, { passive: true });

      // Periodic cursor position update to ensure we always have a position
      const cursorUpdateInterval = setInterval(() => {
        if (recordingState === "recording" && !currentCursorPos) {
          // Try to get last known position from moves array
          if (movesRef.current.length > 0) {
            const lastMove = movesRef.current[movesRef.current.length - 1];
            setCurrentCursorPos({ x: lastMove.x, y: lastMove.y });
          }
        }
      }, 500); // Check every 500ms

      return () => {
        window.removeEventListener("pointerdown", handlePointerDown, true);
        window.removeEventListener("pointermove", handlePointerMove, true);
        window.removeEventListener("mousemove", handleMouseMove, true);
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("wheel", handleScroll);
        if (scrollTimeout) clearTimeout(scrollTimeout);
        clearInterval(cursorUpdateInterval);
      };
    }
  }, [recordingState, handlePointerDown, handlePointerMove, currentCursorPos, zoomState, zoomLevel]);

  // Zoom state machine removed - zoom effects disabled

  // Track cursor position - camera following disabled, cursor indicator removed
  useEffect(() => {
    if (recordingState !== "recording" || !previewContainerRef.current || !currentCursorPos) {
      setCursorIndicatorPos(null);
      cursorIndicatorSmoothPosRef.current = null;
      cursorIndicatorVelocityRef.current = { x: 0, y: 0 };
      return;
    }
  }, [recordingState, currentCursorPos]);

  // Camera following disabled - keep camera centered
  useEffect(() => {
    if (recordingState !== "recording" || !previewContainerRef.current) {
      // Reset transform to center (no panning, zoom always 1.0)
      if (videoPreviewRef.current) {
        videoPreviewRef.current.style.transform = `translate3d(0px, 0px, 0) scale3d(1, 1, 1)`;
        videoPreviewRef.current.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
        videoPreviewRef.current.style.willChange = "auto";
      }
      // Ensure zoom level stays at 1.0
      if (zoomLevel !== 1) {
        setZoomLevel(1);
      }
      containerDimensionsRef.current = null;
      videoDimensionsRef.current = null;
      transformCacheRef.current = { x: 0, y: 0, scale: 1 };
      cameraVelocityRef.current = { x: 0, y: 0 };
      return;
    }

    const container = previewContainerRef.current;
    const video = videoPreviewRef.current;
    if (!container || !video) return;

    // Enable GPU acceleration
    video.style.willChange = "transform";
    video.style.backfaceVisibility = "hidden";
    video.style.perspective = "1000px";

    let animationFrameId: number | null = null;
    let lastUpdateTime = 0;
    const TARGET_FPS = CAMERA_CONFIG.TARGET_FPS;
    const FRAME_TIME = CAMERA_CONFIG.FRAME_TIME_MS;

    // 🛡️ PRODUCTION: Track if component is mounted to prevent state updates after unmount
    let isMounted = true;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    // Cache container dimensions (only update every configured duration or on resize)
    const updateContainerDimensions = () => {
      try {
        const now = Date.now();
        if (!containerDimensionsRef.current ||
          now - lastDimensionsUpdateRef.current > CAMERA_CONFIG.DIMENSIONS_CACHE_MS) {
          const rect = container.getBoundingClientRect();
          if (rect && Number.isFinite(rect.width) && Number.isFinite(rect.height) &&
            rect.width > 0 && rect.height > 0) {
            containerDimensionsRef.current = {
              width: rect.width,
              height: rect.height
            };
            lastDimensionsUpdateRef.current = now;
          }
        }
        return containerDimensionsRef.current;
      } catch (error) {
        console.error('updateContainerDimensions: Error', error);
        return containerDimensionsRef.current;
      }
    };

    // Cache video dimensions (only update when video size changes)
    const updateVideoDimensions = () => {
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      if (!videoDimensionsRef.current ||
        videoDimensionsRef.current.width !== videoWidth ||
        videoDimensionsRef.current.height !== videoHeight) {
        const videoAspect = videoWidth / videoHeight || 16 / 9;
        const containerDims = updateContainerDimensions();
        const containerAspect = containerDims.width / containerDims.height;

        let videoDisplayWidth: number;
        let videoDisplayHeight: number;

        if (videoAspect > containerAspect) {
          videoDisplayWidth = containerDims.width;
          videoDisplayHeight = containerDims.width / videoAspect;
        } else {
          videoDisplayHeight = containerDims.height;
          videoDisplayWidth = containerDims.height * videoAspect;
        }

        videoDimensionsRef.current = {
          width: videoDisplayWidth,
          height: videoDisplayHeight,
          aspect: videoAspect
        };
      }
      return videoDimensionsRef.current;
    };

    const updateFollow = (timestamp: number) => {
      // 🛡️ PRODUCTION: Safety check - don't update if unmounted
      if (!isMounted) {
        return;
      }

      try {
        // Optimized frame throttling
        const deltaTime = timestamp - lastUpdateTime;
        if (!Number.isFinite(deltaTime) || deltaTime < FRAME_TIME) {
          animationFrameId = requestAnimationFrame(updateFollow);
          return;
        }
        lastUpdateTime = timestamp;

        // Camera following disabled - keep camera centered
        // Early exit if not recording
        if (recordingState !== "recording") {
          animationFrameId = requestAnimationFrame(updateFollow);
          return;
        }

        // 🛡️ PRODUCTION: Validate cursor position
        const cursorPos = currentCursorPosRef.current;
        if (!cursorPos ||
          !Number.isFinite(cursorPos.x) ||
          !Number.isFinite(cursorPos.y) ||
          cursorPos.x < 0 || cursorPos.x > 1 ||
          cursorPos.y < 0 || cursorPos.y > 1) {
          animationFrameId = requestAnimationFrame(updateFollow);
          return;
        }

        // Use cached dimensions
        const containerDims = updateContainerDimensions();
        const videoDims = updateVideoDimensions();

        // 🛡️ PRODUCTION: Validate dimensions
        if (!containerDims || !videoDims ||
          !Number.isFinite(containerDims.width) ||
          !Number.isFinite(containerDims.height) ||
          !Number.isFinite(videoDims.width) ||
          !Number.isFinite(videoDims.height) ||
          containerDims.width <= 0 || containerDims.height <= 0 ||
          videoDims.width <= 0 || videoDims.height <= 0) {
          animationFrameId = requestAnimationFrame(updateFollow);
          return;
        }

        const containerWidth = containerDims.width;
        const containerHeight = containerDims.height;
        const videoDisplayWidth = videoDims.width;
        const videoDisplayHeight = videoDims.height;

        // Zoom effects disabled - always use 1.0 zoom
        const effectiveZoom = 1.0;
        const scaledWidth = videoDisplayWidth * effectiveZoom;
        const scaledHeight = videoDisplayHeight * effectiveZoom;

        // 🛡️ PRODUCTION: Validate scaled dimensions
        if (!Number.isFinite(scaledWidth) || !Number.isFinite(scaledHeight) ||
          scaledWidth <= 0 || scaledHeight <= 0) {
          animationFrameId = requestAnimationFrame(updateFollow);
          return;
        }

        // Camera following disabled - keep camera centered (no panning)
        const targetOffsetX = 0;
        const targetOffsetY = 0;
        const clampedOffsetX = 0;
        const clampedOffsetY = 0;
        
        // Reset camera velocity since we're not moving
        cameraVelocityRef.current = { x: 0, y: 0 };

        // Only update transform if it changed significantly (reduce DOM writes)
        const cache = transformCacheRef.current;
        const transformChanged =
          Math.abs(cache.x - clampedOffsetX) > CAMERA_CONFIG.CAMERA_UPDATE_THRESHOLD ||
          Math.abs(cache.y - clampedOffsetY) > CAMERA_CONFIG.CAMERA_UPDATE_THRESHOLD ||
          Math.abs(cache.scale - effectiveZoom) > CAMERA_CONFIG.ZOOM_UPDATE_THRESHOLD;

        if (transformChanged && video) {
          try {
            // Use transform3d for GPU acceleration
            const transform = `translate3d(${clampedOffsetX}px, ${clampedOffsetY}px, 0) scale3d(${effectiveZoom}, ${effectiveZoom}, 1)`;
            video.style.transform = transform;

            // Cache the transform
            transformCacheRef.current = {
              x: clampedOffsetX,
              y: clampedOffsetY,
              scale: effectiveZoom
            };
          } catch (error) {
            console.error('Transform update: Error applying transform', error);
            // Continue animation loop even if transform fails
          }
        }

        // Transition state - zoom effects disabled, always use default transition
        const newTransitionState = "default";

        if (transitionStateRef.current !== newTransitionState && video) {
          transitionStateRef.current = newTransitionState;
          try {
            video.style.transition = "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)";
          } catch (error) {
            console.error('Transition update: Error setting transition', error);
          }
        }

        animationFrameId = requestAnimationFrame(updateFollow);
      } catch (error) {
        console.error('updateFollow: Error in animation loop', error);
        // Continue animation loop even on error
        animationFrameId = requestAnimationFrame(updateFollow);
      }
    };

    // Handle window resize to invalidate cache
    const handleResize = () => {
      try {
        containerDimensionsRef.current = null;
        lastDimensionsUpdateRef.current = 0;
      } catch (error) {
        console.error('handleResize: Error invalidating cache', error);
      }
    };
    window.addEventListener("resize", handleResize);

    animationFrameId = requestAnimationFrame(updateFollow);

    return () => {
      // 🛡️ PRODUCTION: Proper cleanup to prevent memory leaks and state updates after unmount
      isMounted = false;

      try {
        window.removeEventListener("resize", handleResize);
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        if (video) {
          video.style.willChange = "auto";
          video.style.backfaceVisibility = "";
          video.style.perspective = "";
        }
        // Reset cursor smoothing state
        cursorIndicatorSmoothPosRef.current = null;
        cursorIndicatorVelocityRef.current = { x: 0, y: 0 };
      } catch (error) {
        console.error('Cleanup: Error during cleanup', error);
      }
    };
  }, [currentCursorPos, zoomLevel, recordingState, zoomState]);

  // Reset zoom and transform when not recording
  useEffect(() => {
    if (recordingState !== "recording" && videoPreviewRef.current) {
      videoPreviewRef.current.style.transform = "scale(1)";
      videoPreviewRef.current.style.transition = "transform 0.3s ease";
      setZoomLevel(1);
      setCurrentCursorPos(null);
      setCursorIndicatorPos(null);
      setZoomState("NEUTRAL");
      zoomTargetRef.current = 1;
      focusPointRef.current = null;
      cursorDwellStartRef.current = null;
      cursorDwellPositionRef.current = null;
      holdStartTimeRef.current = null;
      cameraOffsetRef.current = { x: 0, y: 0 };
      lastIntentTimeRef.current = 0;
      lastClickClusterTimeRef.current = 0;
      // Clean up click cluster tracking
      clickClusterRef.current = [];
      lastZoomTimeRef.current = 0;
      if (zoomDebounceTimeoutRef.current) {
        clearTimeout(zoomDebounceTimeoutRef.current);
        zoomDebounceTimeoutRef.current = null;
      }
      // Reset spring-damper velocities
      cameraVelocityRef.current = { x: 0, y: 0 };
      zoomVelocityRef.current = 0;
      transformCacheRef.current = { x: 0, y: 0, scale: 1 };
      // Reset smart insights
      setInteractionCount(0);
      setAvgClickInterval(null);
      setRecordingQualityScore(100);

      // Cleanup canvas recording
      if (canvasAnimationFrameRef.current) {
        cancelAnimationFrame(canvasAnimationFrameRef.current);
        canvasAnimationFrameRef.current = null;
      }
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach(track => track.stop());
        canvasStreamRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current = null;
      }
      // Cleanup particle system
      if (particleSystemRef.current) {
        particleSystemRef.current.clear();
        particleSystemRef.current = null;
      }
      lastParticleUpdateRef.current = 0;
      lastCursorPosForParticlesRef.current = null;
    }
  }, [recordingState]);

  // Camera following disabled - no persistence needed

  // Ensure zoom is always 1.0 and zoom state is always NEUTRAL (zoom effects disabled)
  useEffect(() => {
    if (zoomLevel !== 1) {
      setZoomLevel(1);
    }
    if (zoomState !== "NEUTRAL") {
      setZoomState("NEUTRAL");
    }
    zoomTargetRef.current = 1;
    currentZoomRef.current = 1;
    zoomVelocityRef.current = 0;
  }, [zoomLevel, zoomState]);

  // Export all mouse events to a text file
  const exportMouseEventsToFile = () => {
    try {
      const events: string[] = [];
      
      // Calculate actual duration from events
      const allEvents = [
        ...clicksRef.current.map(e => e.timestamp),
        ...movesRef.current.map(e => e.timestamp),
        ...scrollsRef.current.map(e => e.timestamp),
      ];
      const actualDuration = allEvents.length > 0 ? Math.max(...allEvents) : timer;
      
      // Header
      events.push("=== MOUSE EVENTS RECORDING ===");
      events.push(`Recording Duration: ${actualDuration.toFixed(2)} seconds`);
      events.push(`Total Clicks: ${clicksRef.current.length}`);
      events.push(`Total Moves: ${movesRef.current.length}`);
      events.push(`Total Scrolls: ${scrollsRef.current.length}`);
      events.push(`Screen Resolution: ${window.innerWidth}x${window.innerHeight}`);
      events.push("");
      events.push("=== CLICK EVENTS ===");
      events.push("Format: timestamp(s) | type | x | y | screenWidth | screenHeight | [elementInfo]");
      events.push("");
      
      // Click events
      clicksRef.current.forEach((click) => {
        const elementInfo = click.elementInfo 
          ? ` | tag:${click.elementInfo.tagName || 'N/A'} | text:${click.elementInfo.text?.slice(0, 30) || 'N/A'}`
          : '';
        events.push(
          `${click.timestamp.toFixed(3)} | ${click.type} | ${click.x.toFixed(4)} | ${click.y.toFixed(4)} | ${click.screenWidth} | ${click.screenHeight}${elementInfo}`
        );
      });
      
      events.push("");
      events.push("=== MOVE EVENTS ===");
      events.push("Format: timestamp(s) | x | y | screenWidth | screenHeight");
      events.push("");
      
      // Move events (sampled every 10th to reduce file size)
      movesRef.current.forEach((move, index) => {
        if (index % 10 === 0 || index === movesRef.current.length - 1) {
          events.push(
            `${move.timestamp.toFixed(3)} | ${move.x.toFixed(4)} | ${move.y.toFixed(4)} | ${move.screenWidth} | ${move.screenHeight}`
          );
        }
      });
      
      events.push("");
      events.push("=== SCROLL EVENTS ===");
      events.push("Format: timestamp(s) | type | x | y | deltaX | deltaY | screenWidth | screenHeight");
      events.push("");
      
      // Scroll events
      scrollsRef.current.forEach((scroll) => {
        events.push(
          `${scroll.timestamp.toFixed(3)} | ${scroll.type} | ${scroll.x.toFixed(4)} | ${scroll.y.toFixed(4)} | ${scroll.deltaX} | ${scroll.deltaY} | ${scroll.screenWidth} | ${scroll.screenHeight}`
        );
      });
      
      // Create blob and download
      const content = events.join("\n");
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mouse-events-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Events exported",
        description: "Mouse events have been saved to a text file.",
      });
    } catch (error) {
      console.error("Error exporting mouse events:", error);
      toast({
        title: "Export error",
        description: "Failed to export mouse events.",
        variant: "destructive",
      });
    }
  };

  const startRecordingActual = async () => {
    if (!mediaStreamRef.current) return;

    chunksRef.current = [];
    clicksRef.current = [];
    movesRef.current = [];
    scrollsRef.current = [];
    setMarkers([]); // Reset markers
    recordingStartTimeRef.current = Date.now();

    // Setup recording stream based on mode
    let canvasStream: MediaStream | null = null;
    
    // If raw recording is enabled, create container with padding and background
    // Otherwise, use canvas stream with effects
    if (rawRecording) {
      try {
        canvasStream = setupRawRecordingWithContainer();
        if (canvasStream && canvasStream.getVideoTracks().length === 0) {
          console.warn("Raw container stream has no video tracks, falling back to screen recording");
          canvasStream = null;
        }
      } catch (error) {
        console.error("Error setting up raw recording container:", error);
        toast({
          title: "Recording warning",
          description: "Could not setup container recording. Using screen recording instead.",
          variant: "default"
        });
      }
    } else {
      try {
        const streamResult = setupCanvasRecording();
        if (streamResult instanceof Promise) {
          canvasStream = await streamResult;
        } else {
          canvasStream = streamResult;
        }

        // If we got a canvas stream, wait a bit to ensure frames are being produced
        if (canvasStream) {
          // Wait for at least one frame to be drawn before starting MediaRecorder
          await new Promise(resolve => setTimeout(resolve, 100));

          // Verify the stream has video tracks
          if (canvasStream.getVideoTracks().length === 0) {
            console.warn("Canvas stream has no video tracks, falling back to screen recording");
            canvasStream = null;
          }
        }
      } catch (error) {
        console.error("Error setting up canvas recording:", error);
        toast({
          title: "Recording warning",
          description: "Could not setup canvas recording. Using screen recording instead.",
          variant: "default"
        });
      }
    }

    // Use canvas stream if available (either raw with container or with effects), otherwise use screen stream
    const recordingStream = canvasStream || mediaStreamRef.current;

    // Add audio tracks from original stream if using canvas stream
    if (canvasStream && mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        if (!canvasStream!.getAudioTracks().some(t => t.id === track.id)) {
          canvasStream!.addTrack(track);
        }
      });
    }

    // Determine mime type based on browser support
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];

    let selectedMimeType = mimeTypes[0];
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        break;
      }
    }

    // Verify the stream has tracks before creating MediaRecorder
    if (recordingStream.getVideoTracks().length === 0) {
      toast({
        title: "Recording error",
        description: "No video track available. Please try selecting your screen again.",
        variant: "destructive"
      });
      setRecordingState("idle");
      return;
    }

    // Use higher bitrates for better quality
    const bitrates = {
      high: 12000000,   // 12 Mbps for high quality
      medium: 6000000,  // 6 Mbps for medium quality
      low: 3000000      // 3 Mbps for low quality
    };

    const mediaRecorder = new MediaRecorder(recordingStream, {
      mimeType: selectedMimeType,
      videoBitsPerSecond: bitrates[recordingQuality],
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
        console.log(`Received chunk: ${event.data.size} bytes, total chunks: ${chunksRef.current.length}`);
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event);
      toast({
        title: "Recording error",
        description: "An error occurred while recording. Please try again.",
        variant: "destructive"
      });
    };

    mediaRecorder.onstop = () => {
      // Ensure we have chunks before creating blob
      if (chunksRef.current.length === 0) {
        toast({
          title: "Recording error",
          description: "No video data was recorded. Please try again.",
          variant: "destructive"
        });
        setRecordingState("idle");
        return;
      }

      const blob = new Blob(chunksRef.current, { type: selectedMimeType });

      // Verify blob size
      if (blob.size === 0) {
        toast({
          title: "Recording error",
          description: "Recorded video is empty. Please try again.",
          variant: "destructive"
        });
        setRecordingState("idle");
        return;
      }

      const videoUrl = URL.createObjectURL(blob);

      // Export mouse events to text file (async, don't block navigation)
      setTimeout(() => {
        exportMouseEventsToFile();
      }, 100);

      // Cleanup canvas recording
      if (canvasAnimationFrameRef.current) {
        cancelAnimationFrame(canvasAnimationFrameRef.current);
        canvasAnimationFrameRef.current = null;
      }
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach(track => track.stop());
        canvasStreamRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current = null;
      }
      // Cleanup particle system
      if (particleSystemRef.current) {
        particleSystemRef.current.clear();
        particleSystemRef.current = null;
      }
      lastParticleUpdateRef.current = 0;
      lastCursorPosForParticlesRef.current = null;

      // Cleanup audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }

      setRecordingState("stopped");
      toast({
        title: "Recording saved",
        description: "Redirecting to editor...",
      });

      setTimeout(() => {
        navigate("/editor/new", {
          state: {
            videoUrl,
            clickData: clicksRef.current,
            moveData: movesRef.current,
            scrollData: scrollsRef.current,
            markers: markers,
            rawRecording, // Pass raw recording flag for layered rendering
            containerConfig: rawRecording ? {
              padding: containerPadding,
              background: containerBackground,
            } : undefined,
            visualEffects: {
              cursorEffects,
              clickRipple,
              cursorGlow,
              cursorTrail,
              showClickIndicator,
            },
          }
        });
      }, 1500);
    };

    // Set recording state BEFORE starting MediaRecorder
    // This ensures the canvas drawing loop continues
    setRecordingState("recording");

    // Request data more frequently for better reliability
    mediaRecorder.start(500); // Collect 500ms chunks for better reliability
    mediaRecorderRef.current = mediaRecorder;

    toast({
      title: "Recording started",
      description: "Recording preview container with all effects! Press M for markers, Space to pause, Esc to stop",
    });
  };

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState("paused");
    }
  };

  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState("recording");
    }
  };

  const handleStopRecording = () => {
    // 🎬 End-of-video settle: Settle camera before stopping
    // Camera following disabled - ensure zoom is reset
    setZoomState("NEUTRAL");
    zoomTargetRef.current = 1.0;
    zoomVelocityRef.current = 0;

    // Request final data chunk before stopping
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused') {
        // Request any remaining data
        mediaRecorderRef.current.requestData();
        // Small delay to ensure data is collected and camera settles
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }, 100);
      }
    }

    // Cleanup canvas recording after a short delay to ensure final frame is captured
    setTimeout(() => {
      if (canvasAnimationFrameRef.current) {
        cancelAnimationFrame(canvasAnimationFrameRef.current);
        canvasAnimationFrameRef.current = null;
      }
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach(track => track.stop());
        canvasStreamRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current = null;
      }
    }, 200);

    // Stop all tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated user={user} />

      <main className="container grid gap-8 py-12 px-4 lg:grid-cols-2 lg:gap-12 lg:items-start">
        {/* Left Column: Instructions & Tips */}
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Record Your Screen</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Create engaging demo videos with visual effects, click highlights, and smooth interactions. Your viewers will love watching your product in action.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            <div className={`flex gap-4 rounded-xl border border-border bg-card/50 p-4 transition-colors ${recordingState === 'idle' ? 'bg-primary/5 border-primary/50' : 'hover:bg-card'}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                1
              </div>
              <div>
                <h3 className="font-semibold">Choose source</h3>
                <p className="text-sm text-muted-foreground">Select your entire screen, a window, or a specific browser tab to share.</p>
              </div>
            </div>

            <div className={`flex gap-4 rounded-xl border border-border bg-card/50 p-4 transition-colors ${recordingState === 'selecting' ? 'bg-primary/5 border-primary/50' : 'hover:bg-card'}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                2
              </div>
              <div>
                <h3 className="font-semibold">Hide Controls</h3>
                <p className="text-sm text-muted-foreground">Click "Hide" on the browser's screen sharing bar to keep your recording clean.</p>
              </div>
            </div>

            <div className={`flex gap-4 rounded-xl border border-border bg-card/50 p-4 transition-colors ${['ready', 'countdown', 'recording'].includes(recordingState) ? 'bg-primary/5 border-primary/50' : 'hover:bg-card'}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                3
              </div>
              <div>
                <h3 className="font-semibold">Record your flow</h3>
                <p className="text-sm text-muted-foreground">Navigate through your product naturally. We'll capture everything.</p>
              </div>
            </div>
          </div>

          {/* Tips Panel */}
          <Collapsible>
            <CollapsibleTrigger className="w-full rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="h-4 w-4" />
                  Demo Creator Checklist
                </div>
                <ChevronDown className="h-4 w-4" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-600 dark:text-blue-400">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-1">Before Recording:</h4>
                  <ul className="list-inside list-disc space-y-1 opacity-80 ml-2">
                    <li>Clean up your desktop and close unnecessary apps</li>
                    <li>Turn off notifications (Do Not Disturb mode)</li>
                    <li>Close browser tabs you won't need</li>
                    <li>Set your screen resolution to 1920x1080 for best quality</li>
                    <li>Test your microphone levels beforehand</li>
                    <li>Prepare a script or outline of what to demonstrate</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">During Recording:</h4>
                  <ul className="list-inside list-disc space-y-1 opacity-80 ml-2">
                    <li>Move your mouse smoothly and deliberately - viewers follow your cursor</li>
                    <li>Camera following disabled - preview stays centered</li>
                    <li>Use zoom controls (+/-) to focus on specific areas while recording</li>
                    <li>Pause briefly after each major action to let viewers process</li>
                    <li>Use markers (M key) to mark important moments for easy editing</li>
                    <li>Speak clearly and at a moderate pace - explain what you're doing</li>
                    <li>Keep your cursor visible - don't move it off screen unnecessarily</li>
                    <li>Click confidently - visual effects will highlight your interactions</li>
                    <li>Use keyboard shortcuts to pause if you need a break</li>
                    <li>Show, don't just tell - demonstrate features visually</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Keyboard Shortcuts:</h4>
                  <ul className="list-inside list-disc space-y-1 opacity-80 ml-2">
                    <li><kbd className="px-1.5 py-0.5 bg-background/50 rounded text-xs">Space</kbd> - Pause/Resume recording</li>
                    <li><kbd className="px-1.5 py-0.5 bg-background/50 rounded text-xs">M</kbd> - Add a marker at current time</li>
                    <li><kbd className="px-1.5 py-0.5 bg-background/50 rounded text-xs">Esc</kbd> - Stop recording</li>
                    <li><kbd className="px-1.5 py-0.5 bg-background/50 rounded text-xs">+/-</kbd> - Zoom in/out during recording</li>
                    <li><kbd className="px-1.5 py-0.5 bg-background/50 rounded text-xs">0</kbd> - Reset zoom to 100%</li>
                    <li><kbd className="px-1.5 py-0.5 bg-background/50 rounded text-xs">F</kbd> - Toggle cursor following</li>
                  </ul>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Smart Tips Panel */}
          {showSmartTips && recordingState === "recording" && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="w-full rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 font-semibold">
                    <Zap className="h-4 w-4" />
                    Smart Tips & Insights
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-4 text-sm">
                <div className="space-y-3">
                  {recordingQualityScore < 80 && timer > 10 && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-background/50">
                      <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">Tip: {recordingQualityScore < 60 ? 'Consider adding more markers (M key) to highlight important moments' : 'Try varying your click pace for better engagement'}</p>
                      </div>
                    </div>
                  )}
                  {avgClickInterval && avgClickInterval < 500 && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-background/50">
                      <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">You're clicking rapidly. Consider pausing briefly between actions for clarity.</p>
                      </div>
                    </div>
                  )}
                  {timer > 30 && markers.length === 0 && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-background/50">
                      <Bookmark className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">Pro tip: Press M to add markers at key moments for easier editing later.</p>
                      </div>
                    </div>
                  )}
                  {/* Camera following disabled */}
                  {micLevel < 5 && (audioSource === "microphone" || audioSource === "both") && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-background/50">
                      <Mic className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">Microphone level is low. Check your mic settings or move closer to the microphone.</p>
                      </div>
                    </div>
                  )}
                  {clicksRef.current.length === 0 && timer > 5 && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-background/50">
                      <Circle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">Start interacting! Click around to demonstrate your product features.</p>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Feature Highlights */}
          <div className="space-y-3">
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-4 hover:shadow-lg transition-all cursor-pointer group">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20 group-hover:bg-primary/30 transition-colors">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 font-semibold text-foreground">Visual Click Effects</h3>
                  <p className="text-sm text-muted-foreground">
                    Beautiful ripple animations and click indicators that make every interaction clear and engaging. Your viewers will never miss an important click.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 hover:shadow-lg transition-all cursor-pointer group">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors">
                  <Video className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 font-semibold text-foreground">Enhanced Cursor Visibility</h3>
                  <p className="text-sm text-muted-foreground">
                    Cursor glow effects and optional trails make your mouse movements crystal clear. Perfect for tutorials and product demos.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 hover:shadow-lg transition-all cursor-pointer group">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/20 group-hover:bg-green-500/30 transition-colors">
                  <Move className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 font-semibold text-foreground">Smart Cursor Following</h3>
                  <p className="text-sm text-muted-foreground">
                    Camera following and zoom effects are disabled. The preview stays centered.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 hover:shadow-lg transition-all cursor-pointer group">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                  <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 font-semibold text-foreground">AI-Powered Insights</h3>
                  <p className="text-sm text-muted-foreground">
                    Real-time quality scoring and smart suggestions help you create better recordings. Get instant feedback on pacing, interactions, and engagement.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recorder Interface */}
        <div className="lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl ring-1 ring-border/50">
            {/* Browser Chrome visual */}
            <div className="flex items-center gap-3 border-b border-border/50 bg-secondary/30 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
              </div>
              <div className="flex-1 text-center">
                <div className="inline-flex items-center gap-1.5 rounded bg-background/50 px-2 py-0.5 text-xs text-muted-foreground font-medium">
                  <Monitor className="h-3 w-3" />
                  Screen Recording
                </div>
              </div>
              <div className="w-12" /> {/* Spacer for centering */}
            </div>

            {/* Preview Area */}
            <div
              ref={previewContainerRef}
              className={`relative flex aspect-video flex-col items-center justify-center bg-gradient-subtle transition-all duration-300 overflow-hidden p-4 ${recordingState === "recording"
                ? "ring-2 ring-primary/20 shadow-lg shadow-primary/5"
                : recordingState === "paused"
                  ? "ring-2 ring-warning/20 shadow-lg shadow-warning/5"
                  : ""
                }`}
            >
              {/* Video Preview */}
              {showPreview && mediaStreamRef.current && recordingState !== "idle" && (
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="absolute inset-4 object-contain origin-center rounded-lg shadow-2xl border border-border/50"
                  style={{
                    transform: `scale(1)`,
                    transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              )}

              {/* Cursor Position Indicator removed - camera following disabled */}
              {false && cursorIndicatorPos && recordingState === "recording" && showPreview && (
                <div
                  className="absolute z-30 pointer-events-none"
                  style={{
                    // cursorIndicatorPos is already in container-relative coordinates (0-1)
                    left: `${cursorIndicatorPos.x * 100}%`,
                    top: `${cursorIndicatorPos.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className="relative">
                    {/* Outer ring */}
                    <div className="absolute inset-0 w-8 h-8 border-2 border-primary/60 rounded-full animate-ping" />
                    {/* Inner dot */}
                    <div className="w-3 h-3 bg-primary rounded-full shadow-lg shadow-primary/50" />
                    {/* Crosshair lines */}
                    <div className="absolute top-1/2 left-1/2 w-16 h-px bg-primary/30 -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute top-1/2 left-1/2 w-px h-16 bg-primary/30 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                </div>
              )}

              {/* Overlay content */}
              <div className={`relative z-10 flex flex-col items-center justify-center p-8 ${showPreview && mediaStreamRef.current && recordingState !== "idle" ? 'bg-background/40 backdrop-blur-sm rounded-lg' : ''}`}>
                {/* Idle State */}
                {recordingState === "idle" && (
                  <div className="text-center animate-scale-in">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 shadow-inner animate-pulse-slow">
                      <Video className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Ready to record?</h3>
                    <p className="text-sm text-muted-foreground max-w-[200px] mx-auto mt-1">
                      Click the button below to start.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Zap className="h-3 w-3" />
                      <span>Smart features enabled</span>
                    </div>
                  </div>
                )}

                {/* Selecting / Hide Prompt State */}
                {recordingState === "selecting" && (
                  <div className="text-center animate-fade-in max-w-sm">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <Monitor className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Screen Selected!</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Please click <span className="font-bold text-foreground">"Hide"</span> on the browser sharing bar at the bottom of your screen.
                    </p>
                  </div>
                )}

                {/* Ready State */}
                {recordingState === "ready" && (
                  <div className="text-center animate-fade-in">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                      <Circle className="h-10 w-10 fill-destructive text-destructive" />
                    </div>
                    <h3 className="text-lg font-semibold text-destructive">Ready to Capture</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click "Start Recording" when ready.
                    </p>
                  </div>
                )}

                {/* Countdown State */}
                {recordingState === "countdown" && (
                  <div className="text-center animate-scale-in flex flex-col items-center justify-center absolute inset-0 bg-background/80 backdrop-blur-sm z-50">
                    <div className="text-9xl font-bold text-primary animate-pulse tabular-nums">
                      {countdown}
                    </div>
                    <p className="mt-4 text-xl font-medium text-muted-foreground">Get ready...</p>
                  </div>
                )}

                {/* Recording / Paused State */}
                {(recordingState === "recording" || recordingState === "paused") && (
                  <div className="text-center animate-fade-in relative z-20">
                    <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
                      {recordingState === "recording" && (
                        <div className="absolute inset-0 rounded-full bg-destructive/20 animate-pulse-ring" />
                      )}
                      <div className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-colors ${recordingState === "recording" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"
                        }`}>
                        {recordingState === "recording" ? (
                          <Circle className="h-8 w-8 fill-current" />
                        ) : (
                          <Pause className="h-8 w-8 fill-current" />
                        )}
                      </div>
                    </div>
                    <div className="font-mono text-4xl font-bold tracking-wider tabular-nums">
                      {formatTime(timer)}
                    </div>
                    <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${recordingState === "recording" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                      }`}>
                      <div className={`h-2 w-2 rounded-full ${recordingState === "recording" ? "bg-destructive animate-pulse" : "bg-warning"}`} />
                      {recordingState === "recording" ? "Recording" : "Paused"}
                    </div>

                    {/* Camera following disabled */}

                    {/* Recording Stats */}
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm border border-border/50">
                          <Video className="h-3 w-3" />
                          <span>~{estimatedSize} MB</span>
                        </div>
                        {markers.length > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm border border-border/50">
                            <Bookmark className="h-3 w-3" />
                            <span>{markers.length} markers</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm border border-border/50">
                          <Circle className="h-3 w-3" />
                          <span>{clicksRef.current.length} clicks</span>
                        </div>
                        {interactionCount > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm border border-border/50">
                            <Activity className="h-3 w-3" />
                            <span>{interactionCount} interactions</span>
                          </div>
                        )}
                      </div>

                      {/* Smart Quality Score */}
                      {recordingState === "recording" && timer > 5 && (
                        <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/90 backdrop-blur-sm border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-2">
                            <TrendingUp className={`h-3.5 w-3.5 ${recordingQualityScore >= 80 ? 'text-green-500 animate-pulse' : recordingQualityScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`} />
                            <span className="text-xs font-medium">Quality Score</span>
                            <div className="flex items-center gap-1">
                              <div className="w-20 h-2 bg-secondary rounded-full overflow-hidden shadow-inner">
                                <div
                                  className={`h-full transition-all duration-700 ease-out ${recordingQualityScore >= 80 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                                    recordingQualityScore >= 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 'bg-gradient-to-r from-red-400 to-red-500'
                                    }`}
                                  style={{ width: `${recordingQualityScore}%` }}
                                />
                              </div>
                              <span className={`text-xs font-mono font-semibold min-w-[2.5rem] ${recordingQualityScore >= 80 ? 'text-green-500' :
                                recordingQualityScore >= 60 ? 'text-yellow-500' : 'text-red-500'
                                }`}>
                                {Math.round(recordingQualityScore)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Active Effects Indicator */}
                      {(cursorEffects || clickRipple || cursorGlow || cursorTrail || showClickIndicator) && (
                        <div className="flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 animate-pulse">
                          <Sparkles className="h-3 w-3 text-primary" />
                          <span className="text-xs text-primary font-medium">
                            Visual Effects Active
                          </span>
                        </div>
                      )}

                      {/* Smart Interaction Insights */}
                      {recordingState === "recording" && timer > 3 && (
                        <div className="mt-3 space-y-1.5">
                          {avgClickInterval && avgClickInterval > 0 && (
                            <div className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                              <Activity className="h-3 w-3" />
                              <span>Avg click interval: {Math.round(avgClickInterval)}ms</span>
                              {avgClickInterval > 2000 && (
                                <span className="text-green-500">✓ Good pacing</span>
                              )}
                              {avgClickInterval < 1000 && avgClickInterval > 500 && (
                                <span className="text-yellow-500">⚡ Fast pace</span>
                              )}
                              {avgClickInterval < 500 && (
                                <span className="text-amber-500">⚠ Very fast</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Camera following disabled */}
                      {false && recordingState === "recording" && (
                        <div className="flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                          <Move className="h-3 w-3 text-green-600 dark:text-green-400" />
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            Following Cursor
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Microphone Level Indicator */}
                    {(audioSource === "microphone" || audioSource === "both") && recordingState === "recording" && (
                      <div className="mt-4 w-48 mx-auto">
                        <div className="flex items-center gap-2 mb-1">
                          <Mic className="h-3 w-3 text-muted-foreground" />
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-75"
                              style={{ width: `${micLevel}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Stopped State */}
                {recordingState === "stopped" && (
                  <div className="text-center animate-scale-in">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success text-success-foreground shadow-lg">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <h3 className="text-lg font-semibold">Saved!</h3>
                    <p className="text-sm text-muted-foreground">Redirecting to editor...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-border/50" />

            {/* Settings Panel */}
            <Collapsible open={showSettings} onOpenChange={setShowSettings}>
              <CollapsibleTrigger className="w-full px-6 py-3 border-b border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="text-sm font-medium">Recording Settings</span>
                </div>
                {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="p-6 space-y-4 bg-card">
                <div className="space-y-2">
                  <Label htmlFor="countdown">Countdown Duration (seconds)</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="countdown"
                      min={0}
                      max={10}
                      step={1}
                      value={[countdownDuration]}
                      onValueChange={(value) => setCountdownDuration(value[0])}
                      className="flex-1"
                      disabled={recordingState !== "idle"}
                    />
                    <span className="text-sm font-mono w-8">{countdownDuration}s</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audio">Audio Source</Label>
                  <Select
                    value={audioSource}
                    onValueChange={(value) => setAudioSource(value as AudioSource)}
                    disabled={recordingState !== "idle"}
                  >
                    <SelectTrigger id="audio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">System + Microphone</SelectItem>
                      <SelectItem value="system">System Audio Only</SelectItem>
                      <SelectItem value="microphone">Microphone Only</SelectItem>
                      <SelectItem value="none">No Audio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quality">Recording Quality</Label>
                  <Select
                    value={recordingQuality}
                    onValueChange={(value) => setRecordingQuality(value as RecordingQuality)}
                    disabled={recordingState !== "idle"}
                  >
                    <SelectTrigger id="quality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High (1080p @ 30fps)</SelectItem>
                      <SelectItem value="medium">Medium (720p @ 24fps)</SelectItem>
                      <SelectItem value="low">Low (480p @ 15fps)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="rawRecording">Raw Recording Mode</Label>
                    <Switch
                      id="rawRecording"
                      checked={rawRecording}
                      onCheckedChange={(checked) => {
                        setRawRecording(checked);
                        localStorage.setItem("recorder_rawRecording", String(checked));
                      }}
                      disabled={recordingState !== "idle"}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {rawRecording 
                      ? "Recording raw screen with container (padding + background). Mouse events tracked separately."
                      : "Recording with effects applied. Use raw mode for advanced post-processing."}
                  </p>
                </div>

                {rawRecording && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="containerPadding">Container Padding (px)</Label>
                        <span className="text-sm text-muted-foreground">{containerPadding}px</span>
                      </div>
                      <Slider
                        id="containerPadding"
                        min={0}
                        max={200}
                        step={10}
                        value={[containerPadding]}
                        onValueChange={(value) => {
                          setContainerPadding(value[0]);
                          localStorage.setItem("recorder_containerPadding", String(value[0]));
                        }}
                        disabled={recordingState !== "idle"}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">
                        Padding around the raw video inside the container
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="containerBackground">Container Background</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          id="containerBackground"
                          value={containerBackground}
                          onChange={(e) => {
                            setContainerBackground(e.target.value);
                            localStorage.setItem("recorder_containerBackground", e.target.value);
                          }}
                          disabled={recordingState !== "idle"}
                          className="h-10 w-20 rounded border border-border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <input
                          type="text"
                          value={containerBackground}
                          onChange={(e) => {
                            setContainerBackground(e.target.value);
                            localStorage.setItem("recorder_containerBackground", e.target.value);
                          }}
                          disabled={recordingState !== "idle"}
                          className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="#f8f9fa"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Background color of the container (hex color code)
                      </p>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="preview" className="cursor-pointer">Show Preview</Label>
                  <Switch
                    id="preview"
                    checked={showPreview}
                    onCheckedChange={setShowPreview}
                    disabled={recordingState === "idle"}
                  />
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <Label className="text-sm font-semibold">Visual Effects</Label>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <Label htmlFor="cursor-effects" className="cursor-pointer text-sm">Cursor Effects</Label>
                      <span className="text-xs text-muted-foreground">Glow and highlight cursor</span>
                    </div>
                    <Switch
                      id="cursor-effects"
                      checked={cursorEffects}
                      onCheckedChange={setCursorEffects}
                      disabled={recordingState !== "idle"}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <Label htmlFor="click-ripple" className="cursor-pointer text-sm">Click Ripple</Label>
                      <span className="text-xs text-muted-foreground">Animated ripple on clicks</span>
                    </div>
                    <Switch
                      id="click-ripple"
                      checked={clickRipple}
                      onCheckedChange={setClickRipple}
                      disabled={recordingState !== "idle"}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <Label htmlFor="cursor-glow" className="cursor-pointer text-sm">Cursor Glow</Label>
                      <span className="text-xs text-muted-foreground">Glowing effect around cursor</span>
                    </div>
                    <Switch
                      id="cursor-glow"
                      checked={cursorGlow}
                      onCheckedChange={setCursorGlow}
                      disabled={recordingState !== "idle"}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <Label htmlFor="cursor-trail" className="cursor-pointer text-sm">Cursor Trail</Label>
                      <span className="text-xs text-muted-foreground">Trail effect for mouse movement</span>
                    </div>
                    <Switch
                      id="cursor-trail"
                      checked={cursorTrail}
                      onCheckedChange={setCursorTrail}
                      disabled={recordingState !== "idle"}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <Label htmlFor="click-indicator" className="cursor-pointer text-sm">Click Indicators</Label>
                      <span className="text-xs text-muted-foreground">Visual markers for clicks</span>
                    </div>
                    <Switch
                      id="click-indicator"
                      checked={showClickIndicator}
                      onCheckedChange={setShowClickIndicator}
                      disabled={recordingState !== "idle"}
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <Label className="text-sm font-semibold">Preview Controls</Label>

                  <div className="flex items-center justify-between">
                    {/* Camera following disabled */}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Controls Bar */}
            <div className="bg-card p-6 flex flex-col gap-4">
              {recordingState === "idle" && (
                <Button size="lg" className="h-12 w-full max-w-sm gap-2 text-base" onClick={handleSelectScreen}>
                  <Monitor className="h-5 w-5" />
                  Select Screen
                </Button>
              )}

              {recordingState === "selecting" && (
                <Button size="lg" className="h-12 w-full max-w-sm gap-2" onClick={handleConfirmHide}>
                  <CheckCircle2 className="h-5 w-5" />
                  I've Hidden the Bar
                </Button>
              )}

              {recordingState === "ready" && (
                <Button variant="destructive" size="lg" className="h-12 w-full max-w-sm gap-2 text-base shadow-lg shadow-destructive/20 hover:shadow-destructive/30" onClick={handleStartCountdown}>
                  <Circle className="h-5 w-5 fill-current" />
                  Start Recording
                </Button>
              )}

              {recordingState === "countdown" && (
                <Button variant="outline" size="lg" disabled className="h-12 w-full max-w-sm">
                  Starting in {countdown}...
                </Button>
              )}

              {(recordingState === "recording" || recordingState === "paused") && (
                <>
                  <div className="flex w-full items-center justify-center gap-4">
                    {recordingState === "recording" ? (
                      <Button variant="outline" size="lg" className="h-12 w-32 gap-2" onClick={handlePauseRecording}>
                        <Pause className="h-4 w-4 fill-current" />
                        Pause
                      </Button>
                    ) : (
                      <Button variant="outline" size="lg" className="h-12 w-32 gap-2" onClick={handleResumeRecording}>
                        <Circle className="h-4 w-4 fill-current text-primary" />
                        Resume
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="lg"
                      className="h-12 w-32 gap-2"
                      onClick={handleAddMarker}
                      disabled={recordingState === "paused"}
                    >
                      <Bookmark className="h-4 w-4" />
                      Marker
                    </Button>

                    <Button variant="destructive" size="lg" className="h-12 w-40 gap-2 shadow-lg shadow-destructive/20 hover:shadow-destructive/30" onClick={handleStopRecording}>
                      <Square className="h-4 w-4 fill-current" />
                      Stop
                    </Button>
                  </div>

                  {/* Keyboard Shortcuts Hint */}
                  <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Keyboard className="h-3 w-3" />
                      <span>Space: Pause/Resume</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Keyboard className="h-3 w-3" />
                      <span>M: Add Marker</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Keyboard className="h-3 w-3" />
                      <span>Esc: Stop</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Keyboard className="h-3 w-3" />
                      <span>+/-: Zoom</span>
                    </div>
                    {/* Camera following disabled */}
                  </div>

                  {/* Markers List */}
                  {markers.length > 0 && (
                    <div className="border-t border-border/50 pt-4">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Markers:</div>
                      <div className="flex flex-wrap gap-2">
                        {markers.map((marker, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs"
                          >
                            <Bookmark className="h-3 w-3" />
                            <span>{formatTime(marker.timestamp)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
