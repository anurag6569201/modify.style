import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type RecordingState = "idle" | "selecting" | "ready" | "countdown" | "recording" | "paused" | "stopped";

export default function Recorder() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | undefined>(undefined);
  const navigate = useNavigate();
  const { toast } = useToast();

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
        setTimer((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recordingState]);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSelectScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      mediaStreamRef.current = stream;
      setRecordingState("selecting");

      // Handle stream ending (e.g. user clicks "Stop sharing" in browser UI)
      stream.getVideoTracks()[0].onended = () => {
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

  const handleConfirmHide = () => {
    setRecordingState("ready");
  };

  const handleStartCountdown = () => {
    if (!mediaStreamRef.current) return;
    setCountdown(5);
    setRecordingState("countdown");
  };

  const startRecordingActual = () => {
    if (!mediaStreamRef.current) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(mediaStreamRef.current, {
      mimeType: 'video/webm;codecs=vp9'
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);

      setRecordingState("stopped");
      toast({
        title: "Recording saved",
        description: "Redirecting to editor...",
      });

      setTimeout(() => {
        navigate("/editor/new", { state: { videoUrl } });
      }, 1500);
    };

    mediaRecorder.start(1000); // Collect 1s chunks
    mediaRecorderRef.current = mediaRecorder;
    setRecordingState("recording");

    toast({
      title: "Recording started",
      description: "Good luck with your demo!",
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    // Stop all tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated user={user} />

      <main className="container grid gap-8 py-12 lg:grid-cols-2 lg:gap-12 lg:items-start">
        {/* Left Column: Instructions & Tips */}
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Record Your Screen</h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Create professional demos in minutes. Just follow the steps and we'll handle the editing.
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
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-600 dark:text-blue-400">
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4" />
              Pro Tips
            </h3>
            <ul className="list-inside list-disc space-y-1 opacity-80">
              <li>Clean up your desktop icons for a professional look</li>
              <li>Turn off notifications to avoid interruptions</li>
              <li>Move your mouse smoothly between clicks</li>
            </ul>
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
            <div className="relative flex aspect-video flex-col items-center justify-center bg-gradient-subtle p-8 transition-colors">
              {/* Idle State */}
              {recordingState === "idle" && (
                <div className="text-center animate-scale-in">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
                    <Video className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Ready to record?</h3>
                  <p className="text-sm text-muted-foreground max-w-[200px] mx-auto mt-1">
                    Click the button below to start.
                  </p>
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
                <div className="text-center animate-fade-in relative z-10">
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

            {/* Divider */}
            <div className="h-px w-full bg-border/50" />

            {/* Controls Bar */}
            <div className="bg-card p-6 flex justify-center">
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

                  <Button variant="destructive" size="lg" className="h-12 w-40 gap-2 shadow-lg shadow-destructive/20 hover:shadow-destructive/30" onClick={handleStopRecording}>
                    <Square className="h-4 w-4 fill-current" />
                    Stop
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
