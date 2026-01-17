/**
 * Audio Creation API Integration
 * 
 * This service handles communication with the backend audio creation API
 * for generating text-to-speech audio files.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface VoiceOption {
    id: string;
    name: string;
    multiplier: number;
}

export interface AudioCreationRequest {
    title?: string;
    text_input: string;
    voice: string;
    response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav';
    speed?: number; // 0.25 to 4.0, default 1.0
}

export interface AudioCreation {
    id: string;
    title: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    text_input: string;
    voice: string;
    response_format: string;
    speed: number;
    credit_cost: number;
    result_url?: string | null;
    error_message?: string | null;
    created_at: string;
}

export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
    total_pages?: number;
}

class AudioAPIService {
    private getAuthHeaders(): HeadersInit {
        const token = localStorage.getItem('accessToken');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
        };
    }

    /**
     * Get available voice options from the API
     */
    async getVoiceOptions(): Promise<VoiceOption[]> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/audios/voice-options/`, {
                method: 'GET',
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch voice options: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching voice options:', error);
            throw error;
        }
    }

    /**
     * Create a new audio generation request
     */
    async createAudio(request: AudioCreationRequest): Promise<AudioCreation> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/audios/`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    title: request.title || '',
                    text_input: request.text_input,
                    voice: request.voice,
                    response_format: request.response_format || 'mp3',
                    speed: request.speed || 1.0,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.error || `API request failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating audio:', error);
            throw error;
        }
    }

    /**
     * Get a single audio creation by ID
     */
    async getAudio(id: string): Promise<AudioCreation> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/audios/${id}/`, {
                method: 'GET',
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch audio: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching audio:', error);
            throw error;
        }
    }

    /**
     * List audio creations with pagination
     */
    async listAudios(page: number = 1): Promise<PaginatedResponse<AudioCreation>> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/audios/?page=${page}`, {
                method: 'GET',
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch audio list: ${response.statusText}`);
            }

            const data = await response.json();
            // Calculate total_pages if not provided
            if (!data.total_pages && data.count) {
                const pageSize = data.results?.length || 10;
                data.total_pages = Math.ceil(data.count / pageSize);
            }
            return data;
        } catch (error) {
            console.error('Error fetching audio list:', error);
            throw error;
        }
    }

    /**
     * List failed audio creations with pagination
     */
    async listFailedAudios(page: number = 1): Promise<PaginatedResponse<AudioCreation>> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/audios/failed/?page=${page}`, {
                method: 'GET',
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch failed audio list: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.total_pages && data.count) {
                const pageSize = data.results?.length || 10;
                data.total_pages = Math.ceil(data.count / pageSize);
            }
            return data;
        } catch (error) {
            console.error('Error fetching failed audio list:', error);
            throw error;
        }
    }

    /**
     * Update audio creation title
     */
    async updateAudio(id: string, title: string): Promise<AudioCreation> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/audios/${id}/`, {
                method: 'PATCH',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ title }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.error || `Update failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error updating audio:', error);
            throw error;
        }
    }

    /**
     * Delete an audio creation
     */
    async deleteAudio(id: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/audios/${id}/`, {
                method: 'DELETE',
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || errorData.error || `Delete failed: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error deleting audio:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const audioAPI = new AudioAPIService();
