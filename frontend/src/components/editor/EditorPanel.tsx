import React, { useState, useEffect } from 'react';
import { DesignPanel } from './panels/DesignPanel';
import { CameraPanel } from './panels/CameraPanel';
import { EffectsPanel } from './panels/EffectsPanel';
import { InteractionEffectsPanel } from './panels/InteractionEffectsPanel';
import { VoicePanel } from './panels/VoicePanel';
import { TextPanel } from './panels/TextPanel';
import { TimelinePanel } from './panels/TimelinePanel';
import { ScriptPanel } from './panels/ScriptPanel';
import {
    Palette,
    Video,
    Sparkles,
    Mic2,
    Type,
    LayoutTemplate,
    Clock,
    FileText,
    Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type TabId = 'script' | 'voice' | 'design' | 'text' | 'camera' | 'effects' | 'timeline';

interface SidebarItemProps {
    id: TabId;
    icon: React.ElementType;
    label: string;
    isActive: boolean;
    onClick: (id: TabId) => void;
    locked?: boolean;
    lockReason?: string;
}

const SidebarItem = ({ id, icon: Icon, label, isActive, onClick, locked, lockReason }: SidebarItemProps) => (
    <Button
        variant="ghost"
        size="icon"
        disabled={locked}
        title={locked ? lockReason : undefined}
        onClick={() => !locked && onClick(id)}
        className={cn(
            "w-8 h-8 rounded-sm mb-3 flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group overflow-visible",
            locked && "cursor-not-allowed opacity-40",
            isActive
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                : "text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105"
        )}
    >
        {locked ? <Lock className="h-4 w-4" /> : <Icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />}

        {/* Tooltip / Label */}
        <span className={cn(
            "absolute left-14 bg-popover text-popover-foreground text-xs font-semibold px-2 py-1.5 rounded-md shadow-md border border-border/50 transition-all duration-200 pointer-events-none z-50 whitespace-nowrap",
            "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
        )}>
            {label}
        </span>
    </Button>
);

interface EditorPanelProps {
    selectedEffectId?: string | null;
    onEffectSelect?: (id: string | null) => void;
    isLoopingEffect?: boolean;
    selectedClickIndex?: number | null;
    onClickSelect?: (index: number | null) => void;
    activeTab?: TabId;
    onTabChange?: (tab: TabId) => void;
    tabLocks?: Partial<Record<TabId, string>>;
}

export function EditorPanel({
    selectedEffectId,
    onEffectSelect,
    isLoopingEffect,
    selectedClickIndex,
    onClickSelect,
    activeTab: controlledTab,
    onTabChange,
    tabLocks = {},
}: EditorPanelProps = {}) {
    const [internalTab, setInternalTab] = useState<TabId>('voice');
    const activeTab = controlledTab ?? internalTab;

    const setActiveTab = (tab: TabId) => {
        if (tabLocks[tab]) return;
        if (onTabChange) onTabChange(tab);
        else setInternalTab(tab);
    };

    const frameLocked = tabLocks.camera ?? tabLocks.design;

    // Switch to camera tab when effect is selected
    useEffect(() => {
        if (selectedEffectId) {
            setActiveTab('camera');
        }
    }, [selectedEffectId]);

    // Switch to effects tab when click is selected
    useEffect(() => {
        if (selectedClickIndex !== null && selectedClickIndex !== undefined) {
            setActiveTab('effects');
        }
    }, [selectedClickIndex]);

    const renderPanel = () => {
        // Show InteractionEffectsPanel when a click is selected, regardless of tab
        if (selectedClickIndex !== null && selectedClickIndex !== undefined) {
            return (
                <InteractionEffectsPanel 
                    selectedClickIndex={selectedClickIndex}
                    onDeselectClick={() => onClickSelect?.(null)}
                />
            );
        }

        switch (activeTab) {
            case 'script': return <ScriptPanel />;
            case 'voice': return <VoicePanel />;
            case 'design': return <DesignPanel />;
            case 'text': return <TextPanel />;
            case 'camera': return <CameraPanel selectedEffectId={selectedEffectId} onEffectSelect={onEffectSelect} isLoopingEffect={isLoopingEffect} />;
            case 'effects': return <EffectsPanel />;
            case 'timeline': return <TimelinePanel />;
            default: return <VoicePanel />;
        }
    };

    return (
        <div className="flex h-full overflow-hidden bg-card">
            <div className="z-10 flex w-11 shrink-0 flex-col items-center border-r border-border bg-secondary/40">
                <div className="flex w-full flex-1 flex-col items-center overflow-y-auto py-2">
                    <SidebarItem id="script" icon={FileText} label="Script" isActive={activeTab === 'script'} onClick={setActiveTab} locked={!!tabLocks.script} lockReason={tabLocks.script} />
                    <SidebarItem id="voice" icon={Mic2} label="Voice" isActive={activeTab === 'voice'} onClick={setActiveTab} locked={!!tabLocks.voice} lockReason={tabLocks.voice} />
                    <div className="my-2 h-px w-8 bg-border" />
                    <SidebarItem id="design" icon={Palette} label="Design" isActive={activeTab === 'design'} onClick={setActiveTab} locked={!!frameLocked} lockReason={tabLocks.design ?? tabLocks.camera} />
                    <SidebarItem id="text" icon={Type} label="Text" isActive={activeTab === 'text'} onClick={setActiveTab} locked={!!frameLocked} lockReason={tabLocks.text ?? tabLocks.camera} />
                    <SidebarItem id="camera" icon={Video} label="Camera" isActive={activeTab === 'camera'} onClick={setActiveTab} locked={!!frameLocked} lockReason={tabLocks.camera} />
                    <div className="my-2 h-px w-8 bg-border" />
                    <SidebarItem id="timeline" icon={Clock} label="Timeline" isActive={activeTab === 'timeline'} onClick={setActiveTab} locked={!!frameLocked} lockReason={tabLocks.timeline ?? tabLocks.camera} />
                </div>
            </div>

            <div className="relative flex min-w-0 flex-1 flex-col bg-background">
                <div className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-card px-4">
                    <div>
                        <h2 className="font-display text-base font-semibold capitalize">
                            {selectedClickIndex !== null && selectedClickIndex !== undefined ? 'Interaction Effects' : activeTab}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            {selectedClickIndex !== null && selectedClickIndex !== undefined && 'Configure click effect properties'}
                            {selectedClickIndex === null && selectedClickIndex === undefined && activeTab === 'script' && 'Generate AI script with timestamps from video events'}
                            {selectedClickIndex === null && selectedClickIndex === undefined && activeTab === 'voice' && 'Generate and manage AI voiceovers with script editing'}
                            {selectedClickIndex === null && selectedClickIndex === undefined && activeTab === 'design' && 'Canvas layout and background'}
                            {selectedClickIndex === null && selectedClickIndex === undefined && activeTab === 'text' && 'Add text overlays and titles'}
                            {selectedClickIndex === null && selectedClickIndex === undefined && activeTab === 'camera' && (selectedEffectId ? 'Editing selected zoom effect' : 'Control camera movement and zoom')}
                            {selectedClickIndex === null && selectedClickIndex === undefined && activeTab === 'effects' && 'Apply visual effects and filters'}
                            {selectedClickIndex === null && selectedClickIndex === undefined && activeTab === 'timeline' && 'Review events on the timeline'}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-forwards">
                        {renderPanel()}
                    </div>
                </div>
            </div>
        </div>
    );
}
