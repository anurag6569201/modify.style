import { useState, useEffect } from "react";
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

type RecordingState = "idle" | "preparing" | "recording" | "paused" | "stopped";

const mockUser = {
  name: "Alex Johnson",
  email: "alex@company.com",
};

export default function Recorder() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [timer, setTimer] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === "recording") {
      interval = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recordingState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStartRecording = async () => {
    setRecordingState("preparing");
    // Simulate preparation
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRecordingState("recording");
    toast({
      title: "Recording started",
      description: "Your screen is now being recorded.",
    });
  };

  const handlePauseRecording = () => {
    setRecordingState("paused");
  };

  const handleResumeRecording = () => {
    setRecordingState("recording");
  };

  const handleStopRecording = () => {
    setRecordingState("stopped");
    toast({
      title: "Recording saved",
      description: "Your recording has been saved. Redirecting to editor...",
    });
    setTimeout(() => {
      navigate("/editor/new");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated user={mockUser} />

      <main className="container max-w-4xl py-12">
        {/* Instructions Panel */}
        <div className="mb-8 rounded-2xl border border-border bg-card p-8">
          <h1 className="mb-6 text-2xl font-bold">Record Your Screen</h1>

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                1
              </div>
              <div>
                <p className="font-medium">Choose what to share</p>
                <p className="text-sm text-muted-foreground">
                  Select your entire screen, a window, or a browser tab
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                2
              </div>
              <div>
                <p className="font-medium">Perform your demo</p>
                <p className="text-sm text-muted-foreground">
                  Walk through your product naturally. We'll capture everything
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-secondary/50 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                3
              </div>
              <div>
                <p className="font-medium">Stop when done</p>
                <p className="text-sm text-muted-foreground">
                  Click stop to finish. AI will generate script & voice
                </p>
              </div>
            </div>
          </div>

          {/* Recording Tips */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <h3 className="mb-3 flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 text-warning" />
              Tips for better recordings
            </h3>
            <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Close unnecessary tabs and apps
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Use a clean, uncluttered desktop
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Move cursor slowly and deliberately
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Keep recordings under 5 minutes
              </li>
            </ul>
          </div>
        </div>

        {/* Recording Area */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {/* Browser Chrome */}
          <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-destructive/60" />
              <div className="h-3 w-3 rounded-full bg-warning/60" />
              <div className="h-3 w-3 rounded-full bg-success/60" />
            </div>
            <div className="flex-1 text-center">
              <div className="inline-flex items-center gap-2 rounded-md bg-background px-3 py-1 text-sm text-muted-foreground">
                <Monitor className="h-4 w-4" />
                Screen Recording
              </div>
            </div>
          </div>

          {/* Recording Preview Area */}
          <div className="relative flex aspect-video items-center justify-center bg-gradient-subtle">
            {recordingState === "idle" && (
              <div className="text-center animate-fade-in">
                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                  <Video className="h-12 w-12 text-primary" />
                </div>
                <p className="mb-2 text-lg font-medium">Ready to record</p>
                <p className="text-muted-foreground">
                  Click the button below to start recording your screen
                </p>
              </div>
            )}

            {recordingState === "preparing" && (
              <div className="text-center animate-fade-in">
                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                </div>
                <p className="mb-2 text-lg font-medium">Preparing...</p>
                <p className="text-muted-foreground">
                  Please select what you'd like to share
                </p>
              </div>
            )}

            {(recordingState === "recording" || recordingState === "paused") && (
              <div className="text-center animate-fade-in">
                <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
                  {recordingState === "recording" && (
                    <div className="absolute inset-0 rounded-full bg-destructive/20 animate-pulse-ring" />
                  )}
                  <div
                    className={`flex h-24 w-24 items-center justify-center rounded-full ${
                      recordingState === "recording" ? "bg-destructive" : "bg-warning"
                    }`}
                  >
                    {recordingState === "recording" ? (
                      <Circle className="h-8 w-8 fill-current text-destructive-foreground" />
                    ) : (
                      <Pause className="h-8 w-8 text-warning-foreground" />
                    )}
                  </div>
                </div>
                <p className="mb-2 text-4xl font-bold tabular-nums">{formatTime(timer)}</p>
                <p className="text-muted-foreground">
                  {recordingState === "recording" ? "Recording in progress..." : "Recording paused"}
                </p>
              </div>
            )}

            {recordingState === "stopped" && (
              <div className="text-center animate-fade-in">
                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-success">
                  <CheckCircle2 className="h-12 w-12 text-success-foreground" />
                </div>
                <p className="mb-2 text-lg font-medium">Recording saved!</p>
                <p className="text-muted-foreground">Redirecting to editor...</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 border-t border-border bg-secondary/30 p-6">
            {recordingState === "idle" && (
              <Button variant="hero" size="xl" onClick={handleStartRecording}>
                <Circle className="mr-2 h-5 w-5 fill-current" />
                Start Recording
              </Button>
            )}

            {recordingState === "preparing" && (
              <Button variant="outline" size="lg" disabled>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                Waiting for permission...
              </Button>
            )}

            {recordingState === "recording" && (
              <>
                <Button variant="outline" size="lg" onClick={handlePauseRecording}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
                <Button variant="destructive" size="lg" onClick={handleStopRecording}>
                  <Square className="mr-2 h-4 w-4 fill-current" />
                  Stop Recording
                </Button>
              </>
            )}

            {recordingState === "paused" && (
              <>
                <Button variant="default" size="lg" onClick={handleResumeRecording}>
                  <Circle className="mr-2 h-4 w-4 fill-current" />
                  Resume
                </Button>
                <Button variant="destructive" size="lg" onClick={handleStopRecording}>
                  <Square className="mr-2 h-4 w-4 fill-current" />
                  Stop Recording
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
