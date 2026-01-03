
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
        <div className="space-y-6 p-4">
            <Accordion type="single" collapsible defaultValue="layout" className="w-full">

                {/* --- LAYOUT SECTION --- */}
                <AccordionItem value="layout" className="border-b border-border/50">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Layout className="h-4 w-4 text-primary" />
                            <span className="font-semibold">Canvas & Layout</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        {/* Aspect Ratio */}
                        <div className="space-y-2">
                            <Label>Aspect Ratio</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {ASPECT_RATIOS.map((ratio) => (
                                    <Button
                                        key={ratio.value}
                                        variant={presentation.aspectRatio === ratio.value ? "secondary" : "outline"}
                                        size="sm"
                                        className={`justify-start gap-2 h-9 ${presentation.aspectRatio === ratio.value ? "bg-primary/10 border-primary/50 text-foreground" : ""}`}
                                        onClick={() => updatePresentation({ aspectRatio: ratio.value })}
                                    >
                                        <ratio.icon className="h-3.5 w-3.5" />
                                        <span className="text-xs">{ratio.label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Screen DPR */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <Label>Pixel Density (DPR)</Label>
                                <span className="text-xs text-muted-foreground font-mono">{presentation.screenDPR.toFixed(1)}x</span>
                            </div>
                            <Slider
                                min={0.5}
                                max={3}
                                step={0.1}
                                value={[presentation.screenDPR]}
                                onValueChange={([value]) => updatePresentation({ screenDPR: value })}
                            />
                        </div>

                        {/* Output Dimensions Readout (mostly for info) */}
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Width</Label>
                                <Input
                                    readOnly
                                    className="h-8 font-mono text-xs bg-muted/50"
                                    value={`${presentation.outputWidth}px`}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Height</Label>
                                <Input
                                    readOnly
                                    className="h-8 font-mono text-xs bg-muted/50"
                                    value={`${presentation.outputHeight}px`}
                                />
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* --- BACKGROUND SECTION --- */}
                <AccordionItem value="background" className="border-b border-border/50">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Palette className="h-4 w-4 text-primary" />
                            <span className="font-semibold">Background</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        {/* Mode Selection */}
                        <div className="grid grid-cols-4 gap-1 p-1 bg-secondary/30 rounded-lg">
                            {(['hidden', 'solid', 'gradient', 'image'] as const).map((mode) => (
                                <Button
                                    key={mode}
                                    variant="ghost"
                                    size="sm"
                                    className={`h-7 text-xs capitalize ${presentation.backgroundMode === mode ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                                    onClick={() => updatePresentation({ backgroundMode: mode })}
                                >
                                    {mode}
                                </Button>
                            ))}
                        </div>

                        {presentation.backgroundMode === 'solid' && (
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        className="h-9 w-9 p-1 cursor-pointer"
                                        value={presentation.backgroundColor}
                                        onChange={(e) => updatePresentation({ backgroundColor: e.target.value })}
                                    />
                                    <Input
                                        className="flex-1 h-9 font-mono"
                                        value={presentation.backgroundColor}
                                        onChange={(e) => updatePresentation({ backgroundColor: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}

                        {presentation.backgroundMode === 'gradient' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Gradient Type</Label>
                                    <Select
                                        value={presentation.backgroundGradient.type}
                                        onValueChange={(val: 'linear' | 'radial') =>
                                            updatePresentation({
                                                backgroundGradient: { ...presentation.backgroundGradient, type: val }
                                            })
                                        }
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="linear">Linear</SelectItem>
                                            <SelectItem value="radial">Radial</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex gap-2">
                                    {presentation.backgroundGradient.stops.map((stop, index) => (
                                        <div key={index} className="space-y-1 flex-1">
                                            <Label className="text-xs">Stop {index + 1}</Label>
                                            <Input
                                                type="color"
                                                className="h-8 w-full p-1"
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
                                    ))}
                                </div>
                                {presentation.backgroundGradient.type === 'linear' && (
                                    <div className="space-y-2">
                                        <Label>Angle: {presentation.backgroundGradient.angle}°</Label>
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
                                    <Label>Blur Intensity</Label>
                                    <span className="text-xs text-muted-foreground">{presentation.backgroundBlur}px</span>
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
                <AccordionItem value="frame" className="border-b border-border/50">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Crop className="h-4 w-4 text-primary" />
                            <span className="font-semibold">Frame & Style</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-6 pt-2">
                        {/* --- CORNER RADIUS --- */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <Label>Corner Radius</Label>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={presentation.videoCrop.roundedCorners}
                                        onCheckedChange={(c) => updateVideoCrop({ roundedCorners: c, enabled: true })}
                                    />
                                    {presentation.videoCrop.roundedCorners && (
                                        <Input
                                            type="number"
                                            className="h-7 w-14 text-xs text-right"
                                            value={presentation.videoCrop.cornerRadius}
                                            onChange={(e) => updateVideoCrop({ cornerRadius: Number(e.target.value) })}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* --- BORDER --- */}
                        <div className="space-y-3 pt-2 border-t border-border/40">
                            <div className="flex items-center justify-between">
                                <Label>Border</Label>
                                <Switch
                                    checked={presentation.videoStyle.borderEnabled}
                                    onCheckedChange={(c) => updateVideoStyle({ borderEnabled: c })}
                                />
                            </div>
                            {presentation.videoStyle.borderEnabled && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Color</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                className="h-8 w-8 p-1 cursor-pointer"
                                                value={presentation.videoStyle.borderColor}
                                                onChange={(e) => updateVideoStyle({ borderColor: e.target.value })}
                                            />
                                            <Input
                                                className="flex-1 h-8 font-mono text-xs"
                                                value={presentation.videoStyle.borderColor}
                                                onChange={(e) => updateVideoStyle({ borderColor: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Width (px)</Label>
                                        <Slider
                                            min={1} max={50} step={1}
                                            value={[presentation.videoStyle.borderWidth]}
                                            onValueChange={([val]) => updateVideoStyle({ borderWidth: val })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* --- SHADOW --- */}
                        <div className="space-y-3 pt-2 border-t border-border/40">
                            <div className="flex items-center justify-between">
                                <Label>Shadow</Label>
                                <Switch
                                    checked={presentation.videoStyle.shadowEnabled}
                                    onCheckedChange={(c) => updateVideoStyle({ shadowEnabled: c })}
                                />
                            </div>
                            {presentation.videoStyle.shadowEnabled && (
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Color</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                className="h-8 w-8 p-1 cursor-pointer"
                                                value={presentation.videoStyle.shadowColor}
                                                onChange={(e) => updateVideoStyle({ shadowColor: e.target.value })}
                                            />
                                            <Input
                                                className="flex-1 h-8 font-mono text-xs"
                                                value={presentation.videoStyle.shadowColor}
                                                onChange={(e) => updateVideoStyle({ shadowColor: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Blur</Label>
                                            <Slider
                                                min={0} max={100} step={1}
                                                value={[presentation.videoStyle.shadowBlur]}
                                                onValueChange={([val]) => updateVideoStyle({ shadowBlur: val })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Offset Y</Label>
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

                        {/* --- TRANSFORM / ROTATION --- */}
                        <div className="space-y-3 pt-2 border-t border-border/40">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label>Rotation</Label>
                                    <span className="text-xs font-mono text-muted-foreground">{presentation.videoStyle.rotation}°</span>
                                </div>
                                <Slider
                                    min={-180} max={180} step={1}
                                    value={[presentation.videoStyle.rotation]}
                                    onValueChange={([val]) => updateVideoStyle({ rotation: val })}
                                />
                            </div>
                        </div>

                        {/* Container Padding */}
                        <div className="space-y-3 pt-2 border-t border-border/40">
                            <div className="flex items-center justify-between">
                                <Label>Container Padding</Label>
                                <Switch
                                    checked={presentation.videoPadding.enabled}
                                    onCheckedChange={(c) => updateVideoPadding({ enabled: c })}
                                />
                            </div>

                            {presentation.videoPadding.enabled && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Vertical</Label>
                                        <Slider
                                            min={0}
                                            max={200}
                                            step={1}
                                            value={[presentation.videoPadding.top]} // assuming uniform for now simple UI
                                            onValueChange={([val]) => updateVideoPadding({ top: val, bottom: val, uniform: true })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Horizontal</Label>
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
