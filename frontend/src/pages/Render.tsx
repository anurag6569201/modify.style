import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { ShareDialog } from "@/components/ShareDialog";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft, Download, Loader2, Video, FileVideo, Image as ImageIcon, Settings, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PresentationConfig, VideoConfig, EffectsConfig, CursorConfig } from "@/lib/editor/types";
import { calculateOutputDimensions, calculateVideoTransform } from "@/lib/composition/aspectRatio";
import { FilterEngine } from "@/lib/effects/filters";
import { getCursorPos } from "@/lib/composition/math";
import { smoothedCursor, cursorTrail, clickPulseProgress } from "@/lib/editor/cursor";
import { updateCameraSystem, getInitialCameraState } from "@/lib/composition/camera";
import { ClickData, MoveData } from "./Recorder";
import { projectsApi, type ProjectDetail } from "@/lib/api/projects";
import { editorHref } from "@/lib/studio/pipeline";
import { useAuth } from "@/contexts/AuthContext";
import { useEntitlement } from "@/lib/entitlements";
import { useGuestSignIn } from "@/hooks/useGuestSignIn";
import {
  guestCanRender,
  recordGuestRender,
  GUEST_FREE_RENDERS,
} from "@/lib/guest/guestSession";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sparkles } from "lucide-react";

// Helper function to render background
function renderBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  presentation: PresentationConfig,
  backgroundImageCache?: HTMLImageElement
) {
  ctx.clearRect(0, 0, width, height);

  if (presentation.backgroundMode === 'hidden') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (presentation.backgroundMode === 'solid') {
    ctx.fillStyle = presentation.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  } else if (presentation.backgroundMode === 'gradient') {
    const { type, angle = 135, stops } = presentation.backgroundGradient;

    let gradient: CanvasGradient;

    if (type === 'linear') {
      const rad = (angle * Math.PI) / 180;
      const x1 = width / 2 - (width / 2) * Math.cos(rad);
      const y1 = height / 2 - (height / 2) * Math.sin(rad);
      const x2 = width / 2 + (width / 2) * Math.cos(rad);
      const y2 = height / 2 + (height / 2) * Math.sin(rad);

      gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    } else {
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.max(width, height) / 2;
      gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    }

    stops.forEach(stop => {
      gradient.addColorStop(stop.position, stop.color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else if (presentation.backgroundMode === 'image' && presentation.backgroundImage) {
    // Use cached image if provided, otherwise try to draw (may not be loaded yet)
    const img = backgroundImageCache;
    if (img && img.complete && img.naturalWidth > 0) {
      const imgAspect = img.width / img.height;
      const canvasAspect = width / height;

      let drawWidth = width;
      let drawHeight = height;
      let drawX = 0;
      let drawY = 0;

      if (imgAspect > canvasAspect) {
        drawWidth = height * imgAspect;
        drawX = (width - drawWidth) / 2;
      } else {
        drawHeight = width / imgAspect;
        drawY = (height - drawHeight) / 2;
      }

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    } else {
      // Fallback to black if image not loaded
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    }
  }

  if (presentation.backgroundBlur > 0) {
    applyBlur(ctx, width, height, presentation.backgroundBlur, presentation.backgroundBlurType);
  }
}

function applyBlur(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  blur: number,
  blurType: 'gaussian' | 'stack'
) {
  if (blur <= 0) return;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;

  tempCtx.drawImage(ctx.canvas, 0, 0);

  if (blurType === 'stack') {
    const passes = Math.ceil(blur / 10);
    const blurRadius = blur / passes;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < passes; i++) {
      ctx.filter = `blur(${blurRadius}px)`;
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.filter = 'none';

      if (i < passes - 1) {
        tempCtx.clearRect(0, 0, width, height);
        tempCtx.drawImage(ctx.canvas, 0, 0);
      }
    }
  } else {
    ctx.clearRect(0, 0, width, height);
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = 'none';
  }
}

// Easing functions for click animations
function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case 'linear': return t;
    case 'ease-out': return 1 - Math.pow(1 - t, 3);
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'bounce':
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      else return n1 * (t -= 2.625 / d1) * t + 0.984375;
    case 'elastic':
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    default: return 1 - Math.pow(1 - t, 3);
  }
}

function drawRipple(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  eased: number,
  width: number,
  height: number,
  sizeMultiplier: number,
  force: number,
  color: { r: number; g: number; b: number }
) {
  const maxRadius = Math.min(width, height) * 0.05 * sizeMultiplier * force;
  const radius = maxRadius * (0.3 + 0.7 * eased);
  const opacity = (1 - progress) * force;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.2})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
  ctx.lineWidth = 2 * force;
  ctx.stroke();
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  eased: number,
  width: number,
  height: number,
  sizeMultiplier: number,
  force: number,
  color: { r: number; g: number; b: number }
) {
  const maxRadius = Math.min(width, height) * 0.04 * sizeMultiplier * force;
  const radius = maxRadius * eased;
  const opacity = (1 - Math.pow(progress, 2)) * force;

  // Outer glow
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`);
  gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.5})`);
  gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

