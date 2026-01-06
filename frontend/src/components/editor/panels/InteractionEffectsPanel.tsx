import React from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MousePointerClick, Zap, Activity, X } from 'lucide-react';
import { ClickEffectConfig } from '@/lib/editor/types';
import { useToast } from '@/hooks/use-toast';

interface InteractionEffectsPanelProps {
    selectedClickIndex: number | null;
    onDeselectClick: () => void;
}

export function InteractionEffectsPanel({ selectedClickIndex, onDeselectClick }: InteractionEffectsPanelProps) {
    const editorState = useEditorState();
    const { toast } = useToast();

    // Get the selected click
    const selectedClick = selectedClickIndex !== null && editorState.events.clicks[selectedClickIndex]
        ? editorState.events.clicks[selectedClickIndex]
        : null;

    // Get click effect config (or use default)
    const getClickEffectConfig = (): ClickEffectConfig => {
        if (!selectedClick) {
            return {
                enabled: false,
                animationStyle: 'ripple',
                size: 1.0,
                color: '#3b82f6',
                force: 1.0,
                easing: 'ease-out',
                emphasis: false,
            };
        }

        const clickKey = `${selectedClick.timestamp}`;
        const config = editorState.effects.clickEffects[clickKey];
        
        if (config) {
            return config;
        }

        // Return default based on global settings
        return {
            enabled: editorState.effects.clickRipple,
            animationStyle: editorState.effects.clickAnimationStyle,
            size: editorState.effects.clickSize,
            color: editorState.effects.clickColor,
            force: editorState.effects.clickForce,
            easing: editorState.effects.clickEasing,
            emphasis: editorState.effects.clickEmphasis,
            particleCount: 20,
            glowIntensity: 0.8,
            trailLength: 10,
            animationDuration: 0.8,
            glitchIntensity: 0.5,
            blurStrength: 10,
            distortionStrength: 0.5,
        };
    };

    const clickEffectConfig = getClickEffectConfig();

    const updateClickEffect = (updates: Partial<ClickEffectConfig>) => {
        if (!selectedClick) return;

        const clickKey = `${selectedClick.timestamp}`;
        const currentConfig = editorState.effects.clickEffects[clickKey] || clickEffectConfig;
        const newConfig: ClickEffectConfig = { ...currentConfig, ...updates };

        editorStore.setState((prev) => ({
            effects: {
                ...prev.effects,
                clickEffects: {
                    ...prev.effects.clickEffects,
                    [clickKey]: newConfig,
                },
            },
        }));

        // If enabling and it's the first time, show toast
        if (updates.enabled && !clickEffectConfig.enabled) {
            toast({
                title: "Click effect enabled",
                description: "Effect will appear at this click's position",
            });
        }
    };

    const formatTime = (time: number) => {
        if (!isFinite(time) || isNaN(time) || time < 0) {
            return "0:00";
        }
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    if (!selectedClick) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 mb-4">
                    <MousePointerClick className="h-10 w-10 text-primary/60" />
                </div>
                <p className="text-sm font-medium mb-1">No Click Selected</p>
                <p className="text-xs text-muted-foreground">
                    Click on a click marker in the timeline to configure its effects
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
                <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <MousePointerClick className="h-4 w-4 text-blue-400" />
                        Click #{selectedClickIndex !== null ? selectedClickIndex + 1 : '?'}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(selectedClick.timestamp)} • ({Math.round(selectedClick.x * 100)}%, {Math.round(selectedClick.y * 100)}%)
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onDeselectClick}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Main Toggle */}
            <div className="space-y-4 bg-card/40 backdrop-blur-sm p-4 rounded-xl border border-border/40 shadow-sm">
                <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                            <MousePointerClick className="h-3.5 w-3.5" />
                        </div>
                        <Label className="text-sm font-medium">Enable Click Effect</Label>
                    </div>
                    <Switch
                        checked={clickEffectConfig.enabled}
                        onCheckedChange={(enabled) => updateClickEffect({ enabled })}
                    />
                </div>

                {clickEffectConfig.enabled && (
                    <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Animation Style */}
                        <div className="space-y-3">
                            <Label className="text-xs text-muted-foreground font-medium">Animation Style</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    'ripple', 'orb', 'pulse', 'ring', 'splash', 
                                    'particles', 'glow', 'shockwave', 'trail', 'burst',
                                    'neon-burst', 'glitch', 'cyber-pulse', 'implosion', 'magnetic',
                                    'hologram', 'shock-blur', 'liquid', 'time-freeze', 'depth-pop', 'heat-ripple', 'none'
                                ] as const).map((style) => (
                                    <Button
                                        key={style}
                                        variant="outline"
                                        size="sm"
                                        className={`capitalize text-xs h-8 transition-all ${
                                            clickEffectConfig.animationStyle === style
                                                ? "bg-primary text-primary-foreground border-primary shadow-md hover:bg-primary/90"
                                                : "bg-background/50 hover:bg-background border-border/40 text-muted-foreground hover:text-foreground"
                                        }`}
                                        onClick={() => updateClickEffect({ animationStyle: style })}
                                    >
                                        {style.replace(/-/g, ' ')}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Visual Properties */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground font-medium">Primary Color</Label>
                                <div className="flex gap-2 items-center">
                                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border/50 shadow-sm transition-transform active:scale-95">
                                        <input
                                            type="color"
                                            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer border-0"
                                            value={clickEffectConfig.color}
                                            onChange={(e) => updateClickEffect({ color: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex-1 bg-background/50 rounded flex items-center px-2 text-xs font-mono truncate h-8 border border-border/40">
                                        {clickEffectConfig.color}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground font-medium">Secondary Color</Label>
                                <div className="flex gap-2 items-center">
                                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border/50 shadow-sm transition-transform active:scale-95">
                                        <input
                                            type="color"
                                            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer border-0"
                                            value={clickEffectConfig.secondaryColor || clickEffectConfig.color}
                                            onChange={(e) => updateClickEffect({ secondaryColor: e.target.value })}
                                        />
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() => updateClickEffect({ secondaryColor: undefined })}
                                    >
                                        Reset
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground font-medium">Size</Label>
                                    <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">
                                        {clickEffectConfig.size.toFixed(1)}x
                                    </span>
                                </div>
                                <Slider
                                    min={0.5}
                                    max={3}
                                    step={0.1}
                                    value={[clickEffectConfig.size]}
                                    onValueChange={([val]) => updateClickEffect({ size: val })}
                                    className="pt-2"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground font-medium">Duration</Label>
                                    <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">
                                        {(clickEffectConfig.animationDuration || 0.8).toFixed(1)}s
                                    </span>
                                </div>
                                <Slider
                                    min={0.2}
                                    max={2}
                                    step={0.1}
                                    value={[clickEffectConfig.animationDuration || 0.8]}
                                    onValueChange={([val]) => updateClickEffect({ animationDuration: val })}
                                    className="pt-2"
                                />
                            </div>
                        </div>

                        {/* Advanced Options for specific effects */}
                        {(clickEffectConfig.animationStyle === 'particles' || 
                          clickEffectConfig.animationStyle === 'burst' || 
                          clickEffectConfig.animationStyle === 'splash') && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground font-medium">Particle Count</Label>
                                    <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">
                                        {clickEffectConfig.particleCount || 20}
                                    </span>
                                </div>
                                <Slider
                                    min={5}
                                    max={50}
                                    step={5}
                                    value={[clickEffectConfig.particleCount || 20]}
                                    onValueChange={([val]) => updateClickEffect({ particleCount: val })}
                                    className="pt-2"
                                />
                            </div>
                        )}

                        {(clickEffectConfig.animationStyle === 'glow' || 
                          clickEffectConfig.animationStyle === 'orb') && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground font-medium">Glow Intensity</Label>
                                    <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">
                                        {((clickEffectConfig.glowIntensity || 0.8) * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <Slider
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    value={[clickEffectConfig.glowIntensity || 0.8]}
                                    onValueChange={([val]) => updateClickEffect({ glowIntensity: val })}
                                    className="pt-2"
                                />
                            </div>
                        )}

                        {clickEffectConfig.animationStyle === 'trail' && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground font-medium">Trail Length</Label>
                                    <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">
                                        {clickEffectConfig.trailLength || 10}
                                    </span>
                                </div>
                                <Slider
                                    min={5}
                                    max={30}
                                    step={1}
                                    value={[clickEffectConfig.trailLength || 10]}
                                    onValueChange={([val]) => updateClickEffect({ trailLength: val })}
                                    className="pt-2"
                                />
                            </div>
                        )}

                        {clickEffectConfig.animationStyle === 'glitch' && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground font-medium">Glitch Intensity</Label>
                                    <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">
                                        {((clickEffectConfig.glitchIntensity || 0.5) * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <Slider
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    value={[clickEffectConfig.glitchIntensity || 0.5]}
                                    onValueChange={([val]) => updateClickEffect({ glitchIntensity: val })}
                                    className="pt-2"
                                />
                            </div>
                        )}

                        {(clickEffectConfig.animationStyle === 'shock-blur') && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground font-medium">Blur Strength</Label>
                                    <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">
                                        {clickEffectConfig.blurStrength || 10}px
                                    </span>
                                </div>
                                <Slider
                                    min={0}
                                    max={20}
                                    step={1}
                                    value={[clickEffectConfig.blurStrength || 10]}
                                    onValueChange={([val]) => updateClickEffect({ blurStrength: val })}
                                    className="pt-2"
                                />
                            </div>
                        )}

                        {(clickEffectConfig.animationStyle === 'liquid' || clickEffectConfig.animationStyle === 'heat-ripple') && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground font-medium">Distortion Strength</Label>
                                    <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">
                                        {((clickEffectConfig.distortionStrength || 0.5) * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <Slider
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    value={[clickEffectConfig.distortionStrength || 0.5]}
                                    onValueChange={([val]) => updateClickEffect({ distortionStrength: val })}
                                    className="pt-2"
                                />
                            </div>
                        )}

                        {/* Physics / Intensity */}
                        <div className="space-y-3 pt-4 border-t border-border/10">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    <Zap className="h-3.5 w-3.5 text-yellow-500" />
                                    Impact Force
                                </Label>
                                <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">
                                    {(clickEffectConfig.force * 100).toFixed(0)}%
                                </span>
                            </div>
                            <Slider
                                min={0}
                                max={1.5}
                                step={0.1}
                                value={[clickEffectConfig.force]}
                                onValueChange={([val]) => updateClickEffect({ force: val })}
                            />
                            <p className="text-[10px] text-muted-foreground">
                                Controls the intensity of the effect animation.
                            </p>
                        </div>

                        {/* Easing */}
                        <div className="space-y-3">
                            <Label className="text-xs text-muted-foreground font-medium">Easing</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['linear', 'ease-out', 'ease-in-out', 'bounce', 'elastic', 'spring'] as const).map((easing) => (
                                    <Button
                                        key={easing}
                                        variant="outline"
                                        size="sm"
                                        className={`capitalize text-xs h-8 transition-all ${
                                            clickEffectConfig.easing === easing
                                                ? "bg-primary text-primary-foreground border-primary shadow-md hover:bg-primary/90"
                                                : "bg-background/50 hover:bg-background border-border/40 text-muted-foreground hover:text-foreground"
                                        }`}
                                        onClick={() => updateClickEffect({ easing })}
                                    >
                                        {easing}
                                    </Button>
                                ))}
                            </div>
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
                                checked={clickEffectConfig.emphasis}
                                onCheckedChange={(emphasis) => updateClickEffect({ emphasis })}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Quick Actions</Label>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                            editorStore.setPlayback({ currentTime: selectedClick.timestamp });
                            toast({
                                title: "Seeked to click",
                                description: `Jumped to ${formatTime(selectedClick.timestamp)}`,
                            });
                        }}
                    >
                        Seek to Click
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                            // Reset to default
                            const clickKey = `${selectedClick.timestamp}`;
                            editorStore.setState((prev) => {
                                const newClickEffects = { ...prev.effects.clickEffects };
                                delete newClickEffects[clickKey];
                                return {
                                    effects: {
                                        ...prev.effects,
                                        clickEffects: newClickEffects,
                                    },
                                };
                            });
                            toast({
                                title: "Reset to default",
                                description: "Click effect reset to global settings",
                            });
                        }}
                    >
                        Reset to Default
                    </Button>
                </div>
            </div>
        </div>
    );
}

