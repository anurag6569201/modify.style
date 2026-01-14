
import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Wand2, Loader2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { editorStore, useEditorState } from '@/lib/editor/store';


export function ScriptPanel() {
    const { toast } = useToast();
    const editorState = useEditorState();
    const [script, setScript] = useState(
        editorState.voiceover.script || 
        "Welcome to our product demo. In this video, we'll walk you through the key features that make our platform stand out. Let's start by clicking on the Get Started button to begin the onboarding process..."
    );
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);

    // Sync script with voiceover store
    useEffect(() => {
        if (editorState.voiceover.script && editorState.voiceover.script !== script) {
            setScript(editorState.voiceover.script);
        }
    }, [editorState.voiceover.script]);

    const handleScriptChange = (newScript: string) => {
        setScript(newScript);
        // Update voiceover store with new script
        editorStore.setState({
            voiceover: {
                ...editorState.voiceover,
                script: newScript,
            },
        });
    };

    const handleGenerateScript = async () => {
        setIsGeneratingScript(true);
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const generatedScript = "Welcome to our platform walkthrough. Today, I'll show you how to get started in just a few simple steps.\n\nFirst, we'll click on the Get Started button to begin the onboarding process. Notice how intuitive the interface is.\n\nNext, let's scroll down to explore the features section. Here you can see all the powerful tools at your disposal.\n\nNow, click on the Dashboard tab to access your analytics. The dashboard provides real-time insights into your performance.\n\nFinally, use the search functionality to find exactly what you need. Just type your query and click the search icon.";
        setScript(generatedScript);
        handleScriptChange(generatedScript);
        setIsGeneratingScript(false);
        toast({
            title: "Script generated!",
            description: "AI has created a script based on your recording.",
        });
    };

    return (
        <div className="h-full flex flex-col p-2 space-y-4">
            <div className="bg-card/40 backdrop-blur-sm rounded-xl border-none shadow-sm flex-1 flex flex-col space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border/10">
                    <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <FileText className="h-3.5 w-3.5" />
                        Video Script
                    </Label>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateScript}
                        disabled={isGeneratingScript}
                        className="h-7 text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:text-primary transition-all shadow-sm"
                    >
                        {isGeneratingScript ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                            <Wand2 className="mr-2 h-3 w-3" />
                        )}
                        Generate Script
                    </Button>
                </div>
                <hr className='pt-0 mt-0' />
                <div className="flex flex-col " style={{ height: '100%', justifyContent: 'space-between' }}>

                    <div>
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent pointer-events-none rounded-md" style={{ height: '100%' }} />
                        <Textarea
                            value={script}
                            onChange={(e) => handleScriptChange(e.target.value)}
                            placeholder="Enter your video script here..."
                            style={{ maxHeight: '320px', minHeight: '300px' }}
                            className="flex-1 w-full h-full resize-none font-sans text-sm leading-relaxed bg-background/0 border-border/0 focus:border-primary/0 focus:bg-background/0 focus-visible:ring-0 focus-visible:ring-offset-0 transition-all p-0 rounded-md shadow-none"
                        />
                    </div>
                </div>
                <div className="flex justify-end items-center gap-2 text-[10px] text-muted-foreground font-mono bg-background/30 px-2 py-1 rounded-full self-end border border-border/10">
                    <span>{script.split(" ").length} words</span>
                    <span className="w-px h-2 bg-border/50" />
                    <span>~{Math.ceil(script.split(" ").length / 2.5)}s read time</span>
                </div>
            </div>
        </div>
    );
}
