
import React from 'react';
import { useEditorState } from '@/lib/editor/store';

export const TextLayer: React.FC = () => {
    const { textOverlays, playback } = useEditorState();
    const currentTime = playback.currentTime;

    const visibleOverlays = textOverlays.filter(
        overlay => currentTime >= overlay.startTime && currentTime <= overlay.endTime
    );

    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
            {visibleOverlays.map(overlay => {
                // Calculate animation state
                let opacity = overlay.opacity;
                let transform = `translate(-50%, -50%) rotate(${overlay.rotation}deg) scale(${overlay.scale})`;

                // Animation Logic (Entrance/Exit)
                const fadeInDuration = 0.5;
                const fadeOutDuration = 0.5;
                const timeActive = currentTime - overlay.startTime;
                const timeRemaining = overlay.endTime - currentTime;

                if (overlay.animation !== 'none') {
                    // Entrance
                    if (timeActive < fadeInDuration) {
                        const progress = timeActive / fadeInDuration;
                        const easeOut = (t: number) => 1 - Math.pow(1 - t, 3); // Cubic ease out
                        const p = easeOut(progress);

                        if (overlay.animation === 'fade') {
                            opacity *= p;
                        } else if (overlay.animation === 'slide-up') {
                            const offset = (1 - p) * 50;
                            transform += ` translateY(${offset}px)`;
                            opacity *= p;
                        } else if (overlay.animation === 'slide-down') {
                            const offset = (1 - p) * -50;
                            transform += ` translateY(${offset}px)`;
                            opacity *= p;
                        } else if (overlay.animation === 'slide-left') {
                            const offset = (1 - p) * 50;
                            transform += ` translateX(${offset}px)`;
                            opacity *= p;
                        } else if (overlay.animation === 'slide-right') {
                            const offset = (1 - p) * -50;
                            transform += ` translateX(${offset}px)`;
                            opacity *= p;
                        } else if (overlay.animation === 'scale') {
                            const s = p;
                            transform += ` scale(${s})`;
                            opacity *= p;
                        } else if (overlay.animation === 'pop') {
                            // Overshoot effect
                            const backOut = (t: number) => {
                                const c1 = 1.70158;
                                const c3 = c1 + 1;
                                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
                            }
                            const s = backOut(progress);
                            transform += ` scale(${s})`;
                            opacity *= p;
                        }
                    }
                    // Exit
                    else if (timeRemaining < fadeOutDuration) {
                        const progress = timeRemaining / fadeOutDuration;
                        // Linear fade out for simplicity or same easing reversed
                        opacity *= progress;
                    }
                }

                // Typewriter effect logic
                let displayedText = overlay.text;
                if (overlay.animation === 'typewriter') {
                    const totalChars = overlay.text.length;
                    const duration = Math.min(2.0, (overlay.endTime - overlay.startTime) * 0.8);
                    const progress = Math.min(1, timeActive / duration);
                    const charCount = Math.floor(progress * totalChars);
                    displayedText = overlay.text.substring(0, charCount);
                }


                return (
                    <div
                        key={overlay.id}
                        style={{
                            position: 'absolute',
                            left: `${overlay.x * 100}%`,
                            top: `${overlay.y * 100}%`,
                            transform: transform,
                            opacity: opacity,

                            // Typography
                            fontSize: `${overlay.fontSize}px`,
                            fontFamily: overlay.fontFamily,
                            fontWeight: overlay.fontWeight,
                            fontStyle: overlay.fontStyle,
                            textAlign: overlay.textAlign,
                            lineHeight: overlay.lineHeight,
                            letterSpacing: `${overlay.letterSpacing}px`,
                            color: overlay.color,
                            whiteSpace: 'pre-wrap', // Preserve newlines

                            // Box Styling
                            backgroundColor: overlay.backgroundColor,
                            padding: `${overlay.padding}px`,
                            borderRadius: `${overlay.borderRadius}px`,
                            borderWidth: `${overlay.borderWidth}px`,
                            borderStyle: overlay.borderWidth > 0 ? 'solid' : 'none',
                            borderColor: overlay.borderColor,

                            // Shadow
                            textShadow: overlay.shadowBlur > 0 && overlay.backgroundColor === 'transparent'
                                ? `${overlay.shadowOffsetX}px ${overlay.shadowOffsetY}px ${overlay.shadowBlur}px ${overlay.shadowColor}`
                                : 'none',
                            boxShadow: overlay.shadowBlur > 0 && overlay.backgroundColor !== 'transparent'
                                ? `${overlay.shadowOffsetX}px ${overlay.shadowOffsetY}px ${overlay.shadowBlur}px ${overlay.shadowColor}`
                                : 'none',

                            // Optimization
                            willChange: 'transform, opacity',
                        }}
                    >
                        {displayedText}
                    </div>
                );
            })}
        </div>
    );
};
