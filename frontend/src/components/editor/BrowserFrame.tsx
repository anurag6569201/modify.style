import React from 'react';
import { useEditorState } from '@/lib/editor/store';
import { PresentationConfig } from '@/lib/editor/types';

export const BrowserFrame: React.FC = () => {
    const { presentation } = useEditorState();

    if (presentation.browserFrameMode === 'hidden') {
        return null;
    }

    const { outputWidth, outputHeight, browserFrameBorder, browserFrameShadow, browserFrameColor } = presentation;

    const isMinimal = presentation.browserFrameMode === 'minimal';

    return (
        <div
            className="absolute inset-0 pointer-events-none z-50"
            style={{
                width: outputWidth,
                height: outputHeight,
            }}
        >
            <svg
                width={outputWidth}
                height={outputHeight}
                className="absolute inset-0"
                style={{ filter: browserFrameShadow ? 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))' : 'none' }}
            >
                {/* Browser Chrome - Top Bar */}
                {!isMinimal && (
                    <g>
                        {/* Top bar background */}
                        <rect
                            x={0}
                            y={0}
                            width={outputWidth}
                            height={40}
                            fill={browserFrameColor}
                            opacity={0.95}
                        />
                        
                        {/* Traffic lights / Window controls */}
                        <g transform={`translate(12, 12)`}>
                            {/* Red */}
                            <circle cx={0} cy={0} r={6} fill="#ff5f57" />
                            {/* Yellow */}
                            <circle cx={18} cy={0} r={6} fill="#ffbd2e" />
                            {/* Green */}
                            <circle cx={36} cy={0} r={6} fill="#28ca42" />
                        </g>

                        {/* Address bar (centered) */}
                        <rect
                            x={outputWidth / 2 - 200}
                            y={8}
                            width={400}
                            height={24}
                            rx={4}
                            fill="rgba(255, 255, 255, 0.1)"
                            stroke="rgba(255, 255, 255, 0.2)"
                            strokeWidth={1}
                        />
                    </g>
                )}

                {/* Border */}
                {browserFrameBorder && (
                    <rect
                        x={0}
                        y={isMinimal ? 0 : 40}
                        width={outputWidth}
                        height={isMinimal ? outputHeight : outputHeight - 40}
                        fill="none"
                        stroke={browserFrameColor}
                        strokeWidth={isMinimal ? 2 : 1}
                        opacity={0.3}
                    />
                )}

                {/* Minimal mode: just a subtle border */}
                {isMinimal && browserFrameBorder && (
                    <rect
                        x={1}
                        y={1}
                        width={outputWidth - 2}
                        height={outputHeight - 2}
                        fill="none"
                        stroke={browserFrameColor}
                        strokeWidth={1}
                        opacity={0.2}
                    />
                )}
            </svg>
        </div>
    );
};

