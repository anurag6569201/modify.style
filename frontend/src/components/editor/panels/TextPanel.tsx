import React from 'react';
import { editorStore, useEditorState, generateId } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
    Plus,
    Trash2,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Type,
    Move,
    Box,
    Play,
    Clock,
    Crosshair,
    Italic,
    Copy,
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Switch } from '@/components/ui/switch';
import type { TextOverlay } from '@/lib/editor/types';
import { cn } from '@/lib/utils';

const FONT_FAMILIES = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Fraunces', label: 'Fraunces (serif)' },
    { value: 'Georgia', label: 'Georgia' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Verdana', label: 'Verdana' },
    { value: 'Trebuchet MS', label: 'Trebuchet' },
    { value: 'Times New Roman', label: 'Times' },
    { value: 'Courier New', label: 'Courier (mono)' },
    { value: 'Impact', label: 'Impact' },
];

const FONT_WEIGHTS = [
    { value: '300', label: 'Light' },
    { value: 'normal', label: 'Regular' },
    { value: '500', label: 'Medium' },
    { value: '600', label: 'Semibold' },
    { value: 'bold', label: 'Bold' },
    { value: '900', label: 'Black' },
];

const ANIMATION_TYPES = [
    { value: 'none', label: 'None' },
    { value: 'fade', label: 'Fade' },
    { value: 'slide-up', label: 'Slide up' },
    { value: 'slide-down', label: 'Slide down' },
    { value: 'slide-left', label: 'Slide left' },
    { value: 'slide-right', label: 'Slide right' },
    { value: 'scale', label: 'Scale in' },
    { value: 'pop', label: 'Pop' },
    { value: 'blur-in', label: 'Blur in' },
    { value: 'typewriter', label: 'Typewriter' },
    { value: 'glitch', label: 'Glitch' },
    { value: 'spin-3d', label: '3D spin' },
] as const;

type OverlayDefaults = Omit<TextOverlay, 'id' | 'startTime' | 'endTime'>;

const BASE_OVERLAY: OverlayDefaults = {
    text: 'New text',
    x: 0.5,
    y: 0.5,
    rotation: 0,
    scale: 1,
    opacity: 1,
    fontSize: 48,
    fontFamily: 'Inter',
    fontWeight: 'bold',
    fontStyle: 'normal',
    textAlign: 'center',
    lineHeight: 1.2,
    letterSpacing: 0,
    color: '#ffffff',
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    backdropBlur: 0,
    textTransform: 'none',
    gradient: { enabled: false, colors: ['#ff9a5a', '#e8506e'], angle: 45 },
    blendMode: 'normal',
    animation: 'fade',
};

/** One-click styled text presets. */
const TEXT_PRESETS: Array<{ name: string; sample: React.CSSProperties; overrides: Partial<OverlayDefaults> }> = [
    {
        name: 'Title',
        sample: { fontWeight: 800, fontSize: 15 },
        overrides: { text: 'Big headline', fontSize: 72, fontWeight: '900', y: 0.42, animation: 'pop', shadowBlur: 24, shadowOffsetY: 4 },
    },
    {
        name: 'Subtitle',
        sample: { fontWeight: 500, fontSize: 12, opacity: 0.85 },
        overrides: { text: 'Supporting line', fontSize: 32, fontWeight: '500', y: 0.58, animation: 'fade', color: '#f1f5f9' },
    },
    {
        name: 'Caption',
        sample: { fontWeight: 500, fontSize: 10, opacity: 0.7 },
        overrides: { text: 'Caption text', fontSize: 22, fontWeight: '500', y: 0.9, animation: 'slide-up' },
    },
    {
        name: 'Lower third',
        sample: { fontWeight: 600, fontSize: 11, background: 'rgba(0,0,0,0.75)', padding: '2px 6px', borderRadius: 4 },
        overrides: {
            text: 'Name · Role',
            fontSize: 28,
            fontWeight: '600',
            x: 0.18,
            y: 0.85,
            textAlign: 'left',
            backgroundColor: 'rgba(15,23,42,0.85)',
            padding: 14,
            borderRadius: 8,
            animation: 'slide-right',
        },
    },
    {
        name: 'Pill badge',
        sample: { fontWeight: 700, fontSize: 10, background: '#e8506e', color: '#fff', padding: '2px 8px', borderRadius: 999 },
        overrides: {
            text: 'NEW',
            fontSize: 24,
            fontWeight: '900',
            x: 0.85,
            y: 0.1,
            backgroundColor: '#e8506e',
            padding: 12,
            borderRadius: 999,
            letterSpacing: 2,
            textTransform: 'uppercase',
            animation: 'pop',
        },
    },
    {
        name: 'Gradient',
        sample: {
            fontWeight: 800,
            fontSize: 13,
            background: 'linear-gradient(45deg,#ff9a5a,#e8506e)',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
        },
        overrides: {
            text: 'Gradient headline',
            fontSize: 64,
            fontWeight: '900',
            gradient: { enabled: true, colors: ['#ff9a5a', '#e8506e'], angle: 45 },
            animation: 'blur-in',
        },
    },
];

