import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import {
  Download,
  Copy,
  Check,
  Video,
  ArrowLeft,
  Sparkles,
  Share2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type RenderState = "rendering" | "complete";

const mockUser = {
  name: "Alex Johnson",
  email: "alex@company.com",
};

export default function Render() {
  const [renderState, setRenderState] = useState<RenderState>("rendering");
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (renderState === "rendering") {
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            setRenderState("complete");
            return 100;
          }
          return p + Math.random() * 3 + 1;
        });
      }, 150);
      return () => clearInterval(interval);
    }
  }, [renderState]);

  const handleDownload = () => {
    toast({
      title: "Download started",
      description: "Your video is being downloaded.",
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://demoforge.io/share/abc123xyz");
    setCopied(true);
    toast({
      title: "Link copied!",
      description: "Share link has been copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const renderSteps = [
    { label: "Processing video", complete: progress > 20 },
    { label: "Adding voiceover", complete: progress > 45 },
    { label: "Applying effects", complete: progress > 70 },
    { label: "Encoding output", complete: progress > 90 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated user={mockUser} />

      <main className="container max-w-3xl py-12">
        <Button variant="ghost" asChild className="mb-8">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          {renderState === "rendering" ? (
            <div className="animate-fade-in">
              {/* Rendering Animation */}
              <div className="relative mx-auto mb-8 flex h-32 w-32 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 128 128">
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(progress / 100) * 377} 377`}
                    className="transition-all duration-300"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="hsl(245, 58%, 51%)" />
                      <stop offset="100%" stopColor="hsl(262, 83%, 58%)" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="flex flex-col items-center">
                  <Sparkles className="mb-1 h-8 w-8 text-primary animate-pulse" />
                  <span className="text-2xl font-bold">{Math.min(Math.round(progress), 100)}%</span>
                </div>
              </div>

              <h1 className="mb-2 text-2xl font-bold">Rendering your video</h1>
              <p className="mb-8 text-muted-foreground">
                This usually takes 1-2 minutes. Please don't close this page.
              </p>

              {/* Progress Steps */}
              <div className="mx-auto max-w-sm space-y-3 text-left">
                {renderSteps.map((step, index) => (
                  <div
                    key={step.label}
                    className={`flex items-center gap-3 rounded-lg p-3 transition-all ${
                      step.complete
                        ? "bg-success/10 text-success"
                        : renderSteps[index - 1]?.complete || index === 0
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        step.complete
                          ? "bg-success text-success-foreground"
                          : renderSteps[index - 1]?.complete || index === 0
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {step.complete ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className="text-sm font-medium">{step.label}</span>
                    {!step.complete && (renderSteps[index - 1]?.complete || index === 0) && (
                      <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-scale-in">
              {/* Success State */}
              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-success">
                <Check className="h-10 w-10 text-success-foreground" />
              </div>

              <h1 className="mb-2 text-2xl font-bold">Your video is ready!</h1>
              <p className="mb-8 text-muted-foreground">
                Download your demo video or share it with your team.
              </p>

              {/* Video Thumbnail */}
              <div className="mx-auto mb-8 max-w-md overflow-hidden rounded-xl border border-border bg-gradient-subtle">
                <div className="relative aspect-video">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-hero shadow-glow">
                      <Video className="h-8 w-8 text-primary-foreground" />
                    </div>
                  </div>
                </div>
                <div className="border-t border-border bg-card p-4">
                  <p className="font-medium">Product Onboarding Demo</p>
                  <p className="text-sm text-muted-foreground">2:30 • 1080p • 24.5 MB</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button variant="hero" size="lg" onClick={handleDownload}>
                  <Download className="mr-2 h-5 w-5" />
                  Download MP4
                </Button>
                <Button variant="outline" size="lg" onClick={handleCopyLink}>
                  {copied ? (
                    <Check className="mr-2 h-5 w-5" />
                  ) : (
                    <Copy className="mr-2 h-5 w-5" />
                  )}
                  {copied ? "Copied!" : "Copy Share Link"}
                </Button>
              </div>

              {/* Share Options */}
              <div className="mt-8 rounded-xl border border-border bg-secondary/30 p-4">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Share2 className="h-4 w-4" />
                  <span>Share your demo:</span>
                  <code className="rounded bg-background px-2 py-0.5 text-xs">
                    demoforge.io/share/abc123xyz
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
