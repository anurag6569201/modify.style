import React, { useRef, useState } from 'react';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Music, Upload, Trash2, Play, Pause, Volume2, Waves, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const MAX_FILE_MB = 25;

export function MusicPanel() {
    const { music, voiceover } = useEditorState();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewRef = useRef<HTMLAudioElement | null>(null);
    const [previewing, setPreviewing] = useState(false);

    const update = (updates: Partial<typeof music>) => {
        editorStore.setState((prev) => ({ music: { ...prev.music, ...updates } }));
    };

    const stopPreview = () => {
        if (previewRef.current) {
            previewRef.current.pause();
            previewRef.current = null;
        }
        setPreviewing(false);
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('audio/')) {
            toast({ title: 'Not an audio file', description: 'Upload an mp3, wav or m4a track.', variant: 'destructive' });
            return;
        }
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
            toast({ title: 'File too large', description: `Keep music under ${MAX_FILE_MB}MB.`, variant: 'destructive' });
            return;
        }
        stopPreview();
        const url = URL.createObjectURL(file);
        update({ enabled: true, name: file.name, url, blob: file });
        toast({ title: 'Music added', description: `${file.name} — it will play under your narration.` });
    };

    const handleRemove = () => {
        stopPreview();
        if (music.url?.startsWith('blob:')) URL.revokeObjectURL(music.url);
        update({ enabled: false, name: '', url: null, blob: null });
    };

    const togglePreview = () => {
        if (previewing) {
            stopPreview();
            return;
        }
        const src = music.url ?? (music.blob ? URL.createObjectURL(music.blob) : null);
        if (!src) return;
        const audio = new Audio(src);
        audio.volume = (music.volume ?? 30) / 100;
        previewRef.current = audio;
        setPreviewing(true);
        audio.addEventListener('ended', () => setPreviewing(false));
        audio.play().catch(() => setPreviewing(false));
    };

    const hasTrack = !!(music.url || music.blob);
    const voicedCount = voiceover.scriptSegments.filter((s) => s.isGenerated).length;

    return (
        <div className="space-y-5 p-4 pb-16">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <Music className="h-3.5 w-3.5 text-primary" />
                        Background music
                    </Label>
                    {hasTrack && (
                        <Switch checked={music.enabled} onCheckedChange={(c) => update({ enabled: c })} />
                    )}
                </div>

                {!hasTrack ? (
                    <button
                        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-background/40 py-8 transition-colors hover:border-primary/40 hover:bg-background/70"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Upload className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-medium">Upload a music track</p>
                            <p className="text-[10px] text-muted-foreground">mp3 · wav · m4a — up to {MAX_FILE_MB}MB</p>
                        </div>
                    </button>
                ) : (
                    <div className={cn('space-y-3 rounded-xl border p-3 transition-opacity', music.enabled ? 'border-primary/25 bg-primary/5' : 'border-border/40 bg-card/40 opacity-60')}>
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15">
                                <Music className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <span className="min-w-0 flex-1 truncate text-xs font-medium">{music.name || 'Music track'}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={togglePreview} title="Preview track">
                                {previewing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={handleRemove} title="Remove track">
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 w-full text-xs" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-1.5 h-3 w-3" />
                            Replace track
                        </Button>
                    </div>
                )}
                <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFile} />
            </div>

            {hasTrack && music.enabled && (
                <>
                    <div className="space-y-4 border-t border-border/40 pt-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                                    <Volume2 className="h-3 w-3" />
                                    Music volume
                                </Label>
                                <span className="font-mono text-[10px] text-muted-foreground">{music.volume}%</span>
                            </div>
                            <Slider min={0} max={100} step={1} value={[music.volume]} onValueChange={([v]) => update({ volume: v })} />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                                    <Waves className="h-3 w-3" />
                                    Duck under narration
                                </Label>
                                <span className="font-mono text-[10px] text-muted-foreground">-{music.ducking}%</span>
                            </div>
                            <Slider min={0} max={100} step={5} value={[music.ducking]} onValueChange={([v]) => update({ ducking: v })} />
                            <p className="text-[10px] text-muted-foreground">
                                While the AI voiceover speaks ({voicedCount} voiced segment{voicedCount === 1 ? '' : 's'}), music
                                volume drops by this much so the narration stays clear.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] uppercase text-muted-foreground">Fade in</Label>
                                    <span className="font-mono text-[10px] text-muted-foreground">{music.fadeIn.toFixed(1)}s</span>
                                </div>
                                <Slider min={0} max={5} step={0.5} value={[music.fadeIn]} onValueChange={([v]) => update({ fadeIn: v })} />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] uppercase text-muted-foreground">Fade out</Label>
                                    <span className="font-mono text-[10px] text-muted-foreground">{music.fadeOut.toFixed(1)}s</span>
                                </div>
                                <Slider min={0} max={8} step={0.5} value={[music.fadeOut]} onValueChange={([v]) => update({ fadeOut: v })} />
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-border/30 bg-background/40 px-3 py-2">
                            <Label className="text-xs">Loop if shorter than the video</Label>
                            <Switch checked={music.loop} onCheckedChange={(c) => update({ loop: c })} className="scale-90" />
                        </div>
                    </div>

                    <p className="flex items-start gap-1.5 rounded-lg border border-border/30 bg-background/40 p-2 text-[10px] text-muted-foreground">
                        <Info className="mt-0.5 h-3 w-3 shrink-0" />
                        Music plays live in the preview and is mixed into the exported video. It's kept for this session —
                        re-upload after reopening the project.
                    </p>
                </>
            )}
        </div>
    );
}
