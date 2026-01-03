
import React from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Sun, Contrast, Droplets, Thermometer, RotateCcw } from 'lucide-react';

export function ColorPanel() {
    const { colorGrading } = useEditorState();

    const updateColor = (updates: Partial<typeof colorGrading>) => {
        editorStore.setState((prev) => ({
            colorGrading: { ...prev.colorGrading, ...updates },
        }));
    };

    const resetColor = () => {
        editorStore.setState((prev) => ({
            colorGrading: {
                brightness: 0,
                contrast: 0,
                saturation: 0,
                hue: 0,
                temperature: 0,
                vignette: 0,
            }
        }));
    };

    return (
        <div className="space-y-6 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <Label className="font-semibold">Color Grading</Label>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetColor} title="Reset All">
                    <RotateCcw className="h-3 w-3" />
                </Button>
            </div>

            <div className="space-y-4">
                {/* Brightness */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sun className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs">Brightness</Label>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{colorGrading.brightness > 0 ? '+' : ''}{colorGrading.brightness}%</span>
                    </div>
                    <Slider
                        min={-100}
                        max={100}
                        step={1}
                        value={[colorGrading.brightness]}
                        onValueChange={([val]) => updateColor({ brightness: val })}
                    />
                </div>

                {/* Contrast */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Contrast className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs">Contrast</Label>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{colorGrading.contrast > 0 ? '+' : ''}{colorGrading.contrast}%</span>
                    </div>
                    <Slider
                        min={-100}
                        max={100}
                        step={1}
                        value={[colorGrading.contrast]}
                        onValueChange={([val]) => updateColor({ contrast: val })}
                    />
                </div>

                {/* Saturation */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Droplets className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs">Saturation</Label>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{colorGrading.saturation > 0 ? '+' : ''}{colorGrading.saturation}%</span>
                    </div>
                    <Slider
                        min={-100}
                        max={100}
                        step={1}
                        value={[colorGrading.saturation]}
                        onValueChange={([val]) => updateColor({ saturation: val })}
                    />
                </div>

                {/* Temperature */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Thermometer className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs">Temperature</Label>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{colorGrading.temperature > 0 ? '+' : ''}{colorGrading.temperature}</span>
                    </div>
                    <Slider
                        min={-100}
                        max={100}
                        step={1}
                        value={[colorGrading.temperature]}
                        onValueChange={([val]) => updateColor({ temperature: val })}
                        className="[&>.relative>.bg-primary]:bg-gradient-to-r [&>.relative>.bg-primary]:from-blue-500 [&>.relative>.bg-primary]:to-orange-500"
                    />
                </div>
            </div>
        </div>
    );
}
