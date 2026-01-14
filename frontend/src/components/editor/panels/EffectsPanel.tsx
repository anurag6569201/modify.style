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
    ChevronDown,
    Sparkles,
    Palette,
    Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function EffectsPanel() {
    const { effects } = useEditorState();
    const [activeSection, setActiveSection] = useState<string | null>('click_effects');

    const updateEffects = (updates: Partial<typeof effects>) => {
        editorStore.setState((prev) => ({
            effects: { ...prev.effects, ...updates },
        }));
    };

    return (
        <div className="h-full flex flex-col bg-background/20">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                        <Sparkles className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground/90">
                            Global Effects
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            Configure default behaviors
                        </p>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">

                    {/* Interaction Effects Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <MousePointerClick className="h-4 w-4 text-blue-400" />
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Interaction Defaults</h4>
                        </div>

                        {/* Main Toggle */}
                        <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 shadow-sm backdrop-blur-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Label className="text-sm font-medium text-foreground/90">Click Ripple Effects</Label>
                                </div>
                                <Switch
                                    checked={effects.clickRipple}
                                    onCheckedChange={(c) => updateEffects({ clickRipple: c })}
                                    className="data-[state=checked]:bg-blue-500"
                                />
                            </div>
                        </div>

                        {effects.clickRipple && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                {/* Animation Style */}
                                <div className="space-y-3">
                                    <Label className="text-xs text-muted-foreground px-1">Default Style</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['ripple', 'orb', 'pulse', 'ring', 'splash', 'none'] as const).map((style) => (
                                            <Button
                                                key={style}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => updateEffects({ clickAnimationStyle: style })}
                                                className={cn(
                                                    "h-8 text-xs capitalize transition-all duration-200",
                                                    effects.clickAnimationStyle === style
                                                        ? "bg-blue-500/20 text-blue-400 border-blue-500/50 shadow-[0_0_15px_-5px_rgba(59,130,246,0.5)]"
                                                        : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-foreground"
                                                )}
                                            >
                                                {style}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* Properties */}
                                <Collapsible
                                    open={activeSection === 'click_properties'}
                                    onOpenChange={() => setActiveSection(activeSection === 'click_properties' ? null : 'click_properties')}
                                    className="space-y-2 rounded-xl bg-white/5 border border-white/10 overflow-hidden"
                                >
                                    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <Palette className="h-4 w-4 text-purple-400" />
                                            <span className="text-sm font-medium">Appearance</span>
                                        </div>
                                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", activeSection === 'click_properties' && "rotate-180")} />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="p-4 pt-0 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Default Color</Label>
                                            <div className="flex gap-2 items-center">
                                                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-white/20 shadow-sm cursor-pointer hover:scale-105 transition-transform">
                                                    <input
                                                        type="color"
                                                        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer opacity-0"
                                                        value={effects.clickColor}
                                                        onChange={(e) => updateEffects({ clickColor: e.target.value })}
                                                    />
                                                    <div className="w-full h-full" style={{ backgroundColor: effects.clickColor }} />
                                                </div>
                                                <div className="flex-1  rounded px-2 py-1 text-xs font-mono text-muted-foreground border border-white/10">
                                                    {effects.clickColor}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <Label className="text-xs text-muted-foreground">Default Size</Label>
                                                <span className="text-xs font-mono text-muted-foreground">{effects.clickSize.toFixed(1)}x</span>
                                            </div>
                                            <Slider
                                                min={0.5}
                                                max={3}
                                                step={0.1}
                                                value={[effects.clickSize]}
                                                onValueChange={([val]) => updateEffects({ clickSize: val })}
                                                className="[&_.range-thumb]:bg-purple-400 [&_.range-fill]:bg-purple-400/50"
                                            />
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>

                                {/* Physics */}
                                <Collapsible
                                    open={activeSection === 'click_physics'}
                                    onOpenChange={() => setActiveSection(activeSection === 'click_physics' ? null : 'click_physics')}
                                    className="space-y-2 rounded-xl bg-white/5 border border-white/10 overflow-hidden"
                                >
                                    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <Zap className="h-4 w-4 text-yellow-400" />
                                            <span className="text-sm font-medium">Physics</span>
                                        </div>
                                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", activeSection === 'click_physics' && "rotate-180")} />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="p-4 pt-0 space-y-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <Label className="text-xs text-muted-foreground">Impact Force</Label>
                                                <span className="text-xs font-mono text-muted-foreground">{(effects.clickForce * 100).toFixed(0)}%</span>
                                            </div>
                                            <Slider
                                                min={0}
                                                max={1.5}
                                                step={0.1}
                                                value={[effects.clickForce]}
                                                onValueChange={([val]) => updateEffects({ clickForce: val })}
                                                className="[&_.range-thumb]:bg-yellow-400 [&_.range-fill]:bg-yellow-400/50"
                                            />
                                            <p className="text-[10px] text-muted-foreground/70">
                                                Controls screen shake intensity on click
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                            <div className="flex items-center gap-2">
                                                <Activity className="h-3.5 w-3.5 text-red-400" />
                                                <Label className="text-sm text-foreground/80">Double Click Emphasis</Label>
                                            </div>
                                            <Switch
                                                checked={effects.clickEmphasis}
                                                onCheckedChange={(c) => updateEffects({ clickEmphasis: c })}
                                                className="scale-90"
                                            />
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
