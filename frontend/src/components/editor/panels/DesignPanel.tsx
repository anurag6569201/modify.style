
import React, { useRef } from 'react';
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
import { AspectRatioPreset } from '@/lib/editor/types';
import { Smartphone, Monitor, Square, Layout, Palette, Crop, Upload, X, Plus, Trash2 } from 'lucide-react';
import { calculateOutputDimensions } from '@/lib/composition/aspectRatio';

const ASPECT_RATIOS: { label: string; value: AspectRatioPreset; icon: React.ComponentType<any> }[] = [
    { label: 'Native', value: 'native', icon: Monitor },
    { label: '16:9', value: '16:9', icon: Monitor },
    { label: '9:16', value: '9:16', icon: Smartphone },
    { label: '1:1', value: '1:1', icon: Square },
    { label: '4:3', value: '4:3', icon: Monitor },
    { label: '21:9', value: '21:9', icon: Monitor },
    { label: 'Custom', value: 'custom', icon: Layout },
];

export function DesignPanel() {
    const { presentation, video } = useEditorState();
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Calculate output dimensions
    const outputDims = calculateOutputDimensions(
        presentation.aspectRatio,
        video.width,
        video.height,
        presentation.customAspectRatio
    );

    // Handle aspect ratio change
    const handleAspectRatioChange = (value: AspectRatioPreset) => {
        const newDims = calculateOutputDimensions(
            value,
            video.width,
            video.height,
            presentation.customAspectRatio
        );
        updatePresentation({
            aspectRatio: value,
            outputWidth: newDims.width,
            outputHeight: newDims.height,
        });
    };

    // Handle custom aspect ratio dimensions
    const handleCustomAspectRatioChange = (field: 'width' | 'height', value: number) => {
        const newCustom = {
            ...presentation.customAspectRatio,
            [field]: value,
        };
        if (!presentation.customAspectRatio) {
            newCustom.width = newCustom.width || video.width;
            newCustom.height = newCustom.height || video.height;
        }
        const newDims = calculateOutputDimensions(
            'custom',
            video.width,
            video.height,
            newCustom
        );
        updatePresentation({
            customAspectRatio: newCustom,
            outputWidth: newDims.width,
            outputHeight: newDims.height,
        });
    };

    // Handle image upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate image type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            return;
        }

        // Convert to data URL
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            updatePresentation({ backgroundImage: dataUrl });
        };
        reader.readAsDataURL(file);
    };

    // Remove background image
    const handleRemoveImage = () => {
        updatePresentation({ backgroundImage: undefined });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Add gradient stop
    const addGradientStop = () => {
        const stops = [...presentation.backgroundGradient.stops];
        const lastStop = stops[stops.length - 1];
        const newPosition = lastStop ? Math.min(1, lastStop.position + 0.1) : 0.5;
        stops.push({ color: '#ffffff', position: newPosition });
        updatePresentation({
            backgroundGradient: { ...presentation.backgroundGradient, stops },
        });
    };

    // Remove gradient stop
    const removeGradientStop = (index: number) => {
        const stops = presentation.backgroundGradient.stops.filter((_, i) => i !== index);
        if (stops.length < 2) {
            // Keep at least 2 stops
            return;
        }
        updatePresentation({
            backgroundGradient: { ...presentation.backgroundGradient, stops },
        });
    };

    // Update gradient stop position
    const updateGradientStopPosition = (index: number, position: number) => {
        const stops = [...presentation.backgroundGradient.stops];
        stops[index] = { ...stops[index], position: Math.max(0, Math.min(1, position)) };
        // Sort stops by position
        stops.sort((a, b) => a.position - b.position);
        updatePresentation({
            backgroundGradient: { ...presentation.backgroundGradient, stops },
        });
    };

    return (
        <div className="space-y-4 p-4 pb-20">
            {/* Canvas & Layout */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Layout className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Canvas & Layout</h3>
                </div>

                {/* Aspect Ratio */}
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                        {ASPECT_RATIOS.map(({ label, value, icon: Icon }) => (
                            <button
                                key={value}
                                className={`
                                    h-9 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1
                                    ${presentation.aspectRatio === value
                                        ? "bg-primary text-primary-foreground border border-primary shadow-sm"
                                        : "bg-background border border-border hover:bg-accent"}
                                `}
                                onClick={() => handleAspectRatioChange(value)}
                            >
                                <Icon className="h-3 w-3" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Aspect Ratio Dimensions */}
                {presentation.aspectRatio === 'custom' && (
                    <div className="space-y-2 border-l-2 border-primary/20">
                        <Label className="text-xs text-muted-foreground">Custom Dimensions</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-muted-foreground">Width</Label>
                                <Input
                                    type="number"
                                    className="h-9 text-xs"
                                    value={presentation.customAspectRatio?.width || video.width}
                                    onChange={(e) => handleCustomAspectRatioChange('width', Number(e.target.value))}
                                    min={1}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] text-muted-foreground">Height</Label>
                                <Input
                                    type="number"
                                    className="h-9 text-xs"
                                    value={presentation.customAspectRatio?.height || video.height}
                                    onChange={(e) => handleCustomAspectRatioChange('height', Number(e.target.value))}
                                    min={1}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Canvas Dimensions Display */}
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Output Dimensions</Label>
                    <div className="flex items-center gap-2 p-2 rounded-md bg-background/50 border border-border">
                        <div className="flex-1 text-center">
                            <div className="text-[10px] text-muted-foreground">Width</div>
                            <div className="text-sm font-mono font-semibold">{Math.round(outputDims.width)}px</div>
                        </div>
                        <div className="h-8 w-px bg-border" />
                        <div className="flex-1 text-center">
                            <div className="text-[10px] text-muted-foreground">Height</div>
                            <div className="text-sm font-mono font-semibold">{Math.round(outputDims.height)}px</div>
                        </div>
                    </div>
                </div>

                {/* Pixel Density */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Pixel Density</Label>
                        <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded border border-border">
                            {presentation.screenDPR.toFixed(1)}x
                        </span>
                    </div>
                    <Slider
                        min={0.5}
                        max={3}
                        step={0.1}
                        value={[presentation.screenDPR]}
                        onValueChange={([value]) => updatePresentation({ screenDPR: value })}
                    />
                </div>
            </div>

            {/* Background */}
            <div className="space-y-3 border-t border-border/50 pt-4">
                <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-pink-500" />
                    <h3 className="text-sm font-semibold">Background</h3>
                </div>

                {/* Mode Selection */}
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Mode</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                        {(['hidden', 'solid', 'gradient', 'image'] as const).map((mode) => (
                            <button
                                key={mode}
                                className={`
                                    h-9 rounded-md text-xs font-medium transition-all capitalize
                                    ${presentation.backgroundMode === mode
                                        ? "bg-primary text-primary-foreground border border-primary shadow-sm"
                                        : "bg-background border border-border hover:bg-accent"}
                                `}
                                onClick={() => updatePresentation({ backgroundMode: mode })}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Background Color */}
                {presentation.backgroundMode === 'solid' && (
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Color</Label>
                        <div className="flex gap-2 items-center">
                            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border shadow-sm">
                                <input
                                    type="color"
                                    className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer border-0"
                                    value={presentation.backgroundColor}
                                    onChange={(e) => updatePresentation({ backgroundColor: e.target.value })}
                                />
                            </div>
                            <Input
                                className="h-9 font-mono text-xs"
                                value={presentation.backgroundColor}
                                onChange={(e) => updatePresentation({ backgroundColor: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {/* Gradient Settings */}
                {presentation.backgroundMode === 'gradient' && (
                    <div className="space-y-3">
                        <div className="space-y-2 grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Gradient Type</Label>
                                <Select
                                    value={presentation.backgroundGradient.type}
                                    onValueChange={(val: 'linear' | 'radial') =>
                                        updatePresentation({
                                            backgroundGradient: { ...presentation.backgroundGradient, type: val }
                                        })
                                    }
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="linear">Linear</SelectItem>
                                        <SelectItem value="radial">Radial</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2" style={{ marginTop: 0 }}>
                                <Label className="text-xs text-muted-foreground">Blur Type</Label>
                                <Select
                                    value={presentation.backgroundBlurType}
                                    onValueChange={(val: 'gaussian' | 'stack') =>
                                        updatePresentation({ backgroundBlurType: val })
                                    }
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gaussian">Gaussian</SelectItem>
                                        <SelectItem value="stack">Stack</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">Color Stops</Label>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-xs px-2"
                                    onClick={addGradientStop}
                                    disabled={presentation.backgroundGradient.stops.length >= 10}
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add
                                </Button>
                            </div>
                            <div className="space-y-2 grid grid-cols-2 gap-2">
                                {presentation.backgroundGradient.stops.map((stop, index) => (
                                    <div key={index} className="space-y-1.5 p-2 rounded-md border border-border bg-background/30 mt-0" style={{ marginTop: 0 }}>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] text-muted-foreground">Stop {index + 1}</Label>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                                onClick={() => removeGradientStop(index)}
                                                disabled={presentation.backgroundGradient.stops.length <= 2}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="flex gap-2 items-center mt-0">
                                            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border">
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
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[10px] text-muted-foreground">Position</Label>
                                                    <span className="text-[10px] font-mono text-muted-foreground">
                                                        {Math.round(stop.position * 100)}%
                                                    </span>
                                                </div>
                                                <Slider
                                                    min={0}
                                                    max={1}
                                                    step={0.01}
                                                    value={[stop.position]}
                                                    onValueChange={([val]) => updateGradientStopPosition(index, val)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}




                {/* Image Background Settings */}
                {presentation.backgroundMode === 'image' && (
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Background Image</Label>
                        {presentation.backgroundImage ? (
                            <div className="space-y-2">
                                <div className="relative h-24 w-full rounded-md border border-border overflow-hidden bg-background/30">
                                    <img
                                        src={presentation.backgroundImage}
                                        alt="Background"
                                        className="w-full h-full object-cover"
                                    />
                                    <Button
                                        size="icon"
                                        variant="destructive"
                                        className="absolute top-1 right-1 h-6 w-6"
                                        onClick={handleRemoveImage}
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full h-9 text-xs"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="h-3 w-3 mr-1" />
                                    Replace Image
                                </Button>
                            </div>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-9 text-xs"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-3 w-3 mr-1" />
                                Upload Image
                            </Button>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                        />
                    </div>
                )}

                <div className="space-y-2 grid grid-cols-2 gap-2">
                    {/* Blur */}
                    {presentation.backgroundGradient.type === 'linear' && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">Angle</Label>
                                <span className="text-xs font-mono text-muted-foreground">{presentation.backgroundGradient.angle || 135}°</span>
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
                    {(presentation.backgroundMode !== 'hidden') && (
                        <div className="space-y-3" style={{ marginTop: 0 }}>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">Blur</Label>
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

                        </div>
                    )}
                </div>

            </div>

            {/* Frame & Style */}
            <div className="space-y-3 border-t border-border/50 pt-4">
                <div className="flex items-center gap-2">
                    <Crop className="h-4 w-4 text-blue-500" />
                    <h3 className="text-sm font-semibold">Frame & Style</h3>
                </div>



                {/* Border */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Border</Label>
                        <Switch
                            checked={presentation.videoStyle.borderEnabled}
                            onCheckedChange={(c) => updateVideoStyle({ borderEnabled: c })}
                        />
                    </div>
                    {presentation.videoStyle.borderEnabled && (
                        <>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-[10px] text-muted-foreground">Color</Label>
                                    <div className="flex gap-2 items-center">
                                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border">
                                            <input
                                                type="color"
                                                className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer"
                                                value={presentation.videoStyle.borderColor}
                                                onChange={(e) => updateVideoStyle({ borderColor: e.target.value })}
                                            />
                                        </div>
                                        <Input
                                            className="flex-1 h-9 font-mono text-xs"
                                            value={presentation.videoStyle.borderColor}
                                            onChange={(e) => updateVideoStyle({ borderColor: e.target.value })}
                                        />
                                    </div>
                                </div>

                            </div>
                            <div className="space-y-2 grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] text-muted-foreground">Width</Label>
                                        <span className="text-xs font-mono text-muted-foreground">{presentation.videoStyle.borderWidth}px</span>
                                    </div>
                                    <Slider
                                        min={1} max={50} step={1}
                                        value={[presentation.videoStyle.borderWidth]}
                                        onValueChange={([val]) => updateVideoStyle({ borderWidth: val })}
                                    />
                                </div>
                                {/* Corner Radius */}
                                <div className="space-y-2" style={{ marginTop: 0 }}>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] text-muted-foreground">Corner Radius</label>
                                            <span className="text-xs font-mono text-muted-foreground">{presentation.videoCrop.cornerRadius || 0}px</span>
                                        </div>

                                            {presentation.videoCrop.roundedCorners && (
                                                <Slider
                                                min={1} max={100} step={1}
                                                value={[presentation.videoCrop.cornerRadius || 0]}
                                                onValueChange={([val]) => updateVideoCrop({ cornerRadius: val })}
                                            />
                                            )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                </div>

                {/* Shadow */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Shadow</Label>
                        <Switch
                            checked={presentation.videoStyle.shadowEnabled}
                            onCheckedChange={(c) => updateVideoStyle({ shadowEnabled: c })}
                        />
                    </div>
                    {presentation.videoStyle.shadowEnabled && (
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label className="text-[10px] text-muted-foreground">Color</Label>
                                <div className="flex gap-2 items-center">
                                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border">
                                        <input
                                            type="color"
                                            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer"
                                            value={presentation.videoStyle.shadowColor}
                                            onChange={(e) => updateVideoStyle({ shadowColor: e.target.value })}
                                        />
                                    </div>
                                    <Input
                                        className="flex-1 h-9 font-mono text-xs"
                                        value={presentation.videoStyle.shadowColor}
                                        onChange={(e) => updateVideoStyle({ shadowColor: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] text-muted-foreground">Blur</Label>
                                        <span className="text-xs font-mono text-muted-foreground">{presentation.videoStyle.shadowBlur}px</span>
                                    </div>
                                    <Slider
                                        min={0} max={100} step={1}
                                        value={[presentation.videoStyle.shadowBlur]}
                                        onValueChange={([val]) => updateVideoStyle({ shadowBlur: val })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] text-muted-foreground">Offset</Label>
                                        <span className="text-xs font-mono text-muted-foreground">{presentation.videoStyle.shadowOffsetY}px</span>
                                    </div>
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



                {/* Padding */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Padding</Label>
                        <Switch
                            checked={presentation.videoPadding.enabled}
                            onCheckedChange={(c) => updateVideoPadding({ enabled: c })}
                        />
                    </div>
                    {presentation.videoPadding.enabled && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] text-muted-foreground">Vertical</Label>
                                    <span className="text-xs font-mono text-muted-foreground">{presentation.videoPadding.top}px</span>
                                </div>
                                <Slider
                                    min={0} max={200} step={1}
                                    value={[presentation.videoPadding.top]}
                                    onValueChange={([val]) => updateVideoPadding({ top: val, bottom: val, uniform: true })}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] text-muted-foreground">Horizontal</Label>
                                    <span className="text-xs font-mono text-muted-foreground">{presentation.videoPadding.left}px</span>
                                </div>
                                <Slider
                                    min={0} max={200} step={1}
                                    value={[presentation.videoPadding.left]}
                                    onValueChange={([val]) => updateVideoPadding({ left: val, right: val, uniform: true })}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Rotation */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Rotation</Label>
                        <span className="text-xs font-mono text-muted-foreground">{presentation.videoStyle.rotation}°</span>
                    </div>
                    <Slider
                        min={-180} max={180} step={1}
                        value={[presentation.videoStyle.rotation]}
                        onValueChange={([val]) => updateVideoStyle({ rotation: val })}
                    />
                </div>
            </div>
        </div>
    );
}
