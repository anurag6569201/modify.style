import React, { useEffect, useRef, useState } from 'react';
import { useEditorState } from '@/lib/editor/store';
import { cn } from '@/lib/utils';

/**
 * Burned-in caption preview — shows the active script segment's text
 * styled per the captions config. The export renders the same captions
 * (synthesized as text overlays at render time).
 */
export const CaptionsLayer: React.FC = () => {
    const { voiceover, playback, video } = useEditorState();
    const wrapRef = useRef<HTMLDivElement>(null);
    const [stageHeight, setStageHeight] = useState(0);

    useEffect(() => {
        const el = wrapRef.current?.parentElement;
        if (!el) return;
        const update = () => setStageHeight(el.clientHeight);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const captions = voiceover.captions;
    if (!captions?.enabled) return null;

    const time = playback.currentTime;
    const segments = voiceover.scriptSegments;
    let activeText: string | null = null;
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const next = segments[i + 1];
        const end = seg.duration && seg.duration > 0
            ? seg.timestamp + seg.duration
            : next
                ? next.timestamp
                : (video.duration || seg.timestamp + 4);
        if (time >= seg.timestamp && time < end && seg.text.trim()) {
            activeText = seg.text;
            break;
        }
    }

    // Scale caption size relative to a 1080p reference frame
    const fontSize = stageHeight > 0 ? Math.max(9, (captions.size / 1080) * stageHeight) : captions.size;

    return (
        <div
            ref={wrapRef}
            className={cn(
                'pointer-events-none absolute inset-x-0 z-40 flex justify-center px-[8%]',
                captions.position === 'top' ? 'top-[6%]' : 'bottom-[7%]'
            )}
        >
            {activeText && (
                <span
                    className={cn(
                        'max-w-full text-center font-medium leading-snug',
                        captions.style === 'boxed' && 'rounded-lg bg-black/75 px-4 py-2 text-white shadow-lg',
                        captions.style === 'clean' && 'text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.9),0_0_2px_rgba(0,0,0,0.9)]',
                        captions.style === 'gradient' && 'rounded-lg bg-gradient-to-r from-[#ff9a5a]/90 to-[#e8506e]/90 px-4 py-2 text-white shadow-lg'
                    )}
                    style={{ fontSize, fontFamily: 'Inter' }}
                >
                    {activeText}
                </span>
            )}
        </div>
    );
};
