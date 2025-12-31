import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft, Download, Loader2, Video, FileVideo, Image as ImageIcon, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCursorPos } from "@/lib/composition/math";
import { getInitialCameraState, updateCameraSystem } from "@/lib/composition/camera";
import { ClickData, MoveData } from "./Recorder";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FilterEngine } from "@/lib/effects/filters";

export default function Render() {
  const location = useLocation();
  const { videoUrl, clickData, moveData, effects } = location.state || {}; // { videoUrl: string, clickData: ClickData[], moveData: MoveData[], effects: EffectEvent[] }

  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"webm" | "mp4" | "gif" | "apng">("webm");
  const [exportQuality, setExportQuality] = useState<"high" | "medium" | "low">("high");
  const [showSettings, setShowSettings] = useState(false);
  const [filters, setFilters] = useState({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  // Load cursor image
  const cursorImageRef = useRef<HTMLImageElement | null>(null);
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

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const width = canvas.width;
    const height = canvas.height;

    // Initialize filter engine
    const filterEngine = new FilterEngine(ctx, width, height);

    // Determine FPS based on quality
    const fps = exportQuality === "high" ? 60 : exportQuality === "medium" ? 30 : 24;
    const bitrate = exportQuality === "high" ? 8000000 : exportQuality === "medium" ? 4000000 : 2000000;

    // Handle different export formats
    if (exportFormat === "gif" || exportFormat === "apng") {
      await renderAnimatedImage(exportFormat, fps, filterEngine);
      return;
    }

    // Setup MediaRecorder for video formats
    const stream = canvas.captureStream(fps);

    // Determine mime type
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

    // Start playback
    video.currentTime = 0;
    await video.play();

    // Rendering Loop
    let cameraState = getInitialCameraState();

    // We update manually frame-by-frame or just let it play and sync?
    // "Replay composition programmatically"
    // Ideally we'd use requestVideoFrameCallback but let's use requestAnimationFrame + video sync for broad support

    const renderLoop = () => {
      if (video.ended || video.paused) {
        if (video.ended) {
          mediaRecorder.stop();
          return;
        }
        // If paused but not ended, maybe buffering? keep checking
      }

      const time = video.currentTime;
      setProgress((time / video.duration) * 100);

      // 1. Calculate Camera State
      // Using fixed time step for physics consistency (60fps)
      cameraState = updateCameraSystem(
        cameraState,
        time,
        0.016,
        clickData || [],
        moveData || [],
        effects || [],
        { width, height }
      );

      const currentTransform = cameraState.transform;

      // 2. Clear & Setup Transform
      // Important: We want to transform the video AND the effects.
      // So we apply transform to context first.

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // We need to apply transform:
      // Translate to Origin(0,0) -> Scale -> Translate back? 
      // Our camera logic returns translateX/Y which are top-left based offsets relative to 0,0.
      // And we assume transform-origin is 0,0.

      ctx.translate(currentTransform.translateX, currentTransform.translateY);
      ctx.scale(currentTransform.scale, currentTransform.scale);

      // 3. Draw Video Frame with Filters
      if (filters.brightness !== 0 || filters.contrast !== 0 || filters.saturation !== 0 || filters.blur > 0) {
        filterEngine.applyFilters(video, {
          brightness: filters.brightness,
          contrast: filters.contrast,
          saturation: filters.saturation,
          blur: filters.blur,
        });
      } else {
        ctx.drawImage(video, 0, 0, width, height);
      }

      // 4. Draw Ripples
      const activeClicks = (clickData || []).filter(
        (c: ClickData) =>
          (c.type?.includes("click") || c.type === "rightClick") &&
          time >= c.timestamp &&
          time < c.timestamp + 0.8
      );

      activeClicks.forEach((click: ClickData) => {
        const timeSince = time - click.timestamp;
        const progress = Math.min(1, timeSince / 0.6);
        const maxRadius = Math.min(width, height) * 0.08;
        const currentRadius = maxRadius * (0.2 + 0.8 * progress);
        const opacity = 1 - Math.pow(progress, 3);

        ctx.beginPath();
        ctx.arc(click.x * width, click.y * height, currentRadius, 0, Math.PI * 2);
        const color = click.type === "rightClick" ? "239, 68, 68" : "59, 130, 246";
        ctx.fillStyle = `rgba(${color}, ${opacity * 0.3})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${color}, ${opacity})`;
        ctx.lineWidth = 2; // Fixed width - gets scaled by camera
        // To keep line width constant on screen, divide by scale? 
        // "Cinematic" usually implies elements scale with the world. Keep it scaling.
        ctx.stroke();
      });

      // 5. Draw Cursor
      const pos = getCursorPos(time, moveData || []);
      if (pos) {
        const cx = pos.x * width;
        const cy = pos.y * height;
        if (cursorImageRef.current) {
          // Draw cursor
          // Shadow
          ctx.shadowColor = "rgba(0,0,0,0.3)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 2;
          ctx.drawImage(cursorImageRef.current, cx - 2, cy - 2, 24, 24);
          ctx.shadowColor = "transparent";
        }
      }

      ctx.restore();

      if (!video.ended) {
        requestAnimationFrame(renderLoop);
      }
    };

    requestAnimationFrame(renderLoop);
  };

  // Render animated image (GIF/APNG)
  const renderAnimatedImage = async (
    format: "gif" | "apng",
    fps: number,
    filterEngine: FilterEngine
  ) => {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const frames: ImageData[] = [];
    const frameInterval = 1000 / fps;
    const totalFrames = Math.ceil(video.duration * fps);

    video.currentTime = 0;
    await video.play();

    let frameCount = 0;

    const captureFrame = () => {
      if (video.ended || frameCount >= totalFrames) {
        // Process frames into GIF/APNG
        processAnimatedImage(frames, format);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Apply filters if needed
      if (filters.brightness !== 0 || filters.contrast !== 0 || filters.saturation !== 0 || filters.blur > 0) {
        filterEngine.applyFilters(video, {
          brightness: filters.brightness,
          contrast: filters.contrast,
          saturation: filters.saturation,
          blur: filters.blur,
        });
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      // Draw effects
      const time = video.currentTime;
      const cameraState = updateCameraSystem(
        getInitialCameraState(),
        time,
        0.016,
        clickData || [],
        moveData || [],
        effects || [],
        { width: canvas.width, height: canvas.height }
      );

      ctx.save();
      ctx.translate(cameraState.transform.translateX, cameraState.transform.translateY);
      ctx.scale(cameraState.transform.scale, cameraState.transform.scale);

      // Draw clicks and cursor (same as video rendering)
      const activeClicks = (clickData || []).filter(
        (c: ClickData) =>
          (c.type?.includes("click") || c.type === "rightClick") &&
          time >= c.timestamp &&
          time < c.timestamp + 0.8
      );

      activeClicks.forEach((click: ClickData) => {
        const timeSince = time - click.timestamp;
        const progress = Math.min(1, timeSince / 0.6);
        const maxRadius = Math.min(canvas.width, canvas.height) * 0.08;
        const currentRadius = maxRadius * (0.2 + 0.8 * progress);
        const opacity = 1 - Math.pow(progress, 3);

        ctx.beginPath();
        ctx.arc(click.x * canvas.width, click.y * canvas.height, currentRadius, 0, Math.PI * 2);
        const color = click.type === "rightClick" ? "239, 68, 68" : "59, 130, 246";
        ctx.fillStyle = `rgba(${color}, ${opacity * 0.3})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${color}, ${opacity})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      const pos = getCursorPos(time, moveData || []);
      if (pos && cursorImageRef.current) {
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        ctx.drawImage(cursorImageRef.current, pos.x * canvas.width - 2, pos.y * canvas.height - 2, 24, 24);
        ctx.shadowColor = "transparent";
      }

      ctx.restore();

      // Capture frame
      frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      frameCount++;
      setProgress((frameCount / totalFrames) * 100);

      // Advance video
      video.currentTime = (frameCount * frameInterval) / 1000;

      setTimeout(captureFrame, frameInterval);
    };

    captureFrame();
  };

  const processAnimatedImage = async (frames: ImageData[], format: "gif" | "apng") => {
    // For GIF/APNG, we'd need a library like gif.js or apng-js
    // For now, we'll create a simple animated format
    // In production, you'd use a proper library

    toast({
      title: "Animated image rendering",
      description: `${format.toUpperCase()} export requires additional libraries. Falling back to WebM.`,
      variant: "default"
    });

    // Fallback to video rendering
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

              {/* Hidden Source Elements */}
              <video
                ref={videoRef}
                src={videoUrl}
                crossOrigin="anonymous"
                muted
                className="hidden"
                playsInline
              />

              {/* Canvas Preview - Matching Recorder Preview Style */}
              <div className="relative mx-auto mb-8 aspect-video w-full max-w-md overflow-hidden rounded-xl border border-border bg-gradient-subtle shadow-xl p-4">
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] rounded-lg shadow-2xl border border-border/50 overflow-hidden bg-black">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {rendering && (
                    <div className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)] flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
                      <div className="text-center">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-2" />
                        <div className="font-mono text-foreground">{Math.round(progress)}%</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Export Settings */}
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

                  {showSettings && (
                    <div className="space-y-3 p-4 border rounded-lg bg-secondary/30">
                      <div className="space-y-2">
                        <Label>Brightness: {filters.brightness.toFixed(2)}</Label>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.1"
                          value={filters.brightness}
                          onChange={(e) => setFilters({ ...filters, brightness: parseFloat(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Contrast: {filters.contrast.toFixed(2)}</Label>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.1"
                          value={filters.contrast}
                          onChange={(e) => setFilters({ ...filters, contrast: parseFloat(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Saturation: {filters.saturation.toFixed(2)}</Label>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.1"
                          value={filters.saturation}
                          onChange={(e) => setFilters({ ...filters, saturation: parseFloat(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Blur: {filters.blur.toFixed(1)}px</Label>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          step="0.5"
                          value={filters.blur}
                          onChange={(e) => setFilters({ ...filters, blur: parseFloat(e.target.value) })}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
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
