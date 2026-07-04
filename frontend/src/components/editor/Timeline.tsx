import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
    ZoomIn,
    Type,
    Mic2,
    MousePointer2,
    Plus,
    Minus,
    Magnet,
    Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZoomEffect } from '@/lib/editor/types';

const LABEL_W = 96; // px — track label column (single source of truth for alignment)

function formatTime(time: number) {
    if (!isFinite(time) || isNaN(time) || time < 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatTimePrecise(time: number) {
    if (!isFinite(time) || time < 0) return '0:00.0';
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

type DragState =
    | { kind: 'effect-move'; id: string; grabOffset: number }
    | { kind: 'effect-resize'; id: string; edge: 'left' | 'right' }
    | { kind: 'text-move'; id: string; grabOffset: number }
    | { kind: 'text-resize'; id: string; edge: 'left' | 'right' }
    | { kind: 'segment-move'; index: number; grabOffset: number }
    | { kind: 'scrub' }
    | null;

export interface TimelineProps {
    selectedEffectId: string | null;
    onEffectSelect: (id: string | null) => void;
    selectedTextLayerId: string | null;
    onTextLayerSelect: (id: string | null) => void;
    selectedClickIndex: number | null;
    onClickSelect: (index: number | null) => void;
}

export function Timeline({
    selectedEffectId,
    onEffectSelect,
    selectedTextLayerId,
    onTextLayerSelect,
    selectedClickIndex,
    onClickSelect,
}: TimelineProps) {
    const state = useEditorState();
    const { video, playback, events, textOverlays, voiceover } = state;
    const duration = video.duration || 0;

    const [zoom, setZoom] = useState(1);
    const [windowStart, setWindowStart] = useState(0);
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const dragRef = useRef<DragState>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const visibleDuration = duration > 0 ? Math.max(0.5, duration / zoom) : 1;
    const windowEnd = Math.min(duration || 1, windowStart + visibleDuration);

    const clampWindowStart = useCallback(
        (start: number) => Math.max(0, Math.min(start, Math.max(0, (duration || 0) - visibleDuration))),
        [duration, visibleDuration]
    );

    // Keep window valid when zoom/duration changes
    useEffect(() => {
        setWindowStart((s) => Math.max(0, Math.min(s, Math.max(0, duration - visibleDuration))));
    }, [zoom, duration, visibleDuration]);

    // Auto-follow the playhead during playback
    useEffect(() => {
        if (!playback.isPlaying || duration <= 0) return;
        const t = playback.currentTime;
        if (t < windowStart || t > windowStart + visibleDuration * 0.95) {
            setWindowStart(clampWindowStart(t - visibleDuration * 0.1));
        }
    }, [playback.currentTime, playback.isPlaying, duration, windowStart, visibleDuration, clampWindowStart]);

    // ---- Geometry helpers ----------------------------------------------------

    const timeToPercent = useCallback(
        (time: number) => {
            const clamped = Math.max(windowStart, Math.min(time, windowEnd));
            return ((clamped - windowStart) / visibleDuration) * 100;
        },
        [windowStart, windowEnd, visibleDuration]
    );

    const timeAtClientX = useCallback(
        (clientX: number) => {
            const el = contentRef.current;
            if (!el) return 0;
            const rect = el.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return windowStart + ratio * visibleDuration;
        },
        [windowStart, visibleDuration]
    );

    const snapPoints = useMemo(() => {
        const points: number[] = [0];
        events.clicks.forEach((c) => points.push(c.timestamp));
        events.effects.forEach((e) => {
            const s = Number.isFinite(e.start) ? e.start : e.timestamp ?? 0;
            const en = Number.isFinite(e.end) ? e.end : s + 3;
            points.push(s, en);
        });
        textOverlays.forEach((t) => points.push(t.startTime, t.endTime));
        voiceover.scriptSegments.forEach((s) => points.push(s.timestamp));
        if (duration > 0) points.push(duration);
        return points.filter((p) => Number.isFinite(p));
    }, [events.clicks, events.effects, textOverlays, voiceover.scriptSegments, duration]);

    const snapTime = useCallback(
        (time: number, excludeExact = false) => {
            if (!snapEnabled || duration <= 0) return Math.max(0, Math.min(time, duration || time));
            const tolerance = Math.max(0.05, visibleDuration * 0.01);
            let best = time;
            let bestDelta = tolerance;
            for (const p of snapPoints) {
                const delta = Math.abs(p - time);
                if (excludeExact && delta < 0.0001) continue;
                if (delta < bestDelta) {
                    bestDelta = delta;
                    best = p;
                }
            }
            return Math.max(0, Math.min(best, duration));
        },
        [snapEnabled, duration, visibleDuration, snapPoints]
    );

    const seek = useCallback(
        (time: number) => {
            if (!isFinite(time)) return;
            editorStore.setPlayback({ currentTime: Math.max(0, Math.min(time, duration || time)) });
        },
        [duration]
    );

    // ---- Global pointer handlers (drag anything) ------------------------------

    useEffect(() => {
        const onPointerMove = (e: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag) return;
            const rawTime = timeAtClientX(e.clientX);

            switch (drag.kind) {
                case 'scrub':
                    seek(snapTime(rawTime));
                    break;
                case 'effect-move': {
                    const effect = editorStore.getState().events.effects.find((x) => x.id === drag.id);
                    if (!effect) break;
                    const s = Number.isFinite(effect.start) ? effect.start! : effect.timestamp ?? 0;
                    const en = Number.isFinite(effect.end) ? effect.end! : s + 3;
                    const len = en - s;
                    let newStart = snapTime(rawTime - drag.grabOffset, true);
                    newStart = Math.max(0, Math.min(newStart, Math.max(0, duration - len)));
                    editorStore.updateEffect(drag.id, { start: newStart, end: newStart + len });
                    break;
                }
                case 'effect-resize': {
                    const effect = editorStore.getState().events.effects.find((x) => x.id === drag.id);
                    if (!effect) break;
                    const s = Number.isFinite(effect.start) ? effect.start! : effect.timestamp ?? 0;
                    const en = Number.isFinite(effect.end) ? effect.end! : s + 3;
                    if (drag.edge === 'left') {
                        editorStore.updateEffect(drag.id, { start: Math.min(snapTime(rawTime, true), en - 0.3) });
                    } else {
                        editorStore.updateEffect(drag.id, { end: Math.max(snapTime(rawTime, true), s + 0.3) });
                    }
                    break;
                }
                case 'text-move': {
                    const layer = editorStore.getState().textOverlays.find((t) => t.id === drag.id);
                    if (!layer) break;
                    const len = layer.endTime - layer.startTime;
                    let newStart = snapTime(rawTime - drag.grabOffset, true);
                    newStart = Math.max(0, Math.min(newStart, Math.max(0, duration - len)));
                    editorStore.updateTextOverlay(drag.id, { startTime: newStart, endTime: newStart + len });
                    break;
                }
                case 'text-resize': {
                    const layer = editorStore.getState().textOverlays.find((t) => t.id === drag.id);
                    if (!layer) break;
                    if (drag.edge === 'left') {
                        editorStore.updateTextOverlay(drag.id, {
                            startTime: Math.max(0, Math.min(snapTime(rawTime, true), layer.endTime - 0.3)),
                        });
                    } else {
                        editorStore.updateTextOverlay(drag.id, {
                            endTime: Math.min(duration || rawTime, Math.max(snapTime(rawTime, true), layer.startTime + 0.3)),
                        });
                    }
                    break;
                }
                case 'segment-move': {
                    const newTs = Math.max(0, Math.min(snapTime(rawTime - drag.grabOffset, true), duration));
                    editorStore.updateSegment(drag.index, { timestamp: Math.round(newTs * 10) / 10 });
                    break;
                }
            }
        };
        const onPointerUp = () => {
            dragRef.current = null;
        };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }, [timeAtClientX, snapTime, seek, duration]);

    // Ctrl/cmd + wheel = zoom · wheel = pan when zoomed
    const handleWheel = useCallback(
        (e: React.WheelEvent) => {
            if (duration <= 0) return;
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const pivot = timeAtClientX(e.clientX);
                const nextZoom = Math.max(1, Math.min(20, zoom * (e.deltaY > 0 ? 0.85 : 1.18)));
                const nextVisible = duration / nextZoom;
                const ratio = (pivot - windowStart) / visibleDuration;
                setZoom(nextZoom);
                setWindowStart(Math.max(0, Math.min(pivot - ratio * nextVisible, duration - nextVisible)));
            } else if (zoom > 1) {
                e.preventDefault();
                const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * (visibleDuration / 600);
                setWindowStart((s) => clampWindowStart(s + delta));
            }
        },
        [duration, zoom, windowStart, visibleDuration, timeAtClientX, clampWindowStart]
    );

    // ---- Ruler ticks -----------------------------------------------------------

    const ticks = useMemo(() => {
        if (duration <= 0) return [];
        const targetTicks = 10;
        const raw = visibleDuration / targetTicks;
        const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
        const step = steps.find((s) => s >= raw) ?? 300;
        const first = Math.floor(windowStart / step) * step;
        const result: Array<{ time: number; major: boolean }> = [];
        for (let t = first; t <= windowEnd + step; t += step) {
            if (t < windowStart - step) continue;
            result.push({ time: t, major: true });
        }
        return result;
    }, [duration, visibleDuration, windowStart, windowEnd]);

    // ---- Track block sub-render --------------------------------------------------

    const blockHandleProps = (
        onDown: (e: React.PointerEvent, rect: DOMRect) => void
    ) => ({
        onPointerDown: (e: React.PointerEvent) => {
            e.stopPropagation();
            e.preventDefault();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onDown(e, rect);
        },
    });

    const playheadPercent = timeToPercent(playback.currentTime);
    const hasAnyContent =
        events.effects.length > 0 ||
        textOverlays.length > 0 ||
        voiceover.scriptSegments.length > 0 ||
        events.clicks.length > 0;

    return (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
            {/* ---- Toolbar ---- */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 bg-background/50 px-3 py-1.5">
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 font-mono text-xs text-foreground">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatTimePrecise(playback.currentTime)}
                        <span className="text-muted-foreground">/ {formatTime(duration)}</span>
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className={cn(
                            'flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-colors',
                            snapEnabled
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-border/40 text-muted-foreground hover:text-foreground'
                        )}
                        onClick={() => setSnapEnabled((v) => !v)}
                        title="Snap to clicks, blocks and markers"
                    >
                        <Magnet className="h-3 w-3" />
                        Snap
                    </button>
                    <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setZoom((z) => Math.max(1, z / 1.4))}>
                            <Minus className="h-3 w-3" />
                        </Button>
                        <Slider
                            className="w-20"
                            min={1}
                            max={20}
                            step={0.1}
                            value={[zoom]}
                            onValueChange={([v]) => setZoom(v)}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setZoom((z) => Math.min(20, z * 1.4))}>
                            <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => {
                                setZoom(1);
                                setWindowStart(0);
                            }}
                        >
                            Fit
                        </Button>
                    </div>
                </div>
            </div>

            {/* ---- Canvas ---- */}
            <div className="relative select-none" onWheel={handleWheel}>
                {/* Ruler */}
                <div className="flex h-7 border-b border-border/30 bg-background/70">
                    <div className="flex w-[96px] shrink-0 items-center border-r border-border/30 px-2 text-[9px] uppercase tracking-wider text-muted-foreground" style={{ width: LABEL_W }}>
                        {zoom > 1 ? `${zoom.toFixed(1)}x zoom` : 'Timeline'}
                    </div>
                    <div
                        ref={contentRef}
                        className="relative flex-1 cursor-col-resize"
                        onPointerDown={(e) => {
                            if (duration <= 0) return;
                            dragRef.current = { kind: 'scrub' };
                            seek(snapTime(timeAtClientX(e.clientX)));
                            onEffectSelect(null);
                            onTextLayerSelect(null);
                            onClickSelect(null);
                        }}
                        onPointerMove={(e) => {
                            if (duration > 0) setHoverTime(timeAtClientX(e.clientX));
                        }}
                        onPointerLeave={() => setHoverTime(null)}
                    >
                        {duration <= 0 ? (
                            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                                No video loaded
                            </div>
                        ) : (
                            ticks.map(({ time }) => {
                                if (time < windowStart || time > windowEnd) return null;
                                return (
                                    <div
                                        key={time.toFixed(3)}
                                        className="pointer-events-none absolute bottom-0 flex flex-col items-center"
                                        style={{ left: `${timeToPercent(time)}%` }}
                                    >
                                        <span className="mb-0.5 -translate-x-1/2 text-[9px] font-medium text-muted-foreground">
                                            {visibleDuration < 12 ? formatTimePrecise(time) : formatTime(time)}
                                        </span>
                                        <div className="h-1.5 w-px bg-border" />
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Tracks + overlays */}
                <div className="relative">
                    {/* Track rows */}
                    <div className="space-y-px py-px">
                        {/* Zoom track */}
                        <TrackRow
                            icon={ZoomIn}
                            iconClass="text-purple-400"
                            label="Zoom"
                            count={events.effects.length}
                            height={events.effects.length > 0 ? 40 : 28}
                        >
                            {events.effects.map((effect) => {
                                const s = Number.isFinite(effect.start) ? effect.start! : effect.timestamp ?? 0;
                                const en = Number.isFinite(effect.end) ? effect.end! : s + 3;
                                if (en < windowStart || s > windowEnd) return null;
                                const left = timeToPercent(s);
                                const width = Math.max(0.6, timeToPercent(en) - left);
                                const isSelected = selectedEffectId === effect.id;
                                return (
                                    <div
                                        key={effect.id}
                                        className={cn(
                                            'absolute inset-y-1 cursor-grab rounded-md border transition-shadow active:cursor-grabbing',
                                            isSelected
                                                ? 'z-20 border-purple-300 bg-purple-500 shadow-md ring-1 ring-purple-300/50'
                                                : 'z-10 border-purple-500/40 bg-purple-500/75 hover:border-purple-400 hover:shadow-sm'
                                        )}
                                        style={{ left: `${left}%`, width: `${width}%` }}
                                        {...blockHandleProps((e, rect) => {
                                            onEffectSelect(effect.id);
                                            onTextLayerSelect(null);
                                            onClickSelect(null);
                                            const x = e.clientX - rect.left;
                                            if (x < 7 && rect.width > 24) {
                                                dragRef.current = { kind: 'effect-resize', id: effect.id, edge: 'left' };
                                            } else if (x > rect.width - 7 && rect.width > 24) {
                                                dragRef.current = { kind: 'effect-resize', id: effect.id, edge: 'right' };
                                            } else {
                                                dragRef.current = {
                                                    kind: 'effect-move',
                                                    id: effect.id,
                                                    grabOffset: timeAtClientX(e.clientX) - s,
                                                };
                                            }
                                        })}
                                    >
                                        <div className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize rounded-l-md bg-white/20 hover:bg-white/40" />
                                        <div className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r-md bg-white/20 hover:bg-white/40" />
                                        <div className="pointer-events-none absolute inset-0 flex items-center gap-1 overflow-hidden px-2">
                                            <ZoomIn className="h-2.5 w-2.5 shrink-0 text-white" />
                                            <span className="truncate text-[10px] font-medium text-white">
                                                {effect.label || 'Zoom'} · {(effect.zoom ?? state.camera.zoomStrength).toFixed(1)}x
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </TrackRow>

                        {/* Text track */}
                        {textOverlays.length > 0 && (
                            <TrackRow icon={Type} iconClass="text-emerald-400" label="Text" count={textOverlays.length} height={40}>
                                {textOverlays.map((layer) => {
                                    if (layer.endTime < windowStart || layer.startTime > windowEnd) return null;
                                    const left = timeToPercent(layer.startTime);
                                    const width = Math.max(0.6, timeToPercent(layer.endTime) - left);
                                    const isSelected = selectedTextLayerId === layer.id;
                                    return (
                                        <div
                                            key={layer.id}
                                            className={cn(
                                                'absolute inset-y-1 cursor-grab rounded-md border transition-shadow active:cursor-grabbing',
                                                isSelected
                                                    ? 'z-20 border-emerald-300 bg-emerald-600 shadow-md ring-1 ring-emerald-300/50'
                                                    : 'z-10 border-emerald-500/40 bg-emerald-600/75 hover:border-emerald-400 hover:shadow-sm'
                                            )}
                                            style={{ left: `${left}%`, width: `${width}%` }}
                                            {...blockHandleProps((e, rect) => {
                                                onTextLayerSelect(layer.id);
                                                onEffectSelect(null);
                                                onClickSelect(null);
                                                const x = e.clientX - rect.left;
                                                if (x < 7 && rect.width > 24) {
                                                    dragRef.current = { kind: 'text-resize', id: layer.id, edge: 'left' };
                                                } else if (x > rect.width - 7 && rect.width > 24) {
                                                    dragRef.current = { kind: 'text-resize', id: layer.id, edge: 'right' };
                                                } else {
                                                    dragRef.current = {
                                                        kind: 'text-move',
                                                        id: layer.id,
                                                        grabOffset: timeAtClientX(e.clientX) - layer.startTime,
                                                    };
                                                }
                                            })}
                                        >
                                            <div className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize rounded-l-md bg-white/20 hover:bg-white/40" />
                                            <div className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r-md bg-white/20 hover:bg-white/40" />
                                            <div className="pointer-events-none absolute inset-0 flex items-center gap-1 overflow-hidden px-2">
                                                <Type className="h-2.5 w-2.5 shrink-0 text-white" />
                                                <span className="truncate text-[10px] font-medium text-white">{layer.text || 'Text'}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </TrackRow>
                        )}

                        {/* Voiceover track */}
                        {voiceover.scriptSegments.length > 0 && (
                            <TrackRow
                                icon={Mic2}
                                iconClass="text-orange-400"
                                label="Voice"
                                count={`${voiceover.scriptSegments.filter((s) => s.isGenerated).length}/${voiceover.scriptSegments.length}`}
                                height={40}
                            >
                                {voiceover.scriptSegments.map((segment, index) => {
                                    const s = segment.timestamp;
                                    const en = s + (segment.duration && segment.duration > 0 ? segment.duration : 2.5);
                                    if (en < windowStart || s > windowEnd) return null;
                                    const left = timeToPercent(s);
                                    const width = Math.max(0.6, timeToPercent(en) - left);
                                    return (
                                        <div
                                            key={segment.id ?? index}
                                            className={cn(
                                                'absolute inset-y-1 cursor-grab rounded-md border transition-shadow active:cursor-grabbing',
                                                segment.isGenerated
                                                    ? 'z-10 border-orange-500/40 bg-orange-500/80 hover:border-orange-400'
                                                    : 'z-[5] border-dashed border-orange-500/40 bg-orange-500/30 hover:border-orange-400/60'
                                            )}
                                            style={{ left: `${left}%`, width: `${width}%` }}
                                            title={
                                                segment.isGenerated
                                                    ? `${segment.text.slice(0, 80)} (${Math.round(segment.duration ?? 0)}s) — drag to re-time`
                                                    : `${segment.text.slice(0, 80)} — not voiced yet (dashed). Drag to re-time.`
                                            }
                                            {...blockHandleProps((e) => {
                                                onEffectSelect(null);
                                                onTextLayerSelect(null);
                                                onClickSelect(null);
                                                dragRef.current = {
                                                    kind: 'segment-move',
                                                    index,
                                                    grabOffset: timeAtClientX(e.clientX) - s,
                                                };
                                            })}
                                        >
                                            <div className="pointer-events-none absolute inset-0 flex items-center gap-1 overflow-hidden px-2">
                                                <Mic2 className={cn('h-2.5 w-2.5 shrink-0', segment.isGenerated ? 'text-white' : 'text-white/60')} />
                                                <span className={cn('truncate text-[10px] font-medium', segment.isGenerated ? 'text-white' : 'text-white/60')}>
                                                    {segment.text || 'Segment'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </TrackRow>
                        )}

                        {/* Clicks track */}
                        {events.clicks.length > 0 && (
                            <TrackRow icon={MousePointer2} iconClass="text-sky-400" label="Clicks" count={events.clicks.length} height={24}>
                                {events.clicks.map((click, index) => {
                                    if (click.timestamp < windowStart || click.timestamp > windowEnd) return null;
                                    const isSelected = selectedClickIndex === index;
                                    return (
                                        <button
                                            key={`click-${index}`}
                                            className="group absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                                            style={{ left: `${timeToPercent(click.timestamp)}%` }}
                                            title={`Click at ${formatTimePrecise(click.timestamp)} — select to style its effect`}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isSelected) {
                                                    onClickSelect(null);
                                                } else {
                                                    onClickSelect(index);
                                                    onEffectSelect(null);
                                                    onTextLayerSelect(null);
                                                    seek(click.timestamp);
                                                }
                                            }}
                                        >
                                            <div
                                                className={cn(
                                                    'h-2.5 w-2.5 rounded-full border border-background shadow-sm transition-transform group-hover:scale-125',
                                                    isSelected ? 'scale-125 bg-sky-300 ring-2 ring-sky-300/60' : 'bg-sky-500'
                                                )}
                                            />
                                        </button>
                                    );
                                })}
                            </TrackRow>
                        )}
                    </div>

                    {/* Empty state */}
                    {!hasAnyContent && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <p className="text-xs text-muted-foreground">
                                Add zoom moments, text or a voiceover — they&apos;ll show up here as draggable blocks.
                            </p>
                        </div>
                    )}

                    {/* Hover indicator */}
                    {hoverTime !== null && duration > 0 && hoverTime >= windowStart && hoverTime <= windowEnd && (
                        <div
                            className="pointer-events-none absolute bottom-0 top-0 z-30 w-px bg-primary/30"
                            style={{ left: `calc(${LABEL_W}px + ${timeToPercent(hoverTime)} * (100% - ${LABEL_W}px) / 100)` }}
                        />
                    )}

                    {/* Playhead */}
                    {duration > 0 && playback.currentTime >= windowStart && playback.currentTime <= windowEnd && (
                        <div
                            className="pointer-events-none absolute bottom-0 top-0 z-40 w-[1.5px] bg-primary"
                            style={{ left: `calc(${LABEL_W}px + ${playheadPercent} * (100% - ${LABEL_W}px) / 100)` }}
                        >
                            <div className="absolute -top-[3px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-primary shadow-md" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---- Track row shell ----------------------------------------------------------

function TrackRow({
    icon: Icon,
    iconClass,
    label,
    count,
    height,
    children,
}: {
    icon: React.ElementType;
    iconClass?: string;
    label: string;
    count?: number | string;
    height: number;
    children: React.ReactNode;
}) {
    return (
        <div className="flex bg-secondary/10" style={{ height }}>
            <div
                className="flex shrink-0 items-center gap-1.5 border-r border-border/30 bg-secondary/30 px-2"
                style={{ width: LABEL_W }}
            >
                <Icon className={cn('h-3 w-3', iconClass)} />
                <span className="text-[10px] font-medium text-foreground">{label}</span>
                {count !== undefined && <span className="ml-auto text-[8px] text-muted-foreground">{count}</span>}
            </div>
            <div className="relative min-w-0 flex-1">{children}</div>
        </div>
    );
}
