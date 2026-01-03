
import React from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MousePointerClick, Zap, Activity, Waves } from 'lucide-react';

export function EffectsPanel() {
    const { effects } = useEditorState();

    const updateEffects = (updates: Partial<typeof effects>) => {
        editorStore.setState((prev) => ({
            effects: { ...prev.effects, ...updates },
        }));
    };

    return (
        <div className="space-y-6 p-4">

            {/* Main Toggle */}
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/50">
                <div className="flex items-center gap-2">
                    <MousePointerClick className="h-4 w-4 text-primary" />
                    <Label className="font-semibold pointer-events-none">Click Effects</Label>
                </div>
                <Switch
                    checked={effects.clickRipple}
                    onCheckedChange={(c) => updateEffects({ clickRipple: c })}
                />
            </div>

            {effects.clickRipple && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Animation Style */}
                    <div className="space-y-3">
                        <Label>Animation Style</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['ripple', 'orb', 'pulse', 'ring', 'splash', 'none'] as const).map((style) => (
                                <Button
                                    key={style}
                                    variant={effects.clickAnimationStyle === style ? "default" : "outline"}
                                    size="sm"
                                    className="capitalize text-xs h-8"
                                    onClick={() => updateEffects({ clickAnimationStyle: style })}
                                >
                                    {style}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Visual Properties */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="color"
                                    className="h-9 w-9 p-1 cursor-pointer"
                                    value={effects.clickColor}
                                    onChange={(e) => updateEffects({ clickColor: e.target.value })}
                                />
                                <div className="flex-1 bg-muted rounded flex items-center px-2 text-xs font-mono truncate">
                                    {effects.clickColor}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Size</Label>
                            <Slider
                                min={0.5}
                                max={3}
                                step={0.1}
                                value={[effects.clickSize]}
                                onValueChange={([val]) => updateEffects({ clickSize: val })}
                                className="pt-2"
                            />
                        </div>
                    </div>

                    {/* Physics / Intensity */}
                    <div className="space-y-4 pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-yellow-500" />
                                Impact Force
                            </Label>
                            <span className="text-xs font-mono text-muted-foreground">{(effects.clickForce * 100).toFixed(0)}%</span>
                        </div>
                        <Slider
                            min={0}
                            max={1.5}
                            step={0.1}
                            value={[effects.clickForce]}
                            onValueChange={([val]) => updateEffects({ clickForce: val })}
                        />
                        <p className="text-xs text-muted-foreground">
                            Controls the intensity of the screen shake/scale on click.
                        </p>
                    </div>

                    {/* Emphasis */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-red-400" />
                            <Label>Double Click Emphasis</Label>
                        </div>
                        <Switch
                            checked={effects.clickEmphasis}
                            onCheckedChange={(c) => updateEffects({ clickEmphasis: c })}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
