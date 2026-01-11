import React, { useState } from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    MousePointerClick,
    Zap,
    Activity,
    X,
    ChevronDown,
    Sparkles,
    Palette,
    Layers,
    Clock,
    Move
} from 'lucide-react';
import { ClickEffectConfig } from '@/lib/editor/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface InteractionEffectsPanelProps {
    selectedClickIndex: number | null;
    onDeselectClick: () => void;
}

export function InteractionEffectsPanel({ selectedClickIndex, onDeselectClick }: InteractionEffectsPanelProps) {
    const editorState = useEditorState();
    const { toast } = useToast();
    const [activeSection, setActiveSection] = useState<string | null>('style');

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
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="p-6 rounded-full bg-primary/5 border border-primary/10 mb-6 shadow-[0_0_30px_-10px_rgba(var(--primary),0.3)]">
                    <MousePointerClick className="h-12 w-12 text-primary/40" />
                </div>
                <h3 className="text-lg font-semibold text-foreground/80 mb-2">No Click Selected</h3>
                <p className="text-sm text-muted-foreground max-w-[200px]">
                    Select a click marker on the timeline to configure its interaction effects
                </p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background/20">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                        <MousePointerClick className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground/90">
                            Click Event
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                            <Clock className="h-3 w-3" />
                            {formatTime(selectedClick.timestamp)}
                            <span className="text-white/10">|</span>
                            <Move className="h-3 w-3" />
                            {Math.round(selectedClick.x * 100)}%, {Math.round(selectedClick.y * 100)}%
                        </div>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-white/10 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                    onClick={onDeselectClick}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Main Toggle */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 shadow-sm backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Label className="text-sm font-medium text-foreground/90">Enable Effect</Label>
                            </div>
                            <Switch
                                checked={clickEffectConfig.enabled}
                                onCheckedChange={(enabled) => updateEffects({ enabled })}
                                className="data-[state=checked]:bg-blue-500"
                            />
                        </div>
                    </div>

                    {clickEffectConfig.enabled && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">

                            {/* Animation Style Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="h-4 w-4 text-blue-400" />
                                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Style</Label>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        'ripple', 'orb', 'pulse', 'ring',
                                        'splash', 'particles', 'glow', 'shockwave',
                                        'trail', 'burst', 'neon-burst', 'glitch',
                                        'cyber-pulse', 'implosion', 'magnetic',
                                        'hologram', 'shock-blur', 'liquid', 'time-freeze',
                                        'depth-pop', 'heat-ripple', 'none'
                                    ] as const).map((style) => (
                                        <Button
                                            key={style}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateClickEffect({ animationStyle: style })}
                                            className={cn(
                                                "h-9 text-xs justify-start px-3 capitalize transition-all duration-200",
                                                clickEffectConfig.animationStyle === style
                                                    ? "bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-[0_0_15px_-5px_rgba(59,130,246,0.5)]"
                                                    : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-foreground"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full mr-2 transition-colors",
                                                clickEffectConfig.animationStyle === style ? "bg-blue-400" : "bg-white/20"
                                            )} />
                                            {style.replace(/-/g, ' ')}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Properties Section */}
                            <Collapsible
                                open={activeSection === 'properties'}
                                onOpenChange={() => setActiveSection(activeSection === 'properties' ? null : 'properties')}
                                className="space-y-2 rounded-xl bg-white/5 border border-white/10 overflow-hidden"
                            >
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <Palette className="h-4 w-4 text-purple-400" />
                                        <span className="text-sm font-medium">Appearance</span>
                                    </div>
                                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", activeSection === 'properties' && "rotate-180")} />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="p-4 pt-0 space-y-4">
                                    {/* Colors */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Primary</Label>
                                            <div className="flex gap-2 items-center">
                                                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-white/20 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                                                    <input
                                                        type="color"
                                                        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer opacity-0"
                                                        value={clickEffectConfig.color}
                                                        onChange={(e) => updateClickEffect({ color: e.target.value })}
                                                    />
                                                    <div className="w-full h-full" style={{ backgroundColor: clickEffectConfig.color }} />
                                                </div>
                                                <div className="flex-1 bg-black/40 rounded px-2 py-1 text-xs font-mono text-muted-foreground border border-white/10">
                                                    {clickEffectConfig.color}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Secondary</Label>
                                            <div className="flex gap-2 items-center">
                                                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-white/20 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                                                    <input
                                                        type="color"
                                                        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer opacity-0"
                                                        value={clickEffectConfig.secondaryColor || clickEffectConfig.color}
                                                        onChange={(e) => updateClickEffect({ secondaryColor: e.target.value })}
                                                    />
                                                    <div className="w-full h-full" style={{ backgroundColor: clickEffectConfig.secondaryColor || clickEffectConfig.color }} />
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 hover:bg-white/10"
                                                    onClick={() => updateClickEffect({ secondaryColor: undefined })}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <Label className="text-xs text-muted-foreground">Size Scale</Label>
                                                <span className="text-xs font-mono text-muted-foreground">{clickEffectConfig.size.toFixed(1)}x</span>
                                            </div>
                                            <Slider
                                                min={0.5}
                                                max={3}
                                                step={0.1}
                                                value={[clickEffectConfig.size]}
                                                onValueChange={([val]) => updateClickEffect({ size: val })}
                                                className="[&_.range-thumb]:bg-purple-400 [&_.range-fill]:bg-purple-400/50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <Label className="text-xs text-muted-foreground">Duration</Label>
                                                <span className="text-xs font-mono text-muted-foreground">{(clickEffectConfig.animationDuration || 0.8).toFixed(1)}s</span>
                                            </div>
                                            <Slider
                                                min={0.2}
                                                max={2}
                                                step={0.1}
                                                value={[clickEffectConfig.animationDuration || 0.8]}
                                                onValueChange={([val]) => updateClickEffect({ animationDuration: val })}
                                            />
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>

                            {/* Physics / Advanced Section */}
                            <Collapsible
                                open={activeSection === 'physics'}
                                onOpenChange={() => setActiveSection(activeSection === 'physics' ? null : 'physics')}
                                className="space-y-2 rounded-xl bg-white/5 border border-white/10 overflow-hidden"
                            >
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-yellow-400" />
                                        <span className="text-sm font-medium">Physics & Timing</span>
                                    </div>
                                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", activeSection === 'physics' && "rotate-180")} />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="p-4 pt-0 space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <Label className="text-xs text-muted-foreground">Impact Force</Label>
                                            <span className="text-xs font-mono text-muted-foreground">{(clickEffectConfig.force * 100).toFixed(0)}%</span>
                                        </div>
                                        <Slider
                                            min={0}
                                            max={1.5}
                                            step={0.1}
                                            value={[clickEffectConfig.force]}
                                            onValueChange={([val]) => updateClickEffect({ force: val })}
                                            className="[&_.range-thumb]:bg-yellow-400 [&_.range-fill]:bg-yellow-400/50"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Easing Function</Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(['linear', 'ease-out', 'ease-in-out', 'bounce', 'elastic', 'spring'] as const).map((easing) => (
                                                <Button
                                                    key={easing}
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => updateClickEffect({ easing })}
                                                    className={cn(
                                                        "h-7 text-[10px] capitalize border border-transparent",
                                                        clickEffectConfig.easing === easing
                                                            ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                                                            : "bg-white/5 text-muted-foreground hover:bg-white/10"
                                                    )}
                                                >
                                                    {easing}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                        <div className="flex items-center gap-2">
                                            <Activity className="h-3.5 w-3.5 text-red-400" />
                                            <Label className="text-sm text-foreground/80">Double Click Emphasis</Label>
                                        </div>
                                        <Switch
                                            checked={clickEffectConfig.emphasis}
                                            onCheckedChange={(emphasis) => updateClickEffect({ emphasis })}
                                            className="scale-90"
                                        />
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>

                            {/* Specific Effect Settings based on style */}
                            {(clickEffectConfig.animationStyle === 'particles' ||
                                clickEffectConfig.animationStyle === 'burst' ||
                                clickEffectConfig.animationStyle === 'splash' ||
                                clickEffectConfig.animationStyle === 'glow' ||
                                clickEffectConfig.animationStyle === 'orb' ||
                                clickEffectConfig.animationStyle === 'trail' ||
                                clickEffectConfig.animationStyle === 'glitch' ||
                                clickEffectConfig.animationStyle === 'shock-blur' ||
                                clickEffectConfig.animationStyle === 'liquid' ||
                                clickEffectConfig.animationStyle === 'heat-ripple') && (
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Layers className="h-4 w-4 text-emerald-400" />
                                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Effect Specifics</Label>
                                        </div>

                                        {(clickEffectConfig.animationStyle === 'particles' ||
                                            clickEffectConfig.animationStyle === 'burst' ||
                                            clickEffectConfig.animationStyle === 'splash') && (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <Label className="text-xs text-muted-foreground">Particle Count</Label>
                                                        <span className="text-xs font-mono text-muted-foreground">{clickEffectConfig.particleCount || 20}</span>
                                                    </div>
                                                    <Slider
                                                        min={5}
                                                        max={50}
                                                        step={5}
                                                        value={[clickEffectConfig.particleCount || 20]}
                                                        onValueChange={([val]) => updateClickEffect({ particleCount: val })}
                                                    />
                                                </div>
                                            )}

                                        {(clickEffectConfig.animationStyle === 'glow' ||
                                            clickEffectConfig.animationStyle === 'orb') && (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <Label className="text-xs text-muted-foreground">Intensity</Label>
                                                        <span className="text-xs font-mono text-muted-foreground">{((clickEffectConfig.glowIntensity || 0.8) * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <Slider
                                                        min={0}
                                                        max={1}
                                                        step={0.1}
                                                        value={[clickEffectConfig.glowIntensity || 0.8]}
                                                        onValueChange={([val]) => updateClickEffect({ glowIntensity: val })}
                                                    />
                                                </div>
                                            )}

                                        {clickEffectConfig.animationStyle === 'trail' && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <Label className="text-xs text-muted-foreground">Length</Label>
                                                    <span className="text-xs font-mono text-muted-foreground">{clickEffectConfig.trailLength || 10}</span>
                                                </div>
                                                <Slider
                                                    min={5}
                                                    max={30}
                                                    step={1}
                                                    value={[clickEffectConfig.trailLength || 10]}
                                                    onValueChange={([val]) => updateClickEffect({ trailLength: val })}
                                                />
                                            </div>
                                        )}

                                        {clickEffectConfig.animationStyle === 'glitch' && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <Label className="text-xs text-muted-foreground">Glitch Factor</Label>
                                                    <span className="text-xs font-mono text-muted-foreground">{((clickEffectConfig.glitchIntensity || 0.5) * 100).toFixed(0)}%</span>
                                                </div>
                                                <Slider
                                                    min={0}
                                                    max={1}
                                                    step={0.1}
                                                    value={[clickEffectConfig.glitchIntensity || 0.5]}
                                                    onValueChange={([val]) => updateClickEffect({ glitchIntensity: val })}
                                                />
                                            </div>
                                        )}

                                        {clickEffectConfig.animationStyle === 'shock-blur' && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <Label className="text-xs text-muted-foreground">Blur Radius</Label>
                                                    <span className="text-xs font-mono text-muted-foreground">{clickEffectConfig.blurStrength || 10}px</span>
                                                </div>
                                                <Slider
                                                    min={0}
                                                    max={20}
                                                    step={1}
                                                    value={[clickEffectConfig.blurStrength || 10]}
                                                    onValueChange={([val]) => updateClickEffect({ blurStrength: val })}
                                                />
                                            </div>
                                        )}

                                        {(clickEffectConfig.animationStyle === 'liquid' || clickEffectConfig.animationStyle === 'heat-ripple') && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <Label className="text-xs text-muted-foreground">Distortion</Label>
                                                    <span className="text-xs font-mono text-muted-foreground">{((clickEffectConfig.distortionStrength || 0.5) * 100).toFixed(0)}%</span>
                                                </div>
                                                <Slider
                                                    min={0}
                                                    max={1}
                                                    step={0.1}
                                                    value={[clickEffectConfig.distortionStrength || 0.5]}
                                                    onValueChange={([val]) => updateClickEffect({ distortionStrength: val })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                            {/* Quick Actions */}
                            <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-white/5 border-white/10 hover:bg-white/10 text-xs"
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
                                    className="bg-white/5 border-white/10 hover:bg-white/10 text-xs text-red-400 hover:text-red-300"
                                    onClick={() => {
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
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
