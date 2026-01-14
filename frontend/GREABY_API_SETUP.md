# Greaby Audio Creation API Integration

This document explains how to configure and use the Greaby audio creation API in the modify.style editor.

## Overview

The Greaby API integration allows you to generate high-quality AI voiceovers directly from your script text. The integration is located in the Voice panel of the editor.

## Configuration

### Environment Variables

To use the Greaby API, you need to configure the following environment variables in your `.env` file:

```env
# Greaby API Configuration
VITE_GREABY_API_URL=https://api.greaby.com/v1
VITE_GREABY_API_KEY=your_api_key_here
```

### Getting Your API Key

1. Sign up for a Greaby account at [greaby.com](https://greaby.com)
2. Navigate to your API settings/dashboard
3. Generate a new API key
4. Copy the API key and add it to your `.env` file

### API Endpoints

The integration expects the following API endpoints:

- **GET** `/voices` - Fetch available voices
- **POST** `/audio/generate` - Generate audio from text
- **GET** `/audio/jobs/{jobId}` - Check job status (for async processing)

## Usage

### In the Editor

1. **Navigate to Script Panel**: Write or generate your script text
2. **Go to Voice Panel**: Click on the Voice tab in the editor sidebar
3. **Select Voice**: Choose from available Greaby voices
4. **Adjust Settings**: Configure speed, pitch, and volume
5. **Generate**: Click "Generate Audio" to create the voiceover
6. **Preview & Download**: Once generated, you can preview and download the audio

### API Service

The Greaby API service is located at `src/lib/api/greaby.ts` and provides:

- `getVoices()` - Fetch available voices
- `generateAudio(request)` - Generate audio from text
- `checkJobStatus(jobId)` - Check async job status
- `waitForJobCompletion(jobId, onProgress, maxWaitTime, pollInterval)` - Poll until completion
- `downloadAudio(audioUrl)` - Download audio file
- `base64ToBlob(base64Data, mimeType)` - Convert base64 to blob

### Example Usage

```typescript
import { greabyAPI } from '@/lib/api/greaby';

// Generate audio
const response = await greabyAPI.generateAudio({
  text: "Hello, this is a test voiceover.",
  voiceId: "emma",
  speed: 1.0,
  pitch: 0,
  volume: 100,
  format: 'mp3',
});

if (response.success && response.audioUrl) {
  // Download and use the audio
  const audioBlob = await greabyAPI.downloadAudio(response.audioUrl);
  // Use audioBlob as needed
}
```

## Request/Response Formats

### Generate Audio Request

```typescript
{
  text: string;           // Text to convert to speech
  voiceId: string;       // Voice identifier
  speed?: number;         // 0.5 to 2.0, default 1.0
  pitch?: number;         // -20 to 20, default 0
  volume?: number;        // 0 to 100, default 100
  format?: 'mp3' | 'wav' | 'ogg'; // default 'mp3'
  sampleRate?: number;    // 22050, 44100, 48000, default 44100
}
```

### Generate Audio Response

```typescript
{
  success: boolean;
  audioUrl?: string;      // URL to download audio
  audioData?: string;     // Base64 encoded audio
  duration?: number;      // Duration in seconds
  jobId?: string;        // For async processing
  error?: string;
  message?: string;
}
```

## Fallback Behavior

If the Greaby API is not configured or unavailable:

- The service will fall back to default voice options
- Error messages will be displayed to the user
- The UI will continue to function with limited capabilities

## Troubleshooting

### API Key Issues

- Ensure your API key is correctly set in the `.env` file
- Restart the development server after changing environment variables
- Check that the API key has the necessary permissions

### Network Issues

- Verify the API URL is correct
- Check your network connection
- Ensure CORS is properly configured on the API server

### Audio Generation Failures

- Verify your script text is not empty
- Check that the selected voice is available
- Review API response errors in the browser console
- Ensure you have sufficient API credits/quota

## Integration with Editor Store

The generated audio is stored in the editor state:

```typescript
voiceover: {
  script: string;
  voiceId: string;
  audioUrl: string | null;
  audioBlob: Blob | null;
  duration: number;
  speed: number;
  pitch: number;
  volume: number;
  isGenerated: boolean;
  generatedAt: number | null;
}
```

This allows the audio to be:
- Used during video rendering
- Exported with the final video
- Synced across editor panels

## Support

For issues or questions:
- Check the Greaby API documentation
- Review browser console for error messages
- Contact Greaby support for API-specific issues
