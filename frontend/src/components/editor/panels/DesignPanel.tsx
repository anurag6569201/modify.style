import React, { useRef } from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AspectRatioPreset, PresentationConfig } from '@/lib/editor/types';
import {
    Smartphone,
    Monitor,
    Square,
    Layout,
    Palette,
    Frame,
    Upload,
    X,
    Sparkles,
    RectangleHorizontal,
    Clapperboard,
} from 'lucide-react';
import { calculateOutputDimensions } from '@/lib/composition/aspectRatio';
import { cn } from '@/lib/utils';

const ASPECT_RATIOS: { label: string; value: AspectRatioPreset; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
    { label: 'Auto', value: 'native', icon: Clapperboard, hint: 'Match recording' },
    { label: '16:9', value: '16:9', icon: Monitor, hint: 'YouTube, web' },
    { label: '9:16', value: '9:16', icon: Smartphone, hint: 'Reels, Shorts' },
    { label: '1:1', value: '1:1', icon: Square, hint: 'Feed posts' },
    { label: '4:3', value: '4:3', icon: RectangleHorizontal, hint: 'Classic' },
    { label: '21:9', value: '21:9', icon: RectangleHorizontal, hint: 'Cinematic' },
];

/** Curated gradient wallpapers — clicking one switches to gradient mode. */
const WALLPAPERS: Array<{ name: string; angle: number; stops: Array<{ color: string; position: number }> }> = [
    { name: 'Sunset', angle: 135, stops: [{ color: '#ff9a5a', position: 0 }, { color: '#e8506e', position: 1 }] },
    { name: 'Dusk', angle: 135, stops: [{ color: '#667eea', position: 0 }, { color: '#764ba2', position: 1 }] },
    { name: 'Ocean', angle: 160, stops: [{ color: '#0ea5e9', position: 0 }, { color: '#1e3a8a', position: 1 }] },
    { name: 'Aurora', angle: 120, stops: [{ color: '#34d399', position: 0 }, { color: '#0891b2', position: 0.55 }, { color: '#312e81', position: 1 }] },
    { name: 'Peach', angle: 135, stops: [{ color: '#fcd9c4', position: 0 }, { color: '#f7a99b', position: 1 }] },
    { name: 'Candy', angle: 135, stops: [{ color: '#f472b6', position: 0 }, { color: '#8b5cf6', position: 1 }] },
    { name: 'Ember', angle: 150, stops: [{ color: '#f97316', position: 0 }, { color: '#7c2d12', position: 1 }] },
    { name: 'Slate', angle: 135, stops: [{ color: '#334155', position: 0 }, { color: '#0f172a', position: 1 }] },
    { name: 'Mist', angle: 135, stops: [{ color: '#e2e8f0', position: 0 }, { color: '#94a3b8', position: 1 }] },
    { name: 'Lime', angle: 135, stops: [{ color: '#a3e635', position: 0 }, { color: '#166534', position: 1 }] },
    { name: 'Noir', angle: 135, stops: [{ color: '#27272a', position: 0 }, { color: '#09090b', position: 1 }] },
    { name: 'Royal', angle: 135, stops: [{ color: '#fbbf24', position: 0 }, { color: '#92400e', position: 1 }] },
];

const SOLID_SWATCHES = ['#000000', '#0f172a', '#1e293b', '#ffffff', '#f5f0ea', '#e8506e', '#0ea5e9', '#22c55e', '#f59e0b', '#8b5cf6'];

