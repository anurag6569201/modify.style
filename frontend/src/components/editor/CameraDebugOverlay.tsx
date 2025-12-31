import React, { useEffect, useState, useRef } from 'react';
import { useEditorState, editorStore } from '@/lib/editor/store';

export const CameraDebugOverlay: React.FC = () => {
    const [debugInfo, setDebugInfo] = useState<string>('');
    const requestRef = useRef<number>();

    useEffect(() => {
        const update = () => {
            // We need to access the internal camera state from Stage...
            // But Stage state is in a Ref inside Stage.tsx.
            // Ideally Stage should expose it or write it to a debug store.
            // For MVP, we can't easily access it unless we lift it up or use a side-channel.
            // HOWEVER, we can just display the Global Config for now.
            // OR we can make `cameraState` part of the Store but update it via `setState` inside the loop? 
            // Updating Store 60fps might kill React.

            // Alternative: Stage writes to window.__DEBUG_CAMERA_STATE
            const camState = (window as any).__DEBUG_CAMERA_STATE;
            if (camState) {
                setDebugInfo(JSON.stringify(camState, null, 2));
            }

            requestRef.current = requestAnimationFrame(update);
        };

        requestRef.current = requestAnimationFrame(update);
        return () => cancelAnimationFrame(requestRef.current!);
    }, []);

    if (process.env.NODE_ENV === 'production') return null;

    return (
        <div className="absolute top-4 right-4 bg-black/80 text-green-400 p-4 rounded font-mono text-xs whitespace-pre z-[100] pointer-events-none">
            {debugInfo || "Camera Debug Info (Waiting...)"}
        </div>
    );
};
