import React from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MousePointerClick, Zap, Activity } from 'lucide-react';

export function EffectsPanel() {
    const { effects } = useEditorState();

    const updateEffects = (updates: Partial<typeof effects>) => {
        editorStore.setState((prev) => ({
            effects: { ...prev.effects, ...updates },
        }));
    };

    return (
        <div className="space-y-6 ">

            <div className="space-y-4 bg-card/40 backdrop-blur-sm p-4 rounded-xl border-none shadow-sm">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    <MousePointerClick className="h-3.5 w-3.5" />
                    Interaction Effects
                </Label>

                {/* Main Toggle */}
                <div className="flex items-center justify-between py-2 border-b border-border/10">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                            <MousePointerClick className="h-3.5 w-3.5" />
                        </div>
                        <Label className="text-sm font-medium">Click Effects</Label>
                    </div>
                    <Switch
                        checked={effects.clickRipple}
                        onCheckedChange={(c) => updateEffects({ clickRipple: c })}
                    />
                </div>

                {effects.clickRipple && (
                    <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Animation Style */}
                        <div className="space-y-3">
                            <Label className="text-xs text-muted-foreground">Animation Style</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['ripple', 'orb', 'pulse', 'ring', 'splash', 'none'] as const).map((style) => (
                                    <Button
                                        key={style}
                                        variant="outline"
                                        size="sm"
                                        className={`capitalize text-xs h-8 transition-all ${effects.clickAnimationStyle === style
                                                ? "bg-primary text-primary-foreground border-primary shadow-md hover:bg-primary/90"
                                                : "bg-background/50 hover:bg-background border-border/40 text-muted-foreground hover:text-foreground"
                                            }`}
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
                                <Label className="text-xs text-muted-foreground">Color</Label>
                                <div className="flex gap-2 items-center">
                                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border/50 shadow-sm transition-transform active:scale-95">
                                        <input
                                            type="color"
                                            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer border-0"
                                            value={effects.clickColor}
                                            onChange={(e) => updateEffects({ clickColor: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex-1 bg-background/50 rounded flex items-center px-2 text-xs font-mono truncate h-8 border border-border/40">
                                        {effects.clickColor}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Size</Label>
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
                        <div className="space-y-3 pt-4 border-t border-border/10">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    <Zap className="h-3.5 w-3.5 text-yellow-500" />
                                    Impact Force
                                </Label>
                                <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">{(effects.clickForce * 100).toFixed(0)}%</span>
                            </div>
                            <Slider
                                min={0}
                                max={1.5}
                                step={0.1}
                                value={[effects.clickForce]}
                                onValueChange={([val]) => updateEffects({ clickForce: val })}
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Controls the intensity of the screen shake/scale on click.
                            </p>
                        </div>

                        {/* Emphasis */}
                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded-md bg-red-500/10 text-red-500">
                                    <Activity className="h-3.5 w-3.5" />
                                </div>
                                <Label className="text-sm font-medium">Double Click Emphasis</Label>
                            </div>
                            <Switch
                                checked={effects.clickEmphasis}
                                onCheckedChange={(c) => updateEffects({ clickEmphasis: c })}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
