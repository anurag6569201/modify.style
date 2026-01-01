import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft, Download, Loader2, Video, FileVideo, Image as ImageIcon, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PresentationConfig, VideoConfig, EffectsConfig, CursorConfig } from "@/lib/editor/types";
import { calculateOutputDimensions, calculateVideoTransform } from "@/lib/composition/aspectRatio";
import { FilterEngine } from "@/lib/effects/filters";
import { getCursorPos } from "@/lib/composition/math";
import { updateCameraSystem, getInitialCameraState } from "@/lib/composition/camera";
import { ClickData, MoveData } from "./Recorder";

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
  canvasWidth: number,
  canvasHeight: number,
  cursorConfig: CursorConfig,
  cursorImage?: HTMLImageElement
) {
  const pos = getCursorPos(time, moves);
  if (!pos) return;

  const cx = pos.x * canvasWidth;
  const cy = pos.y * canvasHeight;

  // Use cursor image if available (matching CursorLayer.tsx)
  if (cursorImage && cursorImage.complete) {
    const size = 24 * cursorConfig.size;

    // Glow effect
    if (cursorConfig.glow) {
      ctx.shadowColor = cursorConfig.color;
      ctx.shadowBlur = 15;
    } else {
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 4;
    }

    // Draw cursor image
    ctx.drawImage(cursorImage, cx, cy, size, size);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  } else {
    // Fallback: simple cursor drawing
    const size = 24 * cursorConfig.size;
    ctx.fillStyle = cursorConfig.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    
    if (cursorConfig.glow) {
      ctx.shadowColor = cursorConfig.color;
      ctx.shadowBlur = 15;
    }
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.6);
    ctx.lineTo(cx + size * 0.2, cy + size * 0.5);
    ctx.lineTo(cx + size * 0.3, cy + size * 0.8);
    ctx.lineTo(cx + size * 0.1, cy + size * 0.7);
    ctx.closePath();
    
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

export default function Render() {
  const location = useLocation();
  const {
    videoUrl,
    clickData = [],
    moveData = [],
    presentation,
    colorGrading,
    effectsConfig,
    cursorConfig,
    textOverlays = [],
    rawRecording = false,
  } = location.state || {};

  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"webm" | "mp4" | "gif" | "apng">("webm");
  const [exportQuality, setExportQuality] = useState<"high" | "medium" | "low">("high");
  const [showSettings, setShowSettings] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cameraStateRef = useRef(getInitialCameraState());
  const cursorImageRef = useRef<HTMLImageElement | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
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
    const fps = exportQuality === "high" ? 60 : exportQuality === "medium" ? 30 : 24;
    const bitrate = exportQuality === "high" ? 8000000 : exportQuality === "medium" ? 4000000 : 2000000;

    if (exportFormat === "gif" || exportFormat === "apng") {
      await renderAnimatedImage(exportFormat, fps, ctx, canvasWidth, canvasHeight, outputDims, video, videoConfig, presentationConfig, colorGrading, effectsConfig, cursorConfig, clickData, moveData, videoTransform, finalVideoX, finalVideoY, finalVideoWidth, finalVideoHeight, padding);
      return;
    }

    // Setup MediaRecorder
    const stream = canvas.captureStream(fps);
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
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setRendering(false);
      setProgress(100);
      toast({
        title: "Rendering Complete",
        description: `Your ${exportFormat.toUpperCase()} video is ready to download.`,
      });
    };

    mediaRecorder.start();
    video.currentTime = 0;
    await video.play();

    let lastTime = performance.now();

    const renderLoop = () => {
      if (video.ended || video.paused) {
        if (video.ended) {
          mediaRecorder.stop();
          return;
        }
      }

      const currentTime = video.currentTime;
      setProgress((currentTime / video.duration) * 100);

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
        [],
        { width: videoConfig.width, height: videoConfig.height },
        videoConfig.duration || 0
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

    // Draw cursor
    if (cursorConfig) {
      // Scale cursor coordinates to match scaled video size
      const scaledMoves = moveData.map(move => ({
        ...move,
        x: move.x * scaleX,
        y: move.y * scaleY,
      }));
      drawCursor(ctx, time, scaledMoves, scaledVideoWidth, scaledVideoHeight, cursorConfig, cursorImageRef.current || undefined);
    }

    ctx.restore();

    // 6. Render text overlays
    textOverlays.forEach(overlay => {
      if (time >= overlay.startTime && time <= overlay.endTime) {
        const progress = (time - overlay.startTime) / (overlay.endTime - overlay.startTime);
        let opacity = 1;
        if (overlay.animation === 'fade') {
          const fadeIn = Math.min(1, progress * 10);
          const fadeOut = Math.min(1, (overlay.endTime - time) * 10);
          opacity = Math.min(fadeIn, fadeOut);
        }
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = overlay.color;
        ctx.font = `${overlay.fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(overlay.text, overlay.x * width, overlay.y * height);
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
      <Header isAuthenticated user={{ name: "User", email: "user@example.com" }} />
      <main className="container py-12 flex flex-col items-center">
        <Button variant="ghost" asChild className="mb-8 self-start">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="w-full max-w-3xl rounded-xl border border-border bg-card p-8 text-center">
          {!videoUrl ? (
            <div className="text-muted-foreground">No video received. Please record one first.</div>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-4">Export Video</h1>
              <p className="text-muted-foreground mb-8">
                {rendering
                  ? "Rendering in progress... Please wait."
                  : "Ready to render your cinematic demo."}
              </p>

              <video
                ref={videoRef}
                src={videoUrl}
                crossOrigin="anonymous"
                muted
                className="hidden"
                playsInline
              />

              <div className="relative mx-auto mb-8 aspect-video w-full max-w-md overflow-hidden rounded-xl border border-border bg-gradient-subtle shadow-xl p-4">
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="absolute inset-4 rounded-lg shadow-2xl border border-border/50 overflow-hidden bg-black">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {rendering && (
                    <div className="absolute inset-4 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
                      <div className="text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-2" />
                        <div className="font-mono text-foreground">{Math.round(progress)}%</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!rendering && !downloadUrl && (
                <div className="space-y-4 mb-6">
                  <div className="space-y-2">
                    <Label>Export Format</Label>
                    <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as any)}>
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
                    <Select value={exportQuality} onValueChange={(v) => setExportQuality(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High (60fps, 8Mbps)</SelectItem>
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
                    {showSettings ? "Hide" : "Show"} Advanced Settings
                  </Button>
                </div>
              )}

              {!rendering && !downloadUrl && (
                <Button size="lg" onClick={startRendering} className="w-full max-w-sm">
                  <Video className="mr-2 h-4 w-4" />
                  Start Rendering
                </Button>
              )}

              {downloadUrl && (
                <div className="animate-in fade-in zoom-in space-y-4">
                  <div className="flex items-center justify-center gap-2 text-green-500 mb-4">
                    <Check className="h-6 w-6" />
                    <span className="text-lg font-medium">Ready!</span>
                  </div>
                  <Button size="lg" asChild className="w-full max-w-sm">
                    <a href={downloadUrl} download={`demo-recording.${exportFormat}`}>
                      <Download className="mr-2 h-4 w-4" />
                      Download {exportFormat.toUpperCase()}
                    </a>
                  </Button>
                  <Button variant="outline" onClick={startRendering}>
                    Render Again
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
