import React from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles, MousePointer2, Clock, Plus, Play, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function TimelinePanel() {
    const editorState = useEditorState();
    const { toast } = useToast();

    const formatTime = (time: number) => {
        if (!isFinite(time) || isNaN(time) || time < 0) {
            return "0:00";
        }
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    const addSpotlightEffect = () => {
        const currentTime = editorState.playback.currentTime;
        const duration = editorState.video.duration || 0;
        const newEffect = {
            id: `effect-${Date.now()}`,
            type: 'spotlight',
            timestamp: currentTime,
            start: currentTime,
            end: Math.min(currentTime + 5, duration),
            zoom: editorState.camera.zoomStrength,
            label: 'Zoom Effect',
        };
        editorStore.setState(prev => ({
            events: {
                ...prev.events,
                effects: [...prev.events.effects, newEffect],
            }
        }));
        toast({
            title: "Effect added",
            description: "New zoom effect created at current time",
        });
    };

    const updateEffect = (id: string, updates: any) => {
        editorStore.setState(prev => ({
            events: {
                ...prev.events,
                effects: prev.events.effects.map(effect =>
                    effect.id === id ? { ...effect, ...updates } : effect
                ),
            }
        }));
    };

    const deleteEffect = (id: string) => {
        editorStore.setState(prev => ({
            events: {
                ...prev.events,
                effects: prev.events.effects.filter(effect => effect.id !== id),
            }
        }));
        toast({
            title: "Effect deleted",
            description: "Effect has been removed",
        });
    };

    return (
        <div className="space-y-6 p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold">Timeline Events</h3>
                    <p className="text-xs text-muted-foreground">Manage effects and clicks</p>
                </div>
                <Button
                    size="sm"
                    variant="default"
                    className="h-8 text-xs font-medium shadow-sm"
                    onClick={addSpotlightEffect}
                >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Effect
                </Button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-2">
                {/* Effects Section */}
                {editorState.events.effects.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 px-2">
                            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                            <Label className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                                Effects ({editorState.events.effects.length})
                            </Label>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                        {editorState.events.effects.map((effect) => {
                            const effectDuration = Math.max(0, (effect.end ?? 0) - (effect.start ?? 0));
                            return (
                                <div
                                    key={effect.id}
                                    className="timeline-events group relative rounded-xl bg-gradient-to-br from-purple-400/10 via-purple-200/5 to-transparent p-0 hover:border-purple-500/40 hover:shadow-md transition-all"
                                >
                                    <div className="flex items-start gap-1">
                                        <div className="flex-1 space-y-0">
                                            <Input
                                                value={effect.label || ''}
                                                onChange={(e) => updateEffect(effect.id, { label: e.target.value })}
                                                placeholder="Effect name..."
                                                className="h-8 text-sm font-medium bg-background/50 border-purple-500/20 focus:border-purple-500/40"
                                            />
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="space-y-0">
                                                    <Label className="text-[8px] text-muted-foreground uppercase">Start</Label>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step="0.1"
                                                        value={Number(effect.start || 0).toFixed(1)}
                                                        onChange={(e) => updateEffect(effect.id, { start: parseFloat(e.target.value) })}
                                                        className="h-7 text-xs bg-background/50"
                                                    />
                                                </div>
                                                <div className="space-y-0">
                                                    <Label className="text-[8px] text-muted-foreground uppercase">End</Label>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step="0.1"
                                                        value={Number(effect.end || 0).toFixed(1)}
                                                        onChange={(e) => updateEffect(effect.id, { end: parseFloat(e.target.value) })}
                                                        className="h-7 text-xs bg-background/50"
                                                    />
                                                </div>
                                                <div className="space-y-0">
                                                    <Label className="text-[8px] text-muted-foreground uppercase">Zoom</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={5}
                                                        step="0.1"
                                                        value={Number(effect.zoom ?? editorState.camera.zoomStrength).toFixed(1)}
                                                        onChange={(e) => updateEffect(effect.id, { zoom: parseFloat(e.target.value) })}
                                                        className="h-7 text-xs bg-background/50"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                <span className="px-2 py-0.5 rounded bg-background/50 border border-border/30">
                                                    {formatTime(effect.start)} → {formatTime(effect.end)}
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-background/50 border border-border/30">
                                                    {effectDuration.toFixed(1)}s
                                                </span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => deleteEffect(effect.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                        </div>
                    </div>
                )}

                {/* Clicks Section */}
                {editorState.events.clicks.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 px-2">
                            <MousePointer2 className="h-3.5 w-3.5 text-blue-400" />
                            <Label className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
                                Clicks ({editorState.events.clicks.length})
                            </Label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                        {editorState.events.clicks.map((click, index) => (
                            
                                <div
                                    key={`click-list-${index}`}
                                    className="group flex items-center justify-between rounded border border-blue-500/20 bg-blue-500/5 px-2 py-1 text-xs hover:border-blue-500/40 transition cursor-pointer"
                                    onClick={() =>
                                        editorStore.setPlayback({ currentTime: click.timestamp })
                                    }
                                >
                                    <div className="truncate">
                                        <div className="font-medium">#{index + 1}</div>
                                        <div className="text-[10px] text-muted-foreground leading-tight">
                                            {formatTime(click.timestamp)} · {Math.round(click.x * 100)}%,{Math.round(click.y * 100)}%
                                        </div>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            editorStore.setPlayback({ currentTime: click.timestamp });
                                        }}
                                    >
                                        <Play className="h-3 w-3" />
                                    </Button>
                                </div>

                        ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {editorState.events.clicks.length === 0 && editorState.events.effects.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 mb-4">
                            <Clock className="h-10 w-10 text-primary/60" />
                        </div>
                        <p className="text-sm font-medium mb-1">No Events Yet</p>
                        <p className="text-xs text-muted-foreground mb-4">Start recording to capture events</p>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={addSpotlightEffect}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add First Effect
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

