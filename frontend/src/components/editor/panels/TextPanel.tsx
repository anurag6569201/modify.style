
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
import { Switch } from "@/components/ui/switch";

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
    { value: "blur-in", label: "Blur In" },
    { value: "glitch", label: "Glitch" },
    { value: "spin-3d", label: "3D Spin" },
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
            textTransform: "none" as const,
            // Advanced Styling
            gradient: {
                enabled: false,
                colors: ["#ff00cc", "#333399"],
                angle: 45
            },
            blendMode: "normal" as const,
            backdropBlur: 0,
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
        <div className="h-full flex flex-col pb-20">
            <div className="p-4 border-b border-border/10 bg-background/30 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <Layers className="h-3.5 w-3.5" />
                        Text Layers
                    </Label>
                    <Button size="sm" onClick={addTextOverlay} className="h-7 text-xs shadow-sm">
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        Add Layer
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    {textOverlays.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 opacity-60">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <Type className="h-6 w-6 text-primary" />
                            </div>
                            <p className="text-xs text-muted-foreground max-w-[200px]">
                                No text overlays yet. Add a text layer to enhance your video.
                            </p>
                        </div>
                    ) : (
                        <Accordion type="single" collapsible className="space-y-3">
                            {textOverlays.map((overlay) => (
                                <AccordionItem key={overlay.id} value={overlay.id} className="border-none bg-card/40 backdrop-blur-sm shadow-sm rounded-xl overflow-hidden transition-all data-[state=open]:ring-1 data-[state=open]:ring-primary/20 data-[state=open]:shadow-md">
                                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-3 text-sm max-w-full overflow-hidden w-full">
                                            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                                <Type className="h-3.5 w-3.5 text-primary" />
                                            </div>
                                            <span className="truncate font-medium flex-1 text-left opacity-90">{overlay.text}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-0 border-t border-border/10">
                                        <div className="p-4 space-y-5">
                                            {/* Main Text Content */}
                                            <div className="flex gap-2">
                                                <Textarea
                                                    value={overlay.text}
                                                    onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
                                                    className="resize-none h-20 text-sm bg-background/50 border-border/40 focus:bg-background"
                                                    placeholder="Enter text..."
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 self-start"
                                                    onClick={() => deleteTextOverlay(overlay.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <Tabs defaultValue="style" className="w-full">
                                                <TabsList className="w-full grid grid-cols-4 h-8 bg-background/40 p-0.5 rounded-lg border border-border/10">
                                                    <TabsTrigger value="style" className="text-[10px] px-1 h-7 data-[state=active]:bg-background/80 data-[state=active]:shadow-sm"><Type className="h-3 w-3 mr-1" /> Style</TabsTrigger>
                                                    <TabsTrigger value="box" className="text-[10px] px-1 h-7 data-[state=active]:bg-background/80 data-[state=active]:shadow-sm"><Box className="h-3 w-3 mr-1" /> Box</TabsTrigger>
                                                    <TabsTrigger value="pos" className="text-[10px] px-1 h-7 data-[state=active]:bg-background/80 data-[state=active]:shadow-sm"><Move className="h-3 w-3 mr-1" /> Pos</TabsTrigger>
                                                    <TabsTrigger value="anim" className="text-[10px] px-1 h-7 data-[state=active]:bg-background/80 data-[state=active]:shadow-sm"><Play className="h-3 w-3 mr-1" /> Anim</TabsTrigger>
                                                </TabsList>

                                                {/* STYLE TAB */}
                                                <TabsContent value="style" className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-1">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground uppercase">Font</Label>
                                                            <Select value={overlay.fontFamily} onValueChange={(v) => updateTextOverlay(overlay.id, { fontFamily: v })}>
                                                                <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    {FONT_FAMILIES.map(f => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground uppercase">Weight</Label>
                                                            <Select value={overlay.fontWeight} onValueChange={(v) => updateTextOverlay(overlay.id, { fontWeight: v })}>
                                                                <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                                                                    <SelectItem value="bold" className="text-xs">Bold</SelectItem>
                                                                    <SelectItem value="100" className="text-xs">Thin</SelectItem>
                                                                    <SelectItem value="900" className="text-xs">Black</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="space-y-1 flex-1">
                                                            <Label className="text-[10px] text-muted-foreground uppercase">Size</Label>
                                                            <div className="flex items-center gap-2">
                                                                <Slider
                                                                    value={[overlay.fontSize]}
                                                                    min={8} max={200} step={1}
                                                                    onValueChange={([v]) => updateTextOverlay(overlay.id, { fontSize: v })}
                                                                    className="flex-1"
                                                                />
                                                                <span className="text-xs w-8 text-right font-mono bg-background/30 rounded px-1">{overlay.fontSize}</span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground uppercase">Color</Label>
                                                            <div className="relative h-8 w-10 shrink-0 overflow-hidden rounded-md border border-border/50 shadow-sm transition-transform active:scale-95">
                                                                <input
                                                                    type="color"
                                                                    className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer border-0"
                                                                    value={overlay.color}
                                                                    onChange={(e) => updateTextOverlay(overlay.id, { color: e.target.value })}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground uppercase">Alignment & Case</Label>
                                                        <div className="flex gap-2">
                                                            <ToggleGroup type="single" value={overlay.textAlign} onValueChange={(v: any) => v && updateTextOverlay(overlay.id, { textAlign: v })} className="justify-start bg-background/50 p-0.5 rounded-md border border-border/30">
                                                                <ToggleGroupItem value="left" size="sm" className="h-6 px-2"><AlignLeft className="h-3 w-3" /></ToggleGroupItem>
                                                                <ToggleGroupItem value="center" size="sm" className="h-6 px-2"><AlignCenter className="h-3 w-3" /></ToggleGroupItem>
                                                                <ToggleGroupItem value="right" size="sm" className="h-6 px-2"><AlignRight className="h-3 w-3" /></ToggleGroupItem>
                                                            </ToggleGroup>
                                                            <ToggleGroup type="single" value={overlay.textTransform || 'none'} onValueChange={(v: any) => v && updateTextOverlay(overlay.id, { textTransform: v })} className="justify-start bg-background/50 p-0.5 rounded-md border border-border/30">
                                                                <ToggleGroupItem value="none" size="sm" className="h-6 px-2 text-[10px]">Aa</ToggleGroupItem>
                                                                <ToggleGroupItem value="uppercase" size="sm" className="h-6 px-2 text-[10px]">AA</ToggleGroupItem>
                                                                <ToggleGroupItem value="lowercase" size="sm" className="h-6 px-2 text-[10px]">aa</ToggleGroupItem>
                                                            </ToggleGroup>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2 border border-border/30 rounded-lg p-3 bg-muted/20">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-xs font-medium">Gradient Text</Label>
                                                            <Switch
                                                                checked={overlay.gradient?.enabled || false}
                                                                onCheckedChange={(c) => updateTextOverlay(overlay.id, {
                                                                    gradient: {
                                                                        ...(overlay.gradient || { colors: ["#ff00cc", "#333399"], angle: 45 }),
                                                                        enabled: c
                                                                    }
                                                                })}
                                                            />
                                                        </div>
                                                        {(overlay.gradient?.enabled) && (
                                                            <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1">
                                                                <div className="flex gap-2">
                                                                    <div className="flex-1 relative h-6 rounded overflow-hidden border border-border/50">
                                                                        <input type="color" className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 border-0" value={overlay.gradient.colors[0]} onChange={(e) => updateTextOverlay(overlay.id, { gradient: { ...overlay.gradient!, colors: [e.target.value, overlay.gradient!.colors[1]] } })} />
                                                                    </div>
                                                                    <div className="flex-1 relative h-6 rounded overflow-hidden border border-border/50">
                                                                        <input type="color" className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 border-0" value={overlay.gradient.colors[1]} onChange={(e) => updateTextOverlay(overlay.id, { gradient: { ...overlay.gradient!, colors: [overlay.gradient!.colors[0], e.target.value] } })} />
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] text-muted-foreground w-8">Angle</span>
                                                                    <Slider
                                                                        value={[overlay.gradient.angle]}
                                                                        min={0} max={360} step={1}
                                                                        onValueChange={([v]) => updateTextOverlay(overlay.id, {
                                                                            gradient: { ...overlay.gradient!, angle: v }
                                                                        })}
                                                                        className="flex-1"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TabsContent>

                                                {/* BOX TAB */}
                                                <TabsContent value="box" className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-1">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground uppercase">Bg Color</Label>
                                                            <div className="flex gap-2 items-center">
                                                                <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-border/50">
                                                                    <input
                                                                        type="color"
                                                                        value={overlay.backgroundColor === 'transparent' ? '#ffffff' : overlay.backgroundColor}
                                                                        onChange={(e) => updateTextOverlay(overlay.id, { backgroundColor: e.target.value })}
                                                                        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer border-0"
                                                                    />
                                                                </div>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 text-xs flex-1 border-border/40"
                                                                    onClick={() => updateTextOverlay(overlay.id, { backgroundColor: 'transparent' })}
                                                                >
                                                                    Clear
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground uppercase">Blend Mode</Label>
                                                            <Select value={overlay.blendMode || 'normal'} onValueChange={(v: any) => updateTextOverlay(overlay.id, { blendMode: v })}>
                                                                <SelectTrigger className="h-7 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                                                                    <SelectItem value="overlay" className="text-xs">Overlay</SelectItem>
                                                                    <SelectItem value="screen" className="text-xs">Screen</SelectItem>
                                                                    <SelectItem value="multiply" className="text-xs">Multiply</SelectItem>
                                                                    <SelectItem value="difference" className="text-xs">Difference</SelectItem>
                                                                    <SelectItem value="plus-lighter" className="text-xs">Plus Lighter</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground uppercase">Backdrop Blur</Label>
                                                        <Slider
                                                            value={[overlay.backdropBlur || 0]}
                                                            min={0} max={50} step={1}
                                                            onValueChange={([v]) => updateTextOverlay(overlay.id, { backdropBlur: v })}
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground uppercase">Padding</Label>
                                                        <Slider
                                                            value={[overlay.padding]}
                                                            min={0} max={100} step={1}
                                                            onValueChange={([v]) => updateTextOverlay(overlay.id, { padding: v })}
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground uppercase">Corner Radius</Label>
                                                        <Slider
                                                            value={[overlay.borderRadius]}
                                                            min={0} max={50} step={1}
                                                            onValueChange={([v]) => updateTextOverlay(overlay.id, { borderRadius: v })}
                                                        />
                                                    </div>

                                                    <Separator className="bg-border/30" />

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground uppercase">Border</Label>
                                                            <Slider
                                                                value={[overlay.borderWidth]}
                                                                min={0} max={10} step={1}
                                                                onValueChange={([v]) => updateTextOverlay(overlay.id, { borderWidth: v })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground uppercase">Border Color</Label>
                                                            <div className="relative h-7 w-full overflow-hidden rounded border border-border/50">
                                                                <input
                                                                    type="color"
                                                                    value={overlay.borderColor}
                                                                    onChange={(e) => updateTextOverlay(overlay.id, { borderColor: e.target.value })}
                                                                    className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer border-0"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <Separator className="bg-border/30" />

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground uppercase">Shadow Blur</Label>
                                                            <Slider
                                                                value={[overlay.shadowBlur]}
                                                                min={0} max={50} step={1}
                                                                onValueChange={([v]) => updateTextOverlay(overlay.id, { shadowBlur: v })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground uppercase">Shadow Color</Label>
                                                            <div className="relative h-7 w-full overflow-hidden rounded border border-border/50">
                                                                <input
                                                                    type="color"
                                                                    value={overlay.shadowColor}
                                                                    onChange={(e) => updateTextOverlay(overlay.id, { shadowColor: e.target.value })}
                                                                    className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] p-0 cursor-pointer border-0"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TabsContent>

                                                {/* POS TAB */}
                                                <TabsContent value="pos" className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-1">
                                                    <div className="space-y-3">
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between">
                                                                <Label className="text-[10px] text-muted-foreground uppercase">Position X ({Math.round(overlay.x * 100)}%)</Label>
                                                                <span className="text-[10px] font-mono text-muted-foreground">{Math.round(overlay.x * 100)}%</span>
                                                            </div>
                                                            <Slider
                                                                value={[overlay.x]}
                                                                min={0} max={1} step={0.01}
                                                                onValueChange={([v]) => updateTextOverlay(overlay.id, { x: v })}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between">
                                                                <Label className="text-[10px] text-muted-foreground uppercase">Position Y ({Math.round(overlay.y * 100)}%)</Label>
                                                                <span className="text-[10px] font-mono text-muted-foreground">{Math.round(overlay.y * 100)}%</span>
                                                            </div>
                                                            <Slider
                                                                value={[overlay.y]}
                                                                min={0} max={1} step={0.01}
                                                                onValueChange={([v]) => updateTextOverlay(overlay.id, { y: v })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground uppercase">Scale</Label>
                                                            <Input
                                                                type="number" step={0.1}
                                                                value={overlay.scale}
                                                                onChange={(e) => updateTextOverlay(overlay.id, { scale: Number(e.target.value) })}
                                                                className="h-8 text-xs bg-background/50"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[10px] text-muted-foreground uppercase">Rotation</Label>
                                                            <Input
                                                                type="number"
                                                                value={overlay.rotation}
                                                                onChange={(e) => updateTextOverlay(overlay.id, { rotation: Number(e.target.value) })}
                                                                className="h-8 text-xs bg-background/50"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between">
                                                            <Label className="text-[10px] text-muted-foreground uppercase">Opacity</Label>
                                                            <span className="text-[10px] font-mono text-muted-foreground">{Math.round(overlay.opacity * 100)}%</span>
                                                        </div>
                                                        <Slider
                                                            value={[overlay.opacity]}
                                                            min={0} max={1} step={0.05}
                                                            onValueChange={([v]) => updateTextOverlay(overlay.id, { opacity: v })}
                                                        />
                                                    </div>
                                                </TabsContent>

                                                {/* ANIM TAB */}
                                                <TabsContent value="anim" className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-1">
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground uppercase">Entry Animation</Label>
                                                        <Select value={overlay.animation} onValueChange={(v: any) => updateTextOverlay(overlay.id, { animation: v })}>
                                                            <SelectTrigger className="h-9 bg-background/50"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {ANIMATION_TYPES.map(a => <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="bg-secondary/20 p-3 rounded-lg border border-border/30 space-y-3">
                                                        <Label className="text-xs font-medium">Timeline</Label>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1">
                                                                <span className="text-[10px] text-muted-foreground uppercase">Start (sec)</span>
                                                                <div className="flex gap-1">
                                                                    <Input
                                                                        type="number" step={0.1}
                                                                        value={overlay.startTime}
                                                                        onChange={(e) => updateTextOverlay(overlay.id, { startTime: Number(e.target.value) })}
                                                                        className="h-7 text-xs bg-background/50"
                                                                    />
                                                                    <Button
                                                                        variant="ghost" size="icon" className="h-7 w-7"
                                                                        title="Set to current time"
                                                                        onClick={() => updateTextOverlay(overlay.id, { startTime: playback.currentTime })}
                                                                    >
                                                                        <Layers className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <span className="text-[10px] text-muted-foreground uppercase">End (sec)</span>
                                                                <div className="flex gap-1">
                                                                    <Input
                                                                        type="number" step={0.1}
                                                                        value={overlay.endTime}
                                                                        onChange={(e) => updateTextOverlay(overlay.id, { endTime: Number(e.target.value) })}
                                                                        className="h-7 text-xs bg-background/50"
                                                                    />
                                                                    <Button
                                                                        variant="ghost" size="icon" className="h-7 w-7"
                                                                        title="Set to current time"
                                                                        onClick={() => updateTextOverlay(overlay.id, { endTime: playback.currentTime })}
                                                                    >
                                                                        <Layers className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
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
