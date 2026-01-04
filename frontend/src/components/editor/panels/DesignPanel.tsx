
import React from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { AspectRatioPreset } from '@/lib/editor/types';
import { Palette, Layout, Smartphone, Monitor, Minimize, Square, Crop } from 'lucide-react';

const ASPECT_RATIOS: { label: string; value: AspectRatioPreset; icon: React.ComponentType<any> }[] = [
    { label: 'Native', value: 'native', icon: Monitor },
    { label: '16:9 (Landscape)', value: '16:9', icon: Monitor },
    { label: '9:16 (Portrait)', value: '9:16', icon: Smartphone },
    { label: '1:1 (Square)', value: '1:1', icon: Square },
    { label: '4:3 (Standard)', value: '4:3', icon: Monitor },
    { label: '21:9 (Ultrawide)', value: '21:9', icon: Monitor },
];

export function DesignPanel() {
    const { presentation } = useEditorState();

    const updatePresentation = (updates: Partial<typeof presentation>) => {
        editorStore.setState((prev) => ({
            presentation: { ...prev.presentation, ...updates },
        }));
    };

    const updateVideoCrop = (updates: Partial<typeof presentation.videoCrop>) => {
        editorStore.setState((prev) => ({
            presentation: {
                ...prev.presentation,
                videoCrop: { ...prev.presentation.videoCrop, ...updates },
            },
        }));
    };

    const updateVideoPadding = (updates: Partial<typeof presentation.videoPadding>) => {
        editorStore.setState((prev) => ({
            presentation: {
                ...prev.presentation,
                videoPadding: { ...prev.presentation.videoPadding, ...updates },
            },
        }));
    }

    const updateVideoStyle = (updates: Partial<typeof presentation.videoStyle>) => {
        editorStore.setState((prev) => ({
            presentation: {
                ...prev.presentation,
                videoStyle: { ...prev.presentation.videoStyle, ...updates },
            },
        }));
    };

    return (
        <div className="space-y-4 p-4 pb-20">
            <Accordion type="single" collapsible defaultValue="layout" className="w-full space-y-3">

                {/* --- LAYOUT SECTION --- */}
                <AccordionItem value="layout" className="border-none bg-card/40 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                <Layout className="h-4 w-4" />
                            </div>
                            <span className="font-semibold text-sm tracking-wide">Canvas & Layout</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2 space-y-5">
                        {/* Aspect Ratio */}
                        <div className="space-y-3">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Aspect Ratio</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {ASPECT_RATIOS.map((ratio) => (
                                    <Button
                                        key={ratio.value}
                                        variant="outline"
                                        size="sm"
                                        className={`justify-start gap-2 h-10 transition-all ${presentation.aspectRatio === ratio.value
                                                ? "bg-primary text-primary-foreground border-primary shadow-md hover:bg-primary/90"
                                                : "bg-background/50 hover:bg-background border-border/40 text-muted-foreground hover:text-foreground"
                                            }`}
                                        onClick={() => updatePresentation({ aspectRatio: ratio.value })}
                                    >
                                        <ratio.icon className="h-3.5 w-3.5" />
                                        <span className="text-xs">{ratio.label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Screen DPR */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pixel Density</Label>
                                <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border/30">{presentation.screenDPR.toFixed(1)}x</span>
                            </div>
                            <Slider
                                min={0.5}
                                max={3}
                                step={0.1}
                                value={[presentation.screenDPR]}
                                onValueChange={([value]) => updatePresentation({ screenDPR: value })}
                                className="cursor-pointer"
                            />
                        </div>

                        {/* Output Dimensions Readout */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-muted-foreground uppercase">Width</Label>
                                <div className="h-9 px-3 flex items-center bg-background/30 rounded-md border border-border/40 font-mono text-xs">
                                    {presentation.outputWidth}px
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-muted-foreground uppercase">Height</Label>
                                <div className="h-9 px-3 flex items-center bg-background/30 rounded-md border border-border/40 font-mono text-xs">
                                    {presentation.outputHeight}px
                                </div>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* --- BACKGROUND SECTION --- */}
                <AccordionItem value="background" className="border-none bg-card/40 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-500">
                                <Palette className="h-4 w-4" />
                            </div>
                            <span className="font-semibold text-sm tracking-wide">Background</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2 space-y-5">
                        {/* Mode Selection */}
                        <div className="p-1 bg-background/50 rounded-lg border border-border/40 grid grid-cols-4 gap-1">
                            {(['hidden', 'solid', 'gradient', 'image'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    className={`
                                        h-8 rounded-md text-xs font-medium transition-all duration-200 capitalize
                                        ${presentation.backgroundMode === mode
                                            ? "bg-background shadow-sm text-foreground ring-1 ring-border/50"
                                            : "text-muted-foreground hover:text-foreground hover:bg-white/5"}
                                    `}
                                    onClick={() => updatePresentation({ backgroundMode: mode })}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>

                        {presentation.backgroundMode === 'solid' && (
                            <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Color</Label>
                                <div className="flex gap-2 items-center">
                                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/50 shadow-sm transition-transform active:scale-95">
                                        <input
                                            type="color"
                                            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer border-0"
                                            value={presentation.backgroundColor}
                                            onChange={(e) => updatePresentation({ backgroundColor: e.target.value })}
                                        />
                                    </div>
                                    <Input
                                        className="h-10 font-mono text-xs bg-background/50 border-border/40"
                                        value={presentation.backgroundColor}
                                        onChange={(e) => updatePresentation({ backgroundColor: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}

                        {presentation.backgroundMode === 'gradient' && (
                            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gradient Type</Label>
                                    <Select
                                        value={presentation.backgroundGradient.type}
                                        onValueChange={(val: 'linear' | 'radial') =>
                                            updatePresentation({
                                                backgroundGradient: { ...presentation.backgroundGradient, type: val }
                                            })
                                        }
                                    >
                                        <SelectTrigger className="h-9 bg-background/50 border-border/40">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="linear">Linear</SelectItem>
                                            <SelectItem value="radial">Radial</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex gap-2">
                                    {presentation.backgroundGradient.stops.map((stop, index) => (
                                        <div key={index} className="space-y-1.5 flex-1">
                                            <Label className="text-[10px] text-muted-foreground uppercase">Stop {index + 1}</Label>
                                            <div className="relative h-8 w-full overflow-hidden rounded-md border border-border/50">
                                                <input
                                                    type="color"
                                                    className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer"
                                                    value={stop.color}
                                                    onChange={(e) => {
                                                        const newStops = [...presentation.backgroundGradient.stops];
                                                        newStops[index] = { ...stop, color: e.target.value };
                                                        updatePresentation({
                                                            backgroundGradient: { ...presentation.backgroundGradient, stops: newStops }
                                                        });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {presentation.backgroundGradient.type === 'linear' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Angle</Label>
                                            <span className="text-xs font-mono text-muted-foreground">{presentation.backgroundGradient.angle}°</span>
                                        </div>
                                        <Slider
                                            min={0}
                                            max={360}
                                            step={1}
                                            value={[presentation.backgroundGradient.angle || 135]}
                                            onValueChange={([val]) =>
                                                updatePresentation({
                                                    backgroundGradient: { ...presentation.backgroundGradient, angle: val }
                                                })
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {(presentation.backgroundMode !== 'hidden') && (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Blur</Label>
                                    <span className="text-xs font-mono text-muted-foreground">{presentation.backgroundBlur}px</span>
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
                    </AccordionContent>
                </AccordionItem>

                {/* --- VIDEO FRAME SECTION --- */}
                <AccordionItem value="frame" className="border-none bg-card/40 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                                <Crop className="h-4 w-4" />
                            </div>
                            <span className="font-semibold text-sm tracking-wide">Frame & Style</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2 space-y-6">
                        {/* --- CORNER RADIUS --- */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Corner Radius</Label>
                                <div className="flex items-center gap-3">
                                    {presentation.videoCrop.roundedCorners && (
                                        <Input
                                            type="number"
                                            className="h-6 w-12 text-xs text-center p-0 bg-background/50 border-border/40"
                                            value={presentation.videoCrop.cornerRadius}
                                            onChange={(e) => updateVideoCrop({ cornerRadius: Number(e.target.value) })}
                                        />
                                    )}
                                    <Switch
                                        checked={presentation.videoCrop.roundedCorners}
                                        onCheckedChange={(c) => updateVideoCrop({ roundedCorners: c, enabled: true })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* --- BORDER --- */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Border</Label>
                                <Switch
                                    checked={presentation.videoStyle.borderEnabled}
                                    onCheckedChange={(c) => updateVideoStyle({ borderEnabled: c })}
                                />
                            </div>
                            {presentation.videoStyle.borderEnabled && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] text-muted-foreground uppercase">Color</Label>
                                        <div className="flex gap-2">
                                            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border/50">
                                                <input
                                                    type="color"
                                                    className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer"
                                                    value={presentation.videoStyle.borderColor}
                                                    onChange={(e) => updateVideoStyle({ borderColor: e.target.value })}
                                                />
                                            </div>
                                            <Input
                                                className="flex-1 h-8 font-mono text-xs bg-background/50 border-border/40"
                                                value={presentation.videoStyle.borderColor}
                                                onChange={(e) => updateVideoStyle({ borderColor: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] text-muted-foreground uppercase">Width</Label>
                                        <Slider
                                            min={1} max={50} step={1}
                                            value={[presentation.videoStyle.borderWidth]}
                                            onValueChange={([val]) => updateVideoStyle({ borderWidth: val })}
                                            className="pt-2"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* --- SHADOW --- */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Shadow</Label>
                                <Switch
                                    checked={presentation.videoStyle.shadowEnabled}
                                    onCheckedChange={(c) => updateVideoStyle({ shadowEnabled: c })}
                                />
                            </div>
                            {presentation.videoStyle.shadowEnabled && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] text-muted-foreground uppercase">Color</Label>
                                        <div className="flex gap-2">
                                            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border/50">
                                                <input
                                                    type="color"
                                                    className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer"
                                                    value={presentation.videoStyle.shadowColor}
                                                    onChange={(e) => updateVideoStyle({ shadowColor: e.target.value })}
                                                />
                                            </div>
                                            <Input
                                                className="flex-1 h-8 font-mono text-xs bg-background/50 border-border/40"
                                                value={presentation.videoStyle.shadowColor}
                                                onChange={(e) => updateVideoStyle({ shadowColor: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] text-muted-foreground uppercase">Blur</Label>
                                            <Slider
                                                min={0} max={100} step={1}
                                                value={[presentation.videoStyle.shadowBlur]}
                                                onValueChange={([val]) => updateVideoStyle({ shadowBlur: val })}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] text-muted-foreground uppercase">Offset</Label>
                                            <Slider
                                                min={-50} max={50} step={1}
                                                value={[presentation.videoStyle.shadowOffsetY]}
                                                onValueChange={([val]) => updateVideoStyle({ shadowOffsetY: val })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* --- ROTATION --- */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rotation</Label>
                                <span className="text-xs font-mono text-muted-foreground">{presentation.videoStyle.rotation}°</span>
                            </div>
                            <Slider
                                min={-180} max={180} step={1}
                                value={[presentation.videoStyle.rotation]}
                                onValueChange={([val]) => updateVideoStyle({ rotation: val })}
                            />
                        </div>

                        {/* Container Padding */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Padding</Label>
                                <Switch
                                    checked={presentation.videoPadding.enabled}
                                    onCheckedChange={(c) => updateVideoPadding({ enabled: c })}
                                />
                            </div>

                            {presentation.videoPadding.enabled && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] text-muted-foreground uppercase">Vertical</Label>
                                        <Slider
                                            min={0}
                                            max={200}
                                            step={1}
                                            value={[presentation.videoPadding.top]}
                                            onValueChange={([val]) => updateVideoPadding({ top: val, bottom: val, uniform: true })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] text-muted-foreground uppercase">Horizontal</Label>
                                        <Slider
                                            min={0}
                                            max={200}
                                            step={1}
                                            value={[presentation.videoPadding.left]}
                                            onValueChange={([val]) => updateVideoPadding({ left: val, right: val, uniform: true })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
