
import React from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Video, ZoomIn, Zap, Maximize } from 'lucide-react';

export function CameraPanel() {
    const { camera, selectedEffectId, cameraEffects } = useEditorState();

    const selectedEffect = selectedEffectId ? cameraEffects.find(e => e.id === selectedEffectId) : null;

    const updateCamera = (updates: Partial<typeof camera>) => {
        editorStore.setState((prev) => ({
            camera: { ...prev.camera, ...updates },
        }));
    };

    const updateSelectedEffect = (updates: Partial<typeof selectedEffect>) => {
        if (!selectedEffectId) return;
        editorStore.setState((prev) => ({
            cameraEffects: prev.cameraEffects.map(e => e.id === selectedEffectId ? { ...e, ...updates } : e)
        }));
    };

    if (selectedEffect) {
        return (
            <div className="space-y-6 p-4 pb-20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => editorStore.setState({ selectedEffectId: null })}
                        >
                            <Video className="h-4 w-4" />
                        </Button>
                        <h3 className="font-semibold text-sm">Effect Properties</h3>
                    </div>
                    <span className="text-[10px] text-muted-foreground bg-primary/10 px-2 py-1 rounded text-primary font-medium uppercase tracking-wider">
                        {selectedEffect.type}
                    </span>
                </div>

                {/* Effect Duration */}
                <div className="space-y-3 bg-card/40 backdrop-blur-sm p-4 rounded-xl border-none shadow-sm">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Duration (seconds)
                    </Label>
                    <div className="flex items-center gap-3">
                        <Slider
                            min={0.5}
                            max={10}
                            step={0.1}
                            value={[selectedEffect.duration]}
                            onValueChange={([val]) => updateSelectedEffect({ duration: val })}
                            className="flex-1"
                        />
                        <span className="w-12 text-right text-xs font-mono">{selectedEffect.duration.toFixed(1)}s</span>
                    </div>
                </div>

                {/* Effect Start Time */}
                <div className="space-y-3 bg-card/40 backdrop-blur-sm p-4 rounded-xl border-none shadow-sm">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Start Time
                    </Label>
                    <div className="flex items-center gap-3">
                        <Slider
                            min={0}
                            max={editorStore.getState().video.duration || 100} // Fallback if 0
                            step={0.1}
                            value={[selectedEffect.startTime]}
                            onValueChange={([val]) => updateSelectedEffect({ startTime: val })}
                            className="flex-1"
                        />
                        <span className="w-12 text-right text-xs font-mono">{selectedEffect.startTime.toFixed(1)}s</span>
                    </div>
                </div>

                {/* Properties based on Type */}
                {selectedEffect.type === 'zoom' && (
                    <div className="space-y-4">
                        {/* Zoom Strength */}
                        <div className="space-y-3 bg-card/40 backdrop-blur-sm p-4 rounded-xl border-none shadow-sm">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    <ZoomIn className="h-3.5 w-3.5" />
                                    Zoom Strength
                                </Label>
                                <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">x{(selectedEffect.zoomLevel || 1).toFixed(1)}</span>
                            </div>
                            <Slider
                                min={1}
                                max={5}
                                step={0.1}
                                value={[selectedEffect.zoomLevel || 1.5]}
                                onValueChange={([val]) => updateSelectedEffect({ zoomLevel: val })}
                            />
                        </div>

                        {/* Focus Point (Where to Zoom) */}
                        <div className="space-y-3 bg-card/40 backdrop-blur-sm p-4 rounded-xl border-none shadow-sm">
                            <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                                <Maximize className="h-3.5 w-3.5" />
                                Focus Position
                            </Label>

                            <div className="space-y-3">
                                {/* Horizontal X */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Horizontal (X)</span>
                                        <span>{((selectedEffect.x ?? 0.5) * 100).toFixed(0)}%</span>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={[selectedEffect.x ?? 0.5]}
                                        onValueChange={([val]) => updateSelectedEffect({ x: val })}
                                    />
                                </div>

                                {/* Vertical Y */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Vertical (Y)</span>
                                        <span>{((selectedEffect.y ?? 0.5) * 100).toFixed(0)}%</span>
                                    </div>
                                    <Slider
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={[selectedEffect.y ?? 0.5]}
                                        onValueChange={([val]) => updateSelectedEffect({ y: val })}
                                    />
                                </div>
                                <div className="flex justify-center pt-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-[10px] w-full"
                                        onClick={() => updateSelectedEffect({ x: 0.5, y: 0.5 })}
                                    >
                                        Reset to Center
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Easing */}
                <div className="space-y-3 bg-card/40 backdrop-blur-sm p-4 rounded-xl border-none shadow-sm">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Transition Curve
                    </Label>
                    <Select
                        value={selectedEffect.easing || 'ease-in-out'}
                        onValueChange={(val: any) => updateSelectedEffect({ easing: val })}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select Easing" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="linear">Linear</SelectItem>
                            <SelectItem value="ease-in-out">Smooth (Ease In/Out)</SelectItem>
                            <SelectItem value="elastic">Elastic</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Button
                    variant="destructive"
                    className="w-full mt-4"
                    onClick={() => {
                        editorStore.setState((prev) => ({
                            cameraEffects: prev.cameraEffects.filter(e => e.id !== selectedEffectId),
                            selectedEffectId: null
                        }));
                    }}
                >
                    Delete Effect
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 pb-20">
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

                {/* Zoom Control */}
                <div className="space-y-3 pb-4 border-b border-border/10">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <ZoomIn className="h-3.5 w-3.5" />
                            Zoom Level
                        </Label>
                        <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">{camera.zoomStrength.toFixed(1)}x</span>
                    </div>
                    <Slider
                        min={1}
                        max={5}
                        step={0.1}
                        value={[camera.zoomStrength]}
                        onValueChange={([val]) => updateCamera({ zoomStrength: val })}
                    />
                </div>

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
