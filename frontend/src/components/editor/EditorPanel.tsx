
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DesignPanel } from './panels/DesignPanel';
import { CameraPanel } from './panels/CameraPanel';
import { CursorPanel } from './panels/CursorPanel';
import { EffectsPanel } from './panels/EffectsPanel';
import { ScriptPanel } from './panels/ScriptPanel';
import { VoicePanel } from './panels/VoicePanel';

import { TextPanel } from './panels/TextPanel';
import {
    Palette,
    Video,
    MousePointer2,
    Sparkles,
    FileText,
    Mic2,
    Type,
    LayoutTemplate
} from 'lucide-react';

export function EditorPanel() {
    return (
        <div className="h-full flex flex-col bg-card border-l border-border/50">
            <div className="p-4 border-b border-border/50 flex flex-col gap-1">
                <h2 className="font-semibold text-lg tracking-tight">Studio Editor</h2>
                <p className="text-xs text-muted-foreground">Advanced composition & effects.</p>
            </div>

            <Tabs defaultValue="script" className="flex-1 flex flex-col min-h-0">
                <div className="px-0 border-b border-border/40 bg-muted/20">
                    <TabsList className="w-full justify-start h-12 p-0 bg-transparent rounded-none overflow-x-auto no-scrollbar flex-nowrap px-4 space-x-2">
                        <TabsTrigger
                            value="script"
                            className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 flex items-center gap-2 min-w-fit"
                        >
                            <FileText className="h-4 w-4 opacity-70" />
                            <span className="hidden xl:inline">Script</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="voice"
                            className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 flex items-center gap-2 min-w-fit"
                        >
                            <Mic2 className="h-4 w-4 opacity-70" />
                            <span className="hidden xl:inline">Voice</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="design"
                            className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 flex items-center gap-2 min-w-fit"
                        >
                            <LayoutTemplate className="h-4 w-4 opacity-70" />
                            <span className="hidden xl:inline">Design</span>
                        </TabsTrigger>

                        <TabsTrigger
                            value="text"
                            className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 flex items-center gap-2 min-w-fit"
                        >
                            <Type className="h-4 w-4 opacity-70" />
                            <span className="hidden xl:inline">Text</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="camera"
                            className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 flex items-center gap-2 min-w-fit"
                        >
                            <Video className="h-4 w-4 opacity-70" />
                            <span className="hidden xl:inline">Camera</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="cursor"
                            className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 flex items-center gap-2 min-w-fit"
                        >
                            <MousePointer2 className="h-4 w-4 opacity-70" />
                            <span className="hidden xl:inline">Cursor</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="effects"
                            className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 flex items-center gap-2 min-w-fit"
                        >
                            <Sparkles className="h-4 w-4 opacity-70" />
                            <span className="hidden xl:inline">Effects</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-background/50">
                    <TabsContent value="script" className="mt-0 h-full animate-in fade-in duration-300">
                        <ScriptPanel />
                    </TabsContent>
                    <TabsContent value="voice" className="mt-0 h-full animate-in fade-in duration-300">
                        <VoicePanel />
                    </TabsContent>
                    <TabsContent value="design" className="mt-0 h-full animate-in fade-in duration-300">
                        <DesignPanel />
                    </TabsContent>

                    <TabsContent value="text" className="mt-0 h-full animate-in fade-in duration-300">
                        <TextPanel />
                    </TabsContent>
                    <TabsContent value="camera" className="mt-0 h-full animate-in fade-in duration-300">
                        <CameraPanel />
                    </TabsContent>
                    <TabsContent value="cursor" className="mt-0 h-full animate-in fade-in duration-300">
                        <CursorPanel />
                    </TabsContent>
                    <TabsContent value="effects" className="mt-0 h-full animate-in fade-in duration-300">
                        <EffectsPanel />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
