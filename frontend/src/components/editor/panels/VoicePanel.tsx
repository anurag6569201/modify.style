
import React, { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Mic2, Loader2, PlayCircle, Download, Volume2, Play, Pause } from 'lucide-react';
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

export function VoicePanel() {
    const { toast } = useToast();
    const editorState = useEditorState();
    const [voices, setVoices] = useState<GreabyVoice[]>([]);
    const [isLoadingVoices, setIsLoadingVoices] = useState(true);
    const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
    const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    // Load voices from Greaby API on mount
    useEffect(() => {
        const loadVoices = async () => {
            setIsLoadingVoices(true);
            try {
                const availableVoices = await greabyAPI.getVoices();
                
                // If API returned voices, use them; otherwise use all available preview voices
                let voicesToUse: GreabyVoice[];
                
                if (availableVoices.length > 0) {
                    // Enhance API voices with preview URLs
                    voicesToUse = availableVoices.map(voice => {
                        const preview = findVoicePreview(voice.id, voice.name);
                        return {
                            ...voice,
                            previewUrl: preview?.previewUrl,
                        };
                    });
                } else {
                    // Use all available voice previews as fallback
                    const previewVoices = getAllVoicePreviews();
                    voicesToUse = previewVoices.map(preview => ({
                        id: preview.voiceId,
                        name: preview.name,
                        description: `${preview.name} voice${preview.language ? ` (${preview.language})` : ''}${preview.quality ? ` - ${preview.quality.toUpperCase()}` : ''}`,
                        language: preview.language,
                        gender: preview.gender,
                        previewUrl: preview.previewUrl,
                    }));
                }
                
                setVoices(voicesToUse);
                
                // Set default voice if not set
                if (voicesToUse.length > 0 && !editorState.voiceover.voiceId) {
                    editorStore.setState({
                        voiceover: {
                            ...editorState.voiceover,
                            voiceId: voicesToUse[0].id,
                        },
                    });
                }
            } catch (error) {
                console.error('Failed to load voices:', error);
                // Use all available voice previews as fallback
                const previewVoices = getAllVoicePreviews();
                const fallbackVoices: GreabyVoice[] = previewVoices.map(preview => ({
                    id: preview.voiceId,
                    name: preview.name,
                    description: `${preview.name} voice${preview.language ? ` (${preview.language})` : ''}${preview.quality ? ` - ${preview.quality.toUpperCase()}` : ''}`,
                    language: preview.language,
                    gender: preview.gender,
                    previewUrl: preview.previewUrl,
                }));
                setVoices(fallbackVoices);
                
                if (fallbackVoices.length > 0 && !editorState.voiceover.voiceId) {
                    editorStore.setState({
                        voiceover: {
                            ...editorState.voiceover,
                            voiceId: fallbackVoices[0].id,
                        },
                    });
                }
            } finally {
                setIsLoadingVoices(false);
            }
        };

        loadVoices();
    }, []);

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
                    <Select 
                        value={editorState.voiceover.voiceId} 
                        onValueChange={(value) => updateVoiceoverConfig({ voiceId: value })}
                        disabled={isLoadingVoices}
                    >
                        <SelectTrigger className="h-10 bg-background/50 border-border/40 focus:ring-primary/20">
                            <SelectValue placeholder={isLoadingVoices ? "Loading voices..." : "Select a voice"} />
                        </SelectTrigger>
                        <SelectContent>
                            {voices.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id} className="cursor-pointer focus:bg-primary/10">
                                    <div className="flex items-center justify-between w-full pr-2">
                                        <div className="flex flex-col py-1 flex-1">
                                            <span className="font-medium text-sm">{voice.name}</span>
                                            <span className="text-[11px] text-muted-foreground">
                                                {voice.description}
                                            </span>
                                        </div>
                                        {voice.previewUrl && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 ml-2"
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
                    
                    {/* Voice Preview List (Alternative View) */}
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {voices.map((voice) => (
                            <div
                                key={voice.id}
                                className={`flex items-center justify-between p-2 rounded-md border transition-all ${
                                    editorState.voiceover.voiceId === voice.id
                                        ? 'bg-primary/10 border-primary/30'
                                        : 'bg-background/30 border-border/20 hover:bg-background/50'
                                }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => updateVoiceoverConfig({ voiceId: voice.id })}
                                            className="text-left flex-1 min-w-0"
                                        >
                                            <span className="font-medium text-sm block truncate">{voice.name}</span>
                                            <span className="text-[11px] text-muted-foreground block truncate">
                                                {voice.description}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                {voice.previewUrl && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 flex-shrink-0"
                                        onClick={() => {
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
