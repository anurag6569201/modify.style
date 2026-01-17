from rest_framework import serializers
from .models import AudioCreation

class AudioCreationRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = AudioCreation
        fields = ('title', 'text_input', 'voice', 'response_format', 'speed')
        extra_kwargs = {
            'title': {'required': False},
            'speed': {'required': False}
        }
    
    def validate_speed(self, value):
        if not (0.25 <= value <= 4.0):
            raise serializers.ValidationError("Speed must be between 0.25 and 4.0.")
        return value

class AudioCreationUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AudioCreation
        fields = ('title',)

class AudioCreationResponseSerializer(serializers.ModelSerializer):
    result_url = serializers.SerializerMethodField()

    class Meta:
        model = AudioCreation
        fields = (
            'id', 'title', 'status', 'text_input', 'voice', 'response_format', 
            'speed', 'credit_cost', 'result_url', 'error_message', 'created_at'
        )
        read_only_fields = fields

    def get_result_url(self, obj):
        if obj.result_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.result_file.url)
            return obj.result_file.url
        return None
