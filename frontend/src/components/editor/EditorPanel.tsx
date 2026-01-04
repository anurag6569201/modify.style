import React, { useState } from 'react';
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
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type TabId = 'script' | 'voice' | 'design' | 'text' | 'camera' | 'cursor' | 'effects';

interface SidebarItemProps {
    id: TabId;
    icon: React.ElementType;
    label: string;
    isActive: boolean;
    onClick: (id: TabId) => void;
}

const SidebarItem = ({ id, icon: Icon, label, isActive, onClick }: SidebarItemProps) => (
    <Button
        variant="ghost"
        size="icon"
        onClick={() => onClick(id)}
        className={cn(
            "w-8 h-8 rounded-sm mb-3 flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group overflow-visible",
            isActive
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                : "text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105"
        )}
    >
        <Icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />

        {/* Tooltip / Label */}
        <span className={cn(
            "absolute left-14 bg-popover text-popover-foreground text-xs font-semibold px-2 py-1.5 rounded-md shadow-md border border-border/50 transition-all duration-200 pointer-events-none z-50 whitespace-nowrap",
            "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
        )}>
            {label}
        </span>
    </Button>
);

export function EditorPanel() {
    const [activeTab, setActiveTab] = useState<TabId>('script');

    const renderPanel = () => {
        switch (activeTab) {
            case 'script': return <ScriptPanel />;
            case 'voice': return <VoicePanel />;
            case 'design': return <DesignPanel />;
            case 'text': return <TextPanel />;
            case 'camera': return <CameraPanel />;
            case 'cursor': return <CursorPanel />;
            case 'effects': return <EffectsPanel />;
            default: return <ScriptPanel />;
        }
    };

    return (
        <div className="h-full flex bg-background/50 backdrop-blur-3xl overflow-hidden border-l border-white/10 shadow-2xl">
            {/* Sidebar */}
            <div className="w-10 flex flex-col items-center bg-card/40 border-r border-white/5 backdrop-blur-md z-10 shadow-xl">

                <div className="flex-1 w-full flex flex-col items-center scrollbar-none overflow-y-auto py-2">
                    <SidebarItem id="script" icon={FileText} label="Script" isActive={activeTab === 'script'} onClick={setActiveTab} />
                    <SidebarItem id="voice" icon={Mic2} label="Voice" isActive={activeTab === 'voice'} onClick={setActiveTab} />
                    <div className="w-8 h-[1px] bg-border/40 my-2" />
                    <SidebarItem id="design" icon={Palette} label="Design" isActive={activeTab === 'design'} onClick={setActiveTab} />
                    <SidebarItem id="text" icon={Type} label="Text" isActive={activeTab === 'text'} onClick={setActiveTab} />
                    <SidebarItem id="camera" icon={Video} label="Camera" isActive={activeTab === 'camera'} onClick={setActiveTab} />
                    <SidebarItem id="cursor" icon={MousePointer2} label="Cursor" isActive={activeTab === 'cursor'} onClick={setActiveTab} />
                    <SidebarItem id="effects" icon={Sparkles} label="Effects" isActive={activeTab === 'effects'} onClick={setActiveTab} />
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-background/30 relative">
                {/* Header */}
                <div className="h-16 border-b border-white/5 flex items-center px-2 bg-card/10 backdrop-blur-sm sticky top-0 z-20">
                    <div>
                        <h2 className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent capitalize">
                            {activeTab}
                        </h2>
                        <p className="text-xs text-muted-foreground/80 font-medium">
                            {activeTab === 'script' && 'Edit and refining your script'}
                            {activeTab === 'voice' && 'Generate and manage AI voiceovers'}
                            {activeTab === 'design' && 'Canvas layout and background'}
                            {activeTab === 'text' && 'Add text overlays and titles'}
                            {activeTab === 'camera' && 'Control camera movement and zoom'}
                            {activeTab === 'cursor' && 'Customize mouse cursor appearance'}
                            {activeTab === 'effects' && 'Apply visual effects and filters'}
                        </p>
                    </div>
                </div>

                {/* Panel Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-forwards">
                        {renderPanel()}
                    </div>
                </div>
            </div>
        </div>
    );
}
