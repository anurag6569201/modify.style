/**
 * API service for communicating with Django backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiService {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      // Try to parse JSON response even if status is not ok
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // If JSON parsing fails, use empty object
      }
      
      if (!response.ok) {
        // If the response has an error field, use it
        if (errorData.error) {
          throw new Error(errorData.error);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return errorData as T;
    } catch (error: any) {
      console.error('API request failed:', error);
      // Re-throw with more context if it's a network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Unable to connect to the server. Please ensure the backend is running on http://localhost:8000');
      }
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Health check
  async healthCheck() {
    return this.get<{ status: string; message: string }>('/health/');
  }

  // API info
  async getApiInfo() {
    return this.get<{ name: string; version: string; endpoints: any }>('/info/');
  }

  // Proxy website
  async proxyWebsite(url: string) {
    return this.get<{ html?: string; url?: string; status?: string; error?: string }>(`/proxy/?url=${encodeURIComponent(url)}`);
  }
}

export const apiService = new ApiService();
export default apiService;

