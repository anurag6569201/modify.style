import React, { useEffect, useRef, useCallback } from 'react';
import { useEditorState } from '@/lib/editor/store';
import { PresentationConfig } from '@/lib/editor/types';

export const BackgroundLayer: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { presentation } = useEditorState();

    const renderBackground = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Get actual container dimensions
        const container = canvas.parentElement;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const containerWidth = rect.width || presentation.outputWidth;
        const containerHeight = rect.height || presentation.outputHeight;

        // Set canvas size to match container
        canvas.width = containerWidth;
        canvas.height = containerHeight;

        // Clear canvas
        ctx.clearRect(0, 0, containerWidth, containerHeight);

        // Render background based on mode
        if (presentation.backgroundMode === 'hidden') {
            // Transparent/black background
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, containerWidth, containerHeight);
            return;
        }

        if (presentation.backgroundMode === 'solid') {
            ctx.fillStyle = presentation.backgroundColor;
            ctx.fillRect(0, 0, containerWidth, containerHeight);
        } else if (presentation.backgroundMode === 'gradient') {
            const { type, angle = 135, stops } = presentation.backgroundGradient;
            
            let gradient: CanvasGradient;
            
            if (type === 'linear') {
                // Convert angle to radians and calculate gradient line
                const rad = (angle * Math.PI) / 180;
                const x1 = containerWidth / 2 - (containerWidth / 2) * Math.cos(rad);
                const y1 = containerHeight / 2 - (containerHeight / 2) * Math.sin(rad);
                const x2 = containerWidth / 2 + (containerWidth / 2) * Math.cos(rad);
                const y2 = containerHeight / 2 + (containerHeight / 2) * Math.sin(rad);
                
                gradient = ctx.createLinearGradient(x1, y1, x2, y2);
            } else {
                // Radial gradient from center
                const centerX = containerWidth / 2;
                const centerY = containerHeight / 2;
                const radius = Math.max(containerWidth, containerHeight) / 2;
                gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            }

            stops.forEach(stop => {
                gradient.addColorStop(stop.position, stop.color);
            });

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, containerWidth, containerHeight);
        } else if (presentation.backgroundMode === 'image' && presentation.backgroundImage) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                if (!ctx || !canvas) return;
                
                // Draw image to fill canvas (cover mode)
                const imgAspect = img.width / img.height;
                const canvasAspect = containerWidth / containerHeight;
                
                let drawWidth = containerWidth;
                let drawHeight = containerHeight;
                let drawX = 0;
                let drawY = 0;
                
                if (imgAspect > canvasAspect) {
                    // Image is wider - fit to height
                    drawWidth = containerHeight * imgAspect;
                    drawX = (containerWidth - drawWidth) / 2;
                } else {
                    // Image is taller - fit to width
                    drawHeight = containerWidth / imgAspect;
                    drawY = (containerHeight - drawHeight) / 2;
                }
                
                ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
                
                // Apply blur if needed
                if (presentation.backgroundBlur > 0) {
                    applyBlur(ctx, canvas, presentation);
                }
            };
            img.src = presentation.backgroundImage;
            return; // Early return - blur will be applied in onload
        }

        // Apply blur to solid/gradient backgrounds
        if (presentation.backgroundBlur > 0) {
            applyBlur(ctx, canvas, presentation);
        }
    }, [presentation]);

    useEffect(() => {
        renderBackground();
        
        // Add resize observer to update on container resize
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const container = canvas.parentElement;
        if (!container) return;
        
        const resizeObserver = new ResizeObserver(() => {
            renderBackground();
        });
        
        resizeObserver.observe(container);
        
        return () => {
            resizeObserver.disconnect();
        };
    }, [
        renderBackground,
        presentation.backgroundMode,
        presentation.backgroundColor,
        presentation.backgroundGradient,
        presentation.backgroundImage,
        presentation.backgroundBlur,
        presentation.backgroundBlurType,
        presentation.outputWidth,
        presentation.outputHeight,
    ]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none z-0 w-full h-full"
            style={{
                width: '100%',
                height: '100%',
            }}
        />
    );
};

/**
 * Apply blur effect to canvas using multiple passes for stack blur or single pass for gaussian
 */
function applyBlur(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    config: PresentationConfig
) {
    const { backgroundBlur, backgroundBlurType } = config;
    
    if (backgroundBlur <= 0) return;

    // Create temporary canvas for blur
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Copy current canvas content to temp canvas
    tempCtx.drawImage(canvas, 0, 0);

    if (backgroundBlurType === 'stack') {
        // Stack blur: multiple box blur passes
        const passes = Math.ceil(backgroundBlur / 10);
        const blurRadius = backgroundBlur / passes;
        
        // Clear main canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 0; i < passes; i++) {
            ctx.filter = `blur(${blurRadius}px)`;
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.filter = 'none';
            
            // Copy blurred result back to temp for next pass
            if (i < passes - 1) {
                tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                tempCtx.drawImage(canvas, 0, 0);
            }
        }
    } else {
        // Gaussian blur: single CSS filter (browser handles it)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.filter = `blur(${backgroundBlur}px)`;
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.filter = 'none';
    }
}

