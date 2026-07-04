import React from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
    MousePointerClick,
    MousePointer2,
    Sparkles,
    Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CLICK_STYLES = ['ripple', 'orb', 'pulse', 'ring', 'splash', 'none'] as const;

export function EffectsPanel() {
    const { effects, cursor, events } = useEditorState();

    const updateEffects = (updates: Partial<typeof effects>) => {
        editorStore.setState((prev) => ({
            effects: { ...prev.effects, ...updates },
        }));
    };

    const updateCursor = (updates: Partial<typeof cursor>) => {
        editorStore.setState((prev) => ({
            cursor: { ...prev.cursor, ...updates },
        }));
    };

    return (
        <div className="space-y-5 p-4 pb-16">
            {/* ---- Click effects ---- */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <MousePointerClick className="h-3.5 w-3.5 text-sky-500" />
                        Click effects
                    </Label>
                    <Switch
                        checked={effects.clickRipple}
                        onCheckedChange={(c) => updateEffects({ clickRipple: c })}
                    />
                </div>
                <p className="text-[10px] text-muted-foreground">
                    Every recorded click ({events.clicks.length} captured) plays this effect. Select a click dot on the
                    timeline to style one click differently.
                </p>

                {effects.clickRipple && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                        <div className="grid grid-cols-3 gap-1.5">
                            {CLICK_STYLES.map((style) => (
                                <button
                                    key={style}
                                    className={cn(
                                        'h-8 rounded-md border text-[10px] font-medium capitalize transition-all',
                                        effects.clickAnimationStyle === style
                                            ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                            : 'border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground'
                                    )}
                                    onClick={() => updateEffects({ clickAnimationStyle: style })}
                                >
                                    {style}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border/50" title="Effect color">
                                <input
                                    type="color"
                                    className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                                    value={/^#([0-9a-f]{6})$/i.test(effects.clickColor) ? effects.clickColor : '#eb4034'}
                                    onChange={(e) => updateEffects({ clickColor: e.target.value })}
                                />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] text-muted-foreground">Size</Label>
                                    <span className="font-mono text-[10px] text-muted-foreground">{effects.clickSize.toFixed(1)}x</span>
                                </div>
                                <Slider
                                    min={0.5}
                                    max={3}
                                    step={0.1}
                                    value={[effects.clickSize]}
                                    onValueChange={([val]) => updateEffects({ clickSize: val })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] uppercase text-muted-foreground">Impact force</Label>
                                <span className="font-mono text-[10px] text-muted-foreground">{Math.round(effects.clickForce * 100)}%</span>
                            </div>
                            <Slider
                                min={0}
                                max={1.5}
                                step={0.1}
                                value={[effects.clickForce]}
                                onValueChange={([val]) => updateEffects({ clickForce: val })}
                            />
                            <p className="text-[10px] text-muted-foreground/70">Intensity of the effect (and screen shake on strong clicks).</p>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-border/30 bg-background/40 px-3 py-2">
                            <Label className="text-xs">Emphasize double clicks</Label>
                            <Switch
                                checked={effects.clickEmphasis}
                                onCheckedChange={(c) => updateEffects({ clickEmphasis: c })}
                                className="scale-90"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ---- Cursor ---- */}
            <div className="space-y-3 border-t border-border/40 pt-4">
                <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <MousePointer2 className="h-3.5 w-3.5 text-primary" />
                    Cursor
                </Label>

                {/* Style picker */}
                <div className="grid grid-cols-5 gap-1.5">
                    {(
                        [
                            { id: 'arrow', label: 'Arrow', hint: 'Classic pointer' },
                            { id: 'halo', label: 'Halo', hint: 'Pointer with a highlight ring — great for tutorials' },
                            { id: 'dot', label: 'Dot', hint: 'Minimal dot marker' },
                            { id: 'spotlight', label: 'Spot', hint: 'Dims everything except around the cursor' },
                            { id: 'hidden', label: 'Off', hint: 'No cursor' },
                        ] as const
                    ).map(({ id, label, hint }) => (
                        <button
                            key={id}
                            title={hint}
                            className={cn(
                                'h-8 rounded-md border text-[10px] font-medium transition-all',
                                cursor.style === id
                                    ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                    : 'border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground'
                            )}
                            onClick={() => updateCursor({ style: id })}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {cursor.style !== 'hidden' && (
                <>
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground">Movement smoothing</Label>
                        <span className="font-mono text-[10px] text-muted-foreground">{Math.round((cursor.smoothing ?? 0.35) * 100)}%</span>
                    </div>
                    <Slider
                        min={0}
                        max={1}
                        step={0.05}
                        value={[cursor.smoothing ?? 0.35]}
                        onValueChange={([val]) => updateCursor({ smoothing: val })}
                    />
                    <p className="text-[10px] text-muted-foreground/70">Irons out jittery mouse movement for a polished, deliberate feel.</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border/50" title="Cursor color">
                        <input
                            type="color"
                            className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                            value={/^#([0-9a-f]{6})$/i.test(cursor.color) ? cursor.color : '#000000'}
                            onChange={(e) => updateCursor({ color: e.target.value })}
                        />
                    </div>
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground">Size</Label>
                            <span className="font-mono text-[10px] text-muted-foreground">{cursor.size.toFixed(1)}x</span>
                        </div>
                        <Slider
                            min={0.5}
                            max={2.5}
                            step={0.1}
                            value={[cursor.size]}
                            onValueChange={([val]) => updateCursor({ size: val })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <div className="flex items-center justify-between rounded-lg border border-border/30 bg-background/40 px-2.5 py-2">
                        <Label className="text-[11px]">Glow</Label>
                        <Switch
                            checked={cursor.glow}
                            onCheckedChange={(c) => updateCursor({ glow: c })}
                            className="scale-75"
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/30 bg-background/40 px-2.5 py-2">
                        <Label className="text-[11px]">Trail</Label>
                        <Switch
                            checked={cursor.trail}
                            onCheckedChange={(c) => updateCursor({ trail: c, trailLength: c ? Math.max(8, cursor.trailLength) : 0 })}
                            className="scale-75"
                        />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/30 bg-background/40 px-2.5 py-2" title="Ring animation on every recorded click">
                        <Label className="text-[11px]">Pulse</Label>
                        <Switch
                            checked={cursor.clickPulse ?? true}
                            onCheckedChange={(c) => updateCursor({ clickPulse: c })}
                            className="scale-75"
                        />
                    </div>
                </div>

                {cursor.trail && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] uppercase text-muted-foreground">Trail length</Label>
                            <span className="font-mono text-[10px] text-muted-foreground">{cursor.trailLength}</span>
                        </div>
                        <Slider
                            min={4}
                            max={30}
                            step={1}
                            value={[cursor.trailLength]}
                            onValueChange={([val]) => updateCursor({ trailLength: val })}
                        />
                    </div>
                )}

                {(cursor.style === 'halo' || cursor.style === 'spotlight' || cursor.glow || cursor.trail || (cursor.clickPulse ?? true)) && (
                    <div className="flex items-center gap-2">
                        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border/50" title="Accent color for halo, trail, glow and pulse">
                            <input
                                type="color"
                                className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-0 p-0"
                                value={/^#([0-9a-f]{6})$/i.test(cursor.haloColor ?? '') ? cursor.haloColor : '#e8506e'}
                                onChange={(e) => updateCursor({ haloColor: e.target.value })}
                            />
                        </div>
                        <span className="text-[10px] text-muted-foreground">Accent color — halo ring, trail, glow and click pulse</span>
                    </div>
                )}

                <p className="flex items-start gap-1.5 rounded-lg border border-border/30 bg-background/40 p-2 text-[10px] text-muted-foreground">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" />
                    The cursor is re-drawn from your recorded mouse movements — live in the preview and identically in the export.
                </p>
                </>
                )}
            </div>

            {/* ---- Pointer to per-click styling ---- */}
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Per-click styling:</span> click any blue dot on the
                    timeline&apos;s Clicks track to give that moment its own effect — 20+ styles including glitch,
                    shockwave and hologram.
                </p>
            </div>
        </div>
    );
}
