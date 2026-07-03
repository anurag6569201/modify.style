import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Wand2, Loader2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { editorStore, useEditorState } from '@/lib/editor/store';
import { scriptAPI } from '@/lib/api/script';


export function ScriptPanel() {
    const { toast } = useToast();
    const editorState = useEditorState();
    const [script, setScript] = useState(
        editorState.voiceover.script || 
        "Welcome to our product demo. In this video, we'll walk you through the key features that make our platform stand out. Let's start by clicking on the Get Started button to begin the onboarding process..."
    );
    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [captureProgress, setCaptureProgress] = useState(0);

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

    // Function to capture screenshot from video at specific timestamp
    const captureVideoFrame = async (videoUrl: string, timestamp: number): Promise<string | null> => {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;
            
            let resolved = false;
            
            const cleanup = () => {
                video.remove();
            };
            
            video.onloadedmetadata = () => {
                if (resolved) return;
                const targetTime = Math.min(Math.max(0, timestamp), video.duration);
                video.currentTime = targetTime;
            };
            
            video.onseeked = () => {
                if (resolved) return;
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    
                    if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        // Convert to base64 JPEG (smaller than PNG)
                        const base64 = canvas.toDataURL('image/jpeg', 0.85);
                        resolved = true;
                        cleanup();
                        resolve(base64);
                    } else {
                        resolved = true;
                        cleanup();
                        resolve(null);
                    }
                } catch (error) {
                    console.error('Error capturing frame:', error);
                    resolved = true;
                    cleanup();
                    resolve(null);
                }
            };
            
            video.onerror = () => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve(null);
            };
            
            // Set timeout in case video doesn't load
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    resolve(null);
                }
            }, 10000);
            
            video.src = videoUrl;
        });
    };

    const handleGenerateScript = async () => {
        // Check if we have video data
        if (!editorState.video.url || editorState.video.duration <= 0) {
            toast({
                title: "No video data",
                description: "Please load a video first before generating a script.",
                variant: "destructive",
            });
            return;
        }

        setIsGeneratingScript(true);
        setCaptureProgress(0);

        try {
            // Capture screenshots at click timestamps
            const clicks = editorState.events.clicks;
            const screenshots: Array<{ timestamp: number; image: string }> = [];
            
            if (clicks.length > 0) {
                toast({
                    title: "Capturing screenshots",
                    description: `Capturing ${Math.min(clicks.length, 15)} frames from video...`,
                });

                // Capture screenshots for each click (limit to first 15 to avoid too many API calls)
                const clicksToCapture = clicks.slice(0, 15);
                for (let i = 0; i < clicksToCapture.length; i++) {
                    const click = clicksToCapture[i];
                    const screenshot = await captureVideoFrame(editorState.video.url, click.timestamp);
                    if (screenshot) {
                        screenshots.push({
                            timestamp: click.timestamp,
                            image: screenshot,
                        });
                    }
                    setCaptureProgress(((i + 1) / clicksToCapture.length) * 100);
                    // Small delay to avoid overwhelming the browser
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            // Prepare events data
            const events = {
                clicks: editorState.events.clicks.map(click => ({
                    timestamp: click.timestamp,
                    x: click.x,
                    y: click.y,
                })),
                moves: editorState.events.moves.map(move => ({
                    timestamp: move.timestamp,
                    x: move.x,
                    y: move.y,
                })),
            };

            // Call script generation API with screenshots
            const response = await scriptAPI.generateScriptWithTimestamps({
                video_url: editorState.video.url,
                video_duration: editorState.video.duration,
                events: events,
                screenshots: screenshots,
            });

            // Extract script segments
            const scriptSegments = response.script_segments || [];
            
            // Combine all segments into full script text
            const fullScript = scriptSegments
                .map(segment => segment.text)
                .join('\n\n');

            // Update editor state with script segments and full script
            editorStore.setState({
                voiceover: {
                    ...editorState.voiceover,
                    script: fullScript,
                    scriptSegments: scriptSegments.map(segment => ({
                        text: segment.text,
                        timestamp: segment.timestamp,
                        audioUrl: null,
                        audioBlob: null,
                        duration: 0,
                        isGenerated: false,
                    })),
                },
            });

            setScript(fullScript);

            toast({
                title: "Script generated!",
                description: `AI has created ${scriptSegments.length} script segments with timestamps. ${screenshots.length > 0 ? `Analyzed ${screenshots.length} screenshots for visual context.` : ''}`,
            });
        } catch (error) {
            console.error('Error generating script:', error);
            const errorMessage = error instanceof Error ? error.message : "Failed to generate script. Please try again.";
            
            // Check if it's an authentication error
            if (errorMessage.includes('session has expired') || errorMessage.includes('Authentication required')) {
                toast({
                    title: "Authentication required",
                    description: errorMessage + " Redirecting to login...",
                    variant: "destructive",
                });
                // Redirect to auth after a short delay
                setTimeout(() => {
                    window.location.href = '/auth';
                }, 2000);
            } else {
                toast({
                    title: "Generation failed",
                    description: errorMessage,
                    variant: "destructive",
                });
            }
        } finally {
            setIsGeneratingScript(false);
            setCaptureProgress(0);
        }
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
                            <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                {captureProgress > 0 && captureProgress < 100 
                                    ? `Capturing... ${Math.round(captureProgress)}%`
                                    : 'Generating...'}
                            </>
                        ) : (
                            <>
                                <Wand2 className="mr-2 h-3 w-3" />
                                Generate Script
                            </>
                        )}
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