function drawPulse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  eased: number,
  width: number,
  height: number,
  sizeMultiplier: number,
  force: number,
  color: { r: number; g: number; b: number }
) {
  const maxRadius = Math.min(width, height) * 0.06 * sizeMultiplier * force;
  const pulse = Math.sin(progress * Math.PI * 4) * 0.5 + 0.5; // Pulsing effect
  const radius = maxRadius * (0.4 + 0.6 * eased) * (1 + pulse * 0.2);
  const opacity = (1 - progress) * force * (0.7 + pulse * 0.3);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.3})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
  ctx.lineWidth = 3 * force;
  ctx.stroke();
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  eased: number,
  width: number,
  height: number,
  sizeMultiplier: number,
  force: number,
  color: { r: number; g: number; b: number }
) {
  const maxRadius = Math.min(width, height) * 0.05 * sizeMultiplier * force;
  const radius = maxRadius * eased;
  const opacity = (1 - progress) * force;
  const ringWidth = 4 * force;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
  ctx.lineWidth = ringWidth;
  ctx.stroke();

  // Inner ring
  if (progress < 0.5) {
    const innerRadius = radius * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.5})`;
    ctx.lineWidth = ringWidth * 0.5;
    ctx.stroke();
  }
}

function drawSplash(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  eased: number,
  width: number,
  height: number,
  sizeMultiplier: number,
  force: number,
  color: { r: number; g: number; b: number }
) {
  const maxRadius = Math.min(width, height) * 0.08 * sizeMultiplier * force;
  const radius = maxRadius * eased;
  const opacity = (1 - Math.pow(progress, 1.5)) * force;
  const particles = 8;

  // Central orb
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.5);
  gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`);
  gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Splash particles
  for (let i = 0; i < particles; i++) {
    const angle = (i / particles) * Math.PI * 2;
    const distance = radius * (0.5 + eased * 0.5);
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance;
    const particleSize = (radius * 0.1) * (1 - progress);
    const particleOpacity = opacity * (1 - progress * 0.5);

    ctx.beginPath();
    ctx.arc(px, py, particleSize, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${particleOpacity})`;
    ctx.fill();
  }
}

function drawClickAnimation(
  ctx: CanvasRenderingContext2D,
  click: ClickData,
  time: number,
  canvasWidth: number,
  canvasHeight: number,
  effectsConfig: EffectsConfig
) {
  const CLICK_DELAY = 0.08;
  const ANIMATION_DURATION = 0.6;
  const timeSinceClick = time - click.timestamp;

  if (timeSinceClick < CLICK_DELAY || timeSinceClick >= CLICK_DELAY + ANIMATION_DURATION) {
    return;
  }

  const progress = Math.max(0, Math.min(1, (timeSinceClick - CLICK_DELAY) / ANIMATION_DURATION));
  const easedProgress = applyEasing(progress, effectsConfig.clickEasing);
  const force = effectsConfig.clickForce;

  const cx = click.x * canvasWidth;
  const cy = click.y * canvasHeight;

  const baseColor = click.type === 'rightClick'
    ? { r: 239, g: 68, b: 68 }
    : { r: 59, g: 130, b: 246 };

  // Render based on animation style (matching CursorLayer.tsx)
  switch (effectsConfig.clickAnimationStyle) {
    case 'ripple':
      drawRipple(ctx, cx, cy, progress, easedProgress, canvasWidth, canvasHeight, effectsConfig.clickSize, force, baseColor);
      break;
    case 'orb':
      drawOrb(ctx, cx, cy, progress, easedProgress, canvasWidth, canvasHeight, effectsConfig.clickSize, force, baseColor);
      break;
    case 'pulse':
      drawPulse(ctx, cx, cy, progress, easedProgress, canvasWidth, canvasHeight, effectsConfig.clickSize, force, baseColor);
      break;
    case 'ring':
      drawRing(ctx, cx, cy, progress, easedProgress, canvasWidth, canvasHeight, effectsConfig.clickSize, force, baseColor);
      break;
    case 'splash':
      drawSplash(ctx, cx, cy, progress, easedProgress, canvasWidth, canvasHeight, effectsConfig.clickSize, force, baseColor);
      break;
  }
}

function drawCursor(
  ctx: CanvasRenderingContext2D,
  time: number,
  moves: MoveData[],
  clicks: ClickData[],
  canvasWidth: number,
  canvasHeight: number,
  cursorConfig: CursorConfig
) {
  if (!cursorConfig || (cursorConfig as any).style === 'hidden') return;
  const smoothing = (cursorConfig as any).smoothing ?? 0.35;
  const pos = smoothedCursor(time, moves, smoothing);
  if (!pos) return;

  const cx = pos.x * canvasWidth;
  const cy = pos.y * canvasHeight;
  const size = 22 * (cursorConfig.size || 1) * (canvasWidth / 1280);
  const haloColor = (cursorConfig as any).haloColor || '#e8506e';
  const style = (cursorConfig as any).style || 'arrow';
  const pulse = (cursorConfig as any).clickPulse ? clickPulseProgress(time, clicks) : null;

  // Trail
  if (cursorConfig.trail && cursorConfig.trailLength > 0) {
    const trail = cursorTrail(time, moves, cursorConfig.trailLength, smoothing);
    trail.forEach((p, i) => {
      const alpha = 0.35 * (1 - i / trail.length);
      const r = Math.max(1, size * 0.22 * (1 - i / trail.length));
      ctx.beginPath();
      ctx.arc(p.x * canvasWidth, p.y * canvasHeight, r, 0, Math.PI * 2);
      ctx.fillStyle = cursorHexAlpha(haloColor, alpha);
      ctx.fill();
    });
  }

  // Spotlight dimming
  if (style === 'spotlight') {
    const radius = size * 5;
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius * 1.6);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Click pulse ring
  if (pulse !== null) {
    const pr = size * (1 + pulse * 2.4);
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.strokeStyle = cursorHexAlpha(haloColor, 0.75 * (1 - pulse));
    ctx.lineWidth = Math.max(1.5, size * 0.14 * (1 - pulse));
    ctx.stroke();
  }

  // Glow
  if (cursorConfig.glow) {
    ctx.shadowColor = haloColor;
    ctx.shadowBlur = size * 0.9;
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
  }

  const pressScale = pulse !== null && pulse < 0.3 ? 1 - 0.18 * (1 - pulse / 0.3) : 1;
  switch (style) {
    case 'halo': {
      ctx.beginPath();
      ctx.arc(cx, cy, size * 1.5 * pressScale, 0, Math.PI * 2);
      ctx.fillStyle = cursorHexAlpha(haloColor, 0.28);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, size * 1.5 * pressScale, 0, Math.PI * 2);
      ctx.strokeStyle = cursorHexAlpha(haloColor, 0.6);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      drawArrowCursor(ctx, cx, cy, size * pressScale, cursorConfig.color);
      break;
    }
    case 'dot': {
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.55 * pressScale, 0, Math.PI * 2);
      ctx.fillStyle = cursorConfig.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'spotlight': {
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.45 * pressScale, 0, Math.PI * 2);
      ctx.fillStyle = cursorConfig.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'arrow':
    default:
      drawArrowCursor(ctx, cx, cy, size * pressScale, cursorConfig.color);
      break;
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

function drawArrowCursor(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + size * 1.15);
  ctx.lineTo(x + size * 0.28, y + size * 0.88);
  ctx.lineTo(x + size * 0.48, y + size * 1.32);
  ctx.lineTo(x + size * 0.62, y + size * 1.24);
  ctx.lineTo(x + size * 0.42, y + size * 0.82);
  ctx.lineTo(x + size * 0.78, y + size * 0.78);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function cursorHexAlpha(hex: string, alpha: number): string {
  if (/^#([0-9a-f]{6})$/i.test(hex)) {
    const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
    return hex + a;
  }
  return hex;
}

export default function Render() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryProjectId = searchParams.get("project");
  const {
    projectId: stateProjectId,
    videoUrl: stateVideoUrl,
    clickData = [],
    moveData = [],
    effects: zoomEffects = [],
    camera: cameraConfig,
    presentation,
    colorGrading,
    effectsConfig,
    cursorConfig,
    textOverlays = [],
    rawRecording = false,
    voiceover,
    music,
  } = location.state || {};

  // Camera config for the render pass (zoom strength/speed/padding). Falls back
  // to sensible auto-template defaults if we arrived without editor state.
  const renderCameraConfig = {
    zoomStrength: cameraConfig?.zoomStrength ?? 1.5,
    speed: cameraConfig?.speed ?? 1.0,
    padding: cameraConfig?.padding ?? 0.2,
  };

  const projectId = stateProjectId ?? queryProjectId ?? undefined;

  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"webm" | "mp4" | "gif" | "apng">("webm");
  const [exportQuality, setExportQuality] = useState<"high" | "medium" | "low">("high");
  const [showSettings, setShowSettings] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [renderWallOpen, setRenderWallOpen] = useState(false);

  const { isAuthenticated } = useAuth();
  const signIn = useGuestSignIn();
  const hdEntitled = useEntitlement("hdExport");

  const videoUrl = stateVideoUrl ?? project?.video_url ?? undefined;


  useEffect(() => {
    if (!projectId) return;
    projectsApi
      .get(projectId)
      .then(setProject)
      .catch(() => undefined);
  }, [projectId]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cameraStateRef = useRef(getInitialCameraState());
  const cursorImageRef = useRef<HTMLImageElement | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<Map<number, AudioBufferSourceNode>>(new Map());
  const { toast } = useToast();

  // Preload background image if needed
  useEffect(() => {
    if (presentation?.backgroundMode === 'image' && presentation.backgroundImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = presentation.backgroundImage;
      backgroundImageRef.current = img;
    }
  }, [presentation?.backgroundMode, presentation?.backgroundImage]);

  // Load cursor image
  useEffect(() => {
    const img = new Image();
    img.src = `data:image/svg+xml;utf8,<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 3.5L11.5 19.5L14.5 13.5L20.5 13.5L5.5 3.5Z" fill="black" stroke="white" stroke-width="1.5"/></svg>`;
    cursorImageRef.current = img;
  }, []);

  const startRendering = async () => {
    if (!videoUrl || !canvasRef.current || !videoRef.current) return;

    // Guests get a limited number of free renders, then we ask them to sign in.
    if (!isAuthenticated && !guestCanRender()) {
      setRenderWallOpen(true);
      return;
    }

    setRendering(true);
    setProgress(0);
    setDownloadUrl(null);
    chunksRef.current = [];

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Wait for video metadata
    if (video.readyState < 2) {
      await new Promise(r => { video.onloadedmetadata = r; });
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    let videoWidth = video.videoWidth;
    let videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight || videoWidth === 0 || videoHeight === 0) {
      await new Promise(resolve => {
        const checkDimensions = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            videoWidth = video.videoWidth;
            videoHeight = video.videoHeight;
            resolve(undefined);
          } else {
            setTimeout(checkDimensions, 50);
          }
        };
        checkDimensions();
      });
    }

    // Use presentation config if available, otherwise use video dimensions
    const presentationConfig: PresentationConfig = presentation || {
      aspectRatio: 'native',
      outputWidth: videoWidth,
      outputHeight: videoHeight,
      backgroundMode: 'hidden',
      backgroundColor: '#000000',
      backgroundGradient: { type: 'linear', angle: 135, stops: [] },
      backgroundBlur: 0,
      backgroundBlurType: 'gaussian',
      videoCrop: { enabled: false, top: 0, bottom: 0, left: 0, right: 0, roundedCorners: false, cornerRadius: 12 },
      screenDPR: 1.0,
      videoPadding: { enabled: false, top: 50, right: 50, bottom: 50, left: 50, uniform: true },
    };

    const videoConfig: VideoConfig = {
      url: videoUrl,
      duration: video.duration,
      width: videoWidth,
      height: videoHeight,
      aspectRatio: videoWidth / videoHeight,
    };

    // Calculate output dimensions
    const outputDims = calculateOutputDimensions(
      presentationConfig.aspectRatio,
      videoWidth,
      videoHeight,
      presentationConfig.customAspectRatio
    );

    // Apply DPR multiplier
    const dpr = presentationConfig.screenDPR || 1.0;
    const canvasWidth = Math.round(outputDims.width * dpr);
    const canvasHeight = Math.round(outputDims.height * dpr);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    ctx.scale(dpr, dpr);

    // Filter engine will be created per-frame with correct video dimensions

    // Calculate video transform
    const presentationWithDims = {
      ...presentationConfig,
      outputWidth: outputDims.width,
      outputHeight: outputDims.height,
    };
    const videoTransform = calculateVideoTransform(videoConfig, presentationWithDims);

    // Calculate padding
    const padding = presentationConfig.videoPadding?.enabled
      ? (presentationConfig.videoPadding.uniform
        ? {
          top: presentationConfig.videoPadding.top,
          right: presentationConfig.videoPadding.top,
          bottom: presentationConfig.videoPadding.top,
          left: presentationConfig.videoPadding.top,
        }
        : presentationConfig.videoPadding)
      : null;

    // Adjust video position/size if padding is enabled
    let finalVideoX = videoTransform.x;
    let finalVideoY = videoTransform.y;
    let finalVideoWidth = videoTransform.width;
    let finalVideoHeight = videoTransform.height;

    if (padding) {
      const availableWidth = outputDims.width - padding.left - padding.right;
      const availableHeight = outputDims.height - padding.top - padding.bottom;
      const videoAspect = videoTransform.width / videoTransform.height;
      const availableAspect = availableWidth / availableHeight;

      let scaledWidth = availableWidth;
      let scaledHeight = availableHeight;

      if (videoAspect > availableAspect) {
        scaledHeight = availableWidth / videoAspect;
      } else {
        scaledWidth = availableHeight * videoAspect;
      }

      finalVideoWidth = scaledWidth;
      finalVideoHeight = scaledHeight;
      finalVideoX = padding.left + (availableWidth - scaledWidth) / 2;
      finalVideoY = padding.top + (availableHeight - scaledHeight) / 2;
    }

    // Determine FPS and bitrate
    // HD (high) export is a Pro feature — clamp to medium for everyone else.
    const effectiveQuality =
      hdEntitled || exportQuality !== "high" ? exportQuality : "medium";
    const fps = effectiveQuality === "high" ? 60 : effectiveQuality === "medium" ? 30 : 24;
    const bitrate = effectiveQuality === "high" ? 8000000 : effectiveQuality === "medium" ? 4000000 : 2000000;

    if (exportFormat === "gif" || exportFormat === "apng") {
      await renderAnimatedImage(exportFormat, fps, ctx, canvasWidth, canvasHeight, outputDims, video, videoConfig, presentationConfig, colorGrading, effectsConfig, cursorConfig, clickData, moveData, videoTransform, finalVideoX, finalVideoY, finalVideoWidth, finalVideoHeight, padding);
      return;
    }

    // Setup MediaRecorder
    const stream = canvas.captureStream(fps);

    // --- Audio graph: mix voiceover + music INTO the recording (not just speakers) ---
    let recordDest: MediaStreamAudioDestinationNode | null = null;
    const hasVoAudio = !!voiceover?.scriptSegments?.some(
      (seg: any) => seg.isGenerated && (seg.audioBlob || seg.audioUrl)
    );
    const hasMusic = !!(music?.enabled && (music.blob || music.url));
    if (hasVoAudio || hasMusic) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        recordDest = audioContextRef.current.createMediaStreamDestination();
        recordDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch (e) {
        console.warn("Audio mix init failed:", e);
      }
    }
    let mimeType = "video/webm;codecs=vp9";
    if (exportFormat === "mp4") {
      const mp4Types = [
        "video/mp4;codecs=avc1.42E01E",
        "video/mp4;codecs=avc1.4D001E",
        "video/mp4",
      ];
      mimeType = mp4Types.find(t => MediaRecorder.isTypeSupported(t)) || mimeType;
    }

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: bitrate,
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.warn);
        audioContextRef.current = null;
      }
      audioSourcesRef.current.clear();

      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setRendering(false);
      setProgress(100);

      // Count this render against the guest's free allowance.
      if (!isAuthenticated) recordGuestRender();

      toast({
        title: "Rendering complete",
        description: projectId
          ? "Uploading to your project…"
          : `Your ${exportFormat.toUpperCase()} video is ready to download.`,
      });

      if (projectId) {
        const duration = video.duration || 0;
        const ext =
          exportFormat === "mp4" ? "mp4" : exportFormat === "gif" ? "gif" : "webm";
        void projectsApi
          .uploadVideo(projectId, blob, {
            kind: "render",
            duration,
            filename: `export.${ext}`,
          })
          .then(() => {
            toast({
              title: "Saved to project",
              description: "Your demo is ready to share from the dashboard or share dialog.",
            });
          })
          .catch((err) => {
            console.warn("[Render] Upload failed:", err);
            toast({
              title: "Export saved locally",
              description: "Download below — cloud upload failed.",
              variant: "destructive",
            });
          });
      }
    };

    // Setup audio context and load audio segments if available
    if (voiceover?.scriptSegments && voiceover.scriptSegments.length > 0 && audioContextRef.current) {
      try {
        
        // Load and prepare audio segments
        const audioSegments = voiceover.scriptSegments.filter(s => s.isGenerated && (s.audioBlob || s.audioUrl));
        
        for (const segment of audioSegments) {
          try {
            let audioBuffer: AudioBuffer;
            
            if (segment.audioBlob) {
              const arrayBuffer = await segment.audioBlob.arrayBuffer();
              audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            } else if (segment.audioUrl) {
              const response = await fetch(segment.audioUrl);
              const arrayBuffer = await response.arrayBuffer();
              audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            } else {
              continue;
            }
            
            // Store audio buffer for playback at correct timestamp
            // We'll schedule playback in the render loop
            const segmentData = {
              buffer: audioBuffer,
              timestamp: segment.timestamp,
              duration: segment.duration || audioBuffer.duration,
            };
            
            // Schedule audio playback when video reaches the segment timestamp
            // This will be handled in the render loop
            (audioSourcesRef.current as any).set(segment.timestamp, segmentData);
          } catch (error) {
            console.warn(`Failed to load audio segment at ${segment.timestamp}s:`, error);
          }
        }
      } catch (error) {
        console.warn('Failed to initialize audio context:', error);
      }
    }

    // --- Background music with fades + ducking under narration ---
    let musicSource: AudioBufferSourceNode | null = null;
    if (hasMusic && audioContextRef.current && recordDest) {
      try {
        const actx = audioContextRef.current;
        const ab = music.blob
          ? await music.blob.arrayBuffer()
          : await (await fetch(music.url)).arrayBuffer();
        const buffer = await actx.decodeAudioData(ab);
        musicSource = actx.createBufferSource();
        musicSource.buffer = buffer;
        musicSource.loop = !!music.loop;
        const musicGain = actx.createGain();
        musicSource.connect(musicGain);
        musicGain.connect(recordDest);
        musicGain.connect(actx.destination);

        const base = Math.max(0, Math.min(1, (music.volume ?? 30) / 100));
        const ducked = base * (1 - Math.max(0, Math.min(1, (music.ducking ?? 70) / 100)));
        const t0 = actx.currentTime + 0.05;
        const videoDur = video.duration || 0;
        const g = musicGain.gain;
        g.setValueAtTime(music.fadeIn > 0 ? 0.0001 : base, t0);
        if (music.fadeIn > 0) g.linearRampToValueAtTime(base, t0 + music.fadeIn);
        const voicedSegs = (voiceover?.scriptSegments ?? [])
          .filter((seg: any) => seg.isGenerated && (seg.audioBlob || seg.audioUrl))
          .sort((a: any, b: any) => a.timestamp - b.timestamp);
        voicedSegs.forEach((seg: any) => {
          const segStart = t0 + Math.max(0, seg.timestamp - 0.15);
          const segEnd = t0 + seg.timestamp + (seg.duration && seg.duration > 0 ? seg.duration : 4) + 0.2;
          g.setValueAtTime(base, Math.max(t0 + (music.fadeIn || 0), segStart - 0.25));
          g.linearRampToValueAtTime(ducked, segStart);
          g.setValueAtTime(ducked, segEnd);
          g.linearRampToValueAtTime(base, segEnd + 0.5);
        });
        if (videoDur > 0 && music.fadeOut > 0) {
          g.setValueAtTime(base, t0 + Math.max(0, videoDur - music.fadeOut));
          g.linearRampToValueAtTime(0.0001, t0 + videoDur);
        }
        musicSource.start(t0);
      } catch (e) {
        console.warn("Music mixing failed:", e);
      }
    }

    mediaRecorder.start();
    video.currentTime = 0;
    await video.play();

    // Start audio playback if audio context is available
    if (audioContextRef.current && audioSourcesRef.current.size > 0) {
      // Resume audio context (required by some browsers)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    }

    let lastTime = performance.now();
    const playedAudioSegments = new Set<number>();

    const renderLoop = () => {
      if (video.ended || video.paused) {
        if (video.ended) {
          try { musicSource?.stop(); } catch { /* already stopped */ }
          mediaRecorder.stop();
          return;
        }
      }

      const currentTime = video.currentTime;
      setProgress((currentTime / video.duration) * 100);

      // Play audio segments at their timestamps
      if (audioContextRef.current && audioSourcesRef.current.size > 0) {
        audioSourcesRef.current.forEach((segmentData: any, segmentTimestamp: number) => {
          // Check if we should play this segment (within 0.1s tolerance)
          if (
            !playedAudioSegments.has(segmentTimestamp) &&
            currentTime >= segmentTimestamp - 0.1 &&
            currentTime < segmentTimestamp + 0.1
          ) {
            try {
              const source = audioContextRef.current!.createBufferSource();
              source.buffer = segmentData.buffer;
              source.connect(audioContextRef.current!.destination);
              if (recordDest) source.connect(recordDest);
              
              // Calculate offset if we're slightly past the start time
              const offset = Math.max(0, currentTime - segmentTimestamp);
              source.start(0, offset);
              
              playedAudioSegments.add(segmentTimestamp);
              
              // Clean up after playback
              source.onended = () => {
                source.disconnect();
              };
            } catch (error) {
              console.warn(`Failed to play audio segment at ${segmentTimestamp}s:`, error);
            }
          }
        });
      }

      const timestamp = performance.now();
      const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
      lastTime = timestamp;

      // Render frame
      renderFrame(
        ctx,
        outputDims.width,
        outputDims.height,
        currentTime,
        video,
        videoConfig,
        presentationConfig,
        colorGrading || {},
        effectsConfig || {},
        cursorConfig || {},
        clickData,
        moveData,
        videoTransform,
        finalVideoX,
        finalVideoY,
        finalVideoWidth,
        finalVideoHeight,
        padding,
        dt,
        backgroundImageRef.current || undefined
      );

      if (!video.ended) {
        requestAnimationFrame(renderLoop);
      }
    };

    requestAnimationFrame(renderLoop);
  };

  function renderFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number,
    video: HTMLVideoElement,
    videoConfig: VideoConfig,
    presentation: PresentationConfig,
    colorGrading: any,
    effectsConfig: EffectsConfig,
    cursorConfig: CursorConfig,
    clickData: ClickData[],
    moveData: MoveData[],
    videoTransform: any,
    finalVideoX: number,
    finalVideoY: number,
    finalVideoWidth: number,
    finalVideoHeight: number,
    padding: any,
    dt: number,
    backgroundImage?: HTMLImageElement
  ) {
    // Border radius for video frame (always 12px)
    const videoBorderRadius = 12;

    // 1. Render background
    renderBackground(ctx, width, height, presentation, backgroundImage);

    // 2. Update camera system
    if (!rawRecording) {
      cameraStateRef.current = updateCameraSystem(
        cameraStateRef.current,
        time,
        dt,
        clickData,
        moveData,
        zoomEffects,
        { width: videoConfig.width, height: videoConfig.height },
        videoConfig.duration || 0,
        renderCameraConfig
      );
    }

    // 3. Calculate video dimensions and crop
    // Strategy: Always center the video in the output canvas, regardless of crop
    const crop = presentation.videoCrop;
    const videoWidth = video.videoWidth || videoConfig.width;
    const videoHeight = video.videoHeight || videoConfig.height;

    // Scale video to fit output dimensions maintaining aspect ratio
    const videoAspectRatio = videoWidth / videoHeight;
    const outputAspectRatio = finalVideoWidth / finalVideoHeight;

    let scaledVideoWidth = finalVideoWidth;
    let scaledVideoHeight = finalVideoHeight;

    if (videoAspectRatio > outputAspectRatio) {
      // Video is wider - fit to width, center vertically
      scaledVideoHeight = finalVideoWidth / videoAspectRatio;
    } else {
      // Video is taller - fit to height, center horizontally
      scaledVideoWidth = finalVideoHeight * videoAspectRatio;
    }

    // Always center the video in the output canvas
    // Calculate center position relative to output canvas (width x height)
    const centerX = width / 2;
    const centerY = height / 2;
    const scaledVideoX = centerX - scaledVideoWidth / 2;
    const scaledVideoY = centerY - scaledVideoHeight / 2;

    // Crop dimensions (crop values are relative to scaled video dimensions)
    let drawWidth = scaledVideoWidth;
    let drawHeight = scaledVideoHeight;

    if (crop?.enabled) {
      // Crop is applied as a clipping mask - video stays centered
      drawWidth = scaledVideoWidth - crop.left - crop.right;
      drawHeight = scaledVideoHeight - crop.top - crop.bottom;
    }

    // Source video coordinates (no crop applied to source - we crop after scaling)
    const sourceX = 0;
    const sourceY = 0;
    const sourceWidth = videoWidth;
    const sourceHeight = videoHeight;

    // 4. Save context for video layer
    ctx.save();

    // Apply camera transform around the center of the video (always centered in canvas)
    if (!rawRecording && cameraStateRef.current) {
      const { scale, translateX, translateY, rotation = 0, vignette } = cameraStateRef.current.transform;
      const blur = cameraStateRef.current.blur || 0;

      // Camera transform centered around the video center (which is canvas center)
      const videoCenterX = width / 2;
      const videoCenterY = height / 2;
      ctx.translate(videoCenterX, videoCenterY);
      ctx.scale(scale, scale);
      ctx.translate(translateX, translateY);
      ctx.rotate((rotation * Math.PI) / 180);

      // Apply camera blur (matching Stage.tsx)
      if (blur > 0) {
        ctx.filter = `blur(${blur}px)`;
      }

      ctx.translate(-scaledVideoWidth / 2, -scaledVideoHeight / 2);
    } else {
      ctx.translate(scaledVideoX, scaledVideoY);
    }

    // Apply crop clipping (after camera transform, before drawing)
    // Crop coordinates are relative to the scaled video area
    if (crop?.enabled) {
      // Calculate crop position relative to the transformed coordinate system
      // After transform, we're at (-scaledVideoWidth/2, -scaledVideoHeight/2) or (scaledVideoX, scaledVideoY)
      const cropX = crop.left;
      const cropY = crop.top;
      ctx.beginPath();
      ctx.rect(cropX, cropY, drawWidth, drawHeight);
      ctx.clip();
    }

    // Apply rounded corners - always use 12px border radius for video frame
    if (crop?.enabled && crop.roundedCorners && crop.cornerRadius > 0) {
      // Use crop corner radius if specified
      const radius = crop.cornerRadius;
      const cropX = crop.left;
      const cropY = crop.top;
      ctx.beginPath();
      ctx.moveTo(cropX + radius, cropY);
      ctx.lineTo(cropX + drawWidth - radius, cropY);
      ctx.quadraticCurveTo(cropX + drawWidth, cropY, cropX + drawWidth, cropY + radius);
      ctx.lineTo(cropX + drawWidth, cropY + drawHeight - radius);
      ctx.quadraticCurveTo(cropX + drawWidth, cropY + drawHeight, cropX + drawWidth - radius, cropY + drawHeight);
      ctx.lineTo(cropX + radius, cropY + drawHeight);
      ctx.quadraticCurveTo(cropX, cropY + drawHeight, cropX, cropY + drawHeight - radius);
      ctx.lineTo(cropX, cropY + radius);
      ctx.quadraticCurveTo(cropX, cropY, cropX + radius, cropY);
      ctx.closePath();
      ctx.clip();
    } else if (!crop?.enabled) {
      // Apply 12px border radius to the entire video frame when crop is not enabled
      const radius = videoBorderRadius;
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(scaledVideoWidth - radius, 0);
      ctx.quadraticCurveTo(scaledVideoWidth, 0, scaledVideoWidth, radius);
      ctx.lineTo(scaledVideoWidth, scaledVideoHeight - radius);
      ctx.quadraticCurveTo(scaledVideoWidth, scaledVideoHeight, scaledVideoWidth - radius, scaledVideoHeight);
      ctx.lineTo(radius, scaledVideoHeight);
      ctx.quadraticCurveTo(0, scaledVideoHeight, 0, scaledVideoHeight - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();
    } else {
      // Crop is enabled but roundedCorners is false - still apply 12px border radius
      const radius = videoBorderRadius;
      const cropX = crop.left;
      const cropY = crop.top;
      ctx.beginPath();
      ctx.moveTo(cropX + radius, cropY);
      ctx.lineTo(cropX + drawWidth - radius, cropY);
      ctx.quadraticCurveTo(cropX + drawWidth, cropY, cropX + drawWidth, cropY + radius);
      ctx.lineTo(cropX + drawWidth, cropY + drawHeight - radius);
      ctx.quadraticCurveTo(cropX + drawWidth, cropY + drawHeight, cropX + drawWidth - radius, cropY + drawHeight);
      ctx.lineTo(cropX + radius, cropY + drawHeight);
      ctx.quadraticCurveTo(cropX, cropY + drawHeight, cropX, cropY + drawHeight - radius);
      ctx.lineTo(cropX, cropY + radius);
      ctx.quadraticCurveTo(cropX, cropY, cropX + radius, cropY);
      ctx.closePath();
      ctx.clip();
    }

    // Apply color grading
    const hasFilters =
      colorGrading?.brightness !== 0 ||
      colorGrading?.contrast !== 0 ||
      colorGrading?.saturation !== 0 ||
      colorGrading?.hue !== 0 ||
      colorGrading?.temperature !== 0 ||
      colorGrading?.vignette !== 0;

    if (hasFilters) {
      // Create temp canvas for video at scaled size (before crop)
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = Math.round(scaledVideoWidth);
      tempCanvas.height = Math.round(scaledVideoHeight);
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        // Draw video to temp canvas at scaled size (maintaining aspect ratio)
        tempCtx.drawImage(
          video,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, tempCanvas.width, tempCanvas.height
        );

        // Apply filters using FilterEngine
        const filterCanvas = document.createElement('canvas');
        filterCanvas.width = Math.round(scaledVideoWidth);
        filterCanvas.height = Math.round(scaledVideoHeight);
        const filterCtx = filterCanvas.getContext('2d');
        if (filterCtx) {
          const filterEngine = new FilterEngine(filterCtx, Math.round(scaledVideoWidth), Math.round(scaledVideoHeight));
          filterEngine.applyFilters(tempCanvas, {
            brightness: colorGrading.brightness,
            contrast: colorGrading.contrast,
            saturation: colorGrading.saturation,
            hue: colorGrading.hue,
            vignette: colorGrading.vignette,
            colorize: colorGrading.temperature !== 0 ? {
              r: colorGrading.temperature > 0 ? 255 : 0,
              g: colorGrading.temperature > 0 ? 200 : 100,
              b: colorGrading.temperature < 0 ? 255 : 0,
              amount: Math.abs(colorGrading.temperature) * 0.3,
            } : undefined,
          });
          // Draw filtered result to main context (crop clipping already applied)
          ctx.drawImage(filterCanvas, 0, 0);
        }
      }
    } else {
      // No filters - draw video at scaled size (crop clipping already applied)
      ctx.drawImage(
        video,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, scaledVideoWidth, scaledVideoHeight
      );
    }

    // Reset filter after drawing video
    ctx.filter = 'none';

    // Apply camera vignette overlay (matching Stage.tsx)
    if (!rawRecording && cameraStateRef.current) {
      const vignette = cameraStateRef.current.transform.vignette || 0;
      if (vignette > 0) {
        ctx.save();
        const gradient = ctx.createRadialGradient(
          scaledVideoWidth / 2, scaledVideoHeight / 2, 0,
          scaledVideoWidth / 2, scaledVideoHeight / 2, Math.max(scaledVideoWidth, scaledVideoHeight) / 2
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(0, 0, 0, ${vignette})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, scaledVideoWidth, scaledVideoHeight);
        ctx.restore();
      }
    }

    ctx.restore();

    // Apply box shadow effect (matching Stage.tsx style: '0 0 100px rgba(0,0,0,0.7)')
    // Note: Canvas doesn't support box-shadow directly, so we'll draw a shadow manually
    // For now, we'll skip this as it's complex and the video layer shadow is more subtle

    // 5. Render cursor and click effects (on video layer coordinates)
    ctx.save();

    // Apply same transform as video layer (centered in canvas)
    if (!rawRecording && cameraStateRef.current) {
      const { scale, translateX, translateY, rotation = 0 } = cameraStateRef.current.transform;
      // Use canvas center (same as video center)
      const videoCenterX = width / 2;
      const videoCenterY = height / 2;
      ctx.translate(videoCenterX, videoCenterY);
      ctx.scale(scale, scale);
      ctx.translate(translateX, translateY);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.translate(-scaledVideoWidth / 2, -scaledVideoHeight / 2);
    } else {
      ctx.translate(scaledVideoX, scaledVideoY);
    }

    // Apply crop clipping for cursor/effects too
    if (crop?.enabled) {
      const cropX = crop.left;
      const cropY = crop.top;
      ctx.beginPath();
      ctx.rect(cropX, cropY, drawWidth, drawHeight);
      ctx.clip();

      // Apply border radius to cursor/effects layer
      const radius = crop.roundedCorners && crop.cornerRadius > 0 ? crop.cornerRadius : videoBorderRadius;
      ctx.beginPath();
      ctx.moveTo(cropX + radius, cropY);
      ctx.lineTo(cropX + drawWidth - radius, cropY);
      ctx.quadraticCurveTo(cropX + drawWidth, cropY, cropX + drawWidth, cropY + radius);
      ctx.lineTo(cropX + drawWidth, cropY + drawHeight - radius);
      ctx.quadraticCurveTo(cropX + drawWidth, cropY + drawHeight, cropX + drawWidth - radius, cropY + drawHeight);
      ctx.lineTo(cropX + radius, cropY + drawHeight);
      ctx.quadraticCurveTo(cropX, cropY + drawHeight, cropX, cropY + drawHeight - radius);
      ctx.lineTo(cropX, cropY + radius);
      ctx.quadraticCurveTo(cropX, cropY, cropX + radius, cropY);
      ctx.closePath();
      ctx.clip();
    } else {
      // Apply 12px border radius to cursor/effects layer when crop is not enabled
      const radius = videoBorderRadius;
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(scaledVideoWidth - radius, 0);
      ctx.quadraticCurveTo(scaledVideoWidth, 0, scaledVideoWidth, radius);
      ctx.lineTo(scaledVideoWidth, scaledVideoHeight - radius);
      ctx.quadraticCurveTo(scaledVideoWidth, scaledVideoHeight, scaledVideoWidth - radius, scaledVideoHeight);
      ctx.lineTo(radius, scaledVideoHeight);
      ctx.quadraticCurveTo(0, scaledVideoHeight, 0, scaledVideoHeight - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.clip();
    }

    // Scale cursor coordinates from source video to scaled video size
    const scaleX = scaledVideoWidth / videoConfig.width;
    const scaleY = scaledVideoHeight / videoConfig.height;

    // Draw click animations
    if (effectsConfig?.clickRipple && effectsConfig.clickAnimationStyle !== 'none') {
      clickData.forEach(click => {
        // Scale click coordinates to match scaled video size
        const scaledClick = {
          ...click,
          x: click.x * scaleX,
          y: click.y * scaleY,
        };
        drawClickAnimation(ctx, scaledClick, time, scaledVideoWidth, scaledVideoHeight, effectsConfig);
      });
    }

    // Draw cursor (normalized recorded coords — matches editor preview)
    if (cursorConfig) {
      drawCursor(ctx, time, moveData, clickData, scaledVideoWidth, scaledVideoHeight, cursorConfig);
    }

    ctx.restore();

    // 6. Render text overlays (typography, box styling, shadow — matches editor)
    textOverlays.forEach(overlay => {
      if (time >= overlay.startTime && time <= overlay.endTime) {
        const progress = (time - overlay.startTime) / Math.max(0.001, overlay.endTime - overlay.startTime);
        let opacity = overlay.opacity ?? 1;
        if (overlay.animation === 'fade' || overlay.animation === undefined) {
          const fadeIn = Math.min(1, progress * 10);
          const fadeOut = Math.min(1, (overlay.endTime - time) * 10);
          opacity *= Math.min(fadeIn, fadeOut);
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

        // Scale font relative to a 1080p reference frame
        const fontScale = height / 1080;
        const fontSize = (overlay.fontSize || 32) * fontScale * (overlay.scale ?? 1);
        const weight = overlay.fontWeight && overlay.fontWeight !== 'normal' ? overlay.fontWeight : '400';
        const style = overlay.fontStyle === 'italic' ? 'italic ' : '';
        const family = overlay.fontFamily || 'Inter';
        ctx.font = `${style}${weight} ${fontSize}px ${family}, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let text = overlay.text || '';
        if (overlay.textTransform === 'uppercase') text = text.toUpperCase();
        else if (overlay.textTransform === 'lowercase') text = text.toLowerCase();

        const cx = overlay.x * width;
        const cy = overlay.y * height;
        const rotation = ((overlay.rotation ?? 0) * Math.PI) / 180;
        if (rotation !== 0) {
          ctx.translate(cx, cy);
          ctx.rotate(rotation);
          ctx.translate(-cx, -cy);
        }

        // Word-wrap to 84% of frame width
        const maxWidth = width * 0.84;
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let line = '';
        for (const word of words) {
          const test = line ? line + ' ' + word : word;
          if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
        const lineHeight = fontSize * (overlay.lineHeight ?? 1.25);
        const blockHeight = lines.length * lineHeight;
        const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);

        // Background box
        const bg = overlay.backgroundColor;
        if (bg && bg !== 'transparent') {
          const pad = (overlay.padding ?? 0) * fontScale;
          const radius = (overlay.borderRadius ?? 0) * fontScale;
          const bx = cx - widest / 2 - pad;
          const by = cy - blockHeight / 2 - pad;
          const bw = widest + pad * 2;
          const bh = blockHeight + pad * 2;
          ctx.beginPath();
          const r = Math.min(radius, bw / 2, bh / 2);
          ctx.moveTo(bx + r, by);
          ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
          ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
          ctx.arcTo(bx, by + bh, bx, by, r);
          ctx.arcTo(bx, by, bx + bw, by, r);
          ctx.closePath();
          ctx.fillStyle = bg;
          ctx.fill();
        }

        // Text shadow
        if (overlay.shadowBlur && overlay.shadowBlur > 0) {
          ctx.shadowColor = overlay.shadowColor || 'rgba(0,0,0,0.6)';
          ctx.shadowBlur = overlay.shadowBlur * fontScale;
          ctx.shadowOffsetX = (overlay.shadowOffsetX ?? 0) * fontScale;
          ctx.shadowOffsetY = (overlay.shadowOffsetY ?? 0) * fontScale;
        }

        ctx.fillStyle = overlay.color || '#ffffff';
        const startY = cy - blockHeight / 2 + lineHeight / 2;
        lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));

        ctx.restore();
      }
    });
  }

  const renderAnimatedImage = async (
    format: "gif" | "apng",
    fps: number,
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    outputDims: { width: number; height: number },
    video: HTMLVideoElement,
    videoConfig: VideoConfig,
    presentationConfig: PresentationConfig,
    colorGrading: any,
    effectsConfig: EffectsConfig,
    cursorConfig: CursorConfig,
    clickData: ClickData[],
    moveData: MoveData[],
    videoTransform: any,
    finalVideoX: number,
    finalVideoY: number,
    finalVideoWidth: number,
    finalVideoHeight: number,
    padding: any
  ) => {
    toast({
      title: "Animated image rendering",
      description: `${format.toUpperCase()} export requires additional libraries. Falling back to WebM.`,
      variant: "default"
    });

    setExportFormat("webm");
    setRendering(false);
    setTimeout(() => startRendering(), 100);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container space-y-8 py-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {project?.title ?? "Your finished demo"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Preview it, then render and download.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={editorHref(projectId)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to editor
              </Link>
            </Button>
            {project && (
              <Button variant="hero" size="sm" onClick={() => setShareOpen(true)}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-2xl">
          {!videoUrl ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <p className="mb-6 text-muted-foreground">
                No recording found. Start from the recorder or open a project in the editor.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button variant="hero" asChild>
                  <Link to="/recorder">Record a demo</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/dashboard">View demos</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-md">
              <div className="border-b border-border px-6 py-5">
                <h2 className="font-display text-xl font-semibold">Export your demo</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {rendering
                    ? "Rendering in progress — this may take a minute."
                    : downloadUrl
                      ? "Your file is ready. Download it or share a hosted link."
                      : "Choose a format and quality, then render the final video."}
                </p>
              </div>

              <div className="p-6">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  crossOrigin="anonymous"
                  muted
                  className="hidden"
                  playsInline
                />

                <div className="relative mx-auto mb-6 aspect-video w-full overflow-hidden rounded-xl border border-border bg-secondary p-4">
                  <div className="relative flex h-full w-full items-center justify-center">
                    <div className="absolute inset-4 overflow-hidden rounded-lg border border-border bg-black shadow-md">
                      <canvas ref={canvasRef} className="h-full w-full object-contain" />
                    </div>
                    {rendering && (
                      <div className="absolute inset-4 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
                        <div className="text-center">
                          <Loader2 className="mx-auto mb-2 h-10 w-10 animate-spin text-primary" />
                          <div className="font-mono text-sm font-medium">{Math.round(progress)}%</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {!rendering && !downloadUrl && (
                  <div className="mb-6 space-y-4">
                    <div className="space-y-2">
                      <Label>Export format</Label>
                      <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as typeof exportFormat)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="webm">
                            <div className="flex items-center gap-2">
                              <Video className="h-4 w-4" />
                              <span>WebM (VP9)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="mp4">
                            <div className="flex items-center gap-2">
                              <FileVideo className="h-4 w-4" />
                              <span>MP4 (H.264)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="gif">
                            <div className="flex items-center gap-2">
                              <ImageIcon className="h-4 w-4" />
                              <span>GIF (Animated)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="apng">
                            <div className="flex items-center gap-2">
                              <ImageIcon className="h-4 w-4" />
                              <span>APNG (Animated)</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Quality</Label>
                      <Select
                        value={exportQuality}
                        onValueChange={(v) => {
                          if (v === "high" && !hdEntitled) {
                            // HD is Pro-only — nudge instead of selecting it.
                            setUpgradeOpen(true);
                            return;
                          }
                          setExportQuality(v as typeof exportQuality);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">
                            High (60fps, 8Mbps){!hdEntitled ? " — Pro" : ""}
                          </SelectItem>
                          <SelectItem value="medium">Medium (30fps, 4Mbps)</SelectItem>
                          <SelectItem value="low">Low (24fps, 2Mbps)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSettings(!showSettings)}
                      className="w-full"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      {showSettings ? "Hide" : "Show"} advanced settings
                    </Button>
                  </div>
                )}

                {!rendering && !downloadUrl && (
                  <Button variant="hero" size="lg" onClick={startRendering} className="w-full">
                    <Video className="mr-2 h-4 w-4" />
                    Start rendering
                  </Button>
                )}

                {downloadUrl && (
                  <div className="space-y-3 animate-in fade-in zoom-in">
                    <div className="mb-2 flex items-center justify-center gap-2 text-success">
                      <Check className="h-5 w-5" />
                      <span className="font-medium">Export complete</span>
                    </div>
                    <Button variant="hero" size="lg" asChild className="w-full">
                      <a href={downloadUrl} download={`demo-recording.${exportFormat}`}>
                        <Download className="mr-2 h-4 w-4" />
                        Download {exportFormat.toUpperCase()}
                      </a>
                    </Button>
                    {project && (
                      <Button variant="outline" className="w-full" onClick={() => setShareOpen(true)}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Share hosted link
                      </Button>
                    )}
                    <Button variant="ghost" className="w-full" onClick={startRendering}>
                      Render again
                    </Button>
                  </div>
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
          onVisibilityChange={(v) => setProject((p) => (p ? { ...p, visibility: v } : p))}
        />
      )}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="hdExport"
      />

      {/* Guest free-render wall */}
      <Dialog open={renderWallOpen} onOpenChange={setRenderWallOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>
              You've used your free render{GUEST_FREE_RENDERS === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>
              Sign in to save this demo to your account, share it, and render as
              many times as you like — your work so far comes with you.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="hero"
              className="w-full"
              onClick={() =>
                signIn({ onSuccess: () => setRenderWallOpen(false) })
              }
            >
              Sign in to continue
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setRenderWallOpen(false)}
            >
              Maybe later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
