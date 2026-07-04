import React, { useRef, useCallback } from 'react';
import { editorStore, useEditorState, generateId } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Video,
    ZoomIn,
    Zap,
    Maximize,
    X,
    Clock,
    Gauge,
    Repeat,
    Pause,
    Plus,
    Trash2,
    Wand2,
    Crosshair,
    Film,
    Rabbit,
    Hand,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ZoomEffect } from '@/lib/editor/types';
import { cn } from '@/lib/utils';

interface CameraPanelProps {
    selectedEffectId?: string | null;
    onEffectSelect?: (id: string | null) => void;
    isLoopingEffect?: boolean;
}

function formatTime(time: number) {
    if (!isFinite(time) || isNaN(time) || time < 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const EASINGS: Array<{ id: NonNullable<ZoomEffect['easing']>; label: string; hint: string }> = [
    { id: 'ease-out', label: 'Smooth', hint: 'Fast in, gentle settle — the classic demo feel' },
    { id: 'ease-in-out', label: 'Cinematic', hint: 'Gentle in and out' },
    { id: 'linear', label: 'Linear', hint: 'Constant speed' },
    { id: 'ease-in', label: 'Build-up', hint: 'Starts slow, accelerates' },
    { id: 'bounce', label: 'Bounce', hint: 'Playful overshoot' },
];

const MODES = [
    { id: 'cinematic', label: 'Cinematic', icon: Film, hint: 'Smooth, flowing movement with heavy damping' },
    { id: 'fast', label: 'Responsive', icon: Rabbit, hint: 'Quick, snappy tracking of the action' },
    { id: 'manual', label: 'Manual', icon: Hand, hint: 'No auto-follow — only your zoom moments move the camera' },
] as const;

/** Interactive focus pad — drag to set where the zoom looks (panX/panY -1..1). */
function FocusPad({
    panX,
    panY,
    zoom,
    onChange,
}: {
    panX: number;
    panY: number;
    zoom: number;
    onChange: (panX: number, panY: number) => void;
}) {
    const padRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);

    const applyPointer = useCallback(
        (clientX: number, clientY: number) => {
            const el = padRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
            onChange(Math.round((nx * 2 - 1) * 100) / 100, Math.round((ny * 2 - 1) * 100) / 100);
        },
        [onChange]
    );

    // Visible viewport rectangle (what the camera sees at this zoom)
    const viewW = Math.max(18, 100 / Math.max(1, zoom));
    const viewH = viewW;
    const cx = ((panX + 1) / 2) * 100;
    const cy = ((panY + 1) / 2) * 100;
    const left = Math.max(0, Math.min(100 - viewW, cx - viewW / 2));
    const top = Math.max(0, Math.min(100 - viewH, cy - viewH / 2));

    return (
        <div
            ref={padRef}
            className="relative aspect-video w-full cursor-crosshair select-none overflow-hidden rounded-lg border border-border/50 bg-secondary/40"
            onPointerDown={(e) => {
                draggingRef.current = true;
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                applyPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
                if (draggingRef.current) applyPointer(e.clientX, e.clientY);
            }}
            onPointerUp={() => {
                draggingRef.current = false;
            }}
            title="Drag to set the zoom focus point"
        >
            {/* Grid lines */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/3 top-0 h-full w-px bg-border/40" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-border/40" />
                <div className="absolute left-0 top-1/3 h-px w-full bg-border/40" />
                <div className="absolute left-0 top-2/3 h-px w-full bg-border/40" />
            </div>
            {/* Camera viewport preview */}
            <div
                className="pointer-events-none absolute rounded-sm border-2 border-primary/70 bg-primary/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)] transition-all duration-75"
                style={{ left: `${left}%`, top: `${top}%`, width: `${viewW}%`, height: `${viewH}%` }}
            />
            {/* Focus dot */}
            <div
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-md"
                style={{ left: `${cx}%`, top: `${cy}%` }}
            />
        </div>
    );
}

export function CameraPanel({ selectedEffectId, onEffectSelect, isLoopingEffect }: CameraPanelProps = {}) {
    const { camera, events, playback, video } = useEditorState();
    const { toast } = useToast();

    const selectedEffect = selectedEffectId ? events.effects.find((e) => e.id === selectedEffectId) : null;

    const effStart = (e: ZoomEffect) => (Number.isFinite(e.start) ? e.start : e.timestamp ?? 0);
    const effEnd = (e: ZoomEffect) => (Number.isFinite(e.end) ? e.end : effStart(e) + 3);

    const addZoomAtPlayhead = () => {
        const start = playback.currentTime;
        const duration = video.duration || start + 3;
        const effect: ZoomEffect = {
            id: generateId('effect'),
            type: 'spotlight',
            start,
            end: Math.min(duration, start + 3),
            zoom: camera.zoomStrength,
            label: `Zoom ${events.effects.length + 1}`,
            panX: 0,
            panY: 0,
            easing: 'ease-out',
            transitionSpeed: 1.0,
        };
        editorStore.addEffect(effect);
        onEffectSelect?.(effect.id);
    };

    const autoZoomFromClicks = () => {
        const duration = video.duration || 0;
        const clicks = [...events.clicks].sort((a, b) => a.timestamp - b.timestamp);
        if (duration <= 0 || clicks.length === 0) {
            toast({ title: 'No clicks captured', description: 'Auto-zoom needs recorded clicks to work from.', variant: 'destructive' });
            return;
        }
        const existing = events.effects;
        const created: ZoomEffect[] = [];
        const MIN_GAP = 1.0; // don't stack zooms on rapid clicks
        let lastEnd = -MIN_GAP;
        for (const click of clicks) {
            const start = Math.max(0, click.timestamp - 0.2);
            if (start < lastEnd + MIN_GAP) continue;
            // skip if a zoom already covers this moment
            const covered = [...existing, ...created].some((e) => effStart(e) <= click.timestamp && effEnd(e) >= click.timestamp);
            if (covered) continue;
            const end = Math.min(duration, start + 2.8);
            created.push({
                id: generateId('effect'),
                type: 'spotlight',
                start,
                end,
                zoom: camera.zoomStrength,
                label: 'Auto zoom',
                panX: Math.round((click.x * 2 - 1) * 100) / 100,
                panY: Math.round((click.y * 2 - 1) * 100) / 100,
                easing: 'ease-out',
                transitionSpeed: 1.0,
            });
            lastEnd = end;
        }
        if (created.length === 0) {
            toast({ title: 'Nothing to add', description: 'Every click is already covered by a zoom moment.' });
            return;
        }
        editorStore.setState((prev) => ({
            events: { ...prev.events, effects: [...prev.events.effects, ...created] },
        }));
        toast({ title: 'Auto-zoom added', description: `${created.length} zoom moments created, focused on your clicks.` });
    };

    // ------- Selected effect editor -------
    if (selectedEffect) {
        const start = effStart(selectedEffect);
        const end = effEnd(selectedEffect);
        return (
            <div className="space-y-4 p-4 pb-16">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <ZoomIn className="h-3.5 w-3.5 text-primary" />
                        Zoom moment
                    </Label>
                    <div className="flex items-center gap-1">
                        <Button
                            variant={isLoopingEffect ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                                if (isLoopingEffect) {
                                    editorStore.setPlayback({ isPlaying: false });
                                } else {
                                    editorStore.setPlayback({ currentTime: start, isPlaying: true });
                                }
                            }}
                            title="Loop-preview just this moment"
                        >
                            {isLoopingEffect ? <Pause className="mr-1 h-3 w-3" /> : <Repeat className="mr-1 h-3 w-3" />}
                            {isLoopingEffect ? 'Stop' : 'Loop preview'}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                                editorStore.setPlayback({ isPlaying: false });
                                onEffectSelect?.(null);
                            }}
                            title="Back to camera settings"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Focus pad — the star of the show */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground">Focus point</Label>
                        <button
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
                            onClick={() => editorStore.updateEffect(selectedEffect.id, { panX: 0, panY: 0 })}
                        >
                            <Crosshair className="h-3 w-3" />
                            Center
                        </button>
                    </div>
                    <FocusPad
                        panX={selectedEffect.panX ?? 0}
                        panY={selectedEffect.panY ?? 0}
                        zoom={selectedEffect.zoom ?? camera.zoomStrength}
                        onChange={(panX, panY) => editorStore.updateEffect(selectedEffect.id, { panX, panY })}
                    />
                    <p className="text-[10px] text-muted-foreground">
                        Drag to aim the camera. The bright rectangle is what viewers will see.
                    </p>
                </div>

                {/* Zoom level */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground">Zoom level</Label>
                        <span className="rounded border border-border/30 bg-background/50 px-2 py-0.5 font-mono text-xs">
                            {(selectedEffect.zoom ?? camera.zoomStrength).toFixed(1)}x
                        </span>
                    </div>
                    <Slider
                        min={1}
                        max={5}
                        step={0.1}
                        value={[selectedEffect.zoom ?? camera.zoomStrength]}
                        onValueChange={([val]) => editorStore.updateEffect(selectedEffect.id, { zoom: val })}
                    />
                </div>

                {/* Transition */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                        <Gauge className="h-3 w-3" />
                        Transition
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                        {EASINGS.map(({ id, label, hint }) => (
                            <button
                                key={id}
                                title={hint}
                                className={cn(
                                    'rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all',
                                    (selectedEffect.easing ?? 'ease-out') === id
                                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                        : 'border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground'
                                )}
                                onClick={() => editorStore.updateEffect(selectedEffect.id, { easing: id })}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground">Transition speed</Label>
                            <span className="font-mono text-[10px] text-muted-foreground">
                                {(selectedEffect.transitionSpeed ?? 1.0).toFixed(2)}x
                            </span>
                        </div>
                        <Slider
                            min={0.25}
                            max={3}
                            step={0.25}
                            value={[selectedEffect.transitionSpeed ?? 1.0]}
                            onValueChange={([val]) => editorStore.updateEffect(selectedEffect.id, { transitionSpeed: val })}
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground/70">
                            <span>Slow & dreamy</span>
                            <span>Snappy</span>
                        </div>
                    </div>
                </div>

                {/* Timing */}
                <div className="space-y-2 rounded-lg border border-border/30 bg-secondary/20 p-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                Start (s)
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                step={0.1}
                                value={Number(start).toFixed(1)}
                                onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    if (!isNaN(v)) editorStore.updateEffect(selectedEffect.id, { start: v });
                                }}
                                className="h-8 border-border/40 bg-background/50 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                End (s)
                            </Label>
                            <Input
                                type="number"
                                min={0}
                                step={0.1}
                                value={Number(end).toFixed(1)}
                                onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    if (!isNaN(v)) editorStore.updateEffect(selectedEffect.id, { end: v });
                                }}
                                className="h-8 border-border/40 bg-background/50 text-xs"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                            {formatTime(start)} → {formatTime(end)} · {(end - start).toFixed(1)}s
                        </span>
                        <button
                            className="flex items-center gap-1 hover:text-primary"
                            onClick={() => editorStore.setPlayback({ currentTime: start })}
                        >
                            <Crosshair className="h-3 w-3" />
                            Jump here
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <Input
                        value={selectedEffect.label || ''}
                        onChange={(e) => editorStore.updateEffect(selectedEffect.id, { label: e.target.value })}
                        placeholder="Name this moment…"
                        className="h-8 border-border/40 bg-background/50 text-xs"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                            editorStore.deleteEffect(selectedEffect.id);
                            onEffectSelect?.(null);
                        }}
                    >
                        <Trash2 className="mr-1.5 h-3 w-3" />
                        Delete moment
                    </Button>
                </div>
            </div>
        );
    }

    // ------- Global camera settings + zoom moment list -------
    return (
        <div className="space-y-5 p-4 pb-16">
            {/* Zoom moments */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <ZoomIn className="h-3.5 w-3.5 text-primary" />
                        Zoom moments
                    </Label>
                    <span className="text-[10px] text-muted-foreground">{events.effects.length} placed</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" className="h-8 text-xs shadow-md shadow-primary/20" onClick={addZoomAtPlayhead}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Zoom at {formatTime(playback.currentTime)}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={autoZoomFromClicks} title="Create zoom moments focused on every recorded click">
                        <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                        Auto-zoom clicks
                    </Button>
                </div>

                {events.effects.length > 0 && (
                    <div className="max-h-[180px] space-y-1 overflow-y-auto pr-1">
                        {[...events.effects]
                            .sort((a, b) => effStart(a) - effStart(b))
                            .map((effect) => (
                                <button
                                    key={effect.id}
                                    className="group flex w-full items-center gap-2 rounded-md border border-border/40 bg-card/40 px-2.5 py-1.5 text-left transition-all hover:border-primary/40 hover:bg-card/70"
                                    onClick={() => {
                                        onEffectSelect?.(effect.id);
                                        editorStore.setPlayback({ currentTime: effStart(effect) });
                                    }}
                                >
                                    <ZoomIn className="h-3 w-3 shrink-0 text-primary/70" />
                                    <span className="flex-1 truncate text-xs font-medium">{effect.label || 'Zoom'}</span>
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                        {formatTime(effStart(effect))}–{formatTime(effEnd(effect))}
                                    </span>
                                    <span className="rounded bg-background/60 px-1 font-mono text-[10px] text-muted-foreground">
                                        {(effect.zoom ?? camera.zoomStrength).toFixed(1)}x
                                    </span>
                                    <Trash2
                                        className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            editorStore.deleteEffect(effect.id);
                                        }}
                                    />
                                </button>
                            ))}
                    </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                    Click a moment to fine-tune its focus, zoom and transition. Drag the purple blocks on the timeline to re-time them.
                </p>
            </div>

            {/* Camera behaviour */}
            <div className="space-y-2.5 border-t border-border/40 pt-4">
                <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Video className="h-3.5 w-3.5" />
                    Camera behaviour
                </Label>
                <div className="grid grid-cols-3 gap-1.5">
                    {MODES.map(({ id, label, icon: Icon, hint }) => (
                        <button
                            key={id}
                            title={hint}
                            className={cn(
                                'flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-[10px] font-medium transition-all',
                                camera.mode === id
                                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                    : 'border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground'
                            )}
                            onClick={() => editorStore.updateCamera({ mode: id })}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    ))}
                </div>
                <p className="rounded-lg border border-border/20 bg-background/30 p-2 text-center text-[10px] text-muted-foreground">
                    {MODES.find((m) => m.id === camera.mode)?.hint}
                </p>
            </div>

            {/* Sliders */}
            <div className="space-y-4 border-t border-border/40 pt-4">
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                            <ZoomIn className="h-3 w-3" />
                            Default zoom strength
                        </Label>
                        <span className="rounded border border-border/30 bg-background/50 px-2 py-0.5 font-mono text-xs">
                            {camera.zoomStrength.toFixed(1)}x
                        </span>
                    </div>
                    <Slider
                        min={1}
                        max={5}
                        step={0.1}
                        value={[camera.zoomStrength]}
                        onValueChange={([val]) => editorStore.updateCamera({ zoomStrength: val })}
                    />
                    <p className="text-[10px] text-muted-foreground">Used for new zoom moments and auto-follow.</p>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                            <Zap className="h-3 w-3" />
                            Follow speed
                        </Label>
                        <span className="rounded border border-border/30 bg-background/50 px-2 py-0.5 font-mono text-xs">
                            {camera.speed.toFixed(1)}x
                        </span>
                    </div>
                    <Slider
                        min={0.1}
                        max={3}
                        step={0.1}
                        value={[camera.speed]}
                        onValueChange={([val]) => editorStore.updateCamera({ speed: val })}
                    />
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                            <Maximize className="h-3 w-3" />
                            Tracking deadzone
                        </Label>
                        <span className="rounded border border-border/30 bg-background/50 px-2 py-0.5 font-mono text-xs">
                            {(camera.padding * 100).toFixed(0)}%
                        </span>
                    </div>
                    <Slider
                        min={0}
                        max={0.5}
                        step={0.05}
                        value={[camera.padding]}
                        onValueChange={([val]) => editorStore.updateCamera({ padding: val })}
                    />
                    <div className="flex gap-1.5 pt-0.5">
                        {(
                            [
                                { label: 'Tight', value: 0.1 },
                                { label: 'Balanced', value: 0.25 },
                                { label: 'Loose', value: 0.4 },
                            ] as const
                        ).map(({ label, value }) => (
                            <button
                                key={label}
                                onClick={() => editorStore.updateCamera({ padding: value })}
                                className={cn(
                                    'flex-1 rounded border py-1 text-[10px] transition-colors',
                                    Math.abs(camera.padding - value) < 0.01
                                        ? 'border-primary/40 bg-primary/10 text-primary'
                                        : 'border-border/20 bg-background/30 text-muted-foreground hover:bg-background/60'
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        How far the cursor can wander before the camera follows.
                    </p>
                </div>
            </div>
        </div>
    );
}
