import React, { useRef, useEffect, useMemo } from 'react';
import { useEditorState } from '@/lib/editor/store';
import { ClickEffectConfig } from '@/lib/editor/types';

const CLICK_DELAY = 0.08;
const DEFAULT_ANIMATION_DURATION = 0.8;

// Advanced easing functions
const easingFunctions = {
    linear: (t: number) => t,
    'ease-out': (t: number) => 1 - Math.pow(1 - t, 3),
    'ease-in-out': (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    bounce: (t: number) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            return n1 * (t -= 1.5 / d1) * t + 0.75;
        } else if (t < 2.5 / d1) {
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
        } else {
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
    },
    elastic: (t: number) => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0
            ? 0
            : t === 1
            ? 1
            : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    spring: (t: number) => {
        return 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 4.5);
    },
};

interface ClickEffectProps {
    click: {
        x: number;
        y: number;
        timestamp: number;
    };
    config: ClickEffectConfig;
    currentTime: number;
    videoWidth: number;
    videoHeight: number;
}

const ClickEffect: React.FC<ClickEffectProps> = ({ click, config, currentTime, videoWidth, videoHeight }) => {
    const animationDuration = config.animationDuration || DEFAULT_ANIMATION_DURATION;
    const timeSinceClick = currentTime - click.timestamp;
    
    if (timeSinceClick < CLICK_DELAY || timeSinceClick >= CLICK_DELAY + animationDuration) {
        return null;
    }

    const progress = Math.max(0, Math.min(1, (timeSinceClick - CLICK_DELAY) / animationDuration));
    const easedProgress = easingFunctions[config.easing || 'ease-out'](progress);

    // Calculate position in percentage (0-100)
    const xPercent = click.x * 100;
    const yPercent = click.y * 100;

    // Base size with emphasis multiplier
    const emphasisMultiplier = config.emphasis ? 1.5 : 1;
    const baseSize = 50 * config.size * emphasisMultiplier;
    const size = baseSize * Math.min(1, easedProgress * 2) * config.force;

    // Parse color
    const parseColor = (color?: string, defaultColor = { r: 59, g: 130, b: 246, a: 1 }) => {
        if (!color) return defaultColor;
        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return { r, g, b, a: 1 };
        } else if (color.startsWith('rgba')) {
            const matches = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (matches) {
                return {
                    r: parseInt(matches[1]),
                    g: parseInt(matches[2]),
                    b: parseInt(matches[3]),
                    a: matches[4] ? parseFloat(matches[4]) : 1,
                };
            }
        }
        return defaultColor;
    };

    const primaryColor = parseColor(config.color);
    const secondaryColor = parseColor(config.secondaryColor, {
        ...primaryColor,
        a: primaryColor.a * 0.3,
    });

    // Fade out alpha
    const alpha = primaryColor.a * (1 - Math.pow(easedProgress, 0.8));
    const glowIntensity = config.glowIntensity ?? 0.8;

    // Particle system for particle effects
    const particleCount = config.particleCount || 20;
    const particles = useMemo(() => {
        return Array.from({ length: particleCount }).map((_, i) => {
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 0.3 + Math.random() * 0.4;
            return {
                angle,
                speed,
                size: 2 + Math.random() * 4,
                delay: Math.random() * 0.1,
            };
        });
    }, [particleCount]);

    // Render based on animation style
    const renderEffect = () => {
        switch (config.animationStyle) {
            case 'ripple':
                return (
                    <>
                        {/* Multiple ripple rings */}
                        {[0, 0.3, 0.6].map((offset, i) => {
                            const ringProgress = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
                            if (ringProgress <= 0) return null;
                            const ringSize = baseSize * ringProgress * 1.5;
                            const ringAlpha = alpha * (1 - ringProgress) * (1 - offset);
                            return (
                                <div
                                    key={i}
                                    className="absolute rounded-full border-2 pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${ringSize}px`,
                                        height: `${ringSize}px`,
                                        transform: 'translate(-50%, -50%)',
                                        borderColor: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${ringAlpha})`,
                                        borderWidth: `${Math.max(1, ringSize * 0.02)}px`,
                                    }}
                                />
                            );
                        })}
                    </>
                );

            case 'orb':
                return (
                    <>
                        {/* Glowing core */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size * 0.3}px`,
                                height: `${size * 0.3}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha * 0.9}) 0%, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha * 0.5}) 50%, transparent 100%)`,
                                boxShadow: `0 0 ${size * 0.3}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha * 0.8})`,
                            }}
                        />
                        {/* Outer glow */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size}px`,
                                height: `${size}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha * 0.6}) 0%, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, 0) 70%)`,
                                boxShadow: `0 0 ${size * glowIntensity}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha * 0.6})`,
                            }}
                        />
                    </>
                );

            case 'pulse':
                const pulseSize = size * (1 + easedProgress * 0.8);
                return (
                    <>
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size * 0.4}px`,
                                height: `${size * 0.4}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha})`,
                                boxShadow: `0 0 ${pulseSize * 0.5}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha * 0.7})`,
                            }}
                        />
                        {[0, 0.4].map((offset, i) => {
                            const ringProgress = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
                            if (ringProgress <= 0) return null;
                            const ringSize = pulseSize * ringProgress;
                            return (
                                <div
                                    key={i}
                                    className="absolute rounded-full border pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${ringSize}px`,
                                        height: `${ringSize}px`,
                                        transform: 'translate(-50%, -50%)',
                                        borderColor: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha * (1 - ringProgress) * 0.5})`,
                                        borderWidth: `${Math.max(1, ringSize * 0.03)}px`,
                                    }}
                                />
                            );
                        })}
                    </>
                );

            case 'ring':
                return (
                    <>
                        {/* Multiple expanding rings */}
                        {[0, 0.25, 0.5].map((offset, i) => {
                            const ringProgress = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
                            if (ringProgress <= 0) return null;
                            const ringSize = baseSize * ringProgress * 1.8;
                            const ringAlpha = alpha * (1 - ringProgress) * (1 - offset * 0.5);
                            return (
                                <div
                                    key={i}
                                    className="absolute rounded-full border-2 pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${ringSize}px`,
                                        height: `${ringSize}px`,
                                        transform: 'translate(-50%, -50%)',
                                        borderColor: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${ringAlpha})`,
                                        borderWidth: `${Math.max(2, ringSize * 0.04)}px`,
                                    }}
                                />
                            );
                        })}
                    </>
                );

            case 'splash':
                const splashParticles = particles.slice(0, 12);
                return (
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            left: `${xPercent}%`,
                            top: `${yPercent}%`,
                            transform: 'translate(-50%, -50%)',
                            width: `${size * 2}px`,
                            height: `${size * 2}px`,
                        }}
                    >
                        {splashParticles.map((particle, i) => {
                            const particleProgress = Math.max(0, Math.min(1, (progress - particle.delay) / (1 - particle.delay)));
                            const distance = size * 0.6 * particleProgress * particle.speed;
                            const x = Math.cos(particle.angle) * distance;
                            const y = Math.sin(particle.angle) * distance;
                            const particleAlpha = alpha * (1 - particleProgress);
                            return (
                                <div
                                    key={i}
                                    className="absolute rounded-full pointer-events-none"
                                    style={{
                                        left: '50%',
                                        top: '50%',
                                        width: `${particle.size}px`,
                                        height: `${particle.size}px`,
                                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                                        background: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${particleAlpha})`,
                                        boxShadow: `0 0 ${particle.size * 2}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${particleAlpha * 0.5})`,
                                    }}
                                />
                            );
                        })}
                    </div>
                );

            case 'particles':
                return (
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            left: `${xPercent}%`,
                            top: `${yPercent}%`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        {particles.map((particle, i) => {
                            const particleProgress = Math.max(0, Math.min(1, (progress - particle.delay) / (1 - particle.delay)));
                            const distance = size * 0.8 * particleProgress * particle.speed;
                            const x = Math.cos(particle.angle) * distance;
                            const y = Math.sin(particle.angle) * distance;
                            const particleAlpha = alpha * (1 - particleProgress);
                            const particleSize = particle.size * (1 - particleProgress * 0.5);
                            return (
                                <div
                                    key={i}
                                    className="absolute rounded-full pointer-events-none"
                                    style={{
                                        left: '50%',
                                        top: '50%',
                                        width: `${particleSize}px`,
                                        height: `${particleSize}px`,
                                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                                        background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${particleAlpha}) 0%, rgba(${secondaryColor.r}, ${secondaryColor.g}, ${secondaryColor.b}, 0) 100%)`,
                                        boxShadow: `0 0 ${particleSize * 1.5}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${particleAlpha * 0.6})`,
                                    }}
                                />
                            );
                        })}
                    </div>
                );

            case 'glow':
                const glowSize = size * (1 + easedProgress * 1.2);
                return (
                    <>
                        {/* Central bright spot */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size * 0.2}px`,
                                height: `${size * 0.2}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha})`,
                                boxShadow: `0 0 ${glowSize * 0.4}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha * glowIntensity})`,
                            }}
                        />
                        {/* Expanding glow layers */}
                        {[0, 0.3, 0.6].map((offset, i) => {
                            const glowProgress = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
                            if (glowProgress <= 0) return null;
                            const layerSize = glowSize * glowProgress;
                            const layerAlpha = alpha * (1 - glowProgress) * glowIntensity * (1 - offset * 0.3);
                            return (
                                <div
                                    key={i}
                                    className="absolute rounded-full pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${layerSize}px`,
                                        height: `${layerSize}px`,
                                        transform: 'translate(-50%, -50%)',
                                        background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${layerAlpha}) 0%, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, 0) 60%)`,
                                        boxShadow: `0 0 ${layerSize * 0.8}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${layerAlpha})`,
                                    }}
                                />
                            );
                        })}
                    </>
                );

            case 'shockwave':
                const shockwaveSize = baseSize * easedProgress * 2.5;
                const shockwaveAlpha = alpha * (1 - easedProgress);
                return (
                    <>
                        {/* Inner core */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size * 0.15}px`,
                                height: `${size * 0.15}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha})`,
                                boxShadow: `0 0 ${size * 0.3}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha})`,
                            }}
                        />
                        {/* Shockwave rings */}
                        {[0, 0.2, 0.4].map((offset, i) => {
                            const waveProgress = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
                            if (waveProgress <= 0) return null;
                            const waveSize = shockwaveSize * waveProgress;
                            const waveAlpha = shockwaveAlpha * (1 - waveProgress) * (1 - offset * 0.5);
                            return (
                                <div
                                    key={i}
                                    className="absolute rounded-full border-2 pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${waveSize}px`,
                                        height: `${waveSize}px`,
                                        transform: 'translate(-50%, -50%)',
                                        borderColor: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${waveAlpha})`,
                                        borderWidth: `${Math.max(3, waveSize * 0.03)}px`,
                                        boxShadow: `0 0 ${waveSize * 0.2}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${waveAlpha * 0.5})`,
                                    }}
                                />
                            );
                        })}
                    </>
                );

            case 'trail':
                const trailLength = config.trailLength || 10;
                const trailParticles = Array.from({ length: trailLength }).map((_, i) => {
                    const trailProgress = Math.max(0, progress - (i / trailLength) * 0.3);
                    return { progress: trailProgress, index: i };
                });
                return (
                    <>
                        {trailParticles.map((trail) => {
                            if (trail.progress <= 0) return null;
                            const trailSize = size * (1 - trail.index / trailLength) * 0.3;
                            const trailAlpha = alpha * trail.progress * (1 - trail.index / trailLength);
                            return (
                                <div
                                    key={trail.index}
                                    className="absolute rounded-full pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${trailSize}px`,
                                        height: `${trailSize}px`,
                                        transform: 'translate(-50%, -50%)',
                                        background: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${trailAlpha})`,
                                        boxShadow: `0 0 ${trailSize * 2}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${trailAlpha * 0.7})`,
                                    }}
                                />
                            );
                        })}
                    </>
                );

            case 'burst':
                const burstParticles = particles.slice(0, 16);
                return (
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            left: `${xPercent}%`,
                            top: `${yPercent}%`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        {/* Central burst */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: '50%',
                                top: '50%',
                                width: `${size * 0.2}px`,
                                height: `${size * 0.2}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha}) 0%, transparent 70%)`,
                                boxShadow: `0 0 ${size * 0.4}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha * 0.8})`,
                            }}
                        />
                        {/* Burst particles */}
                        {burstParticles.map((particle, i) => {
                            const particleProgress = Math.max(0, Math.min(1, (progress - particle.delay) / (1 - particle.delay)));
                            const distance = size * 1.2 * Math.pow(particleProgress, 0.7) * particle.speed;
                            const x = Math.cos(particle.angle) * distance;
                            const y = Math.sin(particle.angle) * distance;
                            const particleAlpha = alpha * (1 - Math.pow(particleProgress, 1.5));
                            const particleSize = particle.size * (1 - particleProgress * 0.3);
                            return (
                                <div
                                    key={i}
                                    className="absolute rounded-full pointer-events-none"
                                    style={{
                                        left: '50%',
                                        top: '50%',
                                        width: `${particleSize}px`,
                                        height: `${particleSize}px`,
                                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                                        background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${particleAlpha}) 0%, rgba(${secondaryColor.r}, ${secondaryColor.g}, ${secondaryColor.b}, 0) 100%)`,
                                        boxShadow: `0 0 ${particleSize * 2}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${particleAlpha * 0.8})`,
                                    }}
                                />
                            );
                        })}
                    </div>
                );

            case 'neon-burst':
                const neonSize = size * (1 + easedProgress * 1.5);
                const neonAlpha = alpha * (1 - Math.pow(easedProgress, 0.6));
                const electricOffset = Math.sin(progress * Math.PI * 8) * 2;
                return (
                    <>
                        {/* Electric core */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size * 0.25}px`,
                                height: `${size * 0.25}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${neonAlpha}) 0%, transparent 70%)`,
                                boxShadow: `0 0 ${neonSize * 0.3}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${neonAlpha * glowIntensity}), 
                                           0 0 ${neonSize * 0.6}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${neonAlpha * 0.6})`,
                            }}
                        />
                        {/* Electric rings with jagged edges */}
                        {[0, 0.2, 0.4, 0.6].map((offset, i) => {
                            const ringProgress = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
                            if (ringProgress <= 0) return null;
                            const ringSize = neonSize * ringProgress;
                            const ringAlpha = neonAlpha * (1 - ringProgress) * (1 - offset * 0.3);
                            const jaggedOffset = electricOffset * (1 - ringProgress);
                            return (
                                <div
                                    key={i}
                                    className="absolute pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${ringSize}px`,
                                        height: `${ringSize}px`,
                                        transform: `translate(calc(-50% + ${jaggedOffset}px), -50%)`,
                                        border: `2px solid rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${ringAlpha})`,
                                        borderRadius: '50%',
                                        boxShadow: `0 0 ${ringSize * 0.2}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${ringAlpha * 0.8})`,
                                        filter: `blur(${Math.max(0, ringSize * 0.01)}px)`,
                                    }}
                                />
                            );
                        })}
                    </>
                );

            case 'glitch':
                const glitchIntensity = config.glitchIntensity || 0.5;
                const glitchOffset = (Math.random() > 0.5 ? 1 : -1) * glitchIntensity * 10 * (1 - easedProgress);
                const shakeX = (Math.random() - 0.5) * 3 * (1 - easedProgress);
                const shakeY = (Math.random() - 0.5) * 3 * (1 - easedProgress);
                return (
                    <>
                        {/* RGB split layers */}
                        {[
                            { r: 255, g: 0, b: 0, offset: -glitchOffset },
                            { r: 0, g: 255, b: 0, offset: 0 },
                            { r: 0, g: 0, b: 255, offset: glitchOffset },
                        ].map((layer, i) => (
                            <div
                                key={i}
                                className="absolute rounded-full pointer-events-none"
                                style={{
                                    left: `${xPercent}%`,
                                    top: `${yPercent}%`,
                                    width: `${size * 0.8}px`,
                                    height: `${size * 0.8}px`,
                                    transform: `translate(calc(-50% + ${layer.offset + shakeX}px), calc(-50% + ${shakeY}px))`,
                                    background: `radial-gradient(circle, rgba(${layer.r}, ${layer.g}, ${layer.b}, ${alpha * 0.7}) 0%, transparent 70%)`,
                                    mixBlendMode: 'screen',
                                }}
                            />
                        ))}
                        {/* Central white flash */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size * 0.3}px`,
                                height: `${size * 0.3}px`,
                                transform: `translate(-50%, -50%)`,
                                background: `rgba(255, 255, 255, ${alpha * (1 - easedProgress)})`,
                                boxShadow: `0 0 ${size * 0.5}px rgba(255, 255, 255, ${alpha * 0.8})`,
                            }}
                        />
                    </>
                );

            case 'cyber-pulse':
                return (
                    <>
                        {/* Concentric cyber waves */}
                        {[0, 0.15, 0.3, 0.45].map((offset, i) => {
                            const waveProgress = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
                            if (waveProgress <= 0) return null;
                            const waveSize = baseSize * waveProgress * 2;
                            const waveAlpha = alpha * (1 - waveProgress) * (1 - offset * 0.4);
                            const easeInOut = waveProgress < 0.5 
                                ? 2 * waveProgress * waveProgress 
                                : 1 - Math.pow(-2 * waveProgress + 2, 2) / 2;
                            return (
                                <div
                                    key={i}
                                    className="absolute rounded-full border-2 pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${waveSize}px`,
                                        height: `${waveSize * 0.3}px`,
                                        transform: `translate(-50%, -50%) rotate(${45 + i * 45}deg)`,
                                        borderColor: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${waveAlpha})`,
                                        borderWidth: `${Math.max(1, waveSize * 0.02)}px`,
                                        boxShadow: `0 0 ${waveSize * 0.15}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${waveAlpha * 0.6})`,
                                    }}
                                />
                            );
                        })}
                        {/* Central pulse */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size * 0.4}px`,
                                height: `${size * 0.4}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha}) 0%, transparent 70%)`,
                                boxShadow: `0 0 ${size * 0.6}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha * glowIntensity})`,
                            }}
                        />
                    </>
                );

            case 'implosion':
                const implodeProgress = progress < 0.5 ? progress * 2 : 1;
                const explodeProgress = progress >= 0.5 ? (progress - 0.5) * 2 : 0;
                const implodeSize = size * (1 - implodeProgress * 0.7);
                const implodeParticles = particles.slice(0, 16);
                return (
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            left: `${xPercent}%`,
                            top: `${yPercent}%`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        {/* Implosion phase - particles pull inward */}
                        {implodeProgress > 0 && implodeParticles.map((particle, i) => {
                            const particleProgress = implodeProgress;
                            const distance = size * 0.8 * (1 - particleProgress) * particle.speed;
                            const x = Math.cos(particle.angle) * distance;
                            const y = Math.sin(particle.angle) * distance;
                            const particleAlpha = alpha * particleProgress;
                            return (
                                <div
                                    key={`implode-${i}`}
                                    className="absolute rounded-full pointer-events-none"
                                    style={{
                                        left: '50%',
                                        top: '50%',
                                        width: `${particle.size}px`,
                                        height: `${particle.size}px`,
                                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                                        background: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${particleAlpha})`,
                                    }}
                                />
                            );
                        })}
                        {/* Explosion phase - particles burst outward */}
                        {explodeProgress > 0 && implodeParticles.map((particle, i) => {
                            const particleProgress = explodeProgress;
                            const distance = size * 1.5 * particleProgress * particle.speed * 2;
                            const x = Math.cos(particle.angle) * distance;
                            const y = Math.sin(particle.angle) * distance;
                            const particleAlpha = alpha * (1 - particleProgress);
                            return (
                                <div
                                    key={`explode-${i}`}
                                    className="absolute rounded-full pointer-events-none"
                                    style={{
                                        left: '50%',
                                        top: '50%',
                                        width: `${particle.size * (1 + particleProgress)}px`,
                                        height: `${particle.size * (1 + particleProgress)}px`,
                                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                                        background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${particleAlpha}) 0%, rgba(${secondaryColor.r}, ${secondaryColor.g}, ${secondaryColor.b}, 0) 100%)`,
                                        boxShadow: `0 0 ${particle.size * 3}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${particleAlpha * 0.8})`,
                                    }}
                                />
                            );
                        })}
                        {/* Central core */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: '50%',
                                top: '50%',
                                width: `${implodeSize}px`,
                                height: `${implodeSize}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha}) 0%, transparent 70%)`,
                                boxShadow: `0 0 ${implodeSize * 0.8}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${alpha * 0.9})`,
                            }}
                        />
                    </div>
                );

            case 'magnetic':
                const magneticStrength = config.force * 0.3;
                const magneticProgress = Math.min(1, progress * 3); // Faster animation
                const magneticAlpha = alpha * (1 - magneticProgress);
                return (
                    <>
                        {/* Magnetic field lines */}
                        {Array.from({ length: 8 }).map((_, i) => {
                            const angle = (i / 8) * Math.PI * 2;
                            const lineLength = size * magneticProgress * 0.8;
                            const x = Math.cos(angle) * lineLength;
                            const y = Math.sin(angle) * lineLength;
                            return (
                                <div
                                    key={i}
                                    className="absolute pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${lineLength}px`,
                                        height: '2px',
                                        transform: `translate(-50%, -50%) rotate(${angle * (180 / Math.PI)}deg)`,
                                        background: `linear-gradient(to right, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${magneticAlpha}) 0%, transparent 100%)`,
                                    }}
                                />
                            );
                        })}
                        {/* Central magnetic point */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size * 0.3}px`,
                                height: `${size * 0.3}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${magneticAlpha}) 0%, transparent 70%)`,
                                boxShadow: `0 0 ${size * 0.5}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${magneticAlpha * 0.8})`,
                            }}
                        />
                    </>
                );

            case 'hologram':
                const scanlineOffset = (progress * 100) % 10;
                const flickerAlpha = alpha * (0.8 + Math.sin(progress * Math.PI * 20) * 0.2);
                return (
                    <>
                        {/* Hologram scanlines */}
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute pointer-events-none"
                                style={{
                                    left: `${xPercent}%`,
                                    top: `${yPercent}%`,
                                    width: `${size * 1.5}px`,
                                    height: '1px',
                                    transform: `translate(-50%, calc(-50% + ${(i - 2) * 20 + scanlineOffset}px))`,
                                    background: `linear-gradient(90deg, transparent 0%, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${flickerAlpha * 0.6}) 50%, transparent 100%)`,
                                    boxShadow: `0 0 ${size * 0.3}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${flickerAlpha})`,
                                }}
                            />
                        ))}
                        {/* Hologram glow */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size}px`,
                                height: `${size}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${flickerAlpha * 0.4}) 0%, transparent 70%)`,
                                border: `1px solid rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${flickerAlpha})`,
                                boxShadow: `0 0 ${size * 0.8}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${flickerAlpha * 0.6})`,
                            }}
                        />
                    </>
                );

            case 'shock-blur':
                const blurStrength = config.blurStrength || 10;
                const shockBlurSize = size * (1 + easedProgress * 2);
                const shockBlurAlpha = alpha * (1 - easedProgress);
                return (
                    <>
                        {/* Radial blur rings */}
                        {[0, 0.3, 0.6].map((offset, i) => {
                            const ringProgress = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
                            if (ringProgress <= 0) return null;
                            const ringSize = shockBlurSize * ringProgress;
                            const ringAlpha = shockBlurAlpha * (1 - ringProgress);
                            const ringBlur = blurStrength * (1 - ringProgress);
                            return (
                                <div
                                    key={i}
                                    className="absolute rounded-full pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${ringSize}px`,
                                        height: `${ringSize}px`,
                                        transform: 'translate(-50%, -50%)',
                                        background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${ringAlpha * 0.3}) 0%, transparent 60%)`,
                                        filter: `blur(${ringBlur}px)`,
                                    }}
                                />
                            );
                        })}
                        {/* Central shock point */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size * 0.2}px`,
                                height: `${size * 0.2}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${shockBlurAlpha})`,
                                boxShadow: `0 0 ${size * 0.4}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${shockBlurAlpha * 0.8})`,
                            }}
                        />
                    </>
                );

            case 'liquid':
                const distortionStrength = config.distortionStrength || 0.5;
                const liquidSize = size * (1 + easedProgress * 1.8);
                const liquidAlpha = alpha * (1 - easedProgress);
                const waveOffset = Math.sin(progress * Math.PI * 4) * distortionStrength * 10;
                return (
                    <>
                        {/* Liquid waves */}
                        {[0, 0.2, 0.4].map((offset, i) => {
                            const waveProgress = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
                            if (waveProgress <= 0) return null;
                            const waveSize = liquidSize * waveProgress;
                            const waveAlpha = liquidAlpha * (1 - waveProgress);
                            const waveDistortion = Math.sin(waveProgress * Math.PI * 3 + i) * distortionStrength * 15;
                            return (
                                <div
                                    key={i}
                                    className="absolute pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${waveSize}px`,
                                        height: `${waveSize * 0.6}px`,
                                        transform: `translate(calc(-50% + ${waveDistortion}px), -50%)`,
                                        borderRadius: '50%',
                                        background: `radial-gradient(ellipse, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${waveAlpha * 0.4}) 0%, transparent 70%)`,
                                        filter: `blur(${waveSize * 0.03}px)`,
                                    }}
                                />
                            );
                        })}
                        {/* Liquid center */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size * 0.4}px`,
                                height: `${size * 0.4}px`,
                                transform: `translate(calc(-50% + ${waveOffset}px), -50%)`,
                                background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${liquidAlpha}) 0%, transparent 70%)`,
                                filter: `blur(${size * 0.05}px)`,
                            }}
                        />
                    </>
                );

            case 'time-freeze':
                // Visual indicator - this would need video playback control for full effect
                const freezeAlpha = alpha * (1 - Math.abs(easedProgress - 0.5) * 2);
                return (
                    <>
                        {/* Time freeze indicator rings */}
                        {[0, 0.25, 0.5].map((offset, i) => {
                            const ringProgress = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
                            if (ringProgress <= 0 || ringProgress > 0.5) return null;
                            const ringSize = baseSize * (0.5 + ringProgress * 1.5);
                            const ringAlpha = freezeAlpha * (1 - ringProgress * 2);
                            return (
                                <div
                                    key={i}
                                    className="absolute rounded-full border-2 pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${ringSize}px`,
                                        height: `${ringSize}px`,
                                        transform: 'translate(-50%, -50%)',
                                        borderColor: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${ringAlpha})`,
                                        borderStyle: 'dashed',
                                        borderWidth: `${Math.max(1, ringSize * 0.02)}px`,
                                    }}
                                />
                            );
                        })}
                        {/* Central freeze point */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size * 0.3}px`,
                                height: `${size * 0.3}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${freezeAlpha})`,
                                boxShadow: `0 0 ${size * 0.5}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${freezeAlpha * 0.8})`,
                            }}
                        />
                    </>
                );

            case 'depth-pop':
                const depthScale = 1 + (1 - easedProgress) * 0.5;
                const depthSize = size * depthScale;
                const depthAlpha = alpha * (1 - easedProgress);
                return (
                    <>
                        {/* 3D depth layers */}
                        {[0, 0.2, 0.4].map((offset, i) => {
                            const layerProgress = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
                            if (layerProgress <= 0) return null;
                            const layerScale = 1 - (i * 0.15);
                            const layerSize = depthSize * layerScale * (1 - layerProgress * 0.5);
                            const layerAlpha = depthAlpha * (1 - layerProgress) * (1 - i * 0.2);
                            const layerZ = i * -5;
                            return (
                                <div
                                    key={i}
                                    className="absolute rounded-full pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${layerSize}px`,
                                        height: `${layerSize}px`,
                                        transform: `translate(-50%, -50%) scale(${layerScale}) translateZ(${layerZ}px)`,
                                        background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${layerAlpha}) 0%, transparent 70%)`,
                                        boxShadow: `0 0 ${layerSize * 0.4}px rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${layerAlpha * 0.6})`,
                                        perspective: '1000px',
                                    }}
                                />
                            );
                        })}
                    </>
                );

            case 'heat-ripple':
                const heatDistortion = config.distortionStrength || 0.6;
                const heatSize = size * (1 + easedProgress * 2.5);
                const heatAlpha = alpha * (1 - easedProgress);
                return (
                    <>
                        {/* Heat distortion waves */}
                        {[0, 0.15, 0.3, 0.45].map((offset, i) => {
                            const waveProgress = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
                            if (waveProgress <= 0) return null;
                            const waveSize = heatSize * waveProgress;
                            const waveAlpha = heatAlpha * (1 - waveProgress) * (1 - offset * 0.3);
                            const distortion = Math.sin(waveProgress * Math.PI * 4 + i) * heatDistortion * 8;
                            return (
                                <div
                                    key={i}
                                    className="absolute pointer-events-none"
                                    style={{
                                        left: `${xPercent}%`,
                                        top: `${yPercent}%`,
                                        width: `${waveSize}px`,
                                        height: `${waveSize * 0.4}px`,
                                        transform: `translate(calc(-50% + ${distortion}px), -50%)`,
                                        borderRadius: '50%',
                                        background: `radial-gradient(ellipse, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${waveAlpha * 0.3}) 0%, transparent 80%)`,
                                        filter: `blur(${waveSize * 0.04}px)`,
                                        opacity: waveAlpha,
                                    }}
                                />
                            );
                        })}
                        {/* Heat source */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                left: `${xPercent}%`,
                                top: `${yPercent}%`,
                                width: `${size * 0.3}px`,
                                height: `${size * 0.3}px`,
                                transform: 'translate(-50%, -50%)',
                                background: `radial-gradient(circle, rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, ${heatAlpha}) 0%, transparent 70%)`,
                                filter: `blur(${size * 0.08}px)`,
                            }}
                        />
                    </>
                );

            case 'none':
            default:
                return null;
        }
    };

    return <>{renderEffect()}</>;
};

export const ClickEffectsLayer: React.FC = () => {
    const editorState = useEditorState();
    const containerRef = useRef<HTMLDivElement>(null);

    const { events, playback, effects, video } = editorState;

    // Filter clicks that should show effects
    const activeClicks = events.clicks.filter((click) => {
        const clickKey = `${click.timestamp}`;
        const clickConfig = effects.clickEffects[clickKey];
        
        // Use per-click config if available, otherwise use global settings
        if (clickConfig) {
            return clickConfig.enabled && clickConfig.animationStyle !== 'none';
        }
        
        // Fall back to global settings
        return effects.clickRipple && effects.clickAnimationStyle !== 'none';
    });

    if (activeClicks.length === 0) {
        return null;
    }

    const videoWidth = video.width || 1920;
    const videoHeight = video.height || 1080;

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 pointer-events-none z-30"
            style={{
                width: '100%',
                height: '100%',
            }}
        >
            {activeClicks.map((click, index) => {
                const clickKey = `${click.timestamp}`;
                const clickConfig = effects.clickEffects[clickKey] || {
                    enabled: effects.clickRipple,
                    animationStyle: effects.clickAnimationStyle,
                    size: effects.clickSize,
                    color: effects.clickColor,
                    force: effects.clickForce,
                    easing: effects.clickEasing,
                    emphasis: effects.clickEmphasis,
                    particleCount: 20,
                    glowIntensity: 0.8,
                    trailLength: 10,
                    animationDuration: 0.8,
                    glitchIntensity: 0.5,
                    blurStrength: 10,
                    distortionStrength: 0.5,
                };

                return (
                    <ClickEffect
                        key={`click-effect-${click.timestamp}-${index}`}
                        click={click}
                        config={clickConfig}
                        currentTime={playback.currentTime}
                        videoWidth={videoWidth}
                        videoHeight={videoHeight}
                    />
                );
            })}
        </div>
    );
};
