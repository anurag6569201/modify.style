/**
 * Voice Preview Mapping
 * 
 * Maps Greaby voice IDs to their preview audio files
 */

export interface VoicePreview {
    voiceId: string;
    previewUrl: string;
    name: string;
    language?: string;
    gender?: 'male' | 'female' | 'neutral';
    quality?: 'standard' | 'hd' | 'turbo';
}

/**
 * Parse voice filename to extract voice information
 * Format examples:
 * - en-US-Emma-General-Audio-wav.wav
 * - en-US-Andrew3DragonHDLatest-General-Audio-wav.wav
 * - de-DE-SeraphinaMultilingual-General-Audio-wav.wav
 */
function parseVoiceFilename(filename: string): {
    voiceId: string;
    name: string;
    language: string;
    quality?: 'standard' | 'hd' | 'turbo';
} {
    // Remove extension
    const nameWithoutExt = filename.replace(/\.(wav|mp3|ogg|m4a)$/i, '');
    
    // Extract language code (e.g., en-US, de-DE)
    const langMatch = nameWithoutExt.match(/^([a-z]{2}-[A-Z]{2})-/i);
    const language = langMatch ? langMatch[1] : 'en-US';
    
    // Remove language prefix and common suffixes
    let cleanName = nameWithoutExt.replace(/^[a-z]{2}-[A-Z]{2}-/i, '');
    cleanName = cleanName.replace(/-General-Audio-wav$/, '');
    cleanName = cleanName.replace(/-General-audio-wav$/, '');
    
    // Detect quality indicators
    let quality: 'standard' | 'hd' | 'turbo' | undefined = undefined;
    if (cleanName.includes('DragonHDLatest') || cleanName.includes('HD')) {
        quality = 'hd';
    } else if (cleanName.includes('Turbo')) {
        quality = 'turbo';
    } else {
        quality = 'standard';
    }
    
    // Remove quality suffixes to get base name
    let baseName = cleanName
        .replace(/-DragonHDLatest$/, '')
        .replace(/-HD$/, '')
        .replace(/-Turbo$/, '')
        .replace(/-Multilingual$/, '')
        .replace(/2$/, '')
        .replace(/3$/, '');
    
    // Create voice ID (lowercase, hyphenated)
    const voiceId = baseName.toLowerCase().replace(/\s+/g, '-');
    
    return {
        voiceId,
        name: baseName,
        language,
        quality,
    };
}

/**
 * Get preview URL for a voice ID
 */
export function getVoicePreviewUrl(voiceId: string): string | null {
    // Try to find matching preview file
    // This will be populated dynamically from available files
    const previewPath = `/voice-previews/${voiceId}`;
    return previewPath;
}

/**
 * Parse a voice filename to extract voice information
 */
function parseVoiceFilenameToVoice(filename: string): VoicePreview | null {
    try {
        // Remove extension
        const nameWithoutExt = filename.replace(/\.(wav|mp3|ogg|m4a)$/i, '');
        
        // Extract language code (e.g., en-US, de-DE, En-US)
        const langMatch = nameWithoutExt.match(/^([a-z]{2}-[A-Z]{2}|[A-Z][a-z]-[A-Z]{2})-/i);
        const language = langMatch ? langMatch[1] : 'en-US';
        
        // Remove language prefix and common suffixes
        let cleanName = nameWithoutExt.replace(/^[a-z]{2}-[A-Z]{2}-/i, '');
        cleanName = cleanName.replace(/^[A-Z][a-z]-[A-Z]{2}-/i, '');
        cleanName = cleanName.replace(/-General-Audio-wav$/, '');
        cleanName = cleanName.replace(/-General-audio-wav$/, '');
        
        // Detect quality indicators
        let quality: 'standard' | 'hd' | 'turbo' = 'standard';
        if (cleanName.includes('DragonHDLatest') || cleanName.includes('HD')) {
            quality = 'hd';
        } else if (cleanName.includes('Turbo')) {
            quality = 'turbo';
        }
        
        // Remove quality suffixes to get base name
        let baseName = cleanName
            .replace(/-DragonHDLatest$/, '')
            .replace(/-HD$/, '')
            .replace(/-Turbo$/, '')
            .replace(/-Multilingual$/, '')
            .replace(/2$/, '')
            .replace(/3$/, '');
        
        // Create voice ID (lowercase, hyphenated)
        const voiceId = baseName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        // Try to detect gender from name (simple heuristic)
        const nameLower = baseName.toLowerCase();
        const femaleNames = ['emma', 'sarah', 'ashley', 'amber', 'ana', 'jane', 'nancy', 'serena', 'seraphina', 'vivienne', 'arabella', 'xiaoyu', 'kavya', 'aarti', 'aashi', 'ananya', 'neerja', 'ada', 'nova', 'shimmer'];
        const maleNames = ['james', 'jason', 'andrew', 'davis', 'tony', 'guy', 'steffan', 'florian', 'remy', 'lucien', 'madhur', 'arjun', 'kunal', 'prabhat', 'rehaan', 'aarav', 'ollie', 'onyx'];
        
        let gender: 'male' | 'female' | 'neutral' = 'neutral';
        if (femaleNames.some(n => nameLower.includes(n))) {
            gender = 'female';
        } else if (maleNames.some(n => nameLower.includes(n))) {
            gender = 'male';
        }
        
        return {
            voiceId,
            previewUrl: `/voice-previews/${filename}`,
            name: baseName,
            language,
            gender,
            quality,
        };
    } catch (error) {
        console.warn('Error parsing voice filename:', filename, error);
        return null;
    }
}

