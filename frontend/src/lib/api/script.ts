/**
 * Script Generation API Integration
 * 
 * This service handles communication with the backend script generation API
 * for generating timestamped scripts using Gemini AI.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface ScriptSegment {
    text: string;
    timestamp: number;
}

export interface ScriptGenerationRequest {
    video_url?: string | null;
    video_duration: number;
    events: {
        clicks?: Array<{
            timestamp: number;
            x: number;
            y: number;
            [key: string]: any;
        }>;
        moves?: Array<{
            timestamp: number;
            x: number;
            y: number;
            [key: string]: any;
        }>;
        [key: string]: any;
    };
    screenshots?: Array<{
        timestamp: number;
        image: string; // base64 encoded image (data URL)
    }>;
}

export interface ScriptGenerationResponse {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    video_url?: string | null;
    video_duration: number;
    script_segments: ScriptSegment[];
    error_message?: string | null;
    created_at: string;
    updated_at: string;
}

class ScriptAPIService {
    private getAuthHeaders(): HeadersInit {
        const token = localStorage.getItem('accessToken');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
        };
    }

    /**
     * Generate script with timestamps using Gemini API
     * 
     * @param request - Script generation request with video data and events
     * @returns Promise with script segments containing text and timestamps
     */
    async generateScriptWithTimestamps(
        request: ScriptGenerationRequest
    ): Promise<ScriptGenerationResponse> {
        try {
            const token = localStorage.getItem('accessToken');
            if (!token) {
                throw new Error('Authentication required. Please log in to generate scripts.');
            }

            // Prepare request body - ensure video_url is null if empty/invalid
            const requestBody: any = {
                video_duration: request.video_duration,
                events: request.events,
                screenshots: request.screenshots || [],
            };
            
            // Only include video_url if it's a valid non-empty string
            if (request.video_url && request.video_url.trim() !== '') {
                requestBody.video_url = request.video_url;
            } else {
                requestBody.video_url = null;
            }

            const response = await fetch(`${API_BASE_URL}/api/scripts/generate/`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                // Handle authentication errors
                if (response.status === 401) {
                    // Token expired or invalid
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    throw new Error('Your session has expired. Please log in again.');
                }

                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.detail || 
                                    errorData.error || 
                                    errorData.message ||
                                    `Failed to generate script: ${response.statusText}`;
                throw new Error(errorMessage);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error generating script:', error);
            throw error;
        }
    }

    /**
     * Get a script generation by ID
     * 
     * @param id - Script generation ID
     * @returns Promise with script generation data
     */
    async getScriptGeneration(id: string): Promise<ScriptGenerationResponse> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/scripts/generate/${id}/`, {
                method: 'GET',
                headers: this.getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch script generation: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching script generation:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const scriptAPI = new ScriptAPIService();
