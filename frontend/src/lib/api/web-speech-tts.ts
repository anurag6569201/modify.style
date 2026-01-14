/**
 * Web Speech API Text-to-Speech Fallback
 * 
 * Uses browser's built-in TTS when Greaby API is not available
 * This provides a simple preview using browser TTS
 */

export interface WebSpeechTTSOptions {
    text: string;
    voiceId?: string;
    language?: string;
    speed?: number;
    pitch?: number;
    volume?: number;
}

/**
 * Generate audio preview using Web Speech API
 * Note: This speaks the text directly but doesn't generate a downloadable file
 * For full audio generation, the Greaby API is required
 */
export async function generateAudioWithWebSpeech(options: WebSpeechTTSOptions): Promise<{
    success: boolean;
    duration?: number;
    error?: string;
    message?: string;
}> {
    return new Promise((resolve) => {
        // Check if Web Speech API is available
        if (!('speechSynthesis' in window)) {
            resolve({
                success: false,
                error: 'Web Speech API is not supported in this browser. Please configure the Greaby API for full audio generation.',
            });
            return;
        }

        try {
            // Cancel any ongoing speech
            speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(options.text);
            
            // Load voices and set voice if available
            const voices = speechSynthesis.getVoices();
            if (options.voiceId || options.language) {
                const targetVoice = voices.find(voice => {
                    if (options.voiceId) {
                        const voiceIdLower = options.voiceId.toLowerCase();
                        return voice.name.toLowerCase().includes(voiceIdLower) ||
                               voice.voiceURI.toLowerCase().includes(voiceIdLower);
                    }
                    if (options.language) {
                        return voice.lang.startsWith(options.language.split('-')[0]);
                    }
                    return false;
                });
                if (targetVoice) {
                    utterance.voice = targetVoice;
                }
            }

            // Set speech parameters
            utterance.rate = Math.max(0.1, Math.min(10, options.speed || 1.0));
            utterance.pitch = Math.max(0, Math.min(2, 1.0 + ((options.pitch || 0) / 20))); // Convert -20 to 20 range to 0 to 2
            utterance.volume = Math.max(0, Math.min(1, (options.volume || 100) / 100));

            const startTime = Date.now();
            let duration = 0;

            utterance.onend = () => {
                duration = (Date.now() - startTime) / 1000;
                resolve({
                    success: true,
                    duration: duration || (options.text.length * 0.1), // Estimate if needed
                    message: 'Audio preview generated using browser TTS. For downloadable audio, please configure the Greaby API.',
                });
            };
            
            utterance.onerror = (error) => {
                resolve({
                    success: false,
                    error: `Speech synthesis error: ${error.error}`,
                });
            };
            
            // Speak the text
            speechSynthesis.speak(utterance);
        } catch (error) {
            resolve({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
}

/**
 * Get available Web Speech API voices
 */
export function getWebSpeechVoices(): SpeechSynthesisVoice[] {
    if (!('speechSynthesis' in window)) {
        return [];
    }
    return speechSynthesis.getVoices();
}

/**
 * Load voices (needed for some browsers)
 */
export function loadWebSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) {
            resolve([]);
            return;
        }
        
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            resolve(voices);
            return;
        }
        
        // Some browsers need this event
        speechSynthesis.onvoiceschanged = () => {
            resolve(speechSynthesis.getVoices());
        };
        
        // Timeout fallback
        setTimeout(() => {
            resolve(speechSynthesis.getVoices());
        }, 1000);
    });
}
