"""
Serializers for API responses.
Converts model instances to JSON and validates incoming data.
"""

from rest_framework import serializers
from .models import ExampleModel


class ExampleModelSerializer(serializers.ModelSerializer):
    """
    Serializer for ExampleModel.
    Handles serialization/deserialization for CRUD operations.
    """
    
    class Meta:
        model = ExampleModel
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

