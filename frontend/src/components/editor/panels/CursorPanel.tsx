
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
        <div className="space-y-6 p-4">
            {/* Visual Style */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                        <MousePointer2 className="h-4 w-4 text-primary" />
                        Cursor Size
                    </Label>
                    <span className="text-xs font-mono text-muted-foreground">{cursor.size.toFixed(1)}x</span>
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
                    <Label>Color</Label>
                    <div className="flex gap-2">
                        <Input
                            type="color"
                            className="h-9 w-9 p-1 cursor-pointer"
                            value={cursor.color}
                            onChange={(e) => updateCursor({ color: e.target.value })}
                        />
                        <Input
                            className="h-9 font-mono text-xs"
                            value={cursor.color}
                            onChange={(e) => updateCursor({ color: e.target.value })}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Theme</Label>
                    <div className="flex rounded-md border border-input p-1 bg-secondary/20">
                        <Button
                            variant={cursor.theme === 'light' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => updateCursor({ theme: 'light' })}
                        >L</Button>
                        <Button
                            variant={cursor.theme === 'dark' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => updateCursor({ theme: 'dark' })}
                        >D</Button>
                    </div>
                </div>
            </div>

            {/* Effects */}
            <div className="space-y-4 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-yellow-400" />
                        <Label>Cursor Glow</Label>
                    </div>
                    <Switch
                        checked={cursor.glow}
                        onCheckedChange={(c) => updateCursor({ glow: c })}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Ghost className="h-4 w-4 text-blue-400" />
                        <Label>Motion Trail</Label>
                    </div>
                    <Switch
                        checked={cursor.trail}
                        onCheckedChange={(c) => updateCursor({ trail: c })}
                    />
                </div>

                {cursor.trail && (
                    <div className="pl-6 space-y-2">
                        <div className="flex justify-between">
                            <Label className="text-xs text-muted-foreground">Length</Label>
                            <span className="text-xs text-muted-foreground">{cursor.trailLength}</span>
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

            <div className="space-y-4 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-green-400" />
                        <Label>Smoothing</Label>
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
