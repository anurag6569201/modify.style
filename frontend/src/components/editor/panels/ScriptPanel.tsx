import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Wand2,
    Loader2,
    FileText,
    Plus,
    Trash2,
    Clock,
    Sparkles,
    ChevronDown,
    ChevronUp,
    ListOrdered,
    AlignLeft,
    Crosshair,
    Rocket,
    Megaphone,
    GraduationCap,
    Zap,
    Briefcase,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { editorStore, useEditorState, generateId } from '@/lib/editor/store';
import { scriptAPI } from '@/lib/api/script';
import type { ScriptTone } from '@/lib/editor/types';
import { cn } from '@/lib/utils';

const TEMPLATES: Array<{ id: string; label: string; hint: string; icon: React.ElementType }> = [
    { id: 'walkthrough', label: 'Walkthrough', hint: 'Step-by-step guide through the flow', icon: ListOrdered },
    { id: 'feature-launch', label: 'Feature launch', hint: 'Punchy announcement of what’s new', icon: Rocket },
    { id: 'sales-pitch', label: 'Sales pitch', hint: 'Benefits, outcomes and value', icon: Megaphone },
    { id: 'tutorial', label: 'Tutorial', hint: 'Teach the viewer how to do it', icon: GraduationCap },
    { id: 'social-teaser', label: 'Social teaser', hint: 'Hook-first, fast paced, short', icon: Zap },
    { id: 'investor-update', label: 'Stakeholder update', hint: 'Progress and impact for stakeholders', icon: Briefcase },
];

const TONES: Array<{ id: ScriptTone; label: string }> = [
    { id: 'professional', label: 'Professional' },
    { id: 'friendly', label: 'Friendly' },
    { id: 'energetic', label: 'Energetic' },
    { id: 'calm', label: 'Calm' },
    { id: 'playful', label: 'Playful' },
];

const WORDS_PER_SECOND = 2.4;

