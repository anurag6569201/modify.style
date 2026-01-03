
import React from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Plus, Trash2, AlignLeft, AlignCenter, AlignRight, Type, Move, Box, Layers, Play } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const FONT_FAMILIES = [
    "Inter", "Arial", "Helvetica", "Times New Roman", "Courier New", "Georgia", "Verdana", "Impact", "Comic Sans MS"
];

const ANIMATION_TYPES = [
    { value: "none", label: "None" },
    { value: "fade", label: "Fade" },
    { value: "slide-up", label: "Slide Up" },
    { value: "slide-down", label: "Slide Down" },
    { value: "slide-left", label: "Slide Left" },
    { value: "slide-right", label: "Slide Right" },
    { value: "scale", label: "Scale In" },
    { value: "pop", label: "Pop In" },
    { value: "typewriter", label: "Typewriter" },
];

export function TextPanel() {
    const { textOverlays, playback, video } = useEditorState();

    const addTextOverlay = () => {
        const newOverlay = {
            id: Date.now().toString(),
            text: "New Text Layer",
            // Position
            x: 0.5,
            y: 0.5,
            rotation: 0,
            scale: 1,
            opacity: 1,
            // Typography
            fontSize: 48,
            fontFamily: "Inter",
            fontWeight: "bold",
            fontStyle: "normal" as const,
            textAlign: "center" as const,
            lineHeight: 1.2,
            letterSpacing: 0,
            color: "#ffffff",
            // Box
            backgroundColor: "transparent",
            padding: 0,
            borderRadius: 0,
            borderWidth: 0,
            borderColor: "#ffffff",
            // Shadow
            shadowColor: "rgba(0,0,0,0.5)",
            shadowBlur: 0,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            // Timing
            startTime: playback.currentTime,
            endTime: Math.min(playback.currentTime + 3, video.duration || 10),
            animation: "fade" as const,
        };
        editorStore.setState((prev) => ({
            textOverlays: [...prev.textOverlays, newOverlay]
        }));
    };

    const updateTextOverlay = (id: string, updates: Partial<typeof textOverlays[0]>) => {
        editorStore.setState((prev) => ({
            textOverlays: prev.textOverlays.map(overlay =>
                overlay.id === id ? { ...overlay, ...updates } : overlay
            )
        }));
    };

    const deleteTextOverlay = (id: string) => {
        editorStore.setState((prev) => ({
            textOverlays: prev.textOverlays.filter(overlay => overlay.id !== id)
        }));
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
                <Label className="font-semibold">Text Overlays</Label>
                <Button size="sm" onClick={addTextOverlay}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4">
                    {textOverlays.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No text overlays. Add one to get started.
                        </div>
                    ) : (
                        <Accordion type="single" collapsible className="space-y-2">
                            {textOverlays.map((overlay) => (
                                <AccordionItem key={overlay.id} value={overlay.id} className="border border-border/50 rounded-lg bg-card overflow-hidden">
                                    <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/50">
                                        <div className="flex items-center gap-2 text-sm max-w-full overflow-hidden">
                                            <Type className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <span className="truncate font-medium">{overlay.text}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-0">
                                        <div className="p-3 space-y-4">
                                            {/* Main Text Content */}
                                            <div className="flex gap-2">
                                                <Textarea
                                                    value={overlay.text}
                                                    onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
                                                    className="resize-none h-20 text-sm"
                                                    placeholder="Enter text..."
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive self-start"
                                                    onClick={() => deleteTextOverlay(overlay.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <Tabs defaultValue="style" className="w-full">
                                                <TabsList className="w-full grid grid-cols-4 h-8">
                                                    <TabsTrigger value="style" className="text-xs px-1"><Type className="h-3 w-3 mr-1" /> Style</TabsTrigger>
                                                    <TabsTrigger value="box" className="text-xs px-1"><Box className="h-3 w-3 mr-1" /> Box</TabsTrigger>
                                                    <TabsTrigger value="pos" className="text-xs px-1"><Move className="h-3 w-3 mr-1" /> Pos</TabsTrigger>
                                                    <TabsTrigger value="anim" className="text-xs px-1"><Play className="h-3 w-3 mr-1" /> Anim</TabsTrigger>
                                                </TabsList>

                                                {/* STYLE TAB */}
                                                <TabsContent value="style" className="space-y-4 pt-4">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">Font</Label>
                                                            <Select value={overlay.fontFamily} onValueChange={(v) => updateTextOverlay(overlay.id, { fontFamily: v })}>
                                                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    {FONT_FAMILIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">Weight</Label>
                                                            <Select value={overlay.fontWeight} onValueChange={(v) => updateTextOverlay(overlay.id, { fontWeight: v })}>
                                                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="normal">Normal</SelectItem>
                                                                    <SelectItem value="bold">Bold</SelectItem>
                                                                    <SelectItem value="100">Thin</SelectItem>
                                                                    <SelectItem value="900">Black</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="space-y-1 flex-1">
                                                            <Label className="text-xs text-muted-foreground">Size</Label>
                                                            <div className="flex items-center gap-2">
                                                                <Slider
                                                                    value={[overlay.fontSize]}
                                                                    min={8} max={200} step={1}
                                                                    onValueChange={([v]) => updateTextOverlay(overlay.id, { fontSize: v })}
                                                                    className="flex-1"
                                                                />
                                                                <span className="text-xs w-8 text-right font-mono">{overlay.fontSize}</span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">Color</Label>
                                                            <Input
                                                                type="color"
                                                                value={overlay.color}
                                                                onChange={(e) => updateTextOverlay(overlay.id, { color: e.target.value })}
                                                                className="h-8 w-12 p-0.5"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Align</Label>
                                                        <ToggleGroup type="single" value={overlay.textAlign} onValueChange={(v: any) => v && updateTextOverlay(overlay.id, { textAlign: v })} className="justify-start">
                                                            <ToggleGroupItem value="left" size="sm" className="h-7 px-2"><AlignLeft className="h-3 w-3" /></ToggleGroupItem>
                                                            <ToggleGroupItem value="center" size="sm" className="h-7 px-2"><AlignCenter className="h-3 w-3" /></ToggleGroupItem>
                                                            <ToggleGroupItem value="right" size="sm" className="h-7 px-2"><AlignRight className="h-3 w-3" /></ToggleGroupItem>
                                                        </ToggleGroup>
                                                    </div>
                                                </TabsContent>

                                                {/* BOX TAB */}
                                                <TabsContent value="box" className="space-y-4 pt-4">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">Bg Color</Label>
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    type="color"
                                                                    value={overlay.backgroundColor === 'transparent' ? '#ffffff' : overlay.backgroundColor}
                                                                    onChange={(e) => updateTextOverlay(overlay.id, { backgroundColor: e.target.value })}
                                                                    className="h-7 w-8 p-0.5"
                                                                />
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-6 text-xs flex-1"
                                                                    onClick={() => updateTextOverlay(overlay.id, { backgroundColor: 'transparent' })}
                                                                >
                                                                    None
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">Padding</Label>
                                                            <Input
                                                                type="number"
                                                                value={overlay.padding}
                                                                onChange={(e) => updateTextOverlay(overlay.id, { padding: Number(e.target.value) })}
                                                                className="h-7 text-xs"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Corner Radius</Label>
                                                        <Slider
                                                            value={[overlay.borderRadius]}
                                                            min={0} max={50} step={1}
                                                            onValueChange={([v]) => updateTextOverlay(overlay.id, { borderRadius: v })}
                                                        />
                                                    </div>

                                                    <Separator />

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">Border</Label>
                                                            <Slider
                                                                value={[overlay.borderWidth]}
                                                                min={0} max={10} step={1}
                                                                onValueChange={([v]) => updateTextOverlay(overlay.id, { borderWidth: v })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">Color</Label>
                                                            <Input
                                                                type="color"
                                                                value={overlay.borderColor}
                                                                onChange={(e) => updateTextOverlay(overlay.id, { borderColor: e.target.value })}
                                                                className="h-7 w-full p-0.5"
                                                            />
                                                        </div>
                                                    </div>

                                                    <Separator />

                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Shadow Blur</Label>
                                                        <Slider
                                                            value={[overlay.shadowBlur]}
                                                            min={0} max={50} step={1}
                                                            onValueChange={([v]) => updateTextOverlay(overlay.id, { shadowBlur: v })}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Shadow Color</Label>
                                                        <Input
                                                            type="color"
                                                            value={overlay.shadowColor}
                                                            onChange={(e) => updateTextOverlay(overlay.id, { shadowColor: e.target.value })}
                                                            className="h-7 w-full p-0.5"
                                                        />
                                                    </div>
                                                </TabsContent>

                                                {/* POS TAB */}
                                                <TabsContent value="pos" className="space-y-4 pt-4">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Position X ({Math.round(overlay.x * 100)}%)</Label>
                                                        <Slider
                                                            value={[overlay.x]}
                                                            min={0} max={1} step={0.01}
                                                            onValueChange={([v]) => updateTextOverlay(overlay.id, { x: v })}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Position Y ({Math.round(overlay.y * 100)}%)</Label>
                                                        <Slider
                                                            value={[overlay.y]}
                                                            min={0} max={1} step={0.01}
                                                            onValueChange={([v]) => updateTextOverlay(overlay.id, { y: v })}
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">Scale</Label>
                                                            <Input
                                                                type="number" step={0.1}
                                                                value={overlay.scale}
                                                                onChange={(e) => updateTextOverlay(overlay.id, { scale: Number(e.target.value) })}
                                                                className="h-7 text-xs"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">Rotation</Label>
                                                            <Input
                                                                type="number"
                                                                value={overlay.rotation}
                                                                onChange={(e) => updateTextOverlay(overlay.id, { rotation: Number(e.target.value) })}
                                                                className="h-7 text-xs"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Opacity</Label>
                                                        <Slider
                                                            value={[overlay.opacity]}
                                                            min={0} max={1} step={0.05}
                                                            onValueChange={([v]) => updateTextOverlay(overlay.id, { opacity: v })}
                                                        />
                                                    </div>
                                                </TabsContent>

                                                {/* ANIM TAB */}
                                                <TabsContent value="anim" className="space-y-4 pt-4">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Enter/Exit Animation</Label>
                                                        <Select value={overlay.animation} onValueChange={(v: any) => updateTextOverlay(overlay.id, { animation: v })}>
                                                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {ANIMATION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Display Time</Label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <span className="text-[10px] text-muted-foreground uppercase">Start</span>
                                                                <Input
                                                                    type="number" step={0.1}
                                                                    value={overlay.startTime}
                                                                    onChange={(e) => updateTextOverlay(overlay.id, { startTime: Number(e.target.value) })}
                                                                    className="h-7 text-xs"
                                                                />
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] text-muted-foreground uppercase">End</span>
                                                                <Input
                                                                    type="number" step={0.1}
                                                                    value={overlay.endTime}
                                                                    onChange={(e) => updateTextOverlay(overlay.id, { endTime: Number(e.target.value) })}
                                                                    className="h-7 text-xs"
                                                                />
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            className="w-full mt-2 h-7 text-xs"
                                                            onClick={() => updateTextOverlay(overlay.id, { startTime: playback.currentTime })}
                                                        >
                                                            Set Start to Now
                                                        </Button>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            className="w-full mt-1 h-7 text-xs"
                                                            onClick={() => updateTextOverlay(overlay.id, { endTime: playback.currentTime })}
                                                        >
                                                            Set End to Now
                                                        </Button>
                                                    </div>
                                                </TabsContent>

                                            </Tabs>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
