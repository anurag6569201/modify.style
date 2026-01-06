
import React from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Video, ZoomIn, Zap, Maximize, Sparkles, X, Clock, Move, Gauge, ArrowLeftRight, ArrowUpDown, Repeat, Pause } from 'lucide-react';

interface CameraPanelProps {
    selectedEffectId?: string | null;
    onEffectSelect?: (id: string | null) => void;
    isLoopingEffect?: boolean;
}

export function CameraPanel({ selectedEffectId, onEffectSelect, isLoopingEffect }: CameraPanelProps = {}) {
    const { camera, events, playback } = useEditorState();
    
    const selectedEffect = selectedEffectId 
        ? events.effects.find(e => e.id === selectedEffectId)
        : null;

    const updateCamera = (updates: Partial<typeof camera>) => {
        editorStore.setState((prev) => ({
            camera: { ...prev.camera, ...updates },
        }));
    };

    const updateEffect = (id: string, updates: Partial<{ 
        start: number; 
        end: number; 
        zoom: number; 
        label: string;
        panX: number;
        panY: number;
        easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce';
        transitionSpeed: number;
    }>) => {
        editorStore.setState(prev => ({
            events: {
                ...prev.events,
                effects: prev.events.effects.map(effect =>
                    effect.id === id ? { ...effect, ...updates } : effect
                ),
            }
        }));
    };

    const formatTime = (time: number) => {
        if (!isFinite(time) || isNaN(time) || time < 0) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    return (
        <div className="space-y-6 p-4 pb-20">
            {/* Selected Effect Editor */}
            {selectedEffect && (
                <div className="bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-transparent border-2 border-purple-500/30 rounded-xl p-4 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                                <Sparkles className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-purple-300">Editing Effect</h3>
                                    {isLoopingEffect && (
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                                            <Repeat className="h-3 w-3 text-purple-400 animate-spin" />
                                            <span className="text-[10px] text-purple-300 font-medium">Looping</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-purple-400/70">
                                    {isLoopingEffect ? 'Effect is playing in loop • See changes in real-time' : 'Modify zoom effect properties'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                    const start = Number.isFinite(selectedEffect.start) 
                                        ? selectedEffect.start 
                                        : (selectedEffect.timestamp || 0);
                                    editorStore.setPlayback({ currentTime: start });
                                }}
                            >
                                <Clock className="h-3 w-3 mr-1.5" />
                                Jump to Effect
                            </Button>
                            <Button
                                variant={isLoopingEffect ? "default" : "outline"}
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                    if (isLoopingEffect) {
                                        editorStore.setPlayback({ isPlaying: false });
                                    } else {
                                        const start = Number.isFinite(selectedEffect.start) 
                                            ? selectedEffect.start 
                                            : (selectedEffect.timestamp || 0);
                                        editorStore.setPlayback({ 
                                            currentTime: start,
                                            isPlaying: true 
                                        });
                                    }
                                }}
                            >
                                {isLoopingEffect ? (
                                    <>
                                        <Pause className="h-3 w-3 mr-1.5" />
                                        Stop Loop
                                    </>
                                ) : (
                                    <>
                                        <Repeat className="h-3 w-3 mr-1.5" />
                                        Start Loop
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    editorStore.setPlayback({ isPlaying: false });
                                    onEffectSelect?.(null);
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Effect Label */}
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-purple-300">Effect Name</Label>
                            <Input
                                value={selectedEffect.label || ''}
                                onChange={(e) => updateEffect(selectedEffect.id, { label: e.target.value })}
                                placeholder="Enter effect name..."
                                className="bg-background/50 border-purple-500/30 focus:border-purple-500/50"
                            />
                        </div>

                        {/* Time Range */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-purple-300 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Start Time
                                </Label>
                                <Input
                                    type="number"
                                    min={0}
                                    step={0.1}
                                    value={Number(selectedEffect.start || selectedEffect.timestamp || 0).toFixed(1)}
                                    onChange={(e) => {
                                        const start = parseFloat(e.target.value);
                                        if (!isNaN(start)) {
                                            const end = Number.isFinite(selectedEffect.end) ? selectedEffect.end : (start + 5);
                                            updateEffect(selectedEffect.id, { start, end: Math.max(end, start + 0.5) });
                                        }
                                    }}
                                    className="bg-background/50 border-purple-500/30 focus:border-purple-500/50"
                                />
                                <p className="text-[10px] text-purple-400/60">{formatTime(Number(selectedEffect.start || selectedEffect.timestamp || 0))}</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-purple-300 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    End Time
                                </Label>
                                <Input
                                    type="number"
                                    min={0}
                                    step={0.1}
                                    value={Number(selectedEffect.end || (Number(selectedEffect.start || selectedEffect.timestamp || 0) + 5)).toFixed(1)}
                                    onChange={(e) => {
                                        const end = parseFloat(e.target.value);
                                        if (!isNaN(end)) {
                                            const start = Number.isFinite(selectedEffect.start) ? selectedEffect.start : (selectedEffect.timestamp || 0);
                                            updateEffect(selectedEffect.id, { end: Math.max(end, start + 0.5) });
                                        }
                                    }}
                                    className="bg-background/50 border-purple-500/30 focus:border-purple-500/50"
                                />
                                <p className="text-[10px] text-purple-400/60">{formatTime(Number(selectedEffect.end || (Number(selectedEffect.start || selectedEffect.timestamp || 0) + 5)))}</p>
                            </div>
                        </div>

                        {/* Duration Display */}
                        <div className="bg-background/30 rounded-lg p-2 border border-purple-500/20">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-purple-400/70">Duration</span>
                                <span className="font-mono text-purple-300">
                                    {(
                                        Number(selectedEffect.end || (Number(selectedEffect.start || selectedEffect.timestamp || 0) + 5)) - 
                                        Number(selectedEffect.start || selectedEffect.timestamp || 0)
                                    ).toFixed(1)}s
                                </span>
                            </div>
                        </div>

                        {/* Zoom Level for This Effect */}
                        <div className="space-y-3 pt-2 border-t border-purple-500/20">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2 text-xs font-medium text-purple-300 uppercase tracking-wider">
                                    <ZoomIn className="h-3.5 w-3.5" />
                                    Zoom Level (This Effect)
                                </Label>
                                <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-purple-500/30 text-purple-300">
                                    {(selectedEffect.zoom ?? camera.zoomStrength).toFixed(1)}x
                                </span>
                            </div>
                            <Slider
                                min={1}
                                max={5}
                                step={0.1}
                                value={[selectedEffect.zoom ?? camera.zoomStrength]}
                                onValueChange={([val]) => updateEffect(selectedEffect.id, { zoom: val })}
                                className="[&_[role=slider]]:bg-purple-500"
                            />
                            <p className="text-[10px] text-purple-400/60">
                                This zoom level applies only to this effect. Global camera settings below affect non-effect moments.
                            </p>
                        </div>

                        {/* Panning Controls */}
                        <div className="space-y-4 pt-2 border-t border-purple-500/20">
                            <Label className="flex items-center gap-2 text-xs font-medium text-purple-300 uppercase tracking-wider">
                                <Move className="h-3.5 w-3.5" />
                                Pan Position
                            </Label>
                            
                            {/* Horizontal Pan */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="flex items-center gap-1.5 text-xs text-purple-300">
                                        <ArrowLeftRight className="h-3 w-3" />
                                        Horizontal Shift
                                    </Label>
                                    <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-purple-500/30 text-purple-300">
                                        {(selectedEffect.panX ?? 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-purple-400/70 w-8">Left</span>
                                    <Slider
                                        min={-1}
                                        max={1}
                                        step={0.05}
                                        value={[selectedEffect.panX ?? 0]}
                                        onValueChange={([val]) => updateEffect(selectedEffect.id, { panX: val })}
                                        className="flex-1 [&_[role=slider]]:bg-purple-500"
                                    />
                                    <span className="text-[10px] text-purple-400/70 w-8 text-right">Right</span>
                                </div>
                            </div>

                            {/* Vertical Pan */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="flex items-center gap-1.5 text-xs text-purple-300">
                                        <ArrowUpDown className="h-3 w-3" />
                                        Vertical Shift
                                    </Label>
                                    <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-purple-500/30 text-purple-300">
                                        {(selectedEffect.panY ?? 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-purple-400/70 w-8">Up</span>
                                    <Slider
                                        min={-1}
                                        max={1}
                                        step={0.05}
                                        value={[selectedEffect.panY ?? 0]}
                                        onValueChange={([val]) => updateEffect(selectedEffect.id, { panY: val })}
                                        className="flex-1 [&_[role=slider]]:bg-purple-500"
                                    />
                                    <span className="text-[10px] text-purple-400/70 w-8 text-right">Down</span>
                                </div>
                            </div>

                            {/* Quick Pan Presets */}
                            <div className="grid grid-cols-3 gap-2 pt-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] bg-background/30 hover:bg-background/50 border-purple-500/20"
                                    onClick={() => updateEffect(selectedEffect.id, { panX: 0, panY: 0 })}
                                >
                                    Center
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] bg-background/30 hover:bg-background/50 border-purple-500/20"
                                    onClick={() => updateEffect(selectedEffect.id, { panX: -0.5, panY: 0 })}
                                >
                                    Left
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] bg-background/30 hover:bg-background/50 border-purple-500/20"
                                    onClick={() => updateEffect(selectedEffect.id, { panX: 0.5, panY: 0 })}
                                >
                                    Right
                                </Button>
                            </div>
                            <p className="text-[10px] text-purple-400/60">
                                Adjust where the zoom focuses. -1 = full left/up, 0 = center, 1 = full right/down.
                            </p>
                        </div>

                        {/* Transition Settings */}
                        <div className="space-y-3 pt-2 border-t border-purple-500/20">
                            <Label className="flex items-center gap-2 text-xs font-medium text-purple-300 uppercase tracking-wider">
                                <Gauge className="h-3.5 w-3.5" />
                                Transition Settings
                            </Label>
                            
                            {/* Easing Type */}
                            <div className="space-y-2">
                                <Label className="text-xs text-purple-300">Easing Curve</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['linear', 'ease-in', 'ease-out', 'ease-in-out', 'bounce'] as const).map((easeType) => (
                                        <Button
                                            key={easeType}
                                            variant="outline"
                                            size="sm"
                                            className={`h-8 text-[10px] capitalize transition-all ${
                                                (selectedEffect.easing ?? 'ease-out') === easeType
                                                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                                                    : 'bg-background/30 hover:bg-background/50 border-purple-500/20'
                                            }`}
                                            onClick={() => updateEffect(selectedEffect.id, { easing: easeType })}
                                        >
                                            {easeType.replace('-', ' ')}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Transition Speed */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-purple-300">Transition Speed</Label>
                                    <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-purple-500/30 text-purple-300">
                                        {(selectedEffect.transitionSpeed ?? 1.0).toFixed(1)}x
                                    </span>
                                </div>
                                <Slider
                                    min={0.25}
                                    max={3}
                                    step={0.25}
                                    value={[selectedEffect.transitionSpeed ?? 1.0]}
                                    onValueChange={([val]) => updateEffect(selectedEffect.id, { transitionSpeed: val })}
                                    className="[&_[role=slider]]:bg-purple-500"
                                />
                                <p className="text-[10px] text-purple-400/60">
                                    How fast the zoom transitions in/out. Lower = slower, smoother. Higher = faster, snappier.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mode Selection */}
            <div className="space-y-3 bg-card/40 backdrop-blur-sm p-4 rounded-xl border-none shadow-sm">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <Video className="h-3.5 w-3.5" />
                    Camera Mode
                </Label>
                <div className="grid grid-cols-3 gap-2">
                    {(['cinematic', 'fast', 'manual'] as const).map((mode) => (
                        <Button
                            key={mode}
                            variant="outline"
                            size="sm"
                            className={`capitalize text-xs h-9 transition-all ${camera.mode === mode
                                ? "bg-primary text-primary-foreground border-primary shadow-md hover:bg-primary/90"
                                : "bg-background/50 hover:bg-background border-border/40 text-muted-foreground hover:text-foreground"
                                }`}
                            onClick={() => updateCamera({ mode })}
                        >
                            {mode}
                        </Button>
                    ))}
                </div>
                <div className="bg-background/30 p-2 rounded-lg border border-border/20">
                    <p className="text-[11px] text-muted-foreground text-center">
                        {camera.mode === 'cinematic' && "Smooth, flowing movements with heavy damping."}
                        {camera.mode === 'fast' && "Quick, responsive snapping to action."}
                        {camera.mode === 'manual' && "Fixed camera, no automatic movement."}
                    </p>
                </div>
            </div>

            {/* Controls Group */}
            <div className="space-y-1 bg-card/40 backdrop-blur-sm p-4 rounded-xl border-none shadow-sm">

                {/* Speed Control */}
                <div className="space-y-3 py-4 border-b border-border/10">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <Zap className="h-3.5 w-3.5" />
                            Follow Speed
                        </Label>
                        <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">{camera.speed.toFixed(1)}x</span>
                    </div>
                    <Slider
                        min={0.1}
                        max={3}
                        step={0.1}
                        value={[camera.speed]}
                        onValueChange={([val]) => updateCamera({ speed: val })}
                    />
                </div>

                {/* Padding / Deadzone */}
                <div className="space-y-3 pt-4">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <Maximize className="h-3.5 w-3.5" />
                            Screen Padding
                        </Label>
                        <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">{(camera.padding * 100).toFixed(0)}%</span>
                    </div>

                    <Slider
                        min={0}
                        max={0.5}
                        step={0.05}
                        value={[camera.padding]}
                        onValueChange={([val]) => updateCamera({ padding: val })}
                    />

                    <div className="flex gap-2 pt-1">
                        <button onClick={() => updateCamera({ padding: 0.1 })} className="flex-1 text-[10px] py-1 rounded bg-background/30 hover:bg-background/60 transition-colors border border-border/20 text-muted-foreground">Tight</button>
                        <button onClick={() => updateCamera({ padding: 0.25 })} className="flex-1 text-[10px] py-1 rounded bg-background/30 hover:bg-background/60 transition-colors border border-border/20 text-muted-foreground">Balanced</button>
                        <button onClick={() => updateCamera({ padding: 0.4 })} className="flex-1 text-[10px] py-1 rounded bg-background/30 hover:bg-background/60 transition-colors border border-border/20 text-muted-foreground">Loose</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
