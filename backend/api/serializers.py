from rest_framework import serializers
from .models import ExampleModel


class ExampleModelSerializer(serializers.ModelSerializer):
    """Serializer for ExampleModel."""
    
    class Meta:
        model = ExampleModel
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

