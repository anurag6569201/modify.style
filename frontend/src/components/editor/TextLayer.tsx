
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
                let scale = overlay.scale;
                let blur = 0;
                let transform = `translate(-50%, -50%) rotate(${overlay.rotation}deg) scale(${scale})`;

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
                            // Re-apply scale with animation
                            transform = `translate(-50%, -50%) rotate(${overlay.rotation}deg) scale(${overlay.scale * s})`;
                            opacity *= p;
                        } else if (overlay.animation === 'pop') {
                            const backOut = (t: number) => {
                                const c1 = 1.70158;
                                const c3 = c1 + 1;
                                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
                            }
                            const s = backOut(progress);
                            transform = `translate(-50%, -50%) rotate(${overlay.rotation}deg) scale(${overlay.scale * s})`;
                            opacity *= p;
                        } else if (overlay.animation === 'blur-in') {
                            blur = (1 - p) * 10;
                            opacity *= p;
                        } else if (overlay.animation === 'glitch') {
                            // Simple scramble effect simulation by opacity flicker
                            if (Math.random() > 0.8) opacity = 0.5;
                            const glitchOffset = (1 - p) * 10;
                            if (timeActive < 0.2) transform += ` translate(${Math.random() * 5}px, ${Math.random() * 5}px)`;
                        } else if (overlay.animation === 'spin-3d') {
                            const deg = (1 - p) * 360;
                            transform += ` rotateX(${deg}deg)`;
                            opacity *= p;
                        }
                    }
                    // Exit
                    else if (timeRemaining < fadeOutDuration) {
                        const progress = timeRemaining / fadeOutDuration;
                        // Linear fade out
                        opacity *= progress;
                        if (overlay.animation === 'blur-in') {
                            blur = (1 - progress) * 10;
                        }
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

                // CSS styles for gradient text
                const gradientStyle = (overlay.gradient && overlay.gradient.enabled) ? {
                    background: `linear-gradient(${overlay.gradient.angle}deg, ${overlay.gradient.colors[0]}, ${overlay.gradient.colors[1]})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    color: 'transparent'
                } : {
                    color: overlay.color
                };

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
                            textTransform: overlay.textTransform,
                            whiteSpace: 'pre-wrap', // Preserve newlines

                            // Gradient / Color
                            ...gradientStyle,

                            // Box Styling
                            backgroundColor: overlay.backgroundColor,
                            padding: `${overlay.padding}px`,
                            borderRadius: `${overlay.borderRadius}px`,
                            borderWidth: `${overlay.borderWidth}px`,
                            borderStyle: overlay.borderWidth > 0 ? 'solid' : 'none',
                            borderColor: overlay.borderColor,

                            // Glassmorphism (Backdrop Blur)
                            backdropFilter: overlay.backdropBlur && overlay.backdropBlur > 0
                                ? `blur(${overlay.backdropBlur}px)`
                                : undefined,

                            // Blend Mode
                            mixBlendMode: overlay.blendMode,

                            // Shadow
                            // Note: Text shadow doesn't work well with transparent text (gradient). 
                            // If gradient is enabled, we might want drop-shadow filter instead.
                            textShadow: (!overlay.gradient?.enabled && overlay.shadowBlur > 0 && overlay.backgroundColor === 'transparent')
                                ? `${overlay.shadowOffsetX}px ${overlay.shadowOffsetY}px ${overlay.shadowBlur}px ${overlay.shadowColor}`
                                : 'none',

                            boxShadow: (overlay.shadowBlur > 0 && overlay.backgroundColor !== 'transparent')
                                ? `${overlay.shadowOffsetX}px ${overlay.shadowOffsetY}px ${overlay.shadowBlur}px ${overlay.shadowColor}`
                                : 'none',

                            // If gradient text and we want shadow, use filter drop-shadow
                            filter: [
                                blur > 0 ? `blur(${blur}px)` : null,
                                (overlay.gradient?.enabled && overlay.shadowBlur > 0)
                                    ? `drop-shadow(${overlay.shadowOffsetX}px ${overlay.shadowOffsetY}px ${overlay.shadowBlur}px ${overlay.shadowColor})`
                                    : null
                            ].filter(Boolean).join(' '),

                            // Optimization
                            willChange: 'transform, opacity',

                            // 3D Transforms
                            transformStyle: 'preserve-3d',
                            perspective: '1000px',
                        }}
                    >
                        {displayedText}
                    </div>
                );
            })}
        </div>
    );
};
