
import React from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MousePointer2, Sparkles, Activity, Ghost } from 'lucide-react';

export function CursorPanel() {
    const { cursor } = useEditorState();

    const updateCursor = (updates: Partial<typeof cursor>) => {
        editorStore.setState((prev) => ({
            cursor: { ...prev.cursor, ...updates },
        }));
    };

    return (
        <div className="space-y-6 p-4 pb-20">
            {/* Visual Style */}
            <div className="space-y-4 bg-card/40 backdrop-blur-sm p-4 rounded-xl border-none shadow-sm">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    <MousePointer2 className="h-3.5 w-3.5" />
                    Cursor Appearance
                </Label>

                <div className="space-y-3 pb-4 border-b border-border/10">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Size</Label>
                        <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">{cursor.size.toFixed(1)}x</span>
                    </div>
                    <Slider
                        min={0.5}
                        max={3}
                        step={0.1}
                        value={[cursor.size]}
                        onValueChange={([val]) => updateCursor({ size: val })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Color</Label>
                        <div className="flex gap-2 items-center">
                            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border/50 shadow-sm transition-transform active:scale-95">
                                <input
                                    type="color"
                                    className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer border-0"
                                    value={cursor.color}
                                    onChange={(e) => updateCursor({ color: e.target.value })}
                                />
                            </div>
                            <Input
                                className="flex-1 h-8 font-mono text-xs bg-background/50 border-border/40"
                                value={cursor.color}
                                onChange={(e) => updateCursor({ color: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Theme</Label>
                        <div className="flex rounded-md border border-input p-1 bg-background/30 h-8">
                            <Button
                                variant={cursor.theme === 'light' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="flex-1 h-full text-xs"
                                onClick={() => updateCursor({ theme: 'light' })}
                            >Light</Button>
                            <Button
                                variant={cursor.theme === 'dark' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="flex-1 h-full text-xs"
                                onClick={() => updateCursor({ theme: 'dark' })}
                            >Dark</Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Effects */}
            <div className="space-y-4 bg-card/40 backdrop-blur-sm p-4 rounded-xl border-none shadow-sm">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    Special Effects
                </Label>

                <div className="flex items-center justify-between py-2 border-b border-border/10">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-yellow-500/10 text-yellow-500">
                            <Sparkles className="h-3.5 w-3.5" />
                        </div>
                        <Label className="text-sm font-medium">Cursor Glow</Label>
                    </div>
                    <Switch
                        checked={cursor.glow}
                        onCheckedChange={(c) => updateCursor({ glow: c })}
                    />
                </div>

                <div className="space-y-3 py-2 border-b border-border/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                                <Ghost className="h-3.5 w-3.5" />
                            </div>
                            <Label className="text-sm font-medium">Motion Trail</Label>
                        </div>
                        <Switch
                            checked={cursor.trail}
                            onCheckedChange={(c) => updateCursor({ trail: c })}
                        />
                    </div>

                    {cursor.trail && (
                        <div className="pl-10 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex justify-between">
                                <Label className="text-[10px] text-muted-foreground uppercase">Trail Length</Label>
                                <span className="text-[10px] font-mono text-muted-foreground">{cursor.trailLength} frames</span>
                            </div>
                            <Slider
                                min={2}
                                max={20}
                                step={1}
                                value={[cursor.trailLength]}
                                onValueChange={([val]) => updateCursor({ trailLength: val })}
                            />
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-green-500/10 text-green-500">
                            <Activity className="h-3.5 w-3.5" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-sm font-medium">Smart Smoothing</Label>
                            <p className="text-[10px] text-muted-foreground">Reduces jitter for smoother movement</p>
                        </div>
                    </div>
                    <Switch
                        checked={cursor.animation}
                        onCheckedChange={(c) => updateCursor({ animation: c })}
                    />
                </div>
            </div>
        </div>
    );
}
