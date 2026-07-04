import React, { useState, useEffect } from 'react';
import { DesignPanel } from './panels/DesignPanel';
import { CameraPanel } from './panels/CameraPanel';
import { EffectsPanel } from './panels/EffectsPanel';
import { InteractionEffectsPanel } from './panels/InteractionEffectsPanel';
import { VoicePanel } from './panels/VoicePanel';
import { TextPanel } from './panels/TextPanel';
import { TimelinePanel } from './panels/TimelinePanel';
import { ScriptPanel } from './panels/ScriptPanel';
import { PolishPanel } from './panels/PolishPanel';
import { MusicPanel } from './panels/MusicPanel';
import {
    Palette,
    Video,
    Mic2,
    Type,
    Clock,
    FileText,
    Lock,
    MousePointerClick,
    SlidersHorizontal,
    Music,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type TabId = 'script' | 'voice' | 'design' | 'text' | 'camera' | 'effects' | 'polish' | 'music' | 'timeline';

const TAB_META: Record<TabId, { title: string; subtitle: string }> = {
    script: { title: 'Script', subtitle: 'AI-written, timed narration — pick a template and tone' },
    voice: { title: 'Voice', subtitle: 'Turn your script into a lifelike voiceover' },
    design: { title: 'Design', subtitle: 'Looks, backgrounds and framing' },
    text: { title: 'Text', subtitle: 'Titles, captions and callouts' },
    camera: { title: 'Camera', subtitle: 'Zoom moments, focus and movement' },
    effects: { title: 'Effects', subtitle: 'Click effects and the synthetic cursor' },
    polish: { title: 'Polish', subtitle: 'Filters and color grading' },
    music: { title: 'Music', subtitle: 'Background track with auto-ducking' },
    timeline: { title: 'Chapters', subtitle: 'Everything on your timeline, listed' },
};

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
        title={locked ? lockReason : label}
        onClick={() => !locked && onClick(id)}
        className={cn(
            "group relative mb-3 flex h-8 w-8 flex-col items-center justify-center gap-1 overflow-visible rounded-sm transition-all duration-300",
            locked && "cursor-not-allowed opacity-40",
            isActive
                ? "scale-105 bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:scale-105 hover:bg-muted hover:text-foreground"
        )}
    >
        {locked ? <Lock className="h-4 w-4" /> : <Icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />}
        <span className={cn(
            "pointer-events-none absolute left-14 z-50 whitespace-nowrap rounded-md border border-border/50 bg-popover px-2 py-1.5 text-xs font-semibold text-popover-foreground shadow-md transition-all duration-200",
            "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
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
    selectedTextLayerId?: string | null;
    onTextLayerSelect?: (id: string | null) => void;
    activeTab?: TabId;
    onTabChange?: (tab: TabId) => void;
    tabLocks?: Partial<Record<TabId, string>>;
    /** CTA label shown on a locked panel (e.g. "Log in to edit" / "Upgrade to Pro"). */
    lockedCtaLabel?: string;
    /** Invoked when the user clicks the CTA on a locked panel. */
    onLockedCta?: () => void;
}

export function EditorPanel({
    selectedEffectId,
    onEffectSelect,
    isLoopingEffect,
    selectedClickIndex,
    onClickSelect,
    selectedTextLayerId,
    onTextLayerSelect,
    activeTab: controlledTab,
    onTabChange,
    tabLocks = {},
    lockedCtaLabel = "Unlock editing",
    onLockedCta,
}: EditorPanelProps = {}) {
    const [internalTab, setInternalTab] = useState<TabId>('script');
    const activeTab = controlledTab ?? internalTab;

    const setActiveTab = (tab: TabId) => {
        if (tabLocks[tab]) return;
        if (onTabChange) onTabChange(tab);
        else setInternalTab(tab);
    };

    // Selecting a zoom moment opens the camera tab
    useEffect(() => {
        if (selectedEffectId && activeTab !== 'camera') {
            setActiveTab('camera');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEffectId]);

    // Selecting a click opens the effects editor
    useEffect(() => {
        if (selectedClickIndex !== null && selectedClickIndex !== undefined) {
            setActiveTab('effects');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClickIndex]);

    const clickSelected = selectedClickIndex !== null && selectedClickIndex !== undefined;

    const renderPanel = () => {
        // Tier gate: if the active tab isn't editable for this user, show a
        // lock card with a login/upgrade CTA instead of the editable panel.
        const activeLock = tabLocks[activeTab];
        if (activeLock) {
            return (
                <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                        <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold">{TAB_META[activeTab].title} is locked</h3>
                        <p className="max-w-xs text-sm text-muted-foreground">{activeLock}</p>
                    </div>
                    {onLockedCta && (
                        <Button variant="hero" onClick={onLockedCta}>
                            {lockedCtaLabel}
                        </Button>
                    )}
                </div>
            );
        }

        if (clickSelected) {
            return (
                <InteractionEffectsPanel
                    selectedClickIndex={selectedClickIndex!}
                    onDeselectClick={() => onClickSelect?.(null)}
                />
            );
        }

        switch (activeTab) {
            case 'script': return <ScriptPanel />;
            case 'voice': return <VoicePanel />;
            case 'design': return <DesignPanel />;
            case 'text': return <TextPanel selectedLayerId={selectedTextLayerId} onSelectLayer={onTextLayerSelect} />;
            case 'camera': return <CameraPanel selectedEffectId={selectedEffectId} onEffectSelect={onEffectSelect} isLoopingEffect={isLoopingEffect} />;
            case 'effects': return <EffectsPanel />;
            case 'polish': return <PolishPanel />;
            case 'music': return <MusicPanel />;
            case 'timeline': return <TimelinePanel />;
            default: return <ScriptPanel />;
        }
    };

    const meta = clickSelected
        ? { title: 'Click effect', subtitle: 'Style the effect for this click' }
        : TAB_META[activeTab];

    return (
        <div className="flex h-full overflow-hidden bg-card">
            <div className="z-10 flex w-11 shrink-0 flex-col items-center border-r border-border bg-secondary/40">
                <div className="flex w-full flex-1 flex-col items-center overflow-y-auto py-2">
                    <SidebarItem id="script" icon={FileText} label="Script" isActive={activeTab === 'script'} onClick={setActiveTab} locked={!!tabLocks.script} lockReason={tabLocks.script} />
                    <SidebarItem id="voice" icon={Mic2} label="Voice" isActive={activeTab === 'voice'} onClick={setActiveTab} locked={!!tabLocks.voice} lockReason={tabLocks.voice} />
                    <SidebarItem id="music" icon={Music} label="Music" isActive={activeTab === 'music'} onClick={setActiveTab} locked={!!tabLocks.music} lockReason={tabLocks.music} />
                    <div className="my-2 h-px w-8 bg-border" />
                    <SidebarItem id="design" icon={Palette} label="Design" isActive={activeTab === 'design'} onClick={setActiveTab} locked={!!tabLocks.design} lockReason={tabLocks.design} />
                    <SidebarItem id="text" icon={Type} label="Text" isActive={activeTab === 'text'} onClick={setActiveTab} locked={!!tabLocks.text} lockReason={tabLocks.text} />
                    <SidebarItem id="camera" icon={Video} label="Camera" isActive={activeTab === 'camera'} onClick={setActiveTab} locked={!!tabLocks.camera} lockReason={tabLocks.camera} />
                    <SidebarItem id="effects" icon={MousePointerClick} label="Effects" isActive={activeTab === 'effects'} onClick={setActiveTab} locked={!!tabLocks.effects} lockReason={tabLocks.effects} />
                    <SidebarItem id="polish" icon={SlidersHorizontal} label="Polish" isActive={activeTab === 'polish'} onClick={setActiveTab} locked={!!tabLocks.polish} lockReason={tabLocks.polish} />
                    <div className="my-2 h-px w-8 bg-border" />
                    <SidebarItem id="timeline" icon={Clock} label="Chapters" isActive={activeTab === 'timeline'} onClick={setActiveTab} locked={!!tabLocks.timeline} lockReason={tabLocks.timeline} />
                </div>
            </div>

            <div className="relative flex min-w-0 flex-1 flex-col bg-background">
                <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-border bg-card px-4">
                    <div>
                        <h2 className="font-display text-base font-semibold">{meta.title}</h2>
                        <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
                    </div>
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto">
                    <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-forwards h-full duration-300">
                        {renderPanel()}
                    </div>
                </div>
            </div>
        </div>
    );
}
