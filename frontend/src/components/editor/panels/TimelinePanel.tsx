import React from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Button } from '@/components/ui/button';
import { ZoomIn, MousePointer2, Clock, Type, Mic2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * "Chapters" — a linear, time-ordered list of everything in the demo.
 * Complements the visual timeline: fast scanning, jumping and cleanup.
 */
export function TimelinePanel() {
    const editorState = useEditorState();
    const { events, textOverlays, voiceover } = editorState;

    const formatTime = (time: number) => {
        if (!isFinite(time) || isNaN(time) || time < 0) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    type Item = {
        key: string;
        time: number;
        icon: React.ElementType;
        iconClass: string;
        label: string;
        detail: string;
        onDelete?: () => void;
    };

    const items: Item[] = [
        ...events.effects.map((effect): Item => {
            const start = Number.isFinite(effect.start) ? effect.start : effect.timestamp ?? 0;
            const end = Number.isFinite(effect.end) ? effect.end : start + 3;
            return {
                key: `effect-${effect.id}`,
                time: start,
                icon: ZoomIn,
                iconClass: 'text-purple-400 bg-purple-500/10',
                label: effect.label || 'Zoom moment',
                detail: `${formatTime(start)}–${formatTime(end)} · ${(effect.zoom ?? editorState.camera.zoomStrength).toFixed(1)}x`,
                onDelete: () => editorStore.deleteEffect(effect.id),
            };
        }),
        ...textOverlays.map((layer): Item => ({
            key: `text-${layer.id}`,
            time: layer.startTime,
            icon: Type,
            iconClass: 'text-emerald-400 bg-emerald-500/10',
            label: layer.text || 'Text layer',
            detail: `${formatTime(layer.startTime)}–${formatTime(layer.endTime)}`,
            onDelete: () => editorStore.deleteTextOverlay(layer.id),
        })),
        ...voiceover.scriptSegments.map((segment, i): Item => ({
            key: `seg-${segment.id ?? i}`,
            time: segment.timestamp,
            icon: Mic2,
            iconClass: 'text-orange-400 bg-orange-500/10',
            label: segment.text ? segment.text.slice(0, 60) : 'Voice segment',
            detail: `${formatTime(segment.timestamp)}${segment.isGenerated ? ` · ${Math.round(segment.duration ?? 0)}s voiced` : ' · not voiced'}`,
        })),
        ...events.clicks.map((click, i): Item => ({
            key: `click-${i}`,
            time: click.timestamp,
            icon: MousePointer2,
            iconClass: 'text-sky-400 bg-sky-500/10',
            label: `Click #${i + 1}`,
            detail: `${formatTime(click.timestamp)} · ${Math.round(click.x * 100)}%, ${Math.round(click.y * 100)}%`,
        })),
    ].sort((a, b) => a.time - b.time);

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <Clock className="h-10 w-10 text-primary/60" />
                </div>
                <p className="mb-1 text-sm font-medium">Nothing here yet</p>
                <p className="max-w-[220px] text-xs text-muted-foreground">
                    Zoom moments, text, voice segments and clicks will appear here in playback order.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-1 p-3 pb-16">
            {items.map((item) => {
                const Icon = item.icon;
                return (
                    <button
                        key={item.key}
                        className="group flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-all hover:border-border/50 hover:bg-card/60"
                        onClick={() => editorStore.setPlayback({ currentTime: item.time })}
                        title="Jump to this moment"
                    >
                        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', item.iconClass)}>
                            <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{item.label}</p>
                            <p className="text-[10px] text-muted-foreground">{item.detail}</p>
                        </div>
                        {item.onDelete && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    item.onDelete!();
                                }}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
