
import React, { useState, useRef, useEffect } from 'react';
import { CameraEffect, TimelineEvent } from "@/lib/editor/types";
import { useEditorState, editorStore } from "@/lib/editor/store";
import {
    Play,
    Pause,
    Plus,
    Trash2,
    Video,
    MousePointer2,
    Clock,
    ZoomIn,
    GripVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

// Helper for formatting time if not imported
const formatTimeHelper = (time: number) => {
    if (!isFinite(time) || isNaN(time) || time < 0) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export function Timeline() {
    const editorState = useEditorState();
    const [zoom, setZoom] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const duration = editorState.video.duration || 100; // Default or fallback
    const currentTime = editorState.playback.currentTime;

    // --- TIMELINE INTERACTION ---

    const handleScrub = (e: React.MouseEvent | MouseEvent) => {
        if (!containerRef.current || duration <= 0) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;

        // Calculate new time
        // We might need to account for scroll if we implement horizontal scrolling later
        // For now, let's assume one view fits all or simple scaling
        const clickTime = (x / width) * duration;
        const clampedTime = Math.max(0, Math.min(clickTime, duration));

        if (isFinite(clampedTime)) {
            editorStore.setPlayback({ currentTime: clampedTime });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        handleScrub(e);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) handleScrub(e);
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, duration]);


    // --- RENDERING HELPERS ---

    // Convert time to percentage position
    const getPos = (time: number) => Math.min(100, Math.max(0, (time / duration) * 100));


    // --- TRACK: CAMERA EFFECTS ---

    const addCameraEffect = () => {
        const existingEffects = editorState.cameraEffects || [];
        // Generate a name like "Zoom A", "Zoom B" based on count
        const charCode = 65 + (existingEffects.length % 26); // A, B, C...
        const suffix = Math.floor(existingEffects.length / 26) > 0 ? Math.floor(existingEffects.length / 26) + 1 : '';
        const name = `Zoom ${String.fromCharCode(charCode)}${suffix}`;

        const newEffect: CameraEffect = {
            id: Date.now().toString(),
            name: name,
            type: 'zoom',
            startTime: currentTime,
            duration: 2.0,
            zoomLevel: 1.5,
            x: 0.5,
            y: 0.5,
            easing: 'ease-in-out'
        };
        editorStore.setState(prev => ({
            cameraEffects: [...prev.cameraEffects, newEffect],
            selectedEffectId: newEffect.id,
            activePanel: 'camera' // Switch to camera panel
        }));
    };

    const deleteEffect = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        editorStore.setState(prev => ({
            cameraEffects: prev.cameraEffects.filter(eff => eff.id !== id),
            selectedEffectId: prev.selectedEffectId === id ? null : prev.selectedEffectId
        }));
    };

    const handleEffectClick = (effect: CameraEffect, e: React.MouseEvent) => {
        e.stopPropagation();
        editorStore.setState(prev => ({
            selectedEffectId: prev.selectedEffectId === effect.id ? null : effect.id,
            activePanel: 'camera' // Switch to camera panel
        }));
    };


    return (
        <div className="flex flex-col h-full rounded-xl border border-border bg-card overflow-hidden select-none">
            {/* Toolbar */}
            <div className="h-10 border-b border-border bg-secondary/30 flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</span>
                    <div className="h-4 w-px bg-border/50" />
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-2">
                        <ZoomIn className="h-3 w-3 text-muted-foreground" />
                        <Slider
                            min={0.5} max={5} step={0.1}
                            value={[zoom]}
                            onValueChange={([v]) => setZoom(v)}
                            className="w-20"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addCameraEffect}>
                        <Video className="h-3 w-3" />
                        Add Camera Effect
                    </Button>
                </div>
            </div>

            {/* Tracks Container */}
            <div
                ref={containerRef}
                className={cn(
                    "flex-1 relative overflow-hidden cursor-crosshair",
                    isDragging && "cursor-grabbing"
                )}
                onMouseDown={handleMouseDown}
            >
                {/* 1. RULER & PLAYHEAD LAYER (Background) */}
                <div className="absolute inset-0 bg-secondary/5 pointer-events-none">
                    {/* Time Ticks */}
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className="absolute top-0 bottom-0 border-l border-border/10" style={{ left: `${i * 5}%` }} />
                    ))}
                </div>

                {/* 2. TRACKS CONTENT */}
                <div className="absolute inset-0 flex flex-col pointer-events-none">

                    {/* Track 1: Events (Markers & Clicks) */}
                    <div className="h-16 border-b border-border/20 relative group pointer-events-auto">
                        <div className="absolute top-2 left-2 text-[10px] text-muted-foreground font-mono opacity-50">EVENTS</div>

                        {/* Clicks */}
                        {editorState.events.clicks.map((click, i) => (
                            <div
                                key={`click-${i}`}
                                className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-500/50 hover:bg-blue-500 transition-colors cursor-pointer"
                                style={{ left: `${getPos(click.timestamp)}%` }}
                                title={`Click at ${formatTimeHelper(click.timestamp)}`}
                            />
                        ))}

                        {/* Markers */}
                        {editorState.events.markers.map((marker, i) => (
                            <div
                                key={`marker-${marker.id}`}
                                className="absolute top-0 bottom-0 w-px bg-yellow-500/50 group/marker cursor-pointer"
                                style={{ left: `${getPos(marker.time)}%` }}
                            >
                                <div className="absolute top-0 -translate-x-1/2 w-2 h-2 rounded-full bg-yellow-500 hover:scale-150 transition-transform" />
                                <span className="absolute top-2 left-2 text-[9px] bg-background/80 px-1 rounded opacity-0 group-hover/marker:opacity-100 whitespace-nowrap z-20 pointer-events-none">
                                    {marker.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Track 2: Camera Effects */}
                    <div className="h-20 border-b border-border/20 relative group bg-purple-500/5 pointer-events-auto">
                        <div className="absolute top-2 left-2 text-[10px] text-purple-400 font-mono opacity-50 flex items-center gap-1">
                            <Video className="h-3 w-3" /> CAMERA
                        </div>

                        {/* Effect Blocks */}
                        {editorState.cameraEffects.map(effect => {
                            const left = getPos(effect.startTime);
                            const width = (effect.duration / duration) * 100;
                            const isSelected = editorState.selectedEffectId === effect.id;

                            return (
                                <div
                                    key={effect.id}
                                    className={cn(
                                        "absolute top-8 h-8 rounded-md border text-[10px] flex items-center px-2 cursor-pointer transition-all hover:brightness-110 active:scale-95 overflow-hidden whitespace-nowrap",
                                        isSelected
                                            ? "bg-purple-600 border-purple-400 text-white shadow-md z-10"
                                            : "bg-purple-500/20 border-purple-500/30 text-purple-200"
                                    )}
                                    style={{ left: `${left}%`, width: `${width}%` }}
                                    onClick={(e) => handleEffectClick(effect, e)}
                                >
                                    <span className="font-semibold mr-1">{effect.name || effect.type.toUpperCase()}</span>
                                    <span className="opacity-70">x{effect.zoomLevel}</span>

                                    {/* Delete Button (visible on hover) */}
                                    <div
                                        className="absolute right-0 top-0 bottom-0 w-6 flex items-center justify-center bg-black/20 hover:bg-red-500/80 opacity-0 hover:opacity-100 transition-opacity"
                                        onClick={(e) => deleteEffect(effect.id, e)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Track 3: Audio/Voice (Placeholder) */}
                    <div className="h-12 border-b border-border/20 relative group pointer-events-auto">
                        <div className="absolute top-2 left-2 text-[10px] text-muted-foreground font-mono opacity-50">AUDIO</div>
                    </div>
                </div>

                {/* 3. PLAYHEAD OVERLAY */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    style={{ left: `${getPos(currentTime)}%` }}
                >
                    <div className="absolute -top-0 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1 rounded-sm">
                        {formatTimeHelper(currentTime)}
                    </div>
                </div>

            </div>
        </div>
    );
}
