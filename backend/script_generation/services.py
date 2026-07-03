import os
import json
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class GeminiScriptService:
    """
    Service for generating scripts with timestamps using Google Gemini API
    """
    
    def __init__(self):
        # Read from environment only — never hardcode secrets in source.
        self.api_key = os.environ.get('GOOGLE_GEMINI_API_KEY', '')
        self.base_url = 'https://generativelanguage.googleapis.com/v1beta'
        
    def generate_script_with_timestamps(
        self,
        video_duration: float,
        events: Dict[str, Any],
        screenshots: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate script segments with timestamps based on video events and screenshots
        
        Args:
            video_duration: Duration of the video in seconds
            events: Dictionary containing clicks, moves, and other events
            screenshots: Optional list of screenshots with timestamp and base64 image
            
        Returns:
            List of script segments: [{text: str, timestamp: float}, ...]
        """
        if not self.api_key:
            logger.warning("Gemini API key not configured, using fallback script generation")
            return self._generate_fallback_script(video_duration, events)
        
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            
            # Use Gemini Vision if we have screenshots, otherwise use text-only
            if screenshots and len(screenshots) > 0:
                # Use Gemini Vision API with images
                try:
                    try:
                        model = genai.GenerativeModel('gemini-2.5-pro')
                    except:
                        try:
                            model = genai.GenerativeModel('gemini-flash-latest')
                        except:
                            try:
                                model = genai.GenerativeModel('gemini-2.5-flash')
                            except:
                                model = genai.GenerativeModel('gemini-2.5-flash-lite')
                    
                    content = self._build_vision_content(video_duration, events, screenshots)
                    response = model.generate_content(content)
                except Exception as vision_error:
                    logger.warning(f"Gemini Vision API failed, falling back to text-only: {vision_error}")
                    # Fallback to text-only
                    prompt = self._build_prompt(video_duration, events)
                    model = genai.GenerativeModel('gemini-2.5-pro')
                    response = model.generate_content(prompt)
            else:
                # Use text-only model
                prompt = self._build_prompt(video_duration, events)
                model = genai.GenerativeModel('gemini-2.5-pro')
                response = model.generate_content(prompt)
            
            script_text = response.text
            
            # Parse and structure the response
            segments = self._parse_script_response(script_text, events, video_duration)
            
            return segments
            
        except ImportError:
            logger.error("google-generativeai package not installed")
            return self._generate_fallback_script(video_duration, events)
        except Exception as e:
            logger.error(f"Error generating script with Gemini: {e}", exc_info=True)
            return self._generate_fallback_script(video_duration, events)
    
    def _build_prompt(self, video_duration: float, events: Dict[str, Any]) -> str:
        """Build the prompt for Gemini API"""
        clicks = events.get('clicks', [])
        moves = events.get('moves', [])
        
        prompt = f"""You are a professional video script writer. Generate a natural, engaging script for a screen recording video demo.

Video Duration: {video_duration:.2f} seconds

User Interactions:
"""
        
        if clicks:
            prompt += "\nClicks (timestamp in seconds):\n"
            for click in clicks[:20]:  # Limit to first 20 clicks
                timestamp = click.get('timestamp', 0)
                x = click.get('x', 0)
                y = click.get('y', 0)
                prompt += f"  - At {timestamp:.2f}s: Click at ({x:.2f}, {y:.2f})\n"
        
        prompt += f"""
Generate a script with timestamps that narrates what's happening in the video. The script should:
1. Be natural and conversational
2. Explain what the user is doing at each interaction point
3. Include timestamps for each segment
4. Be engaging and professional

Format your response as a JSON array where each object has:
- "text": The narration text for that segment
- "timestamp": The time in seconds when this narration should start

Example format:
[
  {{"text": "Welcome to our platform. Let me show you how to get started.", "timestamp": 0.0}},
  {{"text": "First, click on the Get Started button to begin.", "timestamp": 5.2}},
  {{"text": "Notice how intuitive the interface is.", "timestamp": 12.5}}
]

Generate the script now:
"""
        return prompt
    
    def _build_vision_content(
        self,
        video_duration: float,
        events: Dict[str, Any],
        screenshots: List[Dict[str, Any]]
    ) -> List[Any]:
        """Build content for Gemini Vision API with images"""
        import base64
        from PIL import Image
        import io
        
        clicks = events.get('clicks', [])
        
        # Build text prompt
        prompt_text = f"""You are a professional video script writer. Analyze these screenshots from a screen recording video demo and generate a natural, engaging script.

Video Duration: {video_duration:.2f} seconds

User Interactions:
"""
        
        if clicks:
            prompt_text += "\nClicks (timestamp in seconds):\n"
            for click in clicks[:20]:  # Limit to first 20 clicks
                timestamp = click.get('timestamp', 0)
                x = click.get('x', 0)
                y = click.get('y', 0)
                prompt_text += f"  - At {timestamp:.2f}s: Click at ({x:.2f}, {y:.2f})\n"
        
        prompt_text += f"""
For each screenshot, analyze:
1. What UI elements are visible (buttons, text, menus, forms, etc.)
2. What the user is clicking on or interacting with
3. The context and purpose of the interaction
4. Any visible text, labels, or instructions

Generate a script with timestamps that narrates what's happening in the video. The script should:
1. Be natural and conversational
2. Explain what the user is doing at each interaction point based on what you see in the screenshots
3. Reference specific UI elements you can see (button names, menu items, etc.)
4. Include timestamps for each segment
5. Be engaging and professional

Format your response as a JSON array where each object has:
- "text": The narration text for that segment
- "timestamp": The time in seconds when this narration should start

Example format:
[
  {{"text": "Welcome to our platform. Let me show you how to get started.", "timestamp": 0.0}},
  {{"text": "First, click on the Get Started button to begin.", "timestamp": 5.2}},
  {{"text": "Notice how intuitive the interface is.", "timestamp": 12.5}}
]

Generate the script now:
"""
        
        # Build content array - Gemini Vision expects: [text, image1, text, image2, ...]
        # Or we can send all images with one prompt
        content_parts = [prompt_text]
        
        # Add screenshots with their timestamps
        # Group screenshots by click to reduce API calls
        for screenshot_data in screenshots[:10]:  # Limit to 10 images to avoid token limits
            timestamp = screenshot_data.get('timestamp', 0)
            image_data = screenshot_data.get('image', '')
            
            if image_data:
                try:
                    # Remove data URL prefix if present (data:image/jpeg;base64,)
                    if ',' in image_data:
                        image_base64 = image_data.split(',')[1]
                    else:
                        image_base64 = image_data
                    
                    # Decode base64 to bytes
                    image_bytes = base64.b64decode(image_base64)
                    
                    # Create PIL Image from bytes (required by Gemini Vision API)
                    image = Image.open(io.BytesIO(image_bytes))
                    
                    # Add image to content
                    content_parts.append(image)
                    # Add context about when this screenshot was taken
                    content_parts.append(f"Screenshot at {timestamp:.2f}s")
                except Exception as e:
                    logger.warning(f"Failed to process screenshot at {timestamp}s: {e}")
                    continue
        
        return content_parts
    
    def _parse_script_response(
        self,
        response_text: str,
        events: Dict[str, Any],
        video_duration: float
    ) -> List[Dict[str, Any]]:
        """Parse Gemini response and extract script segments"""
        try:
            # Try to extract JSON from the response
            # Gemini might wrap JSON in markdown code blocks
            text = response_text.strip()
            
            # Remove markdown code blocks if present
            if text.startswith('```'):
                lines = text.split('\n')
                text = '\n'.join(lines[1:-1]) if len(lines) > 2 else text
            
            # Try to parse as JSON
            segments = json.loads(text)
            
            if not isinstance(segments, list):
                raise ValueError("Response is not a list")
            
            # Validate and clean segments
            validated_segments = []
            for segment in segments:
                if isinstance(segment, dict) and 'text' in segment and 'timestamp' in segment:
                    validated_segments.append({
                        'text': str(segment['text']).strip(),
                        'timestamp': float(segment['timestamp'])
                    })
            
            # Sort by timestamp
            validated_segments.sort(key=lambda x: x['timestamp'])
            
            # Ensure timestamps are within video duration
            validated_segments = [
                {**seg, 'timestamp': min(seg['timestamp'], video_duration)}
                for seg in validated_segments
            ]
            
            return validated_segments if validated_segments else self._generate_fallback_script(
                video_duration, events
            )
            
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(f"Failed to parse Gemini response as JSON: {e}")
            # Fallback: try to extract segments from text
            return self._extract_segments_from_text(response_text, events, video_duration)
    
    def _extract_segments_from_text(
        self,
        text: str,
        events: Dict[str, Any],
        video_duration: float
    ) -> List[Dict[str, Any]]:
        """Extract segments from plain text response"""
        # Simple fallback: split by lines and assign timestamps based on events
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        clicks = events.get('clicks', [])
        
        segments = []
        for i, line in enumerate(lines[:len(clicks)] if clicks else [1]):
            # Assign timestamp based on clicks or evenly distribute
            if clicks and i < len(clicks):
                timestamp = clicks[i].get('timestamp', 0)
            else:
                timestamp = (i / max(len(lines), 1)) * video_duration
            
            segments.append({
                'text': line,
                'timestamp': min(timestamp, video_duration)
            })
        
        return segments if segments else self._generate_fallback_script(video_duration, events)
    
    def _generate_fallback_script(
        self,
        video_duration: float,
        events: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate a basic script when Gemini API is not available"""
        clicks = events.get('clicks', [])
        
        if not clicks:
            return [{
                'text': "Welcome to this video demonstration. Let me walk you through the key features.",
                'timestamp': 0.0
            }]
        
        segments = []
        segments.append({
            'text': "Welcome to this video demonstration. Let me walk you through the key features.",
            'timestamp': 0.0
        })
        
        # Add segments for each click
        for i, click in enumerate(clicks[:10]):  # Limit to 10 segments
            timestamp = click.get('timestamp', 0)
            segment_num = i + 1
            
            if segment_num == 1:
                text = "First, let's click here to get started."
            elif segment_num == 2:
                text = "Next, we'll explore the main features."
            elif segment_num == 3:
                text = "Now, let's check out the dashboard."
            else:
                text = f"Step {segment_num}: Continuing with the demonstration."
            
            segments.append({
                'text': text,
                'timestamp': min(timestamp, video_duration)
            })
        
        return segments


# Singleton instance
gemini_script_service = GeminiScriptService()
