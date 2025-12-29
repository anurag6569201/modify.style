import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  const [script, setScript] = useState(
    "Welcome to our product demo. In this video, we'll walk you through the key features that make our platform stand out. Let's start by clicking on the Get Started button to begin the onboarding process..."
  );
  const [selectedVoice, setSelectedVoice] = useState("emma");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [effects, setEffects] = useState({
    zoomOnClick: true,
    cursorHighlight: true,
    smoothPan: false,
  });
  const [steps, setSteps] = useState<TimelineStep[]>(mockSteps);

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
    navigate("/render");
  };

  const updateStepDescription = (id: string, description: string) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, description } : s)));
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
                <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-destructive/60" />
                    <div className="h-3 w-3 rounded-full bg-warning/60" />
                    <div className="h-3 w-3 rounded-full bg-success/60" />
                  </div>
                  <div className="flex-1 text-center text-sm text-muted-foreground">Preview</div>
                </div>

                {/* Video Preview */}
                <div className="relative aspect-video bg-gradient-subtle">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-hero shadow-glow">
                      <Video className="h-8 w-8 text-primary-foreground" />
                    </div>
                  </div>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center justify-center gap-4 border-t border-border bg-secondary/30 p-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="flex-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full w-1/3 rounded-full bg-gradient-hero" />
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">0:45 / 2:30</span>
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
                          <Label className="text-base font-medium">Zoom on Click</Label>
                          <p className="text-sm text-muted-foreground">
                            Auto-zoom to clicked elements
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={effects.zoomOnClick}
                        onCheckedChange={(checked) =>
                          setEffects({ ...effects, zoomOnClick: checked })
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

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Move className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <Label className="text-base font-medium">Smooth Pan</Label>
                          <p className="text-sm text-muted-foreground">
                            Smooth camera panning between actions
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={effects.smoothPan}
                        onCheckedChange={(checked) =>
                          setEffects({ ...effects, smoothPan: checked })
                        }
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-6 rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Timeline</h2>
              <span className="text-sm text-muted-foreground">
                {steps.length} steps • {steps.reduce((acc, s) => acc + s.duration, 0).toFixed(1)}s total
              </span>
            </div>

            <div className="space-y-2">
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
      </main>
    </div>
  );
}
