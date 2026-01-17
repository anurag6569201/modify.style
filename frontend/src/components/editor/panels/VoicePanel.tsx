
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mic2, Loader2, PlayCircle, Download, Volume2, Play, Pause, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { greabyAPI, GreabyVoice } from '@/lib/api/greaby';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { Textarea } from '@/components/ui/textarea';
import { findVoicePreview, getAllVoicePreviews } from '@/lib/api/voice-previews';
import { VOICE_OPTIONS } from '@/lib/api/voices';

interface ExtendedVoice extends GreabyVoice {
    group: string;
    flag: string;
}

export function VoicePanel() {
    const { toast } = useToast();
    const editorState = useEditorState();
    const [voices, setVoices] = useState<ExtendedVoice[]>([]);
    const [isLoadingVoices, setIsLoadingVoices] = useState(true);
    const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
    const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [selectedGender, setSelectedGender] = useState<string>('all');
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    // Convert VOICE_OPTIONS to GreabyVoice format and enhance with preview URLs
    const allVoices = useMemo(() => {
        return VOICE_OPTIONS.map(voice => {
            const previewUrl = voice.audio 
                ? `/voice-previews/${voice.audio}` 
                : findVoicePreview(voice.value, voice.label)?.previewUrl || undefined;
            
            // Normalize gender - handle cases like "Female, Child" -> "female"
            let normalizedGender: 'male' | 'female' | 'neutral' = 'neutral';
            const genderLower = voice.gender.toLowerCase();
            if (genderLower.includes('female')) {
                normalizedGender = 'female';
            } else if (genderLower.includes('male')) {
                normalizedGender = 'male';
            }
            
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

    // Filter voices based on search, group, and gender
    const filteredVoices = useMemo(() => {
        let filtered = allVoices;

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(voice => 
                voice.name.toLowerCase().includes(query) ||
                voice.group.toLowerCase().includes(query) ||
                voice.id.toLowerCase().includes(query)
            );
        }

        // Filter by group
        if (selectedGroup !== 'all') {
            filtered = filtered.filter(voice => voice.group === selectedGroup);
        }

        // Filter by gender
        if (selectedGender !== 'all') {
            filtered = filtered.filter(voice => {
                const voiceGender = voice.gender?.toLowerCase() || '';
                return voiceGender.includes(selectedGender.toLowerCase());
            });
        }

        return filtered;
    }, [allVoices, searchQuery, selectedGroup, selectedGender]);

    // Get unique groups for filter
    const uniqueGroups = useMemo(() => {
        const groups = Array.from(new Set(allVoices.map(v => v.group))).sort();
        return groups;
    }, [allVoices]);

    // Set voices and default voice on mount
    useEffect(() => {
        setIsLoadingVoices(true);
        setVoices(allVoices);
        
        // Set default voice if not set
        if (allVoices.length > 0 && !editorState.voiceover.voiceId) {
            editorStore.setState({
                voiceover: {
                    ...editorState.voiceover,
                    voiceId: allVoices[0].id,
                },
            });
        }
        setIsLoadingVoices(false);
    }, [allVoices]);

    // Cleanup audio preview URL on unmount
    useEffect(() => {
        return () => {
            if (audioPreviewUrl) {
                URL.revokeObjectURL(audioPreviewUrl);
            }
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
                previewAudioRef.current = null;
            }
        };
    }, [audioPreviewUrl]);

    // Handle voice preview playback
    const handlePlayPreview = (voiceId: string, previewUrl?: string) => {
        if (!previewUrl) {
            toast({
                title: "No preview available",
                description: "Preview audio is not available for this voice.",
                variant: "destructive",
            });
            return;
        }

        // Stop current preview if playing
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }

        // Play new preview
        const audio = new Audio(previewUrl);
        previewAudioRef.current = audio;
        setPlayingPreviewId(voiceId);

        audio.addEventListener('ended', () => {
            setPlayingPreviewId(null);
            previewAudioRef.current = null;
        });

        audio.addEventListener('error', () => {
            toast({
                title: "Preview error",
                description: "Could not play voice preview.",
                variant: "destructive",
            });
            setPlayingPreviewId(null);
            previewAudioRef.current = null;
        });

        audio.play().catch((error) => {
            console.error('Error playing preview:', error);
            toast({
                title: "Playback error",
                description: "Could not play voice preview.",
                variant: "destructive",
            });
            setPlayingPreviewId(null);
            previewAudioRef.current = null;
        });
    };

    const handleStopPreview = () => {
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }
        setPlayingPreviewId(null);
    };

    const handleGenerateVoice = async () => {
        const script = editorState.voiceover.script || '';
        
        if (!script.trim()) {
            toast({
                title: "No script found",
                description: "Please add a script in the Script panel first.",
                variant: "destructive",
            });
            return;
        }

        setIsGeneratingVoice(true);
        setGenerationProgress(0);

        try {
            // Generate audio using Greaby API
            const response = await greabyAPI.generateAudio({
                text: script,
                voiceId: editorState.voiceover.voiceId,
                speed: editorState.voiceover.speed,
                pitch: editorState.voiceover.pitch,
                volume: editorState.voiceover.volume,
                format: 'mp3',
            });

            if (!response.success) {
                // If it's a Web Speech API fallback message, handle it
                if (response.message && response.message.includes('browser TTS')) {
                    // Use Web Speech API to speak the text
                    const { generateAudioWithWebSpeech } = await import('@/lib/api/web-speech-tts');
                    const ttsResult = await generateAudioWithWebSpeech({
                        text: script,
                        voiceId: editorState.voiceover.voiceId,
                        speed: editorState.voiceover.speed,
                        pitch: editorState.voiceover.pitch,
                        volume: editorState.voiceover.volume,
                    });

                    if (ttsResult.success) {
                        toast({
                            title: "Preview generated!",
                            description: response.message || "Using browser TTS for preview. Configure Greaby API for downloadable audio.",
                        });
                        return;
                    }
                }
                throw new Error(response.error || 'Failed to generate audio');
            }

            // Handle Web Speech API fallback (message but no audio data)
            if (response.message && !response.audioUrl && !response.audioData) {
                const { generateAudioWithWebSpeech } = await import('@/lib/api/web-speech-tts');
                const ttsResult = await generateAudioWithWebSpeech({
                    text: script,
                    voiceId: editorState.voiceover.voiceId,
                    speed: editorState.voiceover.speed,
                    pitch: editorState.voiceover.pitch,
                    volume: editorState.voiceover.volume,
                });

                if (ttsResult.success) {
                    toast({
                        title: "Preview generated!",
                        description: response.message || "Using browser TTS for preview. Configure Greaby API for downloadable audio.",
                    });
                }
                return;
            }

            // Handle async job if jobId is returned
            let finalAudioUrl = response.audioUrl;
            let finalAudioBlob: Blob | null = null;

            if (response.jobId && !response.audioUrl) {
                // Poll for job completion
                const jobResult = await greabyAPI.waitForJobCompletion(
                    response.jobId,
                    (progress) => setGenerationProgress(progress),
                    60000, // 60 seconds max wait
                    1000   // Poll every second
                );

                if (!jobResult.success || !jobResult.audioUrl) {
                    throw new Error(jobResult.error || 'Job failed or timed out');
                }

                finalAudioUrl = jobResult.audioUrl;
            }

            // Download audio if we have a URL
            if (finalAudioUrl) {
                finalAudioBlob = await greabyAPI.downloadAudio(finalAudioUrl);
                const previewUrl = URL.createObjectURL(finalAudioBlob);
                setAudioPreviewUrl(previewUrl);

                // Create audio element to get duration
                const audio = new Audio(previewUrl);
                const duration = await new Promise<number>((resolve) => {
                    audio.addEventListener('loadedmetadata', () => {
                        resolve(audio.duration);
                    });
                    audio.addEventListener('error', () => {
                        resolve(0);
                    });
                });

                // Update editor store with generated audio
                editorStore.setState({
                    voiceover: {
                        ...editorState.voiceover,
                        script: script,
                        audioUrl: finalAudioUrl,
                        audioBlob: finalAudioBlob,
                        duration: duration || response.duration || 0,
                        isGenerated: true,
                        generatedAt: Date.now(),
                    },
                });

                toast({
                    title: "Voice generated!",
                    description: `AI voiceover has been created (${Math.round(duration || 0)}s).`,
                });
            } else if (response.audioData) {
                // Handle base64 audio data
                const mimeType = 'audio/mpeg';
                const blob = greabyAPI.base64ToBlob(response.audioData, mimeType);
                const previewUrl = URL.createObjectURL(blob);
                setAudioPreviewUrl(previewUrl);

                editorStore.setState({
                    voiceover: {
                        ...editorState.voiceover,
                        script: script,
                        audioUrl: previewUrl,
                        audioBlob: blob,
                        duration: response.duration || 0,
                        isGenerated: true,
                        generatedAt: Date.now(),
                    },
                });

                toast({
                    title: "Voice generated!",
                    description: `AI voiceover has been created (${Math.round(response.duration || 0)}s).`,
                });
            }
        } catch (error) {
            console.error('Error generating voice:', error);
            toast({
                title: "Generation failed",
                description: error instanceof Error ? error.message : "Failed to generate audio. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsGeneratingVoice(false);
            setGenerationProgress(0);
        }
    };

    const handlePlayGeneratedAudio = () => {
        if (audioPreviewUrl) {
            const audio = new Audio(audioPreviewUrl);
            audio.play().catch((error) => {
                console.error('Error playing audio:', error);
                toast({
                    title: "Playback error",
                    description: "Could not play audio preview.",
                    variant: "destructive",
                });
            });
        }
    };

    const handleDownloadAudio = () => {
        if (editorState.voiceover.audioBlob) {
            const url = URL.createObjectURL(editorState.voiceover.audioBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `voiceover-${Date.now()}.mp3`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            toast({
                title: "Audio downloaded",
                description: "Voiceover audio file has been downloaded.",
            });
        }
    };

    const updateVoiceoverConfig = (updates: Partial<typeof editorState.voiceover>) => {
        editorStore.setState({
            voiceover: {
                ...editorState.voiceover,
                ...updates,
            },
        });
    };

    return (
        <div className="space-y-6 p-2 pb-20">
            <div className="bg-card/40 backdrop-blur-sm rounded-xl border-none shadow-sm space-y-4">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    <Mic2 className="h-3.5 w-3.5" />
                    AI Voiceover (Greaby)
                </Label>

                {/* Script Input */}
                <div className="space-y-2 pb-4 border-b border-border/10">
                    <Label className="text-xs text-muted-foreground">Script Text</Label>
                    <Textarea
                        value={editorState.voiceover.script}
                        onChange={(e) => updateVoiceoverConfig({ script: e.target.value })}
                        placeholder="Enter or paste your script text here..."
                        className="min-h-[100px] text-sm bg-background/50 border-border/40 resize-none"
                    />
                    <div className="flex justify-end text-[10px] text-muted-foreground">
                        {editorState.voiceover.script.split(' ').filter(w => w.trim()).length} words
                    </div>
                </div>

                {/* Voice Selection */}
                <div className="space-y-3 pb-4 border-b border-border/10">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Select Voice Persona</Label>
                        {playingPreviewId && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleStopPreview}
                                className="h-6 text-[10px] px-2"
                            >
                                <Pause className="h-3 w-3 mr-1" />
                                Stop Preview
                            </Button>
                        )}
                    </div>

                    {/* Search and Filters */}
                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search voices by name, language, or ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 pr-8 h-9 text-sm bg-background/50 border-border/40"
                            />
                            {searchQuery && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1 h-7 w-7"
                                    onClick={() => setSearchQuery('')}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                        
                        <div className="flex gap-2">
                            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                                <SelectTrigger className="h-9 text-xs bg-background/50 border-border/40">
                                    <SelectValue placeholder="All Languages" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Languages</SelectItem>
                                    {uniqueGroups.map(group => (
                                        <SelectItem key={group} value={group}>
                                            {group}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            
                            <Select value={selectedGender} onValueChange={setSelectedGender}>
                                <SelectTrigger className="h-9 text-xs bg-background/50 border-border/40">
                                    <SelectValue placeholder="All Genders" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Genders</SelectItem>
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                    <SelectItem value="neutral">Neutral</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Voice Count */}
                    <div className="text-[10px] text-muted-foreground">
                        {filteredVoices.length} {filteredVoices.length === 1 ? 'voice' : 'voices'} available
                    </div>

                    {/* Quick Select Dropdown */}
                    <Select 
                        value={editorState.voiceover.voiceId} 
                        onValueChange={(value) => updateVoiceoverConfig({ voiceId: value })}
                        disabled={isLoadingVoices}
                    >
                        <SelectTrigger className="h-10 bg-background/50 border-border/40 focus:ring-primary/20">
                            <SelectValue placeholder={isLoadingVoices ? "Loading voices..." : "Quick Select Voice"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {filteredVoices.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id} className="cursor-pointer focus:bg-primary/10">
                                    <div className="flex items-center justify-between w-full pr-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="text-base">{voice.flag}</span>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="font-medium text-sm truncate">{voice.name}</span>
                                                <span className="text-[11px] text-muted-foreground truncate">
                                                    {voice.group}
                                                </span>
                                            </div>
                                        </div>
                                        {voice.previewUrl && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 ml-2 flex-shrink-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (playingPreviewId === voice.id) {
                                                        handleStopPreview();
                                                    } else {
                                                        handlePlayPreview(voice.id, voice.previewUrl);
                                                    }
                                                }}
                                            >
                                                {playingPreviewId === voice.id ? (
                                                    <Pause className="h-3.5 w-3.5" />
                                                ) : (
                                                    <Play className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    
                    {/* Voice List - Grouped by Language */}
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {(() => {
                            // Group filtered voices by language group
                            const grouped = filteredVoices.reduce((acc, voice) => {
                                const group = voice.group || 'Other';
                                if (!acc[group]) {
                                    acc[group] = [];
                                }
                                acc[group].push(voice);
                                return acc;
                            }, {} as Record<string, typeof filteredVoices>);

                            const sortedGroups = Object.keys(grouped).sort();

                            if (sortedGroups.length === 0) {
                                return (
                                    <div className="text-center py-8 text-sm text-muted-foreground">
                                        No voices found matching your criteria
                                    </div>
                                );
                            }

                            return sortedGroups.map(group => (
                                <div key={group} className="space-y-2">
                                    <div className="flex items-center gap-2 px-2 py-1 bg-background/30 rounded-md">
                                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                            {group}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground/70">
                                            ({grouped[group].length})
                                        </span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {grouped[group].map((voice) => (
                                            <div
                                                key={voice.id}
                                                className={`flex items-center justify-between p-2.5 rounded-md border transition-all cursor-pointer ${
                                                    editorState.voiceover.voiceId === voice.id
                                                        ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                                                        : 'bg-background/30 border-border/20 hover:bg-background/50 hover:border-border/40'
                                                }`}
                                                onClick={() => updateVoiceoverConfig({ voiceId: voice.id })}
                                            >
                                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                    <span className="text-lg flex-shrink-0">{voice.flag}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-sm truncate">
                                                                {voice.name}
                                                            </span>
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                                                                {voice.gender}
                                                            </span>
                                                        </div>
                                                        <span className="text-[11px] text-muted-foreground block truncate">
                                                            {voice.id}
                                                        </span>
                                                    </div>
                                                </div>
                                                {voice.previewUrl && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 flex-shrink-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (playingPreviewId === voice.id) {
                                                                handleStopPreview();
                                                            } else {
                                                                handlePlayPreview(voice.id, voice.previewUrl);
                                                            }
                                                        }}
                                                    >
                                                        {playingPreviewId === voice.id ? (
                                                            <Pause className="h-4 w-4" />
                                                        ) : (
                                                            <Play className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>

                {/* Audio Settings */}
                <div className="space-y-4 pb-4 border-b border-border/10">
                    <Label className="text-xs text-muted-foreground">Audio Settings</Label>
                    
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Speed</Label>
                            <span className="text-xs font-mono text-muted-foreground">
                                {editorState.voiceover.speed.toFixed(1)}x
                            </span>
                        </div>
                        <Slider
                            value={[editorState.voiceover.speed]}
                            onValueChange={([value]) => updateVoiceoverConfig({ speed: value })}
                            min={0.5}
                            max={2.0}
                            step={0.1}
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Pitch</Label>
                            <span className="text-xs font-mono text-muted-foreground">
                                {editorState.voiceover.pitch > 0 ? '+' : ''}{editorState.voiceover.pitch}
                            </span>
                        </div>
                        <Slider
                            value={[editorState.voiceover.pitch]}
                            onValueChange={([value]) => updateVoiceoverConfig({ pitch: value })}
                            min={-20}
                            max={20}
                            step={1}
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Volume</Label>
                            <span className="text-xs font-mono text-muted-foreground">
                                {editorState.voiceover.volume}%
                            </span>
                        </div>
                        <Slider
                            value={[editorState.voiceover.volume]}
                            onValueChange={([value]) => updateVoiceoverConfig({ volume: value })}
                            min={0}
                            max={100}
                            step={1}
                            className="w-full"
                        />
                    </div>
                </div>

                {/* Generation Status */}
                {isGeneratingVoice && generationProgress > 0 && (
                    <div className="space-y-2 pb-4 border-b border-border/10">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Generating...</Label>
                            <span className="text-xs font-mono text-muted-foreground">
                                {generationProgress}%
                            </span>
                        </div>
                        <div className="w-full bg-background/50 rounded-full h-2">
                            <div
                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                style={{ width: `${generationProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Generated Audio Preview */}
                {editorState.voiceover.isGenerated && editorState.voiceover.audioUrl && (
                    <div className="space-y-3 pb-4 border-b border-border/10">
                        <Label className="text-xs text-muted-foreground">Generated Audio</Label>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePlayGeneratedAudio}
                                className="flex-1"
                            >
                                <Volume2 className="mr-2 h-4 w-4" />
                                Preview
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownloadAudio}
                                className="flex-1"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download
                            </Button>
                        </div>
                        {editorState.voiceover.duration > 0 && (
                            <p className="text-[10px] text-muted-foreground text-center">
                                Duration: {Math.round(editorState.voiceover.duration)}s
                            </p>
                        )}
                    </div>
                )}

                {/* Generate Button */}
                <div className="bg-background/20 border border-border/20 rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-50" />
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shadow-inner ring-1 ring-primary/20 group-hover:scale-105 transition-transform duration-500">
                        <Mic2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1 relative z-10">
                        <h4 className="font-medium text-sm">
                            {editorState.voiceover.isGenerated ? 'Regenerate Audio' : 'Ready to Generate'}
                        </h4>
                        <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto leading-relaxed">
                            Generate a lifelike AI voiceover using Greaby API.
                        </p>
                    </div>
                    <Button
                        onClick={handleGenerateVoice}
                        disabled={isGeneratingVoice || !editorState.voiceover.script.trim()}
                        className="w-full relative z-10 shadow-lg shadow-primary/20"
                        size="sm"
                    >
                        {isGeneratingVoice ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <PlayCircle className="mr-2 h-4 w-4" />
                                Generate Audio
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