/**
 * Create a mapping of voice IDs to preview files
 * This scans the available preview files and creates a mapping
 */
export function createVoicePreviewMap(): Map<string, VoicePreview> {
    const voiceMap = new Map<string, VoicePreview>();
    
    // List of known voice preview files with explicit mappings for better matching
    const knownVoices: Array<{ id: string; filename: string; name: string; language?: string; gender?: 'male' | 'female' }> = [
        // English US voices
        { id: 'emma', filename: 'en-US-Emma-General-Audio-wav.wav', name: 'Emma', language: 'en-US', gender: 'female' },
        { id: 'james', filename: 'En-US-Jason-General-Audio-wav.wav', name: 'Jason', language: 'en-US', gender: 'male' },
        { id: 'sarah', filename: 'en-US-Ashley-General-Audio-wav.wav', name: 'Ashley', language: 'en-US', gender: 'female' },
        { id: 'andrew', filename: 'en-US-Andrew-General-Audio-wav.wav', name: 'Andrew', language: 'en-US', gender: 'male' },
        { id: 'amber', filename: 'en-US-Amber-General-Audio-wav.wav', name: 'Amber', language: 'en-US', gender: 'female' },
        { id: 'ana', filename: 'en-US-Ana-General-Audio-wav.wav', name: 'Ana', language: 'en-US', gender: 'female' },
        { id: 'davis', filename: 'En-US-Davis-General-Audio-wav.wav', name: 'Davis', language: 'en-US', gender: 'male' },
        { id: 'jane', filename: 'En-US-Jane-General-Audio-wav.wav', name: 'Jane', language: 'en-US', gender: 'female' },
        { id: 'nancy', filename: 'En-US-Nancy-General-Audio-wav.wav', name: 'Nancy', language: 'en-US', gender: 'female' },
        { id: 'tony', filename: 'En-US-Tony-General-Audio-wav.wav', name: 'Tony', language: 'en-US', gender: 'male' },
        { id: 'guy', filename: 'en-US-Guy-General-audio-wav.wav', name: 'Guy', language: 'en-US', gender: 'male' },
        
        // Multilingual voices
        { id: 'nova-turbo', filename: 'en-US-NovaTurboMultilingual-General-Audio-wav.wav', name: 'Nova Turbo', language: 'en-US', gender: 'female' },
        { id: 'shimmer-turbo', filename: 'en-US-ShimmerTurboMultilingual-General-Audio-wav.wav', name: 'Shimmer Turbo', language: 'en-US', gender: 'female' },
        { id: 'onyx-turbo', filename: 'en-US-OnyxTurboMultilingual-General-Audio-wav.wav', name: 'Onyx Turbo', language: 'en-US', gender: 'male' },
        { id: 'ada', filename: 'en-GB-AdaMultilingual-General-Audio-wav.wav', name: 'Ada', language: 'en-GB', gender: 'female' },
        { id: 'ollie', filename: 'en-GB-OllieMultilingual-General-Audio-wav.wav', name: 'Ollie', language: 'en-GB', gender: 'male' },
        
        // HD voices
        { id: 'andrew-hd', filename: 'en-US-Andrew3DragonHDLatest-General-Audio-wav.wav', name: 'Andrew HD', language: 'en-US', gender: 'male' },
        { id: 'serena-hd', filename: 'en-US-SerenaDragonHDLatest-General-Audio-wav.wav', name: 'Serena HD', language: 'en-US', gender: 'female' },
        { id: 'steffan-hd', filename: 'en-US-SteffanDragonHDLatest-General-Audio-wav.wav', name: 'Steffan HD', language: 'en-US', gender: 'male' },
        
        // German voices
        { id: 'seraphina', filename: 'de-DE-SeraphinaMultilingual-General-Audio-wav.wav', name: 'Seraphina', language: 'de-DE', gender: 'female' },
        { id: 'florian', filename: 'de-DE-FlorianMultilingual-General-Audio-wav.wav', name: 'Florian', language: 'de-DE', gender: 'male' },
        
        // French voices
        { id: 'remy', filename: 'fr-FR-RemyMultilingual-General-Audio-wav.wav', name: 'Remy', language: 'fr-FR', gender: 'male' },
        { id: 'vivienne', filename: 'fr-FR-VivienneMultilingual-General-Audio-wav.wav', name: 'Vivienne', language: 'fr-FR', gender: 'female' },
        { id: 'lucien', filename: 'fr-FR-LucienMultilingual-General-Audio-wav.wav', name: 'Lucien', language: 'fr-FR', gender: 'male' },
        
        // Spanish voices
        { id: 'arabella', filename: 'es-ES-ArabellaMultilingual-General-Audio-wav.wav', name: 'Arabella', language: 'es-ES', gender: 'female' },
        
        // Chinese voices
        { id: 'xiaoyu', filename: 'zh-CN-XiaoyuMultilingual-General-Audio-wav.wav', name: 'Xiaoyu', language: 'zh-CN', gender: 'female' },
        
        // Hindi voices
        { id: 'madhur', filename: 'hi-IN-Madhur-General-Audio-wav.wav', name: 'Madhur', language: 'hi-IN', gender: 'male' },
        { id: 'kavya', filename: 'hi-IN-Kavya-General-Audio-wav.wav', name: 'Kavya', language: 'hi-IN', gender: 'female' },
    ];
    
    // Add known voices with explicit mappings
    knownVoices.forEach(voice => {
        const previewUrl = `/voice-previews/${voice.filename}`;
        voiceMap.set(voice.id, {
            voiceId: voice.id,
            previewUrl,
            name: voice.name,
            language: voice.language,
            gender: voice.gender,
            quality: voice.filename.includes('HD') ? 'hd' : voice.filename.includes('Turbo') ? 'turbo' : 'standard',
        });
    });
    
    // Add all other voice files by parsing their filenames
    // This is a comprehensive list of all 116 voice files
    const allVoiceFiles = [
        'En-US-Davis-General-Audio-wav.wav', 'En-US-Jane-General-Audio-wav.wav', 'En-US-Jason-General-Audio-wav.wav',
        'En-US-Nancy-General-Audio-wav.wav', 'En-US-Tony-General-Audio-wav.wav',
        'de-DE-FlorianDragonHDLatest-General-Audio-wav.wav', 'de-DE-FlorianMultilingual-General-Audio-wav.wav',
        'de-DE-SeraphinaDragonHDLatest-General-Audio-wav.wav', 'de-DE-SeraphinaMultilingual-General-Audio-wav.wav',
        'en-GB-AdaMultilingual-General-Audio-wav.wav', 'en-GB-OllieMultilingual-General-Audio-wav.wav',
        'en-IN-Aarav-General-Audio-wav.wav', 'en-IN-Aarti-General-Audio-wav.wav', 'en-IN-AartiHD-General-Audio-wav.wav',
        'en-IN-Aashi-General-Audio-wav.wav', 'en-IN-Ananya-General-Audio-wav.wav', 'en-IN-Arjun-General-Audio-wav.wav',
        'en-IN-Kavya-General-Audio-wav.wav', 'en-IN-Kunal-General-Audio-wav.wav', 'en-IN-Neerja-General-Audio-wav.wav',
        'en-IN-Prabhat-General-Audio-wav.wav', 'en-IN-Rehaan-General-Audio-wav.wav',
        'en-US-AdamDragonHDLatest-General-Audio-wav.wav', 'en-US-AlloyDragonHDLatest-General-Audio-wav.wav',
        'en-US-AlloyTurboMultilingual-General-Audio-wav.wav', 'en-US-Amber-General-Audio-wav.wav',
        'en-US-Ana-General-Audio-wav.wav', 'en-US-Andrew-General-Audio-wav.wav',
        'en-US-Andrew2DragonHDLatest-General-Audio-wav.wav', 'en-US-Andrew3DragonHDLatest-General-Audio-wav.wav',
        'en-US-Ashley-General-Audio-wav.wav', 'en-US-Charlemagne-General-Audio-wav.wav',
        'en-US-Cora-General-Audio-wav.wav', 'en-US-Dom-General-Audio-wav.wav',
        'en-US-Dorothy-General-Audio-wav.wav', 'en-US-Echo-General-Audio-wav.wav',
        'en-US-Emma-General-Audio-wav.wav', 'en-US-Fable-General-Audio-wav.wav',
        'en-US-Guy-General-audio-wav.wav', 'en-US-Isabella-General-Audio-wav.wav',
        'en-US-Juniper-General-Audio-wav.wav', 'en-US-Liam-General-Audio-wav.wav',
        'en-US-Matilda-General-Audio-wav.wav', 'en-US-Michael-General-Audio-wav.wav',
        'en-US-Mimi-General-Audio-wav.wav', 'en-US-Nicole-General-Audio-wav.wav',
        'en-US-NovaTurboMultilingual-General-Audio-wav.wav', 'en-US-OnyxTurboMultilingual-General-Audio-wav.wav',
        'en-US-Piper-General-Audio-wav.wav', 'en-US-Rachel-General-Audio-wav.wav',
        'en-US-River-General-Audio-wav.wav', 'en-US-Sage-General-Audio-wav.wav',
        'en-US-Sam-General-Audio-wav.wav', 'en-US-SerenaDragonHDLatest-General-Audio-wav.wav',
        'en-US-ShimmerTurboMultilingual-General-Audio-wav.wav', 'en-US-SteffanDragonHDLatest-General-Audio-wav.wav',
        'en-US-SteffanMultilingual-General-Audio-wav.wav', 'en-US-Thomas-General-Audio-wav.wav',
        'en-US-Vera-General-Audio-wav.wav', 'en-US-Will-General-Audio-wav.wav',
        'fr-FR-LucienMultilingual-General-Audio-wav.wav', 'fr-FR-RemyMultilingual-General-Audio-wav.wav',
        'fr-FR-VivienneMultilingual-General-Audio-wav.wav',
        'es-ES-ArabellaMultilingual-General-Audio-wav.wav',
        'zh-CN-XiaoyuMultilingual-General-Audio-wav.wav',
        'hi-IN-Madhur-General-Audio-wav.wav', 'hi-IN-Kavya-General-Audio-wav.wav',
    ];
    
    // Parse and add all voice files
    allVoiceFiles.forEach(filename => {
        // Skip if already in known voices
        if (knownVoices.some(v => v.filename === filename)) {
            return;
        }
        
        const parsed = parseVoiceFilenameToVoice(filename);
        if (parsed && !voiceMap.has(parsed.voiceId)) {
            voiceMap.set(parsed.voiceId, parsed);
        }
    });
    
    return voiceMap;
}

/**
 * Find preview file for a voice by matching voice ID or name
 */
export function findVoicePreview(voiceId: string, voiceName?: string): VoicePreview | null {
    const voiceMap = createVoicePreviewMap();
    
    // Try exact match first
    let preview = voiceMap.get(voiceId.toLowerCase());
    if (preview) return preview;
    
    // Try matching by name
    if (voiceName) {
        for (const [id, previewData] of voiceMap.entries()) {
            if (previewData.name.toLowerCase() === voiceName.toLowerCase()) {
                return previewData;
            }
        }
    }
    
    // Try partial match
    const searchId = voiceId.toLowerCase();
    for (const [id, previewData] of voiceMap.entries()) {
        if (id.includes(searchId) || searchId.includes(id)) {
            return previewData;
        }
    }
    
    return null;
}

/**
 * Get all available voice previews
 */
export function getAllVoicePreviews(): VoicePreview[] {
    const voiceMap = createVoicePreviewMap();
    return Array.from(voiceMap.values());
}
