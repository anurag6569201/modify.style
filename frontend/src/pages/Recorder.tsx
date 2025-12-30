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
  ZoomIn,
  ZoomOut,
  Maximize2,
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
  };
}

export interface MoveData {
  x: number;
  y: number;
  timestamp: number;
  screenWidth: number;
  screenHeight: number;
}

interface RecordingMarker {
  timestamp: number;
  label: string;
}

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

  // Zoom and cursor following settings
  const [zoomLevel, setZoomLevel] = useState(1);
  const [followCursor, setFollowCursor] = useState(() => {
    const saved = localStorage.getItem("recorder_followCursor");
    return saved !== null ? saved === "true" : true; // Default to true
  });
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

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clicksRef = useRef<ClickData[]>([]);
  const movesRef = useRef<MoveData[]>([]);
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
  const followCursorRef = useRef(followCursor);
  const currentCursorPosRef = useRef(currentCursorPos);
  const cursorIndicatorPosRef = useRef(cursorIndicatorPos);
  
  // Advanced particle system for cursor trails
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  const lastParticleUpdateRef = useRef<number>(0);
  const lastCursorPosForParticlesRef = useRef<{ x: number; y: number } | null>(null);
  
  // Update refs when state changes
  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);
  
  useEffect(() => {
    followCursorRef.current = followCursor;
  }, [followCursor]);
  
  useEffect(() => {
    currentCursorPosRef.current = currentCursorPos;
  }, [currentCursorPos]);
  
  useEffect(() => {
    cursorIndicatorPosRef.current = cursorIndicatorPos;
  }, [cursorIndicatorPos]);

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

      // Zoom controls (only when recording)
      if (recordingState === "recording" && e.target === document.body) {
        // Plus/Equal for zoom in
        if ((e.code === "Equal" || e.code === "NumpadAdd") && (e.shiftKey || e.code === "NumpadAdd")) {
          e.preventDefault();
          handleZoomIn();
        }
        // Minus for zoom out
        if (e.code === "Minus" || e.code === "NumpadSubtract") {
          e.preventDefault();
          handleZoomOut();
        }
        // 0 for reset zoom
        if (e.code === "Digit0" || e.code === "Numpad0") {
          e.preventDefault();
          handleResetZoom();
        }
        // F key to toggle follow cursor
        if (e.code === "KeyF" && e.target === document.body) {
          e.preventDefault();
          setFollowCursor((prev) => !prev);
        }
      }
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
  const setupCanvasRecordingSync = useCallback(() => {
    if (!previewContainerRef.current || !videoPreviewRef.current || !mediaStreamRef.current) {
      return null;
    }

    const container = previewContainerRef.current;
    const video = videoPreviewRef.current;
    const rect = container.getBoundingClientRect();
    
    // Create canvas with container dimensions
    const canvas = document.createElement('canvas');
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvasRef.current = canvas;

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

    // Start capturing the preview container to canvas
    const drawFrame = () => {
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

      // Update canvas size if container resized
      const currentRect = container.getBoundingClientRect();
      if (canvas.width !== currentRect.width || canvas.height !== currentRect.height) {
        canvas.width = currentRect.width;
        canvas.height = currentRect.height;
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background gradient (matching the container style)
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#f8f9fa');
      gradient.addColorStop(1, '#e9ecef');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Ensure video has valid dimensions
      if (!video.videoWidth || !video.videoHeight || video.videoWidth === 0 || video.videoHeight === 0) {
        // Video not ready yet, skip this frame
        canvasAnimationFrameRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      // Calculate video display dimensions (accounting for aspect ratio and padding)
      const padding = 16; // 1rem = 16px
      const availableWidth = canvas.width - (padding * 2);
      const availableHeight = canvas.height - (padding * 2);
      
      const videoAspect = video.videoWidth / video.videoHeight || 16 / 9;
      const containerAspect = availableWidth / availableHeight;
      
      let videoDisplayWidth: number;
      let videoDisplayHeight: number;
      
      if (videoAspect > containerAspect) {
        videoDisplayWidth = availableWidth;
        videoDisplayHeight = availableWidth / videoAspect;
      } else {
        videoDisplayHeight = availableHeight;
        videoDisplayWidth = availableHeight * videoAspect;
      }

      // Apply the same transform as the video element (zoom, pan)
      // Read from refs to get current values
      const currentZoom = zoomLevelRef.current;
      const scaledWidth = videoDisplayWidth * currentZoom;
      const scaledHeight = videoDisplayHeight * currentZoom;

      // Calculate offset for cursor following
      let offsetX = 0;
      let offsetY = 0;
      
      if (followCursorRef.current && currentCursorPosRef.current) {
        const containerWidth = canvas.width;
        const containerHeight = canvas.height;
        const cursorX = currentCursorPosRef.current.x * containerWidth;
        const cursorY = currentCursorPosRef.current.y * containerHeight;
        
        offsetX = (containerWidth / 2) - (cursorX * currentZoom);
        offsetY = (containerHeight / 2) - (cursorY * currentZoom);
        
        // Clamp offsets
        const maxOffsetX = Math.max(0, (scaledWidth - containerWidth) / 2);
        const maxOffsetY = Math.max(0, (scaledHeight - containerHeight) / 2);
        offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
        offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));
      }

      // Save context and apply transform
      ctx.save();
      ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY);
      ctx.scale(currentZoom, currentZoom);
      
      // Draw video frame
      const videoX = -videoDisplayWidth / 2;
      const videoY = -videoDisplayHeight / 2;
      
      // Draw rounded rectangle background for video
      const radius = 8;
      ctx.beginPath();
      ctx.moveTo(videoX + radius, videoY);
      ctx.lineTo(videoX + videoDisplayWidth - radius, videoY);
      ctx.quadraticCurveTo(videoX + videoDisplayWidth, videoY, videoX + videoDisplayWidth, videoY + radius);
      ctx.lineTo(videoX + videoDisplayWidth, videoY + videoDisplayHeight - radius);
      ctx.quadraticCurveTo(videoX + videoDisplayWidth, videoY + videoDisplayHeight, videoX + videoDisplayWidth - radius, videoY + videoDisplayHeight);
      ctx.lineTo(videoX + radius, videoY + videoDisplayHeight);
      ctx.quadraticCurveTo(videoX, videoY + videoDisplayHeight, videoX, videoY + videoDisplayHeight - radius);
      ctx.lineTo(videoX, videoY + radius);
      ctx.quadraticCurveTo(videoX, videoY, videoX + radius, videoY);
      ctx.closePath();
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.clip();
      
      ctx.drawImage(video, videoX, videoY, videoDisplayWidth, videoDisplayHeight);
      ctx.restore();

      // Draw cursor indicator if following (during recording)
      if (followCursorRef.current && cursorIndicatorPosRef.current && (recordingState === "recording" || recordingState === "countdown")) {
        const cursorX = cursorIndicatorPosRef.current.x * canvas.width;
        const cursorY = cursorIndicatorPosRef.current.y * canvas.height;
        
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

      // Draw click ripples with enhanced effects
      const currentTime = (Date.now() - recordingStartTimeRef.current) / 1000;
      clicksRef.current.forEach((click) => {
        const timeSince = currentTime - click.timestamp;
        if (timeSince >= 0 && timeSince < 0.8) {
          const progress = Math.min(1, timeSince / 0.6);
          const maxRadius = Math.min(canvas.width, canvas.height) * 0.08;
          const currentRadius = maxRadius * (0.2 + 0.8 * progress);
          const opacity = 1 - Math.pow(progress, 3);
          
          const clickX = click.x * canvas.width;
          const clickY = click.y * canvas.height;
          
          ctx.save();
          ctx.globalAlpha = opacity;
          
          // Determine color based on click type
          const isRightClick = click.type === "rightClick";
          const color = isRightClick ? "239, 68, 68" : "59, 130, 246";
          
          // Enhanced ripple with multiple rings
          for (let ring = 0; ring < 3; ring++) {
            const ringProgress = progress + (ring * 0.2);
            if (ringProgress > 1) continue;
            const ringRadius = currentRadius * (1 + ring * 0.3);
            const ringOpacity = opacity * (1 - ring * 0.3);
            
            ctx.beginPath();
            ctx.arc(clickX, clickY, ringRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${color}, ${ringOpacity * 0.6})`;
            ctx.lineWidth = 2 - ring * 0.5;
            ctx.stroke();
          }
          
          // Outer ring
          ctx.beginPath();
          ctx.arc(clickX, clickY, currentRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${color}, ${opacity})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = `rgba(${color}, ${opacity * 0.3})`;
          ctx.fill();
          
          // Inner ring with glow
          ctx.beginPath();
          ctx.arc(clickX, clickY, currentRadius * 0.7, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${color}, ${opacity * 0.5})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          
          // Center dot
          ctx.beginPath();
          ctx.arc(clickX, clickY, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${color}, ${opacity})`;
          ctx.fill();
          
          ctx.restore();
        }
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
    const stream = canvas.captureStream(recordingQuality === "high" ? 30 : recordingQuality === "medium" ? 24 : 15);
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
      fps: recordingQuality === "high" ? 30 : recordingQuality === "medium" ? 24 : 15
    });

    return stream;
  }, [recordingState, zoomLevel, followCursor, currentCursorPos, cursorIndicatorPos, recordingQuality]);

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

  // Get element information for visual highlights
  const getElementInfo = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target) return undefined;

    try {
      return {
        tagName: target.tagName.toLowerCase(),
        text: target.textContent?.slice(0, 50) || undefined,
        className: target.className?.slice(0, 50) || undefined,
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

    // 🧠 ZOOM-IN: Event-driven (new intent detected)
    if (followCursor) {
      // Update intent tracking
      lastIntentTimeRef.current = now;
      lastClickClusterTimeRef.current = now;
      
      // Set focus point for this interaction
      focusPointRef.current = { x: normalizedX, y: normalizedY };
      
      // Cancel any ongoing zoom-out
      if (zoomState === "DECAY" || zoomState === "HOLD") {
        setZoomState("FOCUSED");
      } else if (zoomState === "NEUTRAL") {
        setZoomState("FOCUSED");
      }
      
      // Trigger zoom-in (event-driven)
      // Zoom to 1.4x for clicks (can be adjusted)
      const targetZoom = 1.4;
      zoomTargetRef.current = targetZoom;
      setZoomLevel((prev) => {
        // Smooth zoom-in with ease
        const dz = targetZoom - prev;
        const ease = 0.1; // Zoom-in ease (0.08-0.12 range)
        return prev + dz * ease;
      });
    }
  }, [recordingState, followCursor, zoomState]);

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

    movesRef.current.push({
      x: normalizedX,
      y: normalizedY,
      timestamp: (now - recordingStartTimeRef.current) / 1000,
      screenWidth: clientWidth,
      screenHeight: clientHeight,
    });

    // Update current cursor position for preview following
    setCurrentCursorPos({ x: normalizedX, y: normalizedY });

    // 🧠 Intent tracking: Detect focused movement and cursor dwell
    if (followCursor) {
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
  }, [recordingState, followCursor, zoomState]);

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

      // 🧠 Scroll detection - hard intent reset
      let scrollTimeout: NodeJS.Timeout | null = null;
      const handleScroll = () => {
        if (!followCursor) return;
        
        const now = Date.now();
        lastScrollTimeRef.current = now;
        isScrollingRef.current = true;
        
        // Cancel zoom-in immediately
        if (zoomState === "FOCUSED" || zoomState === "HOLD" || zoomState === "DECAY") {
          setZoomState("NEUTRAL");
          zoomTargetRef.current = 1;
        }
        
        // Clear scroll timeout
        if (scrollTimeout) clearTimeout(scrollTimeout);
        
        // Mark scroll as settled after 400ms
        scrollTimeout = setTimeout(() => {
          isScrollingRef.current = false;
          // Start zoom-out after scroll settles
          if (zoomLevel > 1) {
            setZoomState("HOLD");
            holdStartTimeRef.current = Date.now();
          }
        }, 400);
      };

      window.addEventListener("scroll", handleScroll, true);
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
  }, [recordingState, handlePointerDown, handlePointerMove, currentCursorPos, followCursor, zoomState, zoomLevel]);

  // 🧠 ZOOM-OUT STATE MACHINE: Intent-driven zoom-out logic
  useEffect(() => {
    if (!followCursor || recordingState !== "recording") {
      // Reset zoom state when not following or not recording
      if (zoomState !== "NEUTRAL") {
        setZoomState("NEUTRAL");
        setZoomLevel(1);
        zoomTargetRef.current = 1;
      }
      return;
    }

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastIntent = now - lastIntentTimeRef.current;
      const timeSinceLastClick = now - lastClickTimeRef.current;
      const timeSinceLastScroll = now - lastScrollTimeRef.current;
      
      // Don't process if scrolling
      if (isScrollingRef.current) return;

      // ✅ TRIGGER 1: Intent Idle (Primary Trigger)
      const T_idle = 1500; // 1200-1800ms range, using 1500ms as default
      
      // Check if cursor is actively dwelling (reading) - this is valid intent
      const isCursorDwelling = cursorDwellStartRef.current !== null && 
                               cursorDwellPositionRef.current !== null;
      const dwellDuration = isCursorDwelling && cursorDwellStartRef.current 
                          ? now - cursorDwellStartRef.current 
                          : Infinity;
      
      // Intent is idle if: no recent clicks, no recent movement, and not dwelling
      const isIntentIdle = timeSinceLastIntent > T_idle && 
                          timeSinceLastClick > T_idle &&
                          !isCursorDwelling; // Cursor dwell (reading) is valid intent

      // ✅ TRIGGER 2: Cursor Leaves Focus Area
      let cursorLeftFocus = false;
      if (focusPointRef.current && currentCursorPos) {
        const dx = Math.abs(currentCursorPos.x - focusPointRef.current.x);
        const dy = Math.abs(currentCursorPos.y - focusPointRef.current.y);
        const viewportDistance = Math.max(dx, dy);
        
        if (viewportDistance > 0.45) { // 45% viewport distance
          // Check if sustained for 400ms
          const cursorLeaveStart = now - (timeSinceLastIntent);
          if (cursorLeaveStart > 400) {
            cursorLeftFocus = true;
          }
        }
      }

      // ✅ TRIGGER 3: Click Cluster Ends
      const T_cluster = 1000; // 800-1200ms range
      const clickClusterEnded = timeSinceLastClick > T_cluster && 
                                clicksRef.current.length > 0 &&
                                zoomState === "FOCUSED";

      // State machine transitions
      if (zoomState === "FOCUSED") {
        // Check if we should enter HOLD state
        if (isIntentIdle || cursorLeftFocus || clickClusterEnded) {
          setZoomState("HOLD");
          holdStartTimeRef.current = now;
        }
      } else if (zoomState === "HOLD") {
        // Hold for 400-600ms before decay
        const holdDuration = holdStartTimeRef.current ? now - holdStartTimeRef.current : 0;
        const T_hold = 400; // 300-600ms range
        
        if (holdDuration > T_hold) {
          // Check if new intent occurred during hold
          if (timeSinceLastIntent < T_idle && timeSinceLastClick < T_idle) {
            // New intent - cancel zoom-out
            setZoomState("FOCUSED");
            holdStartTimeRef.current = null;
          } else {
            // Proceed to decay
            setZoomState("DECAY");
            // Set partial zoom target (don't always return to 1.0)
            const currentZoom = zoomLevel;
            if (currentZoom > 1.3) {
              zoomTargetRef.current = Math.max(1.15, currentZoom * 0.8); // Partial zoom-out
            } else {
              zoomTargetRef.current = 1.0; // Full zoom-out for smaller zooms
            }
          }
        }
      } else if (zoomState === "DECAY") {
        // Decay is handled in the cursor following effect
        // But check if we should cancel decay due to new intent
        if (timeSinceLastIntent < T_idle && timeSinceLastClick < T_idle) {
          // New intent detected - cancel zoom-out, re-enter FOCUSED
          setZoomState("FOCUSED");
          lastIntentTimeRef.current = now;
          zoomTargetRef.current = 1.4; // Re-zoom to click target
        }
      } else if (zoomState === "NEUTRAL") {
        // In neutral state, check if we've reached target
        if (Math.abs(zoomLevel - zoomTargetRef.current) < 0.01) {
          zoomTargetRef.current = 1.0;
        }
      }
    }, 100); // Check every 100ms

    return () => clearInterval(checkInterval);
  }, [followCursor, recordingState, zoomState, zoomLevel, currentCursorPos]);

  // Track cursor position directly on container for accurate indicator
  useEffect(() => {
    if (!followCursor || recordingState !== "recording" || !previewContainerRef.current) {
      setCursorIndicatorPos(null);
      return;
    }

    const container = previewContainerRef.current;
    
    const handleContainerMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      // Clamp to container bounds (0-1)
      const clampedX = Math.max(0, Math.min(1, x));
      const clampedY = Math.max(0, Math.min(1, y));
      
      setCursorIndicatorPos({ x: clampedX, y: clampedY });
    };

    const handleContainerMouseLeave = () => {
      setCursorIndicatorPos(null);
    };

    container.addEventListener("mousemove", handleContainerMouseMove);
    container.addEventListener("mouseleave", handleContainerMouseLeave);

    return () => {
      container.removeEventListener("mousemove", handleContainerMouseMove);
      container.removeEventListener("mouseleave", handleContainerMouseLeave);
    };
  }, [followCursor, recordingState]);

  // Cursor following effect - smooth pan/zoom to follow cursor
  useEffect(() => {
    if (!followCursor || recordingState !== "recording" || !previewContainerRef.current) {
      // Reset transform when not following
      if (videoPreviewRef.current) {
        videoPreviewRef.current.style.transform = `scale(${zoomLevel})`;
        videoPreviewRef.current.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
      }
      return;
    }

    const container = previewContainerRef.current;
    const video = videoPreviewRef.current;
    if (!container || !video) return;

    let animationFrameId: number | null = null;
    let lastUpdateTime = 0;
    let lastIndicatorUpdateTime = 0;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const updateFollow = (timestamp: number) => {
      // Throttle to ~60fps for smooth following
      if (timestamp - lastUpdateTime < 16) {
        animationFrameId = requestAnimationFrame(updateFollow);
        return;
      }
      lastUpdateTime = timestamp;

      if (!followCursor || !currentCursorPos || recordingState !== "recording") {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      // Get video dimensions (accounting for aspect ratio)
      const videoAspect = video.videoWidth / video.videoHeight || 16 / 9;
      const containerAspect = containerWidth / containerHeight;
      
      let videoDisplayWidth: number;
      let videoDisplayHeight: number;
      
      if (videoAspect > containerAspect) {
        // Video is wider - fit to width
        videoDisplayWidth = containerWidth;
        videoDisplayHeight = containerWidth / videoAspect;
      } else {
        // Video is taller - fit to height
        videoDisplayHeight = containerHeight;
        videoDisplayWidth = containerHeight * videoAspect;
      }

      // 🧠 ZOOM-IN: Event-driven (smooth ease)
      if (zoomState === "FOCUSED") {
        setZoomLevel((prev) => {
          const targetZoom = zoomTargetRef.current;
          const dz = targetZoom - prev;
          const ease = 0.1; // Zoom-in ease (0.08-0.12 range)
          const updated = prev + dz * ease;
          return clamp(updated, 1, 3);
        });
      }

      // 🧠 ZOOM-OUT: State-driven (adaptive decay)
      if (zoomState === "DECAY") {
        setZoomLevel((prev) => {
          const targetZoom = zoomTargetRef.current;
          const dz = targetZoom - prev;
          
          // Improved adaptive decay: Faster and more reliable
          const absDz = Math.abs(dz);
          // Increase decay speed for better responsiveness
          const decaySpeed = clamp(absDz * 0.08, 0.005, 0.03); // Faster decay
          const updated = prev + dz * decaySpeed;
          const clamped = clamp(updated, 1, 3);
          
          // Check if we've reached target (within threshold)
          if (Math.abs(clamped - targetZoom) < 0.01) {
            // Reached target - transition to NEUTRAL if target is 1.0, else continue to next partial zoom
            if (targetZoom <= 1.01) {
              setZoomState("NEUTRAL");
              zoomTargetRef.current = 1.0;
            } else {
              // Partial zoom reached, continue to full zoom-out
              zoomTargetRef.current = 1.0;
            }
          }
          
          return clamped;
        });
      }

      // Calculate cursor position in video coordinates (normalized 0-1)
      const cursorX = currentCursorPos.x;
      const cursorY = currentCursorPos.y;

      // Calculate where cursor is in the scaled video
      const currentZoom = zoomLevel;
      const scaledWidth = videoDisplayWidth * currentZoom;
      const scaledHeight = videoDisplayHeight * currentZoom;

      // Calculate the offset needed to center the cursor
      let offsetX = (containerWidth / 2) - (cursorX * scaledWidth);
      let offsetY = (containerHeight / 2) - (cursorY * scaledHeight);

      // 🧠 Gentle camera re-centering during zoom-out (blended with cursor following)
      if (zoomState === "DECAY") {
        // Blend re-centering with cursor following (70% cursor, 30% re-center)
        const reCenterX = 0; // Center of viewport
        const reCenterY = 0;
        const blendFactor = 0.3; // How much to blend toward center
        
        // Smoothly blend toward center while still following cursor
        offsetX = offsetX * (1 - blendFactor) + reCenterX * blendFactor;
        offsetY = offsetY * (1 - blendFactor) + reCenterY * blendFactor;
      }

      // Clamp offsets to prevent panning beyond video bounds
      const maxOffsetX = Math.max(0, (scaledWidth - containerWidth) / 2);
      const maxOffsetY = Math.max(0, (scaledHeight - containerHeight) / 2);
      
      const clampedOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
      const clampedOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));

      // Apply smooth transform with pan and zoom
      const transform = `translate(${clampedOffsetX}px, ${clampedOffsetY}px) scale(${currentZoom})`;
      video.style.transform = transform;
      
      // Use different transitions based on state
      if (zoomState === "FOCUSED") {
        video.style.transition = "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)"; // Smooth zoom-in
      } else if (zoomState === "DECAY") {
        video.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"; // Calm zoom-out
      } else {
        video.style.transition = "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)";
      }

      animationFrameId = requestAnimationFrame(updateFollow);
    };

    animationFrameId = requestAnimationFrame(updateFollow);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [followCursor, currentCursorPos, zoomLevel, recordingState, zoomState]);

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

  // Persist cursor following preference
  useEffect(() => {
    localStorage.setItem("recorder_followCursor", followCursor.toString());
  }, [followCursor]);

  // Zoom controls (manual - overrides automatic system)
  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 0.25, 3);
    setZoomLevel(newZoom);
    zoomTargetRef.current = newZoom;
    setZoomState("FOCUSED");
    lastIntentTimeRef.current = Date.now();
    if (currentCursorPos) {
      focusPointRef.current = currentCursorPos;
    }
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 0.25, 0.5);
    setZoomLevel(newZoom);
    zoomTargetRef.current = newZoom;
    if (newZoom <= 1.01) {
      setZoomState("NEUTRAL");
      zoomTargetRef.current = 1.0;
    } else {
      setZoomState("FOCUSED");
      lastIntentTimeRef.current = Date.now();
    }
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    zoomTargetRef.current = 1;
    setZoomState("NEUTRAL");
    focusPointRef.current = null;
  };

  const startRecordingActual = async () => {
    if (!mediaStreamRef.current) return;

    chunksRef.current = [];
    clicksRef.current = [];
    movesRef.current = [];
    setMarkers([]); // Reset markers
    recordingStartTimeRef.current = Date.now();

    // Setup canvas recording to capture the preview container
    let canvasStream: MediaStream | null = null;
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

    // Use canvas stream if available, otherwise fall back to screen stream
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

    const mediaRecorder = new MediaRecorder(recordingStream, {
      mimeType: selectedMimeType,
      videoBitsPerSecond: recordingQuality === "high" ? 8000000 : recordingQuality === "medium" ? 4000000 : 2000000,
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
            markers: markers,
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
    // Request final data chunk before stopping
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused') {
        // Request any remaining data
        mediaRecorderRef.current.requestData();
        // Small delay to ensure data is collected
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
                    <li><strong>Cursor Following is enabled by default</strong> - the preview automatically tracks your cursor</li>
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
                  {!followCursor && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-background/50">
                      <Move className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-foreground">Enable cursor following (F key) to automatically track your mouse movements.</p>
                      </div>
                    </div>
                  )}
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
                    The preview automatically pans and zooms to follow your cursor, ensuring viewers never miss important interactions. Zoom controls let you focus on specific areas.
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
              className={`relative flex aspect-video flex-col items-center justify-center bg-gradient-subtle transition-all duration-300 overflow-hidden p-4 ${
                recordingState === "recording" 
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
                  className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] object-contain origin-center rounded-lg shadow-2xl border border-border/50"
                  style={{
                    transform: followCursor && currentCursorPos ? undefined : `scale(${zoomLevel})`,
                    transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              )}

              {/* Cursor Position Indicator (when following) */}
              {followCursor && cursorIndicatorPos && recordingState === "recording" && showPreview && (
                <div
                  className="absolute z-30 pointer-events-none"
                  style={{
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

                    {/* Zoom and Follow Controls */}
                    {recordingState === "recording" && (
                      <div className="mt-4 flex flex-col items-center justify-center gap-2">
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex items-center gap-1 rounded-lg bg-background/80 backdrop-blur-sm border border-border/50 px-2 py-1 shadow-sm">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-background"
                              onClick={handleZoomOut}
                              disabled={zoomLevel <= 0.5}
                              title="Zoom Out (-)"
                            >
                              <ZoomOut className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-xs font-mono px-2 min-w-[3.5rem] text-center font-medium">
                              {Math.round(zoomLevel * 100)}%
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-background"
                              onClick={handleZoomIn}
                              disabled={zoomLevel >= 3}
                              title="Zoom In (+)"
                            >
                              <ZoomIn className="h-3.5 w-3.5" />
                            </Button>
                            <div className="h-4 w-px bg-border mx-1" />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:bg-background"
                              onClick={handleResetZoom}
                              disabled={zoomLevel === 1}
                              title="Reset Zoom (0)"
                            >
                              <Maximize2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <Button
                            variant={followCursor ? "default" : "outline"}
                            size="sm"
                            className={`h-7 px-3 gap-1.5 transition-all ${
                              followCursor 
                                ? "bg-primary text-primary-foreground shadow-sm" 
                                : ""
                            }`}
                            onClick={() => setFollowCursor(!followCursor)}
                            title="Toggle Cursor Following (F)"
                          >
                            <Move className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">Follow</span>
                            {followCursor && (
                              <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground/60 animate-pulse" />
                            )}
                          </Button>
                        </div>
                        {followCursor && currentCursorPos && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Move className="h-3 w-3" />
                            <span>Following cursor at ({Math.round(currentCursorPos.x * 100)}%, {Math.round(currentCursorPos.y * 100)}%)</span>
                          </div>
                        )}
                      </div>
                    )}

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
                                  className={`h-full transition-all duration-700 ease-out ${
                                    recordingQualityScore >= 80 ? 'bg-gradient-to-r from-green-400 to-green-500' : 
                                    recordingQualityScore >= 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 'bg-gradient-to-r from-red-400 to-red-500'
                                  }`}
                                  style={{ width: `${recordingQualityScore}%` }}
                                />
                              </div>
                              <span className={`text-xs font-mono font-semibold min-w-[2.5rem] ${
                                recordingQualityScore >= 80 ? 'text-green-500' : 
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

                      {/* Cursor Following Indicator */}
                      {followCursor && recordingState === "recording" && (
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
                    <div className="flex flex-col">
                      <Label htmlFor="follow-cursor" className="cursor-pointer text-sm">Follow Cursor</Label>
                      <span className="text-xs text-muted-foreground">Auto-pan preview to follow cursor</span>
                    </div>
                    <Switch
                      id="follow-cursor"
                      checked={followCursor}
                      onCheckedChange={setFollowCursor}
                    />
                  </div>

                  {recordingState === "recording" && (
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Move className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-primary">Cursor Following Active</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        The preview will automatically pan and zoom to keep your cursor centered. Use zoom controls during recording to adjust.
                      </p>
                    </div>
                  )}
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
                    <div className="flex items-center gap-1">
                      <Keyboard className="h-3 w-3" />
                      <span>F: Follow Cursor</span>
                    </div>
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
