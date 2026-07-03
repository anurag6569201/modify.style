from rest_framework import serializers
from .models import ScriptGeneration


class ScriptSegmentSerializer(serializers.Serializer):
    """Serializer for individual script segments"""
    text = serializers.CharField()
    timestamp = serializers.FloatField(min_value=0)


class ScriptGenerationRequestSerializer(serializers.Serializer):
    """Serializer for script generation request"""
    video_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    video_duration = serializers.FloatField(min_value=0, required=True)
    events = serializers.DictField(
        required=True,
        help_text="Dictionary containing clicks, moves arrays"
    )
    screenshots = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        allow_empty=True,
        help_text="Array of screenshots with timestamp and base64 image"
    )
    
    def validate_video_url(self, value):
        """Validate video_url - allow empty/null, blob URLs, or valid URLs"""
        if not value or value.strip() == '':
            return None
        
        # Allow blob URLs (browser-generated URLs for in-memory data)
        if value.startswith('blob:'):
            return value
        
        # If a value is provided, validate it's a URL
        from django.core.validators import URLValidator
        from django.core.exceptions import ValidationError
        
        validator = URLValidator()
        try:
            validator(value)
            return value
        except ValidationError:
            raise serializers.ValidationError("Enter a valid URL.")
    
    def validate_events(self, value):
        """Validate events structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Events must be a dictionary")
        
        # Ensure clicks and moves are arrays if present
        if 'clicks' in value and not isinstance(value.get('clicks'), list):
            raise serializers.ValidationError("Events.clicks must be an array")
        if 'moves' in value and not isinstance(value.get('moves'), list):
            raise serializers.ValidationError("Events.moves must be an array")
        
        return value
    
    def validate_screenshots(self, value):
        """Validate screenshots structure"""
        if not isinstance(value, list):
            raise serializers.ValidationError("Screenshots must be an array")
        
        for screenshot in value:
            if not isinstance(screenshot, dict):
                raise serializers.ValidationError("Each screenshot must be a dictionary")
            if 'timestamp' not in screenshot or 'image' not in screenshot:
                raise serializers.ValidationError("Screenshot must have 'timestamp' and 'image' fields")
        
        return value


class ScriptGenerationResponseSerializer(serializers.ModelSerializer):
    """Serializer for script generation response"""
    script_segments = ScriptSegmentSerializer(many=True, read_only=True)

    class Meta:
        model = ScriptGeneration
        fields = (
            'id', 'status', 'video_url', 'video_duration',
            'script_segments', 'error_message', 'created_at', 'updated_at'
        )
        read_only_fields = fields
