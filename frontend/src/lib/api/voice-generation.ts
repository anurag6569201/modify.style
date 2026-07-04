/**
 * Voice generation via the Django backend (Azure Speech neural TTS).
 * Same path in local dev and production — no Greaby dependency required.
 */

import { audioAPI } from './audio';
import { API_BASE_URL, authFetch } from '@/lib/auth';

function measureBlobDuration(blob: Blob): Promise<number> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.addEventListener('loadedmetadata', () => {
            resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
            URL.revokeObjectURL(url);
        });
        audio.addEventListener('error', () => {
            resolve(0);
            URL.revokeObjectURL(url);
        });
    });
}

export interface VoiceGenerationResult {
    audioBlob: Blob;
    audioUrl: string;
    duration: number;
}

export async function generateVoiceAudio(options: {
    text: string;
    voiceId: string;
    speed?: number;
    title?: string;
}): Promise<VoiceGenerationResult> {
    const creation = await audioAPI.createAudio({
        text_input: options.text,
        voice: options.voiceId,
        speed: options.speed ?? 1.0,
        response_format: 'mp3',
        title: options.title || 'Voiceover segment',
    });

    if (creation.status === 'failed') {
        throw new Error(creation.error_message || 'Audio generation failed');
    }

    if (creation.status !== 'completed') {
        throw new Error('Audio generation did not complete');
    }

    const downloadUrl = `${API_BASE_URL}/api/audios/${creation.id}/download/`;
    const response = await authFetch(downloadUrl);
    if (!response.ok) {
        throw new Error('Failed to download generated audio');
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const duration = await measureBlobDuration(audioBlob);

    return { audioBlob, audioUrl, duration };
}
