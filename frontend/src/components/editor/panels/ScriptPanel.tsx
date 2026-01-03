
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Wand2, Loader2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ScriptPanel() {
    const { toast } = useToast();
    const [script, setScript] = useState(
        "Welcome to our product demo. In this video, we'll walk you through the key features that make our platform stand out. Let's start by clicking on the Get Started button to begin the onboarding process..."
    );
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);

    const handleGenerateScript = async () => {
        setIsGeneratingScript(true);
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setScript(
            "Welcome to our platform walkthrough. Today, I'll show you how to get started in just a few simple steps.\n\nFirst, we'll click on the Get Started button to begin the onboarding process. Notice how intuitive the interface is.\n\nNext, let's scroll down to explore the features section. Here you can see all the powerful tools at your disposal.\n\nNow, click on the Dashboard tab to access your analytics. The dashboard provides real-time insights into your performance.\n\nFinally, use the search functionality to find exactly what you need. Just type your query and click the search icon."
        );
        setIsGeneratingScript(false);
        toast({
            title: "Script generated!",
            description: "AI has created a script based on your recording.",
        });
    };

    return (
        <div className="space-y-6 p-4 h-full flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <Label className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Video Script
                </Label>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript}
                    className="h-7 text-xs"
                >
                    {isGeneratingScript ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                        <Wand2 className="mr-2 h-3 w-3" />
                    )}
                    Generate AI Script
                </Button>
            </div>

            <div className="flex-1 flex flex-col space-y-2">
                <Textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder="Enter your video script here..."
                    className="flex-1 resize-none font-mono text-sm leading-relaxed"
                />
                <p className="text-xs text-muted-foreground text-right">
                    {script.split(" ").length} words • ~{Math.ceil(script.split(" ").length / 2.5)}s read time
                </p>
            </div>
        </div>
    );
}