function formatTime(time: number) {
    if (!isFinite(time) || isNaN(time) || time < 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function wordCount(text: string) {
    return text.split(/\s+/).filter(Boolean).length;
}

export function ScriptPanel() {
    const { toast } = useToast();
    const editorState = useEditorState();
    const { voiceover, video, events, playback } = editorState;

    const [isGenerating, setIsGenerating] = useState(false);
    const [captureProgress, setCaptureProgress] = useState(0);
    const [mode, setMode] = useState<'segments' | 'full'>(
        voiceover.scriptSegments.length > 0 ? 'segments' : 'full'
    );
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [activeSegment, setActiveSegment] = useState<number | null>(null);

    const style = voiceover.scriptStyle ?? {
        template: 'walkthrough',
        tone: 'professional' as ScriptTone,
        audience: '',
        instructions: '',
    };

    const updateStyle = (updates: Partial<typeof style>) => {
        editorStore.updateVoiceover({ scriptStyle: { ...style, ...updates } });
    };

    // ----- Segment helpers ---------------------------------------------------

    const segments = voiceover.scriptSegments;

    /** Seconds available before the next segment starts (spoken-time budget). */
    const availableWindow = (index: number) => {
        const seg = segments[index];
        if (!seg) return 0;
        const next = segments[index + 1];
        const end = next ? next.timestamp : video.duration || seg.timestamp + 10;
        return Math.max(0, end - seg.timestamp);
    };

    const estimatedSeconds = (text: string) => wordCount(text) / WORDS_PER_SECOND;

    const addSegmentAtPlayhead = () => {
        editorStore.addSegment({
            id: generateId('seg'),
            text: '',
            timestamp: Math.round(playback.currentTime * 10) / 10,
            audioUrl: null,
            audioBlob: null,
            duration: 0,
            isGenerated: false,
        });
        setMode('segments');
    };

    // ----- Frame capture for AI vision --------------------------------------

    const captureVideoFrame = async (videoUrl: string, timestamp: number): Promise<string | null> => {
        return new Promise((resolve) => {
            const videoEl = document.createElement('video');
            videoEl.crossOrigin = 'anonymous';
            videoEl.preload = 'metadata';
            videoEl.muted = true;
            videoEl.playsInline = true;
            let resolved = false;
            const finish = (result: string | null) => {
                if (resolved) return;
                resolved = true;
                videoEl.remove();
                resolve(result);
            };
            videoEl.onloadedmetadata = () => {
                videoEl.currentTime = Math.min(Math.max(0, timestamp), videoEl.duration);
            };
            videoEl.onseeked = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = videoEl.videoWidth;
                    canvas.height = videoEl.videoHeight;
                    const ctx = canvas.getContext('2d');
                    if (ctx && videoEl.videoWidth > 0) {
                        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                        finish(canvas.toDataURL('image/jpeg', 0.85));
                    } else {
                        finish(null);
                    }
                } catch {
                    finish(null);
                }
            };
            videoEl.onerror = () => finish(null);
            setTimeout(() => finish(null), 10000);
            videoEl.src = videoUrl;
        });
    };

    const handleGenerateScript = async () => {
        if (!video.url || video.duration <= 0) {
            toast({
                title: 'No video loaded',
                description: 'Record or open a project with a video first.',
                variant: 'destructive',
            });
            return;
        }

        setIsGenerating(true);
        setCaptureProgress(0);

        try {
            const clicks = events.clicks;
            const screenshots: Array<{ timestamp: number; image: string }> = [];
            const clicksToCapture = clicks.slice(0, 15);
            for (let i = 0; i < clicksToCapture.length; i++) {
                const shot = await captureVideoFrame(video.url, clicksToCapture[i].timestamp);
                if (shot) screenshots.push({ timestamp: clicksToCapture[i].timestamp, image: shot });
                setCaptureProgress(((i + 1) / clicksToCapture.length) * 100);
                await new Promise((r) => setTimeout(r, 30));
            }

            const response = await scriptAPI.generateScriptWithTimestamps({
                video_url: video.url,
                video_duration: video.duration,
                events: {
                    clicks: clicks.map((c) => ({ timestamp: c.timestamp, x: c.x, y: c.y })),
                    moves: events.moves.map((m) => ({ timestamp: m.timestamp, x: m.x, y: m.y })),
                },
                screenshots,
                style: {
                    template: style.template,
                    tone: style.tone,
                    audience: style.audience,
                    instructions: style.instructions,
                },
            });

            const generated = response.script_segments || [];
            editorStore.setScriptSegments(
                generated.map((segment) => ({
                    id: generateId('seg'),
                    text: segment.text,
                    timestamp: segment.timestamp,
                    audioUrl: null,
                    audioBlob: null,
                    duration: 0,
                    isGenerated: false,
                }))
            );
            setMode('segments');
            toast({
                title: 'Script ready',
                description: `${generated.length} segments written${screenshots.length > 0 ? ` from ${screenshots.length} analyzed frames` : ''}. Review, tweak, then head to Voice.`,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to generate script.';
            if (message.includes('session has expired') || message.includes('Authentication required')) {
                toast({ title: 'Sign in required', description: message, variant: 'destructive' });
                setTimeout(() => (window.location.href = '/auth'), 2000);
            } else {
                toast({ title: 'Generation failed', description: message, variant: 'destructive' });
            }
        } finally {
            setIsGenerating(false);
            setCaptureProgress(0);
        }
    };

    const totalWords = mode === 'segments' && segments.length > 0
        ? segments.reduce((sum, s) => sum + wordCount(s.text), 0)
        : wordCount(voiceover.script);
    const totalSpokenSeconds = totalWords / WORDS_PER_SECOND;
    const overBudget = video.duration > 0 && totalSpokenSeconds > video.duration;

    return (
        <div className="flex h-full flex-col">
            {/* ---- AI generation setup ---- */}
            <div className="space-y-3 border-b border-border/40 p-4">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        AI Script Writer
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                        {events.clicks.length} interactions detected
                    </span>
                </div>

                {/* Template picker */}
                <div className="grid grid-cols-3 gap-1.5">
                    {TEMPLATES.map(({ id, label, hint, icon: Icon }) => (
                        <button
                            key={id}
                            title={hint}
                            onClick={() => updateStyle({ template: id })}
                            className={cn(
                                'flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all',
                                style.template === id
                                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                    : 'border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground'
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-medium leading-tight">{label}</span>
                        </button>
                    ))}
                </div>

                {/* Tone chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {TONES.map(({ id, label }) => (
                        <button
                            key={id}
                            onClick={() => updateStyle({ tone: id })}
                            className={cn(
                                'rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all',
                                style.tone === id
                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                    : 'border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Advanced: audience + custom instructions */}
                <button
                    className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowAdvanced((v) => !v)}
                >
                    {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Audience & custom instructions
                </button>
                {showAdvanced && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <Input
                            placeholder="Audience — e.g. new users, engineering leads, customers"
                            value={style.audience}
                            onChange={(e) => updateStyle({ audience: e.target.value })}
                            className="h-8 bg-background/50 text-xs"
                        />
                        <Textarea
                            placeholder="Anything the AI should mention, avoid, or emphasize…"
                            value={style.instructions}
                            onChange={(e) => updateStyle({ instructions: e.target.value })}
                            className="min-h-[56px] resize-none bg-background/50 text-xs"
                        />
                    </div>
                )}

                <Button
                    onClick={handleGenerateScript}
                    disabled={isGenerating}
                    className="w-full shadow-md shadow-primary/20"
                    size="sm"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            {captureProgress > 0 && captureProgress < 100
                                ? `Analyzing video… ${Math.round(captureProgress)}%`
                                : 'Writing script…'}
                        </>
                    ) : (
                        <>
                            <Wand2 className="mr-2 h-3.5 w-3.5" />
                            {segments.length > 0 || voiceover.script.trim()
                                ? 'Rewrite with AI'
                                : 'Write script with AI'}
                        </>
                    )}
                </Button>
            </div>

            {/* ---- Editor mode toggle + stats ---- */}
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
                <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-secondary/40 p-0.5">
                    <button
                        onClick={() => setMode('segments')}
                        className={cn(
                            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all',
                            mode === 'segments'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <ListOrdered className="h-3 w-3" />
                        Segments {segments.length > 0 && `(${segments.length})`}
                    </button>
                    <button
                        onClick={() => setMode('full')}
                        className={cn(
                            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all',
                            mode === 'full'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <AlignLeft className="h-3 w-3" />
                        Full script
                    </button>
                </div>
                <div
                    className={cn(
                        'flex items-center gap-2 font-mono text-[10px]',
                        overBudget ? 'text-destructive' : 'text-muted-foreground'
                    )}
                    title={overBudget ? 'Narration is longer than the video — trim the script or it will feel rushed.' : undefined}
                >
                    <span>{totalWords} words</span>
                    <span className="h-2 w-px bg-border" />
                    <span>
                        ~{formatTime(totalSpokenSeconds)} / {formatTime(video.duration)}
                    </span>
                </div>
            </div>

            {/* ---- Content ---- */}
            <div className="flex-1 overflow-y-auto">
                {mode === 'full' ? (
                    <div className="p-4">
                        <Textarea
                            value={voiceover.script}
                            onChange={(e) => editorStore.updateVoiceover({ script: e.target.value })}
                            placeholder={'Write your narration here, or use the AI writer above.\n\nTip: switch to Segments to time each line to the video.'}
                            className="min-h-[260px] w-full resize-none border-border/40 bg-background/40 text-sm leading-relaxed"
                        />
                        {segments.length > 0 && (
                            <p className="mt-2 text-[10px] text-muted-foreground">
                                Note: Voice generation uses your timed segments. Editing the full script here
                                doesn&apos;t change segments — use the Segments view for precise control.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2 p-4">
                        {segments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="mb-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                                    <FileText className="h-8 w-8 text-primary/60" />
                                </div>
                                <p className="mb-1 text-sm font-medium">No script segments yet</p>
                                <p className="mb-4 max-w-[240px] text-xs text-muted-foreground">
                                    Let the AI write timed narration from your recording, or add segments manually.
                                </p>
                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addSegmentAtPlayhead}>
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Add segment at playhead
                                </Button>
                            </div>
                        ) : (
                            <>
                                {segments.map((segment, index) => {
                                    const words = wordCount(segment.text);
                                    const spoken = estimatedSeconds(segment.text);
                                    const budget = availableWindow(index);
                                    const tooLong = budget > 0 && spoken > budget + 0.5;
                                    const isActive = activeSegment === index;
                                    return (
                                        <div
                                            key={segment.id ?? index}
                                            className={cn(
                                                'group rounded-lg border transition-all',
                                                isActive
                                                    ? 'border-primary/40 bg-card/70 shadow-sm ring-1 ring-primary/20'
                                                    : 'border-border/40 bg-card/40 hover:border-border/70'
                                            )}
                                        >
                                            <div className="flex items-center gap-2 px-3 pt-2.5">
                                                <button
                                                    className="flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-primary"
                                                    title="Jump playhead here"
                                                    onClick={() => editorStore.setPlayback({ currentTime: segment.timestamp })}
                                                >
                                                    <Clock className="h-2.5 w-2.5" />
                                                    {formatTime(segment.timestamp)}
                                                </button>
                                                <button
                                                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-all hover:bg-background/60 hover:text-primary group-hover:opacity-100"
                                                    title="Re-time to playhead"
                                                    onClick={() =>
                                                        editorStore.updateSegment(index, {
                                                            timestamp: Math.round(playback.currentTime * 10) / 10,
                                                        })
                                                    }
                                                >
                                                    <Crosshair className="h-2.5 w-2.5" />
                                                    Set to playhead
                                                </button>
                                                <span
                                                    className={cn(
                                                        'ml-auto font-mono text-[10px]',
                                                        tooLong ? 'text-destructive' : 'text-muted-foreground/60'
                                                    )}
                                                    title={
                                                        tooLong
                                                            ? `~${spoken.toFixed(1)}s of narration but only ${budget.toFixed(1)}s before the next segment`
                                                            : `~${spoken.toFixed(1)}s spoken · ${budget.toFixed(1)}s window`
                                                    }
                                                >
                                                    {words}w · ~{spoken.toFixed(0)}s{tooLong ? ' ⚠' : ''}
                                                </span>
                                                {segment.isGenerated && (
                                                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                                                        voiced
                                                    </span>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                                    onClick={() => {
                                                        editorStore.deleteSegment(index);
                                                        setActiveSegment(null);
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <Textarea
                                                value={segment.text}
                                                onFocus={() => setActiveSegment(index)}
                                                onBlur={() => setActiveSegment(null)}
                                                onChange={(e) =>
                                                    editorStore.updateSegment(index, {
                                                        text: e.target.value,
                                                        // text changed → prior audio is stale
                                                        ...(segment.isGenerated ? { isGenerated: false, audioUrl: null, audioBlob: null } : {}),
                                                    })
                                                }
                                                placeholder="Narration for this moment…"
                                                className="min-h-[54px] resize-none border-0 bg-transparent px-3 py-2 text-sm leading-relaxed shadow-none focus-visible:ring-0"
                                            />
                                        </div>
                                    );
                                })}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-full border-dashed text-xs text-muted-foreground hover:text-foreground"
                                    onClick={addSegmentAtPlayhead}
                                >
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                                    Add segment at {formatTime(playback.currentTime)}
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