/** One-click looks: background + frame + shadow + padding, tuned to work together. */
const LOOKS: Array<{
    name: string;
    preview: string; // CSS background for the swatch
    apply: (p: PresentationConfig) => Partial<PresentationConfig>;
}> = [
    {
        name: 'Clean studio',
        preview: 'linear-gradient(135deg,#e2e8f0,#94a3b8)',
        apply: () => ({
            backgroundMode: 'gradient',
            backgroundGradient: { type: 'linear', angle: 135, stops: [{ color: '#e2e8f0', position: 0 }, { color: '#94a3b8', position: 1 }] },
            backgroundBlur: 0,
            videoPadding: { enabled: true, top: 56, right: 56, bottom: 56, left: 56, uniform: true },
            videoCrop: { enabled: false, top: 0, bottom: 0, left: 0, right: 0, roundedCorners: true, cornerRadius: 14 },
            videoStyle: { borderEnabled: false, borderColor: '#ffffff', borderWidth: 0, shadowEnabled: true, shadowColor: 'rgba(15,23,42,0.45)', shadowBlur: 48, shadowOffsetX: 0, shadowOffsetY: 18, rotation: 0 },
        }),
    },
    {
        name: 'Launch day',
        preview: 'linear-gradient(135deg,#ff9a5a,#e8506e)',
        apply: () => ({
            backgroundMode: 'gradient',
            backgroundGradient: { type: 'linear', angle: 135, stops: [{ color: '#ff9a5a', position: 0 }, { color: '#e8506e', position: 1 }] },
            backgroundBlur: 0,
            videoPadding: { enabled: true, top: 64, right: 64, bottom: 64, left: 64, uniform: true },
            videoCrop: { enabled: false, top: 0, bottom: 0, left: 0, right: 0, roundedCorners: true, cornerRadius: 16 },
            videoStyle: { borderEnabled: false, borderColor: '#ffffff', borderWidth: 0, shadowEnabled: true, shadowColor: 'rgba(120,20,40,0.5)', shadowBlur: 60, shadowOffsetX: 0, shadowOffsetY: 24, rotation: 0 },
        }),
    },
    {
        name: 'Midnight',
        preview: 'linear-gradient(135deg,#27272a,#09090b)',
        apply: () => ({
            backgroundMode: 'gradient',
            backgroundGradient: { type: 'linear', angle: 135, stops: [{ color: '#27272a', position: 0 }, { color: '#09090b', position: 1 }] },
            backgroundBlur: 0,
            videoPadding: { enabled: true, top: 48, right: 48, bottom: 48, left: 48, uniform: true },
            videoCrop: { enabled: false, top: 0, bottom: 0, left: 0, right: 0, roundedCorners: true, cornerRadius: 12 },
            videoStyle: { borderEnabled: true, borderColor: 'rgba(255,255,255,0.14)', borderWidth: 1, shadowEnabled: true, shadowColor: 'rgba(99,102,241,0.35)', shadowBlur: 70, shadowOffsetX: 0, shadowOffsetY: 0, rotation: 0 },
        }),
    },
    {
        name: 'Deep focus',
        preview: 'linear-gradient(160deg,#0ea5e9,#1e3a8a)',
        apply: () => ({
            backgroundMode: 'gradient',
            backgroundGradient: { type: 'linear', angle: 160, stops: [{ color: '#0ea5e9', position: 0 }, { color: '#1e3a8a', position: 1 }] },
            backgroundBlur: 0,
            videoPadding: { enabled: true, top: 56, right: 56, bottom: 56, left: 56, uniform: true },
            videoCrop: { enabled: false, top: 0, bottom: 0, left: 0, right: 0, roundedCorners: true, cornerRadius: 14 },
            videoStyle: { borderEnabled: false, borderColor: '#ffffff', borderWidth: 0, shadowEnabled: true, shadowColor: 'rgba(2,6,23,0.6)', shadowBlur: 50, shadowOffsetX: 0, shadowOffsetY: 20, rotation: 0 },
        }),
    },
    {
        name: 'Edge to edge',
        preview: 'linear-gradient(135deg,#111,#000)',
        apply: () => ({
            backgroundMode: 'hidden',
            backgroundBlur: 0,
            videoPadding: { enabled: false, top: 0, right: 0, bottom: 0, left: 0, uniform: true },
            videoCrop: { enabled: false, top: 0, bottom: 0, left: 0, right: 0, roundedCorners: false, cornerRadius: 0 },
            videoStyle: { borderEnabled: false, borderColor: '#ffffff', borderWidth: 0, shadowEnabled: false, shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, rotation: 0 },
        }),
    },
    {
        name: 'Soft paper',
        preview: 'linear-gradient(135deg,#fcd9c4,#f7a99b)',
        apply: () => ({
            backgroundMode: 'gradient',
            backgroundGradient: { type: 'linear', angle: 135, stops: [{ color: '#fcd9c4', position: 0 }, { color: '#f7a99b', position: 1 }] },
            backgroundBlur: 0,
            videoPadding: { enabled: true, top: 72, right: 72, bottom: 72, left: 72, uniform: true },
            videoCrop: { enabled: false, top: 0, bottom: 0, left: 0, right: 0, roundedCorners: true, cornerRadius: 18 },
            videoStyle: { borderEnabled: true, borderColor: '#ffffff', borderWidth: 3, shadowEnabled: true, shadowColor: 'rgba(146,64,14,0.28)', shadowBlur: 44, shadowOffsetX: 0, shadowOffsetY: 16, rotation: 0 },
        }),
    },
];

