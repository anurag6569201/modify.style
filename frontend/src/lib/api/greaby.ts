/**
 * Greaby Audio Creation API Integration
 * 
 * This service handles communication with the Greaby audio creation API
 * for generating text-to-speech audio files.
 */

export interface GreabyVoice {
    id: string;
    name: string;
    description: string;
    language?: string;
    gender?: 'male' | 'female' | 'neutral';
    style?: string;
    previewUrl?: string; // URL to preview audio file
}

export interface GreabyAudioRequest {
    text: string;
    voiceId: string;
    speed?: number; // 0.5 to 2.0, default 1.0
    pitch?: number; // -20 to 20, default 0
    volume?: number; // 0 to 100, default 100
    format?: 'mp3' | 'wav' | 'ogg'; // default 'mp3'
    sampleRate?: number; // 22050, 44100, 48000, default 44100
}

export interface GreabyAudioResponse {
    success: boolean;
    audioUrl?: string;
    audioData?: string; // Base64 encoded audio
    duration?: number; // Duration in seconds
    jobId?: string; // For async processing
    error?: string;
    message?: string;
}

export interface GreabyJobStatus {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number; // 0-100
    audioUrl?: string;
    error?: string;
}

class GreabyAPIService {
    private baseUrl: string;
    private apiKey: string | null;

    constructor() {
        // Get API configuration from environment variables
        this.baseUrl = import.meta.env.VITE_GREABY_API_URL || 'https://api.greaby.com/v1';
        this.apiKey = import.meta.env.VITE_GREABY_API_KEY || null;
    }

    /**
     * Get available voices from Greaby API
     */
    async getVoices(): Promise<GreabyVoice[]> {
        // Check if API is configured - if no API key, skip API call and return empty array
        // VoicePanel will use voice previews as fallback
        if (!this.apiKey) {
            return [];
        }

        try {
            const response = await fetch(`${this.baseUrl}/voices`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch voices: ${response.statusText}`);
            }

            const data = await response.json();
            return data.voices || data || [];
        } catch (error) {
            // Silently return empty array - VoicePanel will handle fallback with preview voices
            // Network errors (Failed to fetch) are expected when API is not configured or unavailable
            // Only log unexpected errors
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                // Network error - API likely not configured or unavailable, this is expected
                return [];
            }
            // Log other types of errors (but don't throw)
            if (error instanceof Error && !error.message.includes('Failed to fetch')) {
                console.warn('Error fetching Greaby voices:', error);
            }
            return [];
        }
    }

    /**
     * Generate audio from text using Greaby API
     * Falls back to Web Speech API if Greaby API is not available
     */
    async generateAudio(request: GreabyAudioRequest): Promise<GreabyAudioResponse> {
        // Check if API is configured
        if (!this.apiKey) {
            // Use Web Speech API fallback
            return this.generateAudioWithWebSpeech(request);
        }

        try {
            const response = await fetch(`${this.baseUrl}/audio/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
                },
                body: JSON.stringify({
                    text: request.text,
                    voice_id: request.voiceId,
                    speed: request.speed || 1.0,
                    pitch: request.pitch || 0,
                    volume: request.volume || 100,
                    format: request.format || 'mp3',
                    sample_rate: request.sampleRate || 44100,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || `API request failed: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Handle different response formats
            if (data.audio_url) {
                return {
                    success: true,
                    audioUrl: data.audio_url,
                    duration: data.duration,
                    jobId: data.job_id,
                };
            } else if (data.audio_data) {
                return {
                    success: true,
                    audioData: data.audio_data,
                    duration: data.duration,
                };
            } else if (data.job_id) {
                // Async processing
                return {
                    success: true,
                    jobId: data.job_id,
                    message: 'Audio generation started. Use checkJobStatus to track progress.',
                };
            }

            return {
                success: false,
                error: 'Unexpected response format',
            };
        } catch (error) {
            // If network error and no API key, use Web Speech API fallback
            if (error instanceof TypeError && error.message === 'Failed to fetch') {
                return this.generateAudioWithWebSpeech(request);
            }
            
            console.error('Error generating Greaby audio:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }

    /**
     * Generate audio using Web Speech API as fallback
     * This provides a preview by speaking the text, but doesn't generate a downloadable file
     */
    private async generateAudioWithWebSpeech(request: GreabyAudioRequest): Promise<GreabyAudioResponse> {
        try {
            const { generateAudioWithWebSpeech } = await import('./web-speech-tts');
            const result = await generateAudioWithWebSpeech({
                text: request.text,
                voiceId: request.voiceId,
                speed: request.speed,
                pitch: request.pitch,
                volume: request.volume,
            });

            if (!result.success) {
                return {
                    success: false,
                    error: result.error || 'Web Speech API generation failed. Please configure the Greaby API for full audio generation.',
                };
            }

            // Return success with message - this will trigger the preview to play
            return {
                success: true,
                duration: result.duration || 0,
                message: result.message || 'Preview generated using browser TTS. Configure Greaby API for downloadable audio.',
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Web Speech API error',
            };
        }
    }

    /**
     * Check status of an async audio generation job
     */
    async checkJobStatus(jobId: string): Promise<GreabyJobStatus> {
        try {
            const response = await fetch(`${this.baseUrl}/audio/jobs/${jobId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to check job status: ${response.statusText}`);
            }

            const data = await response.json();
            return {
                jobId: data.job_id || jobId,
                status: data.status || 'pending',
                progress: data.progress,
                audioUrl: data.audio_url,
                error: data.error,
            };
        } catch (error) {
            console.error('Error checking Greaby job status:', error);
            return {
                jobId,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Poll job status until completion
     */
    async waitForJobCompletion(
        jobId: string,
        onProgress?: (progress: number) => void,
        maxWaitTime: number = 60000, // 60 seconds default
        pollInterval: number = 1000 // 1 second default
    ): Promise<GreabyAudioResponse> {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            const status = await this.checkJobStatus(jobId);

            if (onProgress && status.progress !== undefined) {
                onProgress(status.progress);
            }

            if (status.status === 'completed' && status.audioUrl) {
                return {
                    success: true,
                    audioUrl: status.audioUrl,
                    jobId,
                };
            }

            if (status.status === 'failed') {
                return {
                    success: false,
                    error: status.error || 'Job failed',
                    jobId,
                };
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        return {
            success: false,
            error: 'Job timeout - exceeded maximum wait time',
            jobId,
        };
    }

    /**
     * Download audio file from URL and convert to blob
     */
    async downloadAudio(audioUrl: string): Promise<Blob> {
        try {
            const response = await fetch(audioUrl, {
                headers: {
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to download audio: ${response.statusText}`);
            }

            return await response.blob();
        } catch (error) {
            console.error('Error downloading Greaby audio:', error);
            throw error;
        }
    }

    /**
     * Convert base64 audio data to blob
     */
    base64ToBlob(base64Data: string, mimeType: string = 'audio/mpeg'): Blob {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }
}

// Export singleton instance
export const greabyAPI = new GreabyAPIService();
