import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { 
  Video, 
  Sparkles, 
  Download, 
  Play, 
  MonitorPlay, 
  Mic2, 
  Wand2,
  Check,
  ArrowRight
} from "lucide-react";

const steps = [
  {
    icon: MonitorPlay,
    title: "Record your screen",
    description: "Capture your product in action with our simple browser-based recorder. No downloads required.",
  },
  {
    icon: Wand2,
    title: "AI generates script & voice",
    description: "Our AI analyzes your recording and creates a professional script with natural-sounding voiceover.",
  },
  {
    icon: Download,
    title: "Download demo video",
    description: "Get a polished, ready-to-share demo video with smooth transitions and professional effects.",
  },
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect for trying out",
    features: ["3 demo videos per month", "720p export quality", "Basic AI voices", "Watermark included"],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For growing teams",
    features: ["Unlimited demo videos", "4K export quality", "Premium AI voices", "No watermark", "Priority support", "Custom branding"],
    cta: "Start Pro Trial",
    popular: true,
  },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl" />
        </div>

        <div className="container py-24 lg:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">AI-Powered Demo Creation</span>
            </div>

            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl animate-fade-in">
              Turn your product into a{" "}
              <span className="text-gradient">demo video</span>
              <br />
              in minutes
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground animate-fade-in delay-100">
              Record your screen, let AI generate the perfect script and voiceover, 
              and download a polished demo video. No video editing skills required.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row animate-fade-in delay-200">
              <Button variant="hero" size="xl" asChild className="group">
                <Link to="/dashboard">
                  Create Demo
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="gap-2">
                <Play className="h-4 w-4" />
                Watch Demo
              </Button>
            </div>

            {/* Hero Visual */}
            <div className="relative mt-16 animate-slide-up delay-300">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-destructive/60" />
                    <div className="h-3 w-3 rounded-full bg-warning/60" />
                    <div className="h-3 w-3 rounded-full bg-success/60" />
                  </div>
                  <div className="flex-1 text-center text-sm text-muted-foreground">DemoForge Editor</div>
                </div>
                <div className="relative aspect-video bg-gradient-subtle">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-hero shadow-glow animate-pulse-glow">
                        <Video className="h-10 w-10 text-primary-foreground" />
                      </div>
                      <p className="text-lg font-medium text-muted-foreground">Your demo preview</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating elements */}
              <div className="absolute -right-4 top-1/4 hidden animate-float rounded-xl border border-border bg-card p-4 shadow-lg lg:block">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                    <Mic2 className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Voice generated</p>
                    <p className="text-xs text-muted-foreground">2.4s audio</p>
                  </div>
                </div>
              </div>
              <div className="absolute -left-4 bottom-1/4 hidden animate-float delay-200 rounded-xl border border-border bg-card p-4 shadow-lg lg:block">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Wand2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Script ready</p>
                    <p className="text-xs text-muted-foreground">AI-optimized</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-y border-border/40 bg-secondary/30 py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">How it works</h2>
            <p className="text-lg text-muted-foreground">
              Create professional demo videos in three simple steps
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="relative rounded-2xl border border-border bg-card p-8 card-hover"
              >
                <div className="absolute -top-4 left-8 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-hero text-sm font-bold text-primary-foreground">
                  {index + 1}
                </div>
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                  <step.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mb-3 text-xl font-semibold">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Simple, transparent pricing</h2>
            <p className="text-lg text-muted-foreground">
              Start for free, upgrade when you need more
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl gap-8 md:grid-cols-2">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-8 ${
                  plan.popular
                    ? "border-primary bg-card shadow-lg shadow-primary/10"
                    : "border-border bg-card"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-hero px-4 py-1 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                </div>
                <ul className="mb-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <Check className="h-4 w-4 text-success" />
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
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-12 text-center md:p-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsla(0,0%,100%,0.1),transparent)]" />
            <div className="relative">
              <h2 className="mb-4 text-3xl font-bold text-primary-foreground sm:text-4xl">
                Ready to create your first demo?
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-lg text-primary-foreground/80">
                Join thousands of product teams creating stunning demo videos with AI.
              </p>
              <Button size="xl" className="bg-background text-foreground hover:bg-background/90" asChild>
                <Link to="/dashboard">
                  Get Started Free
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
