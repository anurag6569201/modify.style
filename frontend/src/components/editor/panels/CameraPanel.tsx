
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
import { Video, move, ZoomIn, Activity, Zap, Maximize } from 'lucide-react';

export function CameraPanel() {
    const { camera } = useEditorState();

    const updateCamera = (updates: Partial<typeof camera>) => {
        editorStore.setState((prev) => ({
            camera: { ...prev.camera, ...updates },
        }));
    };

    return (
        <div className="space-y-6 p-4">

            {/* Mode Selection */}
            <div className="space-y-3">
                <Label className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary" />
                    Camera Mode
                </Label>
                <div className="grid grid-cols-3 gap-2">
                    {(['cinematic', 'fast', 'manual'] as const).map((mode) => (
                        <Button
                            key={mode}
                            variant={camera.mode === mode ? "default" : "outline"}
                            size="sm"
                            className="capitalize text-xs"
                            onClick={() => updateCamera({ mode })}
                        >
                            {mode}
                        </Button>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground px-1">
                    {camera.mode === 'cinematic' && "Smooth, flowing movements with heavy damping."}
                    {camera.mode === 'fast' && "Quick, responsive snapping to action."}
                    {camera.mode === 'manual' && "Fixed camera, no automatic movement."}
                </p>
            </div>

            {/* Zoom Control */}
            <div className="space-y-4 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                        <ZoomIn className="h-4 w-4 text-primary" />
                        Zoom Strength
                    </Label>
                    <span className="text-xs font-mono text-muted-foreground">{camera.zoomStrength.toFixed(1)}x</span>
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
            <div className="space-y-4 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Follow Speed
                    </Label>
                    <span className="text-xs font-mono text-muted-foreground">{camera.speed.toFixed(1)}x</span>
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
            <div className="space-y-4 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                        <Maximize className="h-4 w-4 text-primary" />
                        Screen Padding
                    </Label>
                    <span className="text-xs font-mono text-muted-foreground">{(camera.padding * 100).toFixed(0)}%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                    Deadzone area around the edges where the camera won't move.
                </p>
                <Slider
                    min={0}
                    max={0.5}
                    step={0.05}
                    value={[camera.padding]}
                    onValueChange={([val]) => updateCamera({ padding: val })}
                />
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="flex-1 text-xs h-7" onClick={() => updateCamera({ padding: 0.1 })}>Tight</Button>
                    <Button variant="ghost" size="sm" className="flex-1 text-xs h-7" onClick={() => updateCamera({ padding: 0.25 })}>Balanced</Button>
                    <Button variant="ghost" size="sm" className="flex-1 text-xs h-7" onClick={() => updateCamera({ padding: 0.4 })}>Loose</Button>
                </div>
            </div>

        </div>
    );
}
