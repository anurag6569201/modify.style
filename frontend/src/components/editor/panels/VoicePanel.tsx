
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
        <div className="space-y-6 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <Label className="font-semibold flex items-center gap-2">
                    <Mic2 className="h-4 w-4" />
                    AI Voiceover
                </Label>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Select Voice Actor</Label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {voiceOptions.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                    <div className="flex flex-col py-1">
                                        <span className="font-medium">{voice.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {voice.description}
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="bg-secondary/20 border border-border/50 rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Mic2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="font-medium text-sm">Ready to Generate</h4>
                        <p className="text-xs text-muted-foreground max-w-[200px]">
                            Generate a lifelike AI voiceover based on your script.
                        </p>
                    </div>
                    <Button
                        onClick={handleGenerateVoice}
                        disabled={isGeneratingVoice}
                        className="w-full"
                    >
                        {isGeneratingVoice ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <PlayCircle className="mr-2 h-4 w-4" />
                        )}
                        Generate Voiceover
                    </Button>
                </div>
            </div>
        </div>
    );
}
