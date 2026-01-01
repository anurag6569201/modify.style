import { useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Check, ArrowLeft, Download, Loader2, Video, FileVideo, Image as ImageIcon, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function Render() {
  const location = useLocation();
  const {
    videoUrl,
    clickData,
    moveData,
  } = location.state || {}; // location.state can be null/undefined
  
  // Get screen dimensions from recorded data (use first click/move to get screen size)
  const getScreenDimensions = () => {
    if (clickData && clickData.length > 0) {
      return {
        width: clickData[0].screenWidth,
        height: clickData[0].screenHeight,
      };
    }
    if (moveData && moveData.length > 0) {
      return {
        width: moveData[0].screenWidth,
        height: moveData[0].screenHeight,
      };
    }
    return null;
  };

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
  const containerDimsRef = useRef<{ width: number; height: number } | null>(null);
  const { toast } = useToast();

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

    // Wait for video metadata to be fully loaded
    if (video.readyState < 2) {
      await new Promise(r => { video.onloadedmetadata = r; });
    }
    
    // Wait a bit more to ensure video dimensions are available
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get video dimensions - ensure they're valid
    let videoWidth = video.videoWidth;
    let videoHeight = video.videoHeight;
    
    // Fallback if dimensions are not available
    if (!videoWidth || !videoHeight || videoWidth === 0 || videoHeight === 0) {
      // Wait for video to load dimensions
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

    // Get screen dimensions from recorded data (container wrapper size)
    const screenDims = getScreenDimensions();
    const containerWidth = screenDims?.width || videoWidth;
    const containerHeight = screenDims?.height || videoHeight;
    
    // Store container dimensions for use in render loop
    containerDimsRef.current = { width: containerWidth, height: containerHeight };

    // Set canvas size to match screen/container dimensions (wrapper size)
    // This is the container that will hold the video
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Determine FPS based on quality
    const fps = exportQuality === "high" ? 60 : exportQuality === "medium" ? 30 : 24;
    const bitrate = exportQuality === "high" ? 8000000 : exportQuality === "medium" ? 4000000 : 2000000;

    // Handle different export formats
    if (exportFormat === "gif" || exportFormat === "apng") {
      await renderAnimatedImage(exportFormat, fps);
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

    // Simple rendering loop - just draw raw video frame
    const renderLoop = () => {
      if (video.ended || video.paused) {
        if (video.ended) {
          mediaRecorder.stop();
          return;
        }
      }

      const time = video.currentTime;
      setProgress((time / video.duration) * 100);

      // Clear canvas (container wrapper)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw video inside the container, filling it exactly (no padding, no letterboxing)
      // The video is scaled/stretched to fill the container dimensions
      const containerDims = containerDimsRef.current || { width: canvas.width, height: canvas.height };
      ctx.drawImage(video, 0, 0, containerDims.width, containerDims.height);

      if (!video.ended) {
        requestAnimationFrame(renderLoop);
      }
    };

    requestAnimationFrame(renderLoop);
  };

  // Render animated image (GIF/APNG) - simplified to raw video
  const renderAnimatedImage = async (
    format: "gif" | "apng",
    fps: number
  ) => {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    // Wait for video metadata
    if (video.readyState < 2) {
      await new Promise(r => { video.onloadedmetadata = r; });
    }
    
    // Get screen dimensions for container wrapper
    const screenDims = getScreenDimensions();
    const containerWidth = screenDims?.width || video.videoWidth;
    const containerHeight = screenDims?.height || video.videoHeight;
    
    // Store container dimensions for use in captureFrame
    containerDimsRef.current = { width: containerWidth, height: containerHeight };
    
    // Set canvas to match container/screen dimensions (wrapper size)
    canvas.width = containerWidth;
    canvas.height = containerHeight;

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

      // Draw video inside container wrapper, filling it exactly
      const containerDims = containerDimsRef.current || { width: canvas.width, height: canvas.height };
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, containerDims.width, containerDims.height);

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
                  <div className="absolute inset-4 rounded-lg shadow-2xl border border-border/50 overflow-hidden bg-black">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {rendering && (
                    <div className="absolute inset-4  flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
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