const SHADOW_PRESETS = [
    { name: 'None', shadowEnabled: false, shadowBlur: 0, shadowOffsetY: 0, shadowColor: 'rgba(0,0,0,0.4)' },
    { name: 'Soft', shadowEnabled: true, shadowBlur: 32, shadowOffsetY: 10, shadowColor: 'rgba(0,0,0,0.35)' },
    { name: 'Deep', shadowEnabled: true, shadowBlur: 64, shadowOffsetY: 24, shadowColor: 'rgba(0,0,0,0.5)' },
    { name: 'Glow', shadowEnabled: true, shadowBlur: 70, shadowOffsetY: 0, shadowColor: 'rgba(232,80,110,0.4)' },
];

function SectionTitle({ icon: Icon, children, color }: { icon: React.ElementType; children: React.ReactNode; color?: string }) {
    return (
        <div className="flex items-center gap-2">
            <Icon className={cn('h-3.5 w-3.5', color ?? 'text-primary')} />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>
        </div>
    );
}

export function DesignPanel() {
    const { presentation, video } = useEditorState();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const updatePresentation = (updates: Partial<PresentationConfig>) => {
        editorStore.updatePresentation(updates);
    };

    const updateVideoStyle = (updates: Partial<PresentationConfig['videoStyle']>) => {
        editorStore.setState((prev) => ({
            presentation: {
                ...prev.presentation,
                videoStyle: { ...prev.presentation.videoStyle, ...updates },
            },
        }));
    };

    const updateVideoCrop = (updates: Partial<PresentationConfig['videoCrop']>) => {
        editorStore.setState((prev) => ({
            presentation: {
                ...prev.presentation,
                videoCrop: { ...prev.presentation.videoCrop, ...updates },
            },
        }));
    };

    const updateVideoPadding = (updates: Partial<PresentationConfig['videoPadding']>) => {
        editorStore.setState((prev) => ({
            presentation: {
                ...prev.presentation,
                videoPadding: { ...prev.presentation.videoPadding, ...updates },
            },
        }));
    };

    const outputDims = calculateOutputDimensions(
        presentation.aspectRatio,
        video.width,
        video.height,
        presentation.customAspectRatio
    );

    const handleAspectRatioChange = (value: AspectRatioPreset) => {
        const newDims = calculateOutputDimensions(value, video.width, video.height, presentation.customAspectRatio);
        updatePresentation({ aspectRatio: value, outputWidth: newDims.width, outputHeight: newDims.height });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            updatePresentation({ backgroundImage: event.target?.result as string, backgroundMode: 'image' });
        };
        reader.readAsDataURL(file);
    };

    const gradientCss = (angle: number, stops: Array<{ color: string; position: number }>) =>
        `linear-gradient(${angle}deg, ${stops.map((s) => `${s.color} ${Math.round(s.position * 100)}%`).join(', ')})`;

    const activeWallpaper =
        presentation.backgroundMode === 'gradient'
            ? WALLPAPERS.findIndex(
                  (w) => JSON.stringify(w.stops) === JSON.stringify(presentation.backgroundGradient.stops)
              )
            : -1;

    return (
        <div className="space-y-5 p-4 pb-16">
            {/* ---- One-click looks ---- */}
            <div className="space-y-2.5">
                <SectionTitle icon={Sparkles}>Looks</SectionTitle>
                <div className="grid grid-cols-3 gap-2">
                    {LOOKS.map((look) => (
                        <button
                            key={look.name}
                            className="group overflow-hidden rounded-lg border border-border/50 text-left transition-all hover:border-primary/50 hover:shadow-md"
                            onClick={() => updatePresentation(look.apply(presentation))}
                            title={`Apply the “${look.name}” look`}
                        >
                            <div className="relative h-12 w-full" style={{ background: look.preview }}>
                                <div className="absolute inset-x-3 bottom-1.5 top-3 rounded-t-sm border border-white/40 bg-black/30 shadow-lg transition-transform group-hover:-translate-y-0.5" />
                            </div>
                            <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground group-hover:text-foreground">
                                {look.name}
                            </div>
                        </button>
                    ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                    Starting points — everything below stays fully adjustable.
                </p>
            </div>

            {/* ---- Canvas ---- */}
            <div className="space-y-2.5 border-t border-border/40 pt-4">
                <div className="flex items-center justify-between">
                    <SectionTitle icon={Layout}>Canvas</SectionTitle>
                    <span className="font-mono text-[10px] text-muted-foreground">
                        {Math.round(outputDims.width)}×{Math.round(outputDims.height)}
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    {ASPECT_RATIOS.map(({ label, value, icon: Icon, hint }) => (
                        <button
                            key={value}
                            title={hint}
                            className={cn(
                                'flex h-10 flex-col items-center justify-center gap-0.5 rounded-md border text-[10px] font-medium transition-all',
                                presentation.aspectRatio === value
                                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                    : 'border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground'
                            )}
                            onClick={() => handleAspectRatioChange(value)}
                        >
                            <Icon className="h-3 w-3" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ---- Background ---- */}
            <div className="space-y-3 border-t border-border/40 pt-4">
                <SectionTitle icon={Palette} color="text-pink-500">Background</SectionTitle>

                {/* Wallpapers */}
                <div className="grid grid-cols-6 gap-1.5">
                    {WALLPAPERS.map((wp, i) => (
                        <button
                            key={wp.name}
                            title={wp.name}
                            className={cn(
                                'h-9 rounded-md border-2 transition-all hover:scale-105',
                                activeWallpaper === i && presentation.backgroundMode === 'gradient'
                                    ? 'border-primary shadow-md'
                                    : 'border-transparent hover:border-border'
                            )}
                            style={{ background: gradientCss(wp.angle, wp.stops) }}
                            onClick={() =>
                                updatePresentation({
                                    backgroundMode: 'gradient',
                                    backgroundGradient: { type: 'linear', angle: wp.angle, stops: wp.stops },
                                })
                            }
                        />
                    ))}
                </div>

                {/* Solid swatches + custom + image + none */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {SOLID_SWATCHES.map((color) => (
                        <button
                            key={color}
                            title={color}
                            className={cn(
                                'h-7 w-7 rounded-md border-2 transition-all hover:scale-110',
                                presentation.backgroundMode === 'solid' && presentation.backgroundColor === color
                                    ? 'border-primary shadow-md'
                                    : 'border-border/40'
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => updatePresentation({ backgroundMode: 'solid', backgroundColor: color })}
                        />
                    ))}
                    <div className="relative h-7 w-7 overflow-hidden rounded-md border-2 border-dashed border-border/60" title="Custom color">
                        <input
                            type="color"
                            className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                            value={presentation.backgroundColor}
                            onChange={(e) => updatePresentation({ backgroundMode: 'solid', backgroundColor: e.target.value })}
                        />
                    </div>
                    <button
                        className={cn(
                            'flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-all',
                            presentation.backgroundMode === 'image'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border/50 text-muted-foreground hover:text-foreground'
                        )}
                        onClick={() => fileInputRef.current?.click()}
                        title="Upload a background image"
                    >
                        <Upload className="h-3 w-3" />
                        Image
                    </button>
                    <button
                        className={cn(
                            'flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-all',
                            presentation.backgroundMode === 'hidden'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border/50 text-muted-foreground hover:text-foreground'
                        )}
                        onClick={() => updatePresentation({ backgroundMode: 'hidden' })}
                        title="No background — video fills the canvas"
                    >
                        <X className="h-3 w-3" />
                        None
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </div>

                {presentation.backgroundMode === 'image' && presentation.backgroundImage && (
                    <div className="relative h-20 w-full overflow-hidden rounded-md border border-border/50">
                        <img src={presentation.backgroundImage} alt="Background" className="h-full w-full object-cover" />
                        <Button
                            size="icon"
                            variant="destructive"
                            className="absolute right-1 top-1 h-6 w-6"
                            onClick={() => updatePresentation({ backgroundImage: undefined, backgroundMode: 'gradient' })}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                )}

                {/* Gradient angle — only when gradient is active */}
                {presentation.backgroundMode === 'gradient' && presentation.backgroundGradient.type === 'linear' && (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] uppercase text-muted-foreground">Angle</Label>
                            <span className="font-mono text-[10px] text-muted-foreground">
                                {presentation.backgroundGradient.angle ?? 135}°
                            </span>
                        </div>
                        <Slider
                            min={0}
                            max={360}
                            step={5}
                            value={[presentation.backgroundGradient.angle ?? 135]}
                            onValueChange={([val]) =>
                                updatePresentation({
                                    backgroundGradient: { ...presentation.backgroundGradient, angle: val },
                                })
                            }
                        />
                    </div>
                )}

                {presentation.backgroundMode !== 'hidden' && (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] uppercase text-muted-foreground">Blur</Label>
                            <span className="font-mono text-[10px] text-muted-foreground">{presentation.backgroundBlur}px</span>
                        </div>
                        <Slider
                            min={0}
                            max={100}
                            step={1}
                            value={[presentation.backgroundBlur]}
                            onValueChange={([val]) => updatePresentation({ backgroundBlur: val })}
                        />
                    </div>
                )}
            </div>

            {/* ---- Frame ---- */}
            <div className="space-y-3 border-t border-border/40 pt-4">
                <SectionTitle icon={Frame} color="text-blue-500">Frame</SectionTitle>

                {/* Padding */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground">Margin around video</Label>
                        <span className="font-mono text-[10px] text-muted-foreground">
                            {presentation.videoPadding.enabled ? `${presentation.videoPadding.top}px` : 'off'}
                        </span>
                    </div>
                    <Slider
                        min={0}
                        max={200}
                        step={2}
                        value={[presentation.videoPadding.enabled ? presentation.videoPadding.top : 0]}
                        onValueChange={([val]) =>
                            updateVideoPadding({
                                enabled: val > 0,
                                top: val,
                                bottom: val,
                                left: val,
                                right: val,
                                uniform: true,
                            })
                        }
                    />
                </div>

                {/* Corner radius */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground">Corner radius</Label>
                        <span className="font-mono text-[10px] text-muted-foreground">
                            {presentation.videoCrop.roundedCorners ? `${presentation.videoCrop.cornerRadius}px` : '0px'}
                        </span>
                    </div>
                    <Slider
                        min={0}
                        max={60}
                        step={1}
                        value={[presentation.videoCrop.roundedCorners ? presentation.videoCrop.cornerRadius : 0]}
                        onValueChange={([val]) => updateVideoCrop({ roundedCorners: val > 0, cornerRadius: val })}
                    />
                </div>

                {/* Shadow presets */}
                <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-muted-foreground">Shadow</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                        {SHADOW_PRESETS.map((preset) => {
                            const isActive =
                                presentation.videoStyle.shadowEnabled === preset.shadowEnabled &&
                                (!preset.shadowEnabled ||
                                    (presentation.videoStyle.shadowBlur === preset.shadowBlur &&
                                        presentation.videoStyle.shadowOffsetY === preset.shadowOffsetY));
                            return (
                                <button
                                    key={preset.name}
                                    className={cn(
                                        'h-8 rounded-md border text-[10px] font-medium transition-all',
                                        isActive
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground'
                                    )}
                                    onClick={() =>
                                        updateVideoStyle({
                                            shadowEnabled: preset.shadowEnabled,
                                            shadowBlur: preset.shadowBlur,
                                            shadowOffsetY: preset.shadowOffsetY,
                                            shadowOffsetX: 0,
                                            shadowColor: preset.shadowColor,
                                        })
                                    }
                                >
                                    {preset.name}
                                </button>
                            );
                        })}
                    </div>
                    {presentation.videoStyle.shadowEnabled && (
                        <div className="flex items-center gap-2 pt-1">
                            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border/50" title="Shadow color">
                                <input
                                    type="color"
                                    className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                                    value={/^#([0-9a-f]{6})$/i.test(presentation.videoStyle.shadowColor) ? presentation.videoStyle.shadowColor : '#000000'}
                                    onChange={(e) => updateVideoStyle({ shadowColor: e.target.value })}
                                />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] text-muted-foreground">Softness</Label>
                                    <span className="font-mono text-[10px] text-muted-foreground">{presentation.videoStyle.shadowBlur}px</span>
                                </div>
                                <Slider
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={[presentation.videoStyle.shadowBlur]}
                                    onValueChange={([val]) => updateVideoStyle({ shadowBlur: val })}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Border */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground">Border</Label>
                        <Switch
                            checked={presentation.videoStyle.borderEnabled}
                            onCheckedChange={(c) => updateVideoStyle({ borderEnabled: c })}
                        />
                    </div>
                    {presentation.videoStyle.borderEnabled && (
                        <div className="flex items-center gap-2">
                            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border/50" title="Border color">
                                <input
                                    type="color"
                                    className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                                    value={/^#([0-9a-f]{6})$/i.test(presentation.videoStyle.borderColor) ? presentation.videoStyle.borderColor : '#ffffff'}
                                    onChange={(e) => updateVideoStyle({ borderColor: e.target.value })}
                                />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] text-muted-foreground">Width</Label>
                                    <span className="font-mono text-[10px] text-muted-foreground">{presentation.videoStyle.borderWidth}px</span>
                                </div>
                                <Slider
                                    min={1}
                                    max={24}
                                    step={1}
                                    value={[presentation.videoStyle.borderWidth]}
                                    onValueChange={([val]) => updateVideoStyle({ borderWidth: val })}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Rotation + DPR (advanced) */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] uppercase text-muted-foreground">Tilt</Label>
                            <span className="font-mono text-[10px] text-muted-foreground">{presentation.videoStyle.rotation}°</span>
                        </div>
                        <Slider
                            min={-15}
                            max={15}
                            step={0.5}
                            value={[presentation.videoStyle.rotation]}
                            onValueChange={([val]) => updateVideoStyle({ rotation: val })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] uppercase text-muted-foreground">Render quality</Label>
                            <span className="font-mono text-[10px] text-muted-foreground">{presentation.screenDPR.toFixed(1)}x</span>
                        </div>
                        <Slider
                            min={0.5}
                            max={3}
                            step={0.5}
                            value={[presentation.screenDPR]}
                            onValueChange={([val]) => updatePresentation({ screenDPR: val })}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