function formatTime(time: number) {
    if (!isFinite(time) || time < 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

interface TextPanelProps {
    selectedLayerId?: string | null;
    onSelectLayer?: (id: string | null) => void;
}

export function TextPanel({ selectedLayerId: controlledId, onSelectLayer }: TextPanelProps = {}) {
    const { textOverlays, playback, video } = useEditorState();
    const [internalId, setInternalId] = React.useState<string | null>(null);
    const selectedLayerId = controlledId !== undefined ? controlledId : internalId;
    const selectLayer = (id: string | null) => {
        if (onSelectLayer) onSelectLayer(id);
        else setInternalId(id);
    };

    const addOverlay = (overrides: Partial<OverlayDefaults> = {}) => {
        const start = playback.currentTime;
        const overlay: TextOverlay = {
            ...BASE_OVERLAY,
            ...overrides,
            id: generateId('text'),
            startTime: Math.round(start * 10) / 10,
            endTime: Math.round(Math.min(start + 3, video.duration || start + 3) * 10) / 10,
        };
        editorStore.addTextOverlay(overlay);
        selectLayer(overlay.id);
    };

    const update = (id: string, updates: Partial<TextOverlay>) => editorStore.updateTextOverlay(id, updates);

    const duplicate = (overlay: TextOverlay) => {
        const copy: TextOverlay = {
            ...overlay,
            id: generateId('text'),
            x: Math.min(0.95, overlay.x + 0.04),
            y: Math.min(0.95, overlay.y + 0.04),
        };
        editorStore.addTextOverlay(copy);
        selectLayer(copy.id);
    };

    return (
        <div className="flex h-full flex-col">
            {/* ---- Presets ---- */}
            <div className="space-y-2 border-b border-border/40 p-4">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <Type className="h-3.5 w-3.5 text-primary" />
                        Add text
                    </Label>
                    <Button size="sm" variant="outline" onClick={() => addOverlay()} className="h-7 text-xs">
                        <Plus className="mr-1 h-3 w-3" />
                        Blank
                    </Button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    {TEXT_PRESETS.map((preset) => (
                        <button
                            key={preset.name}
                            className="group flex h-14 flex-col items-center justify-center gap-1 rounded-lg border border-border/50 bg-background/50 transition-all hover:border-primary/50 hover:shadow-sm"
                            onClick={() => addOverlay(preset.overrides)}
                            title={`Add a ${preset.name.toLowerCase()} at the playhead`}
                        >
                            <span style={preset.sample} className="max-w-full truncate px-1 leading-none">
                                {preset.name === 'Pill badge' ? 'NEW' : 'Aa'}
                            </span>
                            <span className="text-[9px] text-muted-foreground group-hover:text-foreground">{preset.name}</span>
                        </button>
                    ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                    Text is added at the playhead ({formatTime(playback.currentTime)}) and shows for 3s — adjust below.
                </p>
            </div>

            {/* ---- Layer list & editor ---- */}
            <div className="flex-1 overflow-y-auto p-4 pb-16">
                {textOverlays.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center opacity-70">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            <Type className="h-6 w-6 text-primary" />
                        </div>
                        <p className="max-w-[220px] text-xs text-muted-foreground">
                            No text layers yet. Pick a preset above to add a styled title, caption or badge.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {textOverlays.map((overlay) => {
                            const isSelected = selectedLayerId === overlay.id;
                            return (
                                <div
                                    key={overlay.id}
                                    className={cn(
                                        'rounded-xl border transition-all',
                                        isSelected
                                            ? 'border-primary/40 bg-card/60 shadow-md ring-1 ring-primary/20'
                                            : 'border-border/40 bg-card/40 hover:border-border/70'
                                    )}
                                >
                                    {/* Header */}
                                    <div
                                        className="flex cursor-pointer items-center gap-2 rounded-t-xl px-3 py-2.5 transition-colors hover:bg-muted/20"
                                        onClick={() => selectLayer(isSelected ? null : overlay.id)}
                                    >
                                        <div
                                            className={cn(
                                                'flex h-6 w-6 shrink-0 items-center justify-center rounded',
                                                isSelected ? 'bg-primary/20' : 'bg-primary/10'
                                            )}
                                        >
                                            <Type className={cn('h-3.5 w-3.5', isSelected ? 'text-primary' : 'text-primary/70')} />
                                        </div>
                                        <span className="flex-1 truncate text-sm font-medium">{overlay.text || 'Untitled'}</span>
                                        <button
                                            className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-primary"
                                            title="Jump to this layer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                editorStore.setPlayback({ currentTime: overlay.startTime });
                                            }}
                                        >
                                            {formatTime(overlay.startTime)}–{formatTime(overlay.endTime)}
                                        </button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                            title="Duplicate layer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                duplicate(overlay);
                                            }}
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                editorStore.deleteTextOverlay(overlay.id);
                                                if (selectedLayerId === overlay.id) selectLayer(null);
                                            }}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>

                                    {/* Editor */}
                                    {isSelected && (
                                        <div className="space-y-4 border-t border-border/10 p-3 animate-in fade-in slide-in-from-top-2">
                                            <Textarea
                                                value={overlay.text}
                                                onChange={(e) => update(overlay.id, { text: e.target.value })}
                                                className="h-16 resize-none border-border/40 bg-background/50 text-sm focus:bg-background"
                                                placeholder="Enter text…"
                                            />

                                            <Tabs defaultValue="style" className="w-full">
                                                <TabsList className="grid h-8 w-full grid-cols-4 rounded-lg border border-border/10 bg-background/40 p-0.5">
                                                    <TabsTrigger value="style" className="h-7 px-1 text-[10px] data-[state=active]:bg-background/80 data-[state=active]:shadow-sm">
                                                        <Type className="mr-1 h-3 w-3" /> Style
                                                    </TabsTrigger>
                                                    <TabsTrigger value="box" className="h-7 px-1 text-[10px] data-[state=active]:bg-background/80 data-[state=active]:shadow-sm">
                                                        <Box className="mr-1 h-3 w-3" /> Box
                                                    </TabsTrigger>
                                                    <TabsTrigger value="pos" className="h-7 px-1 text-[10px] data-[state=active]:bg-background/80 data-[state=active]:shadow-sm">
                                                        <Move className="mr-1 h-3 w-3" /> Layout
                                                    </TabsTrigger>
                                                    <TabsTrigger value="anim" className="h-7 px-1 text-[10px] data-[state=active]:bg-background/80 data-[state=active]:shadow-sm">
                                                        <Play className="mr-1 h-3 w-3" /> Timing
                                                    </TabsTrigger>
                                                </TabsList>

                                                {/* STYLE */}
                                                <TabsContent value="style" className="space-y-3 pt-3 animate-in fade-in">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">Font</Label>
                                                            <Select value={overlay.fontFamily} onValueChange={(v) => update(overlay.id, { fontFamily: v })}>
                                                                <SelectTrigger className="h-8 bg-background/50 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {FONT_FAMILIES.map((f) => (
                                                                        <SelectItem key={f.value} value={f.value} className="text-xs" style={{ fontFamily: f.value }}>
                                                                            {f.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">Weight</Label>
                                                            <div className="flex gap-1">
                                                                <Select value={overlay.fontWeight} onValueChange={(v) => update(overlay.id, { fontWeight: v })}>
                                                                    <SelectTrigger className="h-8 flex-1 bg-background/50 text-xs">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {FONT_WEIGHTS.map((w) => (
                                                                            <SelectItem key={w.value} value={w.value} className="text-xs">
                                                                                {w.label}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <Button
                                                                    variant={overlay.fontStyle === 'italic' ? 'default' : 'outline'}
                                                                    size="icon"
                                                                    className="h-8 w-8 shrink-0"
                                                                    title="Italic"
                                                                    onClick={() =>
                                                                        update(overlay.id, { fontStyle: overlay.fontStyle === 'italic' ? 'normal' : 'italic' })
                                                                    }
                                                                >
                                                                    <Italic className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-end gap-3">
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-[10px] uppercase text-muted-foreground">Size</Label>
                                                                <span className="rounded bg-background/40 px-1 font-mono text-[10px]">{overlay.fontSize}px</span>
                                                            </div>
                                                            <Slider
                                                                value={[overlay.fontSize]}
                                                                min={10}
                                                                max={160}
                                                                step={1}
                                                                onValueChange={([v]) => update(overlay.id, { fontSize: v })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">Color</Label>
                                                            <div className="relative h-8 w-10 shrink-0 overflow-hidden rounded-md border border-border/50 shadow-sm">
                                                                <input
                                                                    type="color"
                                                                    className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                                                                    value={overlay.color}
                                                                    onChange={(e) => update(overlay.id, { color: e.target.value })}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        <ToggleGroup
                                                            type="single"
                                                            value={overlay.textAlign}
                                                            onValueChange={(v: 'left' | 'center' | 'right') => v && update(overlay.id, { textAlign: v })}
                                                            className="justify-start rounded-md border border-border/30 bg-background/50 p-0.5"
                                                        >
                                                            <ToggleGroupItem value="left" size="sm" className="h-6 px-2"><AlignLeft className="h-3 w-3" /></ToggleGroupItem>
                                                            <ToggleGroupItem value="center" size="sm" className="h-6 px-2"><AlignCenter className="h-3 w-3" /></ToggleGroupItem>
                                                            <ToggleGroupItem value="right" size="sm" className="h-6 px-2"><AlignRight className="h-3 w-3" /></ToggleGroupItem>
                                                        </ToggleGroup>
                                                        <ToggleGroup
                                                            type="single"
                                                            value={overlay.textTransform || 'none'}
                                                            onValueChange={(v: 'none' | 'uppercase' | 'lowercase' | 'capitalize') => v && update(overlay.id, { textTransform: v })}
                                                            className="justify-start rounded-md border border-border/30 bg-background/50 p-0.5"
                                                        >
                                                            <ToggleGroupItem value="none" size="sm" className="h-6 px-2 text-[10px]">Aa</ToggleGroupItem>
                                                            <ToggleGroupItem value="uppercase" size="sm" className="h-6 px-2 text-[10px]">AA</ToggleGroupItem>
                                                            <ToggleGroupItem value="lowercase" size="sm" className="h-6 px-2 text-[10px]">aa</ToggleGroupItem>
                                                            <ToggleGroupItem value="capitalize" size="sm" className="h-6 px-2 text-[10px]">Ab</ToggleGroupItem>
                                                        </ToggleGroup>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-[10px] uppercase text-muted-foreground">Spacing</Label>
                                                                <span className="font-mono text-[10px] text-muted-foreground">{overlay.letterSpacing}px</span>
                                                            </div>
                                                            <Slider
                                                                value={[overlay.letterSpacing]}
                                                                min={-2}
                                                                max={16}
                                                                step={0.5}
                                                                onValueChange={([v]) => update(overlay.id, { letterSpacing: v })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-[10px] uppercase text-muted-foreground">Line height</Label>
                                                                <span className="font-mono text-[10px] text-muted-foreground">{overlay.lineHeight.toFixed(1)}</span>
                                                            </div>
                                                            <Slider
                                                                value={[overlay.lineHeight]}
                                                                min={0.8}
                                                                max={2.5}
                                                                step={0.1}
                                                                onValueChange={([v]) => update(overlay.id, { lineHeight: v })}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Gradient text */}
                                                    <div className="space-y-2 rounded-lg border border-border/30 bg-muted/20 p-2.5">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-xs font-medium">Gradient text</Label>
                                                            <Switch
                                                                checked={overlay.gradient?.enabled || false}
                                                                onCheckedChange={(c) =>
                                                                    update(overlay.id, {
                                                                        gradient: { ...(overlay.gradient || { colors: ['#ff9a5a', '#e8506e'], angle: 45 }), enabled: c },
                                                                    })
                                                                }
                                                            />
                                                        </div>
                                                        {overlay.gradient?.enabled && (
                                                            <div className="flex items-center gap-2 animate-in fade-in">
                                                                {[0, 1].map((i) => (
                                                                    <div key={i} className="relative h-6 flex-1 overflow-hidden rounded border border-border/50">
                                                                        <input
                                                                            type="color"
                                                                            className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                                                                            value={overlay.gradient!.colors[i] ?? '#ffffff'}
                                                                            onChange={(e) => {
                                                                                const colors = [...overlay.gradient!.colors];
                                                                                colors[i] = e.target.value;
                                                                                update(overlay.id, { gradient: { ...overlay.gradient!, colors } });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                ))}
                                                                <div className="flex flex-[2] items-center gap-1.5">
                                                                    <span className="text-[10px] text-muted-foreground">Angle</span>
                                                                    <Slider
                                                                        value={[overlay.gradient!.angle]}
                                                                        min={0}
                                                                        max={360}
                                                                        step={5}
                                                                        onValueChange={([v]) => update(overlay.id, { gradient: { ...overlay.gradient!, angle: v } })}
                                                                        className="flex-1"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TabsContent>

                                                {/* BOX */}
                                                <TabsContent value="box" className="space-y-3 pt-3 animate-in fade-in">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">Background</Label>
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-border/50">
                                                                    <input
                                                                        type="color"
                                                                        value={overlay.backgroundColor === 'transparent' ? '#0f172a' : overlay.backgroundColor}
                                                                        onChange={(e) => update(overlay.id, { backgroundColor: e.target.value })}
                                                                        className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                                                                    />
                                                                </div>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 flex-1 border-border/40 text-xs"
                                                                    onClick={() => update(overlay.id, { backgroundColor: 'transparent' })}
                                                                >
                                                                    None
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">Blend</Label>
                                                            <Select value={overlay.blendMode || 'normal'} onValueChange={(v: TextOverlay['blendMode']) => update(overlay.id, { blendMode: v })}>
                                                                <SelectTrigger className="h-7 bg-background/50 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {(['normal', 'overlay', 'screen', 'multiply', 'difference', 'plus-lighter'] as const).map((m) => (
                                                                        <SelectItem key={m} value={m} className="text-xs capitalize">{m}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>

                                                    {(
                                                        [
                                                            { key: 'padding', label: 'Padding', min: 0, max: 60, step: 1 },
                                                            { key: 'borderRadius', label: 'Corner radius', min: 0, max: 60, step: 1 },
                                                            { key: 'backdropBlur', label: 'Backdrop blur', min: 0, max: 40, step: 1 },
                                                        ] as const
                                                    ).map(({ key, label, min, max, step }) => (
                                                        <div key={key} className="space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
                                                                <span className="font-mono text-[10px] text-muted-foreground">{(overlay[key] as number) || 0}px</span>
                                                            </div>
                                                            <Slider
                                                                value={[(overlay[key] as number) || 0]}
                                                                min={min}
                                                                max={max}
                                                                step={step}
                                                                onValueChange={([v]) => update(overlay.id, { [key]: v } as Partial<TextOverlay>)}
                                                            />
                                                        </div>
                                                    ))}

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-[10px] uppercase text-muted-foreground">Shadow</Label>
                                                                <span className="font-mono text-[10px] text-muted-foreground">{overlay.shadowBlur}px</span>
                                                            </div>
                                                            <Slider
                                                                value={[overlay.shadowBlur]}
                                                                min={0}
                                                                max={50}
                                                                step={1}
                                                                onValueChange={([v]) =>
                                                                    update(overlay.id, { shadowBlur: v, shadowOffsetY: v > 0 ? Math.max(2, Math.round(v / 6)) : 0 })
                                                                }
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">Shadow color</Label>
                                                            <div className="relative h-7 w-full overflow-hidden rounded border border-border/50">
                                                                <input
                                                                    type="color"
                                                                    value={/^#([0-9a-f]{6})$/i.test(overlay.shadowColor) ? overlay.shadowColor : '#000000'}
                                                                    onChange={(e) => update(overlay.id, { shadowColor: e.target.value })}
                                                                    className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TabsContent>

                                                {/* LAYOUT */}
                                                <TabsContent value="pos" className="space-y-3 pt-3 animate-in fade-in">
                                                    {/* Position grid — quick anchor placement */}
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] uppercase text-muted-foreground">Quick position</Label>
                                                        <div className="grid grid-cols-3 gap-1">
                                                            {[
                                                                [0.15, 0.12], [0.5, 0.12], [0.85, 0.12],
                                                                [0.15, 0.5], [0.5, 0.5], [0.85, 0.5],
                                                                [0.15, 0.88], [0.5, 0.88], [0.85, 0.88],
                                                            ].map(([x, y], i) => {
                                                                const active = Math.abs(overlay.x - x) < 0.08 && Math.abs(overlay.y - y) < 0.08;
                                                                return (
                                                                    <button
                                                                        key={i}
                                                                        className={cn(
                                                                            'flex h-8 items-center justify-center rounded border transition-all',
                                                                            active
                                                                                ? 'border-primary bg-primary/10'
                                                                                : 'border-border/40 bg-background/40 hover:border-border'
                                                                        )}
                                                                        onClick={() => update(overlay.id, { x, y })}
                                                                    >
                                                                        <div className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-primary' : 'bg-muted-foreground/40')} />
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {(
                                                        [
                                                            { key: 'x', label: 'Horizontal', min: 0, max: 1, step: 0.01, format: (v: number) => `${Math.round(v * 100)}%` },
                                                            { key: 'y', label: 'Vertical', min: 0, max: 1, step: 0.01, format: (v: number) => `${Math.round(v * 100)}%` },
                                                            { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.05, format: (v: number) => `${Math.round(v * 100)}%` },
                                                            { key: 'scale', label: 'Scale', min: 0.2, max: 3, step: 0.05, format: (v: number) => `${v.toFixed(2)}x` },
                                                            { key: 'rotation', label: 'Rotation', min: -45, max: 45, step: 1, format: (v: number) => `${v}°` },
                                                        ] as const
                                                    ).map(({ key, label, min, max, step, format }) => (
                                                        <div key={key} className="space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
                                                                <span className="font-mono text-[10px] text-muted-foreground">{format(overlay[key] as number)}</span>
                                                            </div>
                                                            <Slider
                                                                value={[overlay[key] as number]}
                                                                min={min}
                                                                max={max}
                                                                step={step}
                                                                onValueChange={([v]) => update(overlay.id, { [key]: v } as Partial<TextOverlay>)}
                                                            />
                                                        </div>
                                                    ))}
                                                </TabsContent>

                                                {/* TIMING */}
                                                <TabsContent value="anim" className="space-y-3 pt-3 animate-in fade-in">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] uppercase text-muted-foreground">Entry animation</Label>
                                                        <Select value={overlay.animation} onValueChange={(v: TextOverlay['animation']) => update(overlay.id, { animation: v })}>
                                                            <SelectTrigger className="h-8 bg-background/50 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {ANIMATION_TYPES.map((a) => (
                                                                    <SelectItem key={a.value} value={a.value} className="text-xs">
                                                                        {a.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="space-y-2 rounded-lg border border-border/30 bg-secondary/20 p-2.5">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {(
                                                                [
                                                                    { key: 'startTime', label: 'Start' },
                                                                    { key: 'endTime', label: 'End' },
                                                                ] as const
                                                            ).map(({ key, label }) => (
                                                                <div key={key} className="space-y-1">
                                                                    <span className="text-[10px] uppercase text-muted-foreground">{label} (s)</span>
                                                                    <div className="flex gap-1">
                                                                        <Input
                                                                            type="number"
                                                                            step={0.1}
                                                                            min={0}
                                                                            value={overlay[key]}
                                                                            onChange={(e) => {
                                                                                const v = Number(e.target.value);
                                                                                if (!isFinite(v)) return;
                                                                                update(overlay.id, { [key]: Math.max(0, v) } as Partial<TextOverlay>);
                                                                            }}
                                                                            className="h-7 bg-background/50 text-xs"
                                                                        />
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7"
                                                                            title="Set to playhead"
                                                                            onClick={() => update(overlay.id, { [key]: Math.round(playback.currentTime * 10) / 10 } as Partial<TextOverlay>)}
                                                                        >
                                                                            <Crosshair className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                            <Clock className="h-3 w-3" />
                                                            Shows for {Math.max(0, overlay.endTime - overlay.startTime).toFixed(1)}s — drag the green block on the timeline to move it.
                                                        </p>
                                                    </div>
                                                </TabsContent>
                                            </Tabs>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
