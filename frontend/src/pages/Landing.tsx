import { useState, useEffect, useRef, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/contexts/AuthContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sparkles,
  Play,
  MonitorPlay,
  Wand2,
  Share2,
  Check,
  ArrowRight,
  Mic2,
  ScanText,
  Languages,
  BarChart3,
  MousePointerClick,
  Palette,
  Clock,
  Globe,
  Quote,
  Circle,
  Eye,
  Link2,
  Code2,
  ListOrdered,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Scroll-reveal wrapper (no external deps)
   ───────────────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Interactive, self-playing "Studio" hero mock
   ───────────────────────────────────────────── */
const pipeline = [
  { icon: MonitorPlay, label: "Record", hint: "Capturing your screen" },
  { icon: Wand2, label: "Script", hint: "AI writing narration" },
  { icon: Mic2, label: "Voice", hint: "Synthesizing neural voice" },
  { icon: MousePointerClick, label: "Frame", hint: "Auto-zoom & camera" },
  { icon: Share2, label: "Share", hint: "Link + analytics ready" },
];

const captions: Record<string, { label: string; text: string }> = {
  en: { label: "English", text: "Click “New Project” to get started." },
  es: { label: "Español", text: "Haz clic en «Nuevo proyecto» para empezar." },
  ja: { label: "日本語", text: "「新規プロジェクト」をクリックして開始します。" },
  de: { label: "Deutsch", text: "Klicke auf „Neues Projekt“, um zu starten." },
};

function HeroStudio() {
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState("en");
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setStep((s) => (s + 1) % pipeline.length), 2400);
    return () => clearInterval(id);
  }, [playing]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      {/* Screen */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-destructive/50" />
            <div className="h-3 w-3 rounded-full bg-warning/60" />
            <div className="h-3 w-3 rounded-full bg-success/60" />
          </div>
          <div className="flex-1 text-center text-xs text-muted-foreground sm:text-sm">
            DemoForge Studio
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <span className="h-2 w-2 rounded-full bg-destructive animate-blink" />
            REC
          </div>
        </div>

        {/* Faux app being recorded */}
        <div className="relative aspect-[16/10] bg-gradient-subtle">
          {/* mock product UI */}
          <div className="absolute inset-0 flex">
            <div className="hidden w-1/4 flex-col gap-2 border-r border-border/60 bg-card/40 p-4 sm:flex">
              <div className="h-2.5 w-3/4 rounded bg-muted-foreground/20" />
              <div className="h-2.5 w-1/2 rounded bg-muted-foreground/15" />
              <div className="mt-2 h-8 rounded-lg bg-primary/15" />
              <div className="h-2.5 w-2/3 rounded bg-muted-foreground/15" />
              <div className="h-2.5 w-1/2 rounded bg-muted-foreground/10" />
            </div>
            <div className="flex-1 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="h-3 w-28 rounded bg-muted-foreground/20" />
                <div className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm">
                  New Project
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <div className="mb-2 h-10 rounded bg-muted-foreground/10" />
                    <div className="h-2 w-3/4 rounded bg-muted-foreground/15" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* animated recording cursor */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute animate-demo-cursor" style={{ left: 0, top: 0 }}>
              <div className="relative">
                <span className="absolute -inset-3 rounded-full bg-primary/30 animate-ripple-out" />
                <MousePointerClick className="h-6 w-6 text-foreground drop-shadow" fill="white" />
              </div>
            </div>
          </div>

          {/* Frame step: rule-of-thirds + zoom reticle */}
          <div
            className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
              step === 3 ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="absolute inset-8 rounded-lg border-2 border-primary/70">
              <div className="absolute left-1/3 top-0 h-full w-px bg-primary/30" />
              <div className="absolute left-2/3 top-0 h-full w-px bg-primary/30" />
              <div className="absolute left-0 top-1/3 h-px w-full bg-primary/30" />
              <div className="absolute left-0 top-2/3 h-px w-full bg-primary/30" />
              <span className="absolute -left-px -top-6 rounded bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                Auto-zoom 1.4×
              </span>
            </div>
          </div>

          {/* Share step: link + views */}
          <div
            className={`absolute inset-x-0 bottom-0 flex items-center justify-center pb-14 transition-all duration-500 ${
              step === 4 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
          >
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
              <Share2 className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">demoforge.io/v/onboarding</span>
              <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                <BarChart3 className="h-3 w-3" /> 128 views
              </span>
            </div>
          </div>

          {/* Caption bar (Voice step highlighted) */}
          <div className="absolute inset-x-0 bottom-0 border-t border-border/60 bg-card/85 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-2.5">
              {/* waveform */}
              <div className="flex h-5 items-end gap-0.5">
                {[...Array(9)].map((_, i) => (
                  <span
                    key={i}
                    className={`w-0.5 rounded-full ${
                      step === 2 ? "bg-primary animate-waveform" : "bg-muted-foreground/30"
                    }`}
                    style={{ height: "100%", animationDelay: `${i * 90}ms` }}
                  />
                ))}
              </div>
              <p className="flex-1 truncate text-xs font-medium sm:text-sm">
                {captions[lang].text}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Live pipeline rail */}
      <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pipeline
            </span>
            <button
              onClick={() => setPlaying((p) => !p)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {playing ? "Pause" : "Play"}
            </button>
          </div>
          <ul className="space-y-1.5">
            {pipeline.map((p, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <li
                  key={p.label}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-300 ${
                    active
                      ? "border-primary/40 bg-primary/10"
                      : "border-transparent"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : done
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : <p.icon className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight">{p.label}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {active ? p.hint : done ? "Done" : "Queued"}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Interactive language switcher */}
        <div className="mt-4 border-t border-border/60 pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Languages className="h-3.5 w-3.5" /> Caption language
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(captions).map(([code, c]) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                  lang === code
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Interactive feature showcase (tab → preview)
   ───────────────────────────────────────────── */
const showcase = [
  {
    icon: Wand2,
    title: "Auto-written scripts",
    body: "DemoForge reads your clicks and screenshots, then writes a clear, on-brand narration script. Edit a line or regenerate with a different tone — friendly, formal, energetic.",
    preview: (
      <div className="space-y-2.5">
        {[
          "Welcome to Acme — let's set up your first workspace.",
          "Click New Project to name it and pick a template.",
          "Invite your team, and you're ready to ship.",
        ].map((t, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm"
          >
            <span className="mt-0.5 rounded bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
              0:0{i * 3 + 2}
            </span>
            <span>{t}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Mic2,
    title: "Neural voiceover",
    body: "Pick from hundreds of natural voices across 140+ locales. Pacing is tuned to your on-screen actions, with SSML emphasis on the moments that matter.",
    preview: (
      <div className="space-y-3">
        {["Ava — warm, US", "Kenji — calm, JP", "Sofia — bright, ES"].map((v, i) => (
          <div
            key={v}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Play className="h-3.5 w-3.5 translate-x-px" />
            </span>
            <span className="text-sm font-medium">{v}</span>
            <div className="ml-auto flex h-5 items-end gap-0.5">
              {[...Array(7)].map((_, j) => (
                <span
                  key={j}
                  className="w-0.5 rounded-full bg-primary animate-waveform"
                  style={{ height: "100%", animationDelay: `${(i + j) * 80}ms` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: BarChart3,
    title: "Share analytics",
    body: "Every share link tracks views, average completion, and where viewers drop off. Know which demos land — and which prospects are watching.",
    preview: (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">onboarding-demo</span>
          <span className="text-success">128 views</span>
        </div>
        <div className="flex h-24 items-end gap-1.5">
          {[40, 62, 55, 78, 90, 72, 84, 60, 95, 70].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-primary/70"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>Avg. completion 74%</span>
          <span>Drop-off 0:41</span>
        </div>
      </div>
    ),
  },
  {
    icon: Palette,
    title: "Brand kit & studio look",
    body: "Drop your recording onto a studio background with padding, rounded corners, and a soft shadow. Save a logo, colors, and font once — applied to every demo automatically.",
    preview: (
      <div className="rounded-xl bg-gradient-hero p-6">
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary" />
            <div className="h-2.5 w-20 rounded bg-muted-foreground/30" />
          </div>
          <div className="aspect-video rounded bg-gradient-subtle" />
        </div>
      </div>
    ),
  },
];

function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const item = showcase[active];
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="flex flex-col gap-2">
        {showcase.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.title}
              onClick={() => setActive(i)}
              className={`rounded-2xl border p-5 text-left transition-all ${
                on
                  ? "border-primary/40 bg-card shadow-md"
                  : "border-border bg-card/40 hover:bg-card"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    on ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                  }`}
                >
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="font-semibold">{s.title}</span>
              </div>
              <div
                className={`grid transition-all duration-300 ${
                  on ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <p className="overflow-hidden text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="rounded-2xl border border-border bg-secondary/30 p-6 sm:p-10">
        <div key={active} className="animate-fade-in">
          {item.preview}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Static content
   ───────────────────────────────────────────── */
const steps = [
  {
    icon: MonitorPlay,
    title: "Record your screen",
    description:
      "Capture your product with the browser recorder. Pixel-perfect cursor tracking, no downloads, no setup.",
  },
  {
    icon: Wand2,
    title: "AI scripts & voices it",
    description:
      "DemoForge reads your clicks, writes a natural script, records a neural voiceover, and frames every shot automatically.",
  },
  {
    icon: Share2,
    title: "Share a link that converts",
    description:
      "Get a polished demo with a share link and embed code — then see who watched, how far, and where they dropped off.",
  },
];

const stats = [
  { icon: Clock, value: "Minutes", label: "from recording to share link" },
  { icon: Mic2, value: "400+", label: "neural voices, 140+ locales" },
  { icon: Globe, value: "100+", label: "languages, one recording" },
  { icon: BarChart3, value: "4.8%", label: "avg. conversion with video demos" },
];

const comparison = {
  old: [
    "Write a script from a blank page",
    "Re-record voiceover until it's right",
    "Manually zoom, cut, and caption in an editor",
    "Export, upload, and hope someone watches",
  ],
  now: [
    "AI drafts the script from your clicks",
    "Neural voiceover in one click, any language",
    "Auto-zoom, framing, and synced captions",
    "Share a link with built-in view analytics",
  ],
};

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "For your first demos",
    features: [
      "5 active demos",
      "720p export",
      "Standard AI voices",
      "Basic view analytics",
      "DemoForge watermark",
    ],
    cta: "Start free",
    popular: false,
  },
  {
    name: "Pro",
    price: "$24",
    period: "/mo",
    description: "For makers & marketers",
    features: [
      "Unlimited demos",
      "4K export, no watermark",
      "Premium neural voices",
      "Captions & auto-chapters",
      "5-language localization",
      "Brand kit + full analytics",
    ],
    cta: "Start Pro trial",
    popular: true,
  },
  {
    name: "Team",
    price: "$40",
    period: "/seat/mo",
    description: "For growing teams",
    features: [
      "Everything in Pro",
      "Shared workspaces & roles",
      "Unlimited localization",
      "Per-viewer analytics",
      "CRM & webhook events",
      "Priority support",
    ],
    cta: "Talk to us",
    popular: false,
  },
];

const faqs = [
  {
    q: "Do I need any video editing skills?",
    a: "None. You record your screen and DemoForge handles the script, voiceover, framing, and captions. You can tweak anything, but the default output is ready to share.",
  },
  {
    q: "How does the AI write the narration?",
    a: "The browser extension captures your clicks and periodic screenshots. Our AI reads that context and writes a clear, on-brand script with timestamps, which you can edit or regenerate in a different tone.",
  },
  {
    q: "Can I make the same demo in other languages?",
    a: "Yes — translate the script into 100+ languages and re-voice it with a matching neural voice in a click. One recording becomes a demo for every market, no reshoots.",
  },
  {
    q: "What can I do with the finished demo?",
    a: "Export as MP4, WebM, GIF, or APNG, or share a hosted link with an embed snippet. Every link tracks views, completion, and drop-off so you know what's landing.",
  },
  {
    q: "Is there really a free plan?",
    a: "Yes. The free plan lets you create up to 5 demos with standard voices and a small watermark — no credit card required. Upgrade when you need more.",
  },
];

const trustedBy = ["Northwind", "Acme Labs", "Loomly", "Basewell", "Quill", "Tandem", "Cadence", "Orbit"];

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-12%] h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]" />
        </div>

        <div className="container py-16 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-sm shadow-sm backdrop-blur animate-fade-in">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">
                From screen recording to share link — automatically
              </span>
            </div>

            <h1 className="font-display text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl animate-fade-in delay-100">
              Turn any screen recording
              <br className="hidden sm:block" /> into a demo that{" "}
              <span className="text-primary">sells</span>.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground animate-fade-in delay-200">
              Record once. DemoForge writes the script, voices it in a natural AI
              voice, frames every shot, and gives you a polished, shareable demo —
              no editing skills required.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-in delay-300">
              <Button variant="hero" size="xl" asChild className="group">
                <Link to="/dashboard">
                  Create your demo
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button variant="outline" size="xl" className="gap-2">
                <Play className="h-4 w-4" />
                Watch a 60s demo
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground animate-fade-in delay-400">
              Free forever plan · No credit card · Ready in minutes
            </p>
          </div>

          {/* Interactive studio */}
          <div className="mx-auto mt-14 max-w-5xl animate-slide-up delay-300">
            <HeroStudio />
          </div>
        </div>
      </section>

      {/* Trust marquee */}
      <section className="border-y border-border/60 bg-card/40 py-10">
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Loved by product teams and founders shipping faster
        </p>
        <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          <div className="flex w-max animate-marquee gap-14">
            {[...trustedBy, ...trustedBy].map((name, i) => (
              <span
                key={i}
                className="font-display text-xl font-semibold text-muted-foreground/45"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Old way vs DemoForge */}
      <section className="py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Why DemoForge
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              The demo, without the dread
            </h2>
          </Reveal>

          <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-border bg-card/40 p-8">
                <h3 className="mb-5 text-lg font-semibold text-muted-foreground">
                  The old way
                </h3>
                <ul className="space-y-4">
                  {comparison.old.map((t) => (
                    <li key={t} className="flex items-start gap-3 text-muted-foreground">
                      <Circle className="mt-1 h-4 w-4 shrink-0 opacity-40" />
                      <span className="line-through decoration-muted-foreground/40">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="h-full rounded-2xl border border-primary/30 bg-card p-8 shadow-md">
                <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold">
                  <Sparkles className="h-4 w-4 text-primary" /> With DemoForge
                </h3>
                <ul className="space-y-4">
                  {comparison.now.map((t) => (
                    <li key={t} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-border/60 bg-card/50 py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              How it works
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Three calm steps to a demo
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              You record. The AI does the rest.
            </p>
          </Reveal>

          <div className="mx-auto mt-16 grid max-w-5xl gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <Reveal key={step.title} delay={index * 120}>
                <div className="relative h-full rounded-2xl border border-border bg-card p-8 card-hover">
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="mb-2 text-sm font-semibold text-muted-foreground">
                    Step {index + 1}
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">{step.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive feature showcase */}
      <section id="features" className="py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Everything included
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              A studio that runs itself
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Click through the parts you'd normally dread — all handled for you.
            </p>
          </Reveal>

          <Reveal className="mx-auto mt-14 max-w-6xl">
            <FeatureShowcase />
          </Reveal>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y border-border/60 bg-gradient-subtle py-16">
        <div className="container">
          <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 100} className="text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="font-display text-3xl font-semibold">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-3xl text-center">
            <Quote className="mx-auto mb-6 h-10 w-10 text-primary/30" />
            <p className="font-display text-2xl font-medium leading-relaxed sm:text-3xl">
              “We replaced a full afternoon of recording and editing with a
              five-minute DemoForge session. Our onboarding demo now ships in four
              languages and we can see exactly who finishes it.”
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/15" />
              <div className="text-left">
                <div className="text-sm font-semibold">Maya Okafor</div>
                <div className="text-sm text-muted-foreground">Head of Product, Loomly</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* The share link is the product */}
      <section className="border-t border-border/60 py-24">
        <div className="container">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">
                Share &amp; measure
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                The share link <span className="text-primary">is</span> the product
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Every demo gets a fast, beautiful player page — with AI-generated
                chapters, a clickable transcript, and view counts. Send the link,
                or embed the player anywhere with one snippet.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  { icon: Link2, text: "Unguessable links with private / unlisted / public control" },
                  { icon: ListOrdered, text: "Auto-chapters and a seekable transcript from your AI script" },
                  { icon: Code2, text: "One-line responsive embed for docs, changelogs, and landing pages" },
                  { icon: Eye, text: "View counts today — per-viewer drop-off analytics next" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </span>
                    <span className="text-muted-foreground">{text}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            {/* Mini mock of the /v/:slug player page */}
            <Reveal delay={120}>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-xl">
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5 text-primary" />
                  demoforge.app/v/x7Kp2mQ9rTw
                  <span className="ml-auto flex items-center gap-1 text-foreground">
                    <Eye className="h-3.5 w-3.5" /> 1,284
                  </span>
                </div>
                <div className="relative overflow-hidden rounded-xl bg-foreground">
                  <div className="aspect-video bg-gradient-to-br from-foreground via-foreground/95 to-primary/25" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-2xl">
                      <Play className="ml-0.5 h-6 w-6 text-primary-foreground" />
                    </span>
                  </div>
                  <div className="absolute inset-x-4 bottom-3 h-1 rounded-full bg-white/25">
                    <div className="h-full w-1/3 rounded-full bg-primary" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    ["0:00", "Meet your new dashboard"],
                    ["0:24", "Create a report in one click"],
                    ["0:51", "Share it with your team"],
                  ].map(([t, label], i) => (
                    <div
                      key={t}
                      className={`flex items-baseline gap-3 rounded-lg px-3 py-2 text-sm ${
                        i === 0 ? "bg-primary/10 font-medium" : "text-muted-foreground"
                      }`}
                    >
                      <span className="font-mono text-xs text-primary">{t}</span>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/60 bg-card/50 py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Pricing
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Start free, upgrade when it clicks
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Simple plans that scale from your first demo to your whole team.
            </p>
          </Reveal>

          <div className="mx-auto mt-16 grid max-w-5xl items-start gap-6 md:grid-cols-3">
            {pricingPlans.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 100}>
                <div
                  className={`relative h-full rounded-2xl border p-8 ${
                    plan.popular
                      ? "border-primary bg-card shadow-lg"
                      : "border-border bg-card"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
                      Most popular
                    </div>
                  )}
                  <div className="mb-5">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                  </div>
                  <div className="mb-6 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-semibold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-muted-foreground">{plan.period}</span>
                    )}
                  </div>
                  <ul className="mb-8 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={plan.popular ? "hero" : "outline"}
                    className="w-full"
                    asChild
                  >
                    <Link to="/auth">{plan.cta}</Link>
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              FAQ
            </p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Questions, answered
            </h2>
          </Reveal>
          <Reveal className="mx-auto mt-12 max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-base font-medium">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-hero p-12 text-center md:p-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsla(40,40%,99%,0.18),transparent_60%)]" />
            <div className="relative">
              <h2 className="font-display text-4xl font-semibold tracking-tight text-primary-foreground sm:text-5xl">
                Your next demo is minutes away
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/85">
                Record it once. Let DemoForge script, voice, and frame it — then
                send a link that shows you exactly who watched.
              </p>
              <Button
                size="xl"
                className="mt-8 bg-background text-foreground hover:bg-background/90"
                asChild
              >
                <Link to="/dashboard">
                  Create your demo free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
