import React from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Sun, Contrast, Droplets, Palette, CircleDot, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type Grading = {
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
    temperature: number;
    vignette: number;
};

const NEUTRAL: Grading = { brightness: 0, contrast: 0, saturation: 0, hue: 0, temperature: 0, vignette: 0 };

/** One-click filter presets — tuned for screen recordings. */
const PRESETS: Array<{ name: string; grading: Partial<Grading>; css: string }> = [
    { name: 'Original', grading: {}, css: 'none' },
    { name: 'Vivid', grading: { saturation: 0.25, contrast: 0.12 }, css: 'saturate(1.25) contrast(1.12)' },
    { name: 'Warm', grading: { hue: -8, brightness: 0.05, saturation: 0.1 }, css: 'hue-rotate(-8deg) brightness(1.05) saturate(1.1)' },
    { name: 'Cool', grading: { hue: 10, saturation: 0.08 }, css: 'hue-rotate(10deg) saturate(1.08)' },
    { name: 'Fade', grading: { contrast: -0.15, brightness: 0.08 }, css: 'contrast(0.85) brightness(1.08)' },
    { name: 'Noir', grading: { saturation: -1, contrast: 0.15 }, css: 'saturate(0) contrast(1.15)' },
    { name: 'Punch', grading: { contrast: 0.25, saturation: 0.15, vignette: 0.25 }, css: 'contrast(1.25) saturate(1.15)' },
    { name: 'Dreamy', grading: { brightness: 0.12, saturation: 0.08, vignette: 0.2, contrast: -0.08 }, css: 'brightness(1.12) saturate(1.08) contrast(0.92)' },
];

const SLIDERS: Array<{
    key: keyof Grading;
    label: string;
    icon: React.ElementType;
    min: number;
    max: number;
    step: number;
    format: (v: number) => string;
}> = [
    { key: 'brightness', label: 'Brightness', icon: Sun, min: -0.5, max: 0.5, step: 0.01, format: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` },
    { key: 'contrast', label: 'Contrast', icon: Contrast, min: -0.5, max: 0.5, step: 0.01, format: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` },
    { key: 'saturation', label: 'Saturation', icon: Droplets, min: -1, max: 1, step: 0.02, format: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` },
    { key: 'hue', label: 'Hue shift', icon: Palette, min: -45, max: 45, step: 1, format: (v) => `${v > 0 ? '+' : ''}${v}°` },
    { key: 'vignette', label: 'Vignette', icon: CircleDot, min: 0, max: 1, step: 0.02, format: (v) => `${Math.round(v * 100)}%` },
];

export function PolishPanel() {
    const { colorGrading } = useEditorState();

    const update = (updates: Partial<Grading>) => {
        editorStore.setState((prev) => ({
            colorGrading: { ...prev.colorGrading, ...updates },
        }));
    };

    const applyPreset = (grading: Partial<Grading>) => {
        update({ ...NEUTRAL, ...grading });
    };

    const isPresetActive = (grading: Partial<Grading>) => {
        const target = { ...NEUTRAL, ...grading };
        return (Object.keys(NEUTRAL) as Array<keyof Grading>).every(
            (k) => Math.abs((colorGrading[k] ?? 0) - target[k]) < 0.011
        );
    };

    const isNeutral = isPresetActive({});

    return (
        <div className="space-y-5 p-4 pb-16">
            {/* Presets */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Filters
                    </Label>
                    {!isNeutral && (
                        <button
                            className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                            onClick={() => applyPreset({})}
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                    {PRESETS.map((preset) => {
                        const active = isPresetActive(preset.grading);
                        return (
                            <button
                                key={preset.name}
                                className={cn(
                                    'group overflow-hidden rounded-lg border transition-all',
                                    active
                                        ? 'border-primary shadow-md ring-1 ring-primary/30'
                                        : 'border-border/50 hover:border-primary/40 hover:shadow-sm'
                                )}
                                onClick={() => applyPreset(preset.grading)}
                                title={preset.name}
                            >
                                {/* Mini preview swatch */}
                                <div className="relative h-10 w-full bg-gradient-to-br from-sky-400 via-violet-400 to-rose-400" style={{ filter: preset.css }}>
                                    {(preset.grading.vignette ?? 0) > 0 && (
                                        <div
                                            className="absolute inset-0"
                                            style={{ background: 'radial-gradient(circle, transparent 45%, rgba(0,0,0,0.55) 130%)' }}
                                        />
                                    )}
                                </div>
                                <div
                                    className={cn(
                                        'py-0.5 text-center text-[9px] font-medium',
                                        active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                                    )}
                                >
                                    {preset.name}
                                </div>
                            </button>
                        );
                    })}
                </div>
                <p className="text-[10px] text-muted-foreground">
                    Applied live in the preview and baked into the export.
                </p>
            </div>

            {/* Manual adjustment */}
            <div className="space-y-4 border-t border-border/40 pt-4">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Fine-tune
                </Label>
                {SLIDERS.map(({ key, label, icon: Icon, min, max, step, format }) => (
                    <div key={key} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                                <Icon className="h-3 w-3" />
                                {label}
                            </Label>
                            <span
                                className={cn(
                                    'rounded border border-border/30 bg-background/50 px-1.5 py-0.5 font-mono text-[10px]',
                                    Math.abs(colorGrading[key] ?? 0) > 0.001 ? 'text-primary' : 'text-muted-foreground'
                                )}
                            >
                                {format(colorGrading[key] ?? 0)}
                            </span>
                        </div>
                        <Slider
                            min={min}
                            max={max}
                            step={step}
                            value={[colorGrading[key] ?? 0]}
                            onValueChange={([v]) => update({ [key]: v } as Partial<Grading>)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
