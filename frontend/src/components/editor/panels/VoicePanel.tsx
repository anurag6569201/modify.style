
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Mic2, Loader2, PlayCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const voiceOptions = [
    { id: "emma", name: "Emma", description: "Professional, warm female voice" },
    { id: "james", name: "James", description: "Clear, confident male voice" },
    { id: "sarah", name: "Sarah", description: "Friendly, casual female voice" },
];

export function VoicePanel() {
    const { toast } = useToast();
    const [selectedVoice, setSelectedVoice] = useState("emma");
    const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);

    const handleGenerateVoice = async () => {
        setIsGeneratingVoice(true);
        await new Promise((resolve) => setTimeout(resolve, 2500));
        setIsGeneratingVoice(false);
        toast({
            title: "Voice generated!",
            description: "AI voiceover has been added to your video.",
        });
    };

    return (
        <div className="space-y-6 p-2 pb-20">
            <div className="bg-card/40 backdrop-blur-sm rounded-xl border-none shadow-sm space-y-4">
                <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    <Mic2 className="h-3.5 w-3.5" />
                    AI Voiceover
                </Label>

                <div className="space-y-3 pb-4 border-b border-border/10">
                    <Label className="text-xs text-muted-foreground">Select Voice Persona</Label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                        <SelectTrigger className="h-10 bg-background/50 border-border/40 focus:ring-primary/20">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {voiceOptions.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id} className="cursor-pointer focus:bg-primary/10">
                                    <div className="flex flex-col py-1">
                                        <span className="font-medium text-sm">{voice.name}</span>
                                        <span className="text-[11px] text-muted-foreground">
                                            {voice.description}
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="bg-background/20 border border-border/20 rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-50" />
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shadow-inner ring-1 ring-primary/20 group-hover:scale-105 transition-transform duration-500">
                        <Mic2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1 relative z-10">
                        <h4 className="font-medium text-sm">Ready to Generate</h4>
                        <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto leading-relaxed">
                            Generate a lifelike AI voiceover directly from your script.
                        </p>
                    </div>
                    <Button
                        onClick={handleGenerateVoice}
                        disabled={isGeneratingVoice}
                        className="w-full relative z-10 shadow-lg shadow-primary/20"
                        size="sm"
                    >
                        {isGeneratingVoice ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <PlayCircle className="mr-2 h-4 w-4" />
                        )}
                        Generate Audio
                    </Button>
                </div>
            </div>
        </div>
    );
}
