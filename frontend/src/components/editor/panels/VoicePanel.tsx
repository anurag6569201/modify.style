import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Mic2,
    Loader2,
    Download,
    Play,
    Pause,
    Search,
    X,
    RefreshCw,
    Check,
    AlertTriangle,
    FileText,
    Sparkles,
    ChevronDown,
    ChevronUp,
    SlidersHorizontal,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { GreabyVoice } from '@/lib/api/greaby';
import { generateVoiceAudio } from '@/lib/api/voice-generation';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { findVoicePreview } from '@/lib/api/voice-previews';
import { VOICE_OPTIONS } from '@/lib/api/voices';
import { cn } from '@/lib/utils';

interface ExtendedVoice extends GreabyVoice {
    group: string;
    flag: string;
}

type SegmentStatus = 'idle' | 'generating' | 'done' | 'error';

function formatTime(seconds: number) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VoicePanel() {
    const { toast } = useToast();
    const editorState = useEditorState();
    const { voiceover } = editorState;

    const [isGenerating, setIsGenerating] = useState(false);
    const [segmentStatus, setSegmentStatus] = useState<Record<number, SegmentStatus>>({});
    const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
    const [playingSegmentIndex, setPlayingSegmentIndex] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [selectedGender, setSelectedGender] = useState<string>('all');
    const [voiceListOpen, setVoiceListOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);
    const cancelRef = useRef(false);

    // ---- Voice catalogue ----------------------------------------------------

    const allVoices = useMemo<ExtendedVoice[]>(() => {
        return VOICE_OPTIONS.map((voice) => {
            const previewUrl = voice.audio
                ? `/voice-previews/${voice.audio}`
                : findVoicePreview(voice.value, voice.label)?.previewUrl || undefined;
            let normalizedGender: 'male' | 'female' | 'neutral' = 'neutral';
            const genderLower = voice.gender.toLowerCase();
            if (genderLower.includes('female')) normalizedGender = 'female';
            else if (genderLower.includes('male')) normalizedGender = 'male';
            return {
                id: voice.value,
                name: voice.label,
                description: `${voice.group} • ${voice.gender}`,
                language: voice.accent,
                gender: normalizedGender,
                previewUrl,
                group: voice.group,
                flag: voice.flag,
            } as ExtendedVoice;
        });
    }, []);

    const selectedVoice = allVoices.find((v) => v.id === voiceover.voiceId) ?? allVoices[0];

    const filteredVoices = useMemo(() => {
        let filtered = allVoices;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (v) =>
                    v.name.toLowerCase().includes(q) ||
                    v.group.toLowerCase().includes(q) ||
                    v.id.toLowerCase().includes(q)
            );
        }
        if (selectedGroup !== 'all') filtered = filtered.filter((v) => v.group === selectedGroup);
        if (selectedGender !== 'all')
            filtered = filtered.filter((v) => (v.gender ?? '').toLowerCase().includes(selectedGender));
        return filtered;
    }, [allVoices, searchQuery, selectedGroup, selectedGender]);

    const uniqueGroups = useMemo(
        () => Array.from(new Set(allVoices.map((v) => v.group))).sort(),
        [allVoices]
    );

    // Ensure a valid default voice
    useEffect(() => {
        if (allVoices.length > 0 && !allVoices.some((v) => v.id === voiceover.voiceId)) {
            editorStore.updateVoiceover({ voiceId: allVoices[0].id });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allVoices]);

    useEffect(() => {
        return () => {
            cancelRef.current = true;
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
                previewAudioRef.current = null;
            }
        };
    }, []);

    // ---- Preview playback -----------------------------------------------------

    const stopPreview = () => {
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }
        setPlayingPreviewId(null);
        setPlayingSegmentIndex(null);
    };

    const playUrl = (url: string, onDone: () => void) => {
        stopPreview();
        const audio = new Audio(url);
        previewAudioRef.current = audio;
        audio.addEventListener('ended', () => {
            onDone();
            previewAudioRef.current = null;
        });
        audio.addEventListener('error', () => {
            toast({ title: 'Playback error', description: 'Could not play audio.', variant: 'destructive' });
            onDone();
            previewAudioRef.current = null;
        });
        audio.play().catch(() => {
            onDone();
            previewAudioRef.current = null;
        });
    };

    const handlePlayVoicePreview = (voice: ExtendedVoice) => {
        if (!voice.previewUrl) {
            toast({ title: 'No preview', description: 'This voice has no preview sample.', variant: 'destructive' });
            return;
        }
        if (playingPreviewId === voice.id) {
            stopPreview();
            return;
        }
        setPlayingPreviewId(voice.id);
        playUrl(voice.previewUrl, () => setPlayingPreviewId(null));
    };

    const handlePlaySegment = (index: number) => {
        const segment = editorStore.getState().voiceover.scriptSegments[index];
        if (playingSegmentIndex === index) {
            stopPreview();
            return;
        }
        const url =
            segment?.audioUrl ||
            (segment?.audioBlob ? URL.createObjectURL(segment.audioBlob) : null);
        if (!url) {
            toast({ title: 'No audio yet', description: 'Generate this segment first.', variant: 'destructive' });
            return;
        }
        setPlayingSegmentIndex(index);
        playUrl(url, () => setPlayingSegmentIndex(null));
    };

    // ---- Generation -----------------------------------------------------------

    /** Generate audio for a single segment. Always reads fresh state from the store. */
    const generateSegment = async (index: number): Promise<boolean> => {
        const state = editorStore.getState().voiceover;
        const segment = state.scriptSegments[index];
        if (!segment || !segment.text.trim()) return false;

        setSegmentStatus((prev) => ({ ...prev, [index]: 'generating' }));
        try {
            const { audioBlob, audioUrl, duration } = await generateVoiceAudio({
                text: segment.text,
                voiceId: state.voiceId,
                speed: state.speed,
                title: `Segment ${index + 1}`,
            });

            editorStore.updateSegment(index, {
                audioUrl,
                audioBlob,
                duration,
                isGenerated: true,
            });
            setSegmentStatus((prev) => ({ ...prev, [index]: 'done' }));
            return true;
        } catch (error) {
            console.error(`Segment ${index + 1} generation failed:`, error);
            setSegmentStatus((prev) => ({ ...prev, [index]: 'error' }));
            return false;
        }
    };

    const handleGenerateAll = async (onlyMissing: boolean) => {
        const segments = editorStore.getState().voiceover.scriptSegments;
        if (segments.length === 0) {
            toast({
                title: 'No script segments',
                description: 'Write or generate a script in the Script tab first.',
                variant: 'destructive',
            });
            return;
        }
        cancelRef.current = false;
        setIsGenerating(true);
        let ok = 0;
        let attempted = 0;
        for (let i = 0; i < segments.length; i++) {
            if (cancelRef.current) break;
            const seg = editorStore.getState().voiceover.scriptSegments[i];
            if (!seg?.text.trim()) continue;
            if (onlyMissing && seg.isGenerated) continue;
            attempted++;
            if (await generateSegment(i)) ok++;
        }
        setIsGenerating(false);
        if (attempted === 0) {
            toast({ title: 'Nothing to generate', description: 'All segments already have audio.' });
        } else {
            editorStore.updateVoiceover({
                isGenerated: ok > 0,
                generatedAt: ok > 0 ? Date.now() : voiceover.generatedAt,
            });
            toast({
                title: ok === attempted ? 'Voiceover ready' : 'Voiceover partially generated',
                description: `${ok} of ${attempted} segments voiced. ${ok === attempted ? 'Scrub the timeline to hear it with your video.' : 'Retry the failed ones below.'}`,
                variant: ok === 0 ? 'destructive' : undefined,
            });
        }
    };

    const handleDownloadSegment = (index: number) => {
        const segment = voiceover.scriptSegments[index];
        if (!segment?.audioBlob) return;
        const url = URL.createObjectURL(segment.audioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voiceover-segment-${index + 1}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const segments = voiceover.scriptSegments;
    const generatedCount = segments.filter((s) => s.isGenerated).length;
    const hasScript = segments.some((s) => s.text.trim());
    const captions = voiceover.captions ?? { enabled: false, style: 'boxed' as const, position: 'bottom' as const, size: 32 };
    const updateCaptions = (updates: Partial<typeof captions>) => {
        editorStore.updateVoiceover({ captions: { ...captions, ...updates } });
    };

    return (
        <div className="flex h-full flex-col">
            {/* ---- Voice picker ---- */}
            <div className="space-y-2 border-b border-border/40 p-4">
                <Label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Mic2 className="h-3.5 w-3.5 text-primary" />
                    Narrator voice
                </Label>

                {/* Selected voice card */}
                <div className="flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 p-2.5">
                    <span className="text-xl">{selectedVoice?.flag}</span>
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{selectedVoice?.name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                            {selectedVoice?.group} · {selectedVoice?.gender}
                        </div>
                    </div>
                    {selectedVoice?.previewUrl && (
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => handlePlayVoicePreview(selectedVoice)}
                            title="Preview this voice"
                        >
                            {playingPreviewId === selectedVoice.id ? (
                                <Pause className="h-3.5 w-3.5" />
                            ) : (
                                <Play className="h-3.5 w-3.5" />
                            )}
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 text-xs"
                        onClick={() => setVoiceListOpen((v) => !v)}
                    >
                        Change
                        {voiceListOpen ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
                    </Button>
                </div>

                {/* Voice browser */}
                {voiceListOpen && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <div className="relative">
                            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search voices…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 border-border/40 bg-background/50 pl-7 pr-7 text-xs"
                            />
                            {searchQuery && (
                                <button
                                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setSearchQuery('')}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                                <SelectTrigger className="h-8 border-border/40 bg-background/50 text-xs">
                                    <SelectValue placeholder="All languages" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[260px]">
                                    <SelectItem value="all">All languages</SelectItem>
                                    {uniqueGroups.map((group) => (
                                        <SelectItem key={group} value={group}>
                                            {group}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={selectedGender} onValueChange={setSelectedGender}>
                                <SelectTrigger className="h-8 w-28 shrink-0 border-border/40 bg-background/50 text-xs">
                                    <SelectValue placeholder="Any" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Any gender</SelectItem>
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="max-h-[220px] space-y-1 overflow-y-auto pr-1">
                            {filteredVoices.length === 0 && (
                                <p className="py-6 text-center text-xs text-muted-foreground">No voices match.</p>
                            )}
                            {filteredVoices.map((voice) => (
                                <div
                                    key={voice.id}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 transition-all',
                                        voiceover.voiceId === voice.id
                                            ? 'border-primary/30 bg-primary/10'
                                            : 'border-transparent hover:border-border/40 hover:bg-background/60'
                                    )}
                                    onClick={() => {
                                        editorStore.updateVoiceover({ voiceId: voice.id });
                                        setVoiceListOpen(false);
                                    }}
                                >
                                    <span className="text-base">{voice.flag}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="truncate text-xs font-medium">{voice.name}</span>
                                            <span className="rounded bg-muted/50 px-1 py-px text-[9px] text-muted-foreground">
                                                {voice.gender}
                                            </span>
                                        </div>
                                        <span className="block truncate text-[10px] text-muted-foreground">{voice.group}</span>
                                    </div>
                                    {voice.previewUrl && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePlayVoicePreview(voice);
                                            }}
                                        >
                                            {playingPreviewId === voice.id ? (
                                                <Pause className="h-3 w-3" />
                                            ) : (
                                                <Play className="h-3 w-3" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Delivery settings */}
                <button
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setSettingsOpen((v) => !v)}
                >
                    <SlidersHorizontal className="h-3 w-3" />
                    Delivery — {voiceover.speed.toFixed(1)}x speed · pitch {voiceover.pitch > 0 ? '+' : ''}
                    {voiceover.pitch} · {voiceover.volume}% volume
                    {settingsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {settingsOpen && (
                    <div className="space-y-3 rounded-lg border border-border/30 bg-background/40 p-3 animate-in fade-in slide-in-from-top-1">
                        {(
                            [
                                { key: 'speed', label: 'Speed', min: 0.5, max: 2, step: 0.1, format: (v: number) => `${v.toFixed(1)}x` },
                                { key: 'pitch', label: 'Pitch', min: -20, max: 20, step: 1, format: (v: number) => `${v > 0 ? '+' : ''}${v}` },
                                { key: 'volume', label: 'Volume', min: 0, max: 100, step: 1, format: (v: number) => `${v}%` },
                            ] as const
                        ).map(({ key, label, min, max, step, format }) => (
                            <div key={key} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                        {format(voiceover[key] as number)}
                                    </span>
                                </div>
                                <Slider
                                    min={min}
                                    max={max}
                                    step={step}
                                    value={[voiceover[key] as number]}
                                    onValueChange={([v]) => editorStore.updateVoiceover({ [key]: v })}
                                />
                            </div>
                        ))}
                        <p className="text-[10px] text-muted-foreground">
                            Changing delivery settings affects newly generated audio — regenerate segments to apply.
                        </p>
                    </div>
                )}
            </div>

            {/* ---- Generate actions ---- */}
            <div className="space-y-2 border-b border-border/40 p-4">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Voiceover
                    </Label>
                    {segments.length > 0 && (
                        <span
                            className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                                generatedCount === segments.length && segments.length > 0
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted/60 text-muted-foreground'
                            )}
                        >
                            {generatedCount}/{segments.length} voiced
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => handleGenerateAll(false)}
                        disabled={isGenerating || !hasScript}
                        size="sm"
                        className="flex-1 shadow-md shadow-primary/20"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                Generating…
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-3.5 w-3.5" />
                                {generatedCount > 0 ? 'Regenerate all' : 'Generate voiceover'}
                            </>
                        )}
                    </Button>
                    {generatedCount > 0 && generatedCount < segments.length && !isGenerating && (
                        <Button
                            onClick={() => handleGenerateAll(true)}
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            title="Only generate segments that don't have audio yet"
                        >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Missing only
                        </Button>
                    )}
                    {isGenerating && (
                        <Button
                            onClick={() => {
                                cancelRef.current = true;
                            }}
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                        >
                            Stop
                        </Button>
                    )}
                </div>

                {/* Captions */}
                <div className="space-y-2 rounded-lg border border-border/30 bg-background/40 p-2.5">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Burned-in captions</Label>
                        <Switch
                            checked={captions.enabled}
                            onCheckedChange={(c) => updateCaptions({ enabled: c })}
                            className="scale-90"
                        />
                    </div>
                    {captions.enabled && (
                        <div className="space-y-2.5 animate-in fade-in slide-in-from-top-1">
                            <div className="flex gap-1.5">
                                {(
                                    [
                                        { id: 'boxed', label: 'Boxed' },
                                        { id: 'clean', label: 'Clean' },
                                        { id: 'gradient', label: 'Gradient' },
                                    ] as const
                                ).map(({ id, label }) => (
                                    <button
                                        key={id}
                                        className={cn(
                                            'flex-1 rounded-md border py-1.5 text-[10px] font-medium transition-all',
                                            captions.style === id
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-border/50 text-muted-foreground hover:text-foreground'
                                        )}
                                        onClick={() => updateCaptions({ style: id })}
                                    >
                                        {label}
                                    </button>
                                ))}
                                <button
                                    className="flex-1 rounded-md border border-border/50 py-1.5 text-[10px] font-medium text-muted-foreground transition-all hover:text-foreground"
                                    onClick={() => updateCaptions({ position: captions.position === 'bottom' ? 'top' : 'bottom' })}
                                    title="Toggle caption position"
                                >
                                    {captions.position === 'bottom' ? '↓ Bottom' : '↑ Top'}
                                </button>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] uppercase text-muted-foreground">Size</Label>
                                    <span className="font-mono text-[10px] text-muted-foreground">{captions.size}px</span>
                                </div>
                                <Slider min={18} max={64} step={1} value={[captions.size]} onValueChange={([v]) => updateCaptions({ size: v })} />
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Your script segments appear as subtitles in the preview and are burned into the export.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ---- Segments ---- */}
            <div className="flex-1 overflow-y-auto p-4">
                {segments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="mb-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                            <FileText className="h-8 w-8 text-primary/60" />
                        </div>
                        <p className="mb-1 text-sm font-medium">Script comes first</p>
                        <p className="max-w-[240px] text-xs text-muted-foreground">
                            Write your narration in the Script tab — each segment becomes a voiced audio clip
                            timed to your video.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {segments.map((segment, index) => {
                            const status: SegmentStatus =
                                segmentStatus[index] === 'generating'
                                    ? 'generating'
                                    : segment.isGenerated
                                        ? 'done'
                                        : segmentStatus[index] === 'error'
                                            ? 'error'
                                            : 'idle';
                            return (
                                <div
                                    key={segment.id ?? index}
                                    className={cn(
                                        'group rounded-lg border p-2.5 transition-all',
                                        status === 'done'
                                            ? 'border-primary/20 bg-primary/5'
                                            : status === 'error'
                                                ? 'border-destructive/30 bg-destructive/5'
                                                : 'border-border/40 bg-card/40'
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-primary"
                                            onClick={() => editorStore.setPlayback({ currentTime: segment.timestamp })}
                                            title="Jump playhead here"
                                        >
                                            {formatTime(segment.timestamp)}
                                        </button>
                                        {status === 'done' && (
                                            <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
                                                <Check className="h-3 w-3" />
                                                {segment.duration ? `${Math.round(segment.duration)}s` : 'ready'}
                                            </span>
                                        )}
                                        {status === 'generating' && (
                                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                generating…
                                            </span>
                                        )}
                                        {status === 'error' && (
                                            <span className="flex items-center gap-1 text-[10px] text-destructive">
                                                <AlertTriangle className="h-3 w-3" />
                                                failed
                                            </span>
                                        )}
                                        <div className="ml-auto flex items-center gap-1">
                                            {status === 'done' && (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => handlePlaySegment(index)}
                                                        title="Play this clip"
                                                    >
                                                        {playingSegmentIndex === index ? (
                                                            <Pause className="h-3.5 w-3.5" />
                                                        ) : (
                                                            <Play className="h-3.5 w-3.5" />
                                                        )}
                                                    </Button>
                                                    {segment.audioBlob && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                                                            onClick={() => handleDownloadSegment(index)}
                                                            title="Download mp3"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                            {(status === 'idle' || status === 'error' || status === 'done') && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        'h-6 w-6',
                                                        status !== 'error' && 'opacity-0 transition-opacity group-hover:opacity-100'
                                                    )}
                                                    disabled={isGenerating || !segment.text.trim()}
                                                    onClick={async () => {
                                                        const ok = await generateSegment(index);
                                                        if (ok) {
                                                            editorStore.updateVoiceover({ isGenerated: true, generatedAt: Date.now() });
                                                        }
                                                    }}
                                                    title={status === 'done' ? 'Regenerate this segment' : 'Generate this segment'}
                                                >
                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">{segment.text || <span className="italic text-muted-foreground">Empty segment — add text in the Script tab</span>}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
