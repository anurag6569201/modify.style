from rest_framework import serializers

from .models import Project
from .upload import resolve_project_video_url


class ProjectListSerializer(serializers.ModelSerializer):
    """Lightweight representation for the dashboard grid."""

    class Meta:
        model = Project
        fields = (
            'id', 'title', 'status', 'visibility', 'share_slug',
            'thumbnail_url', 'duration', 'aspect_ratio', 'language',
            'view_count', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'share_slug', 'view_count', 'created_at', 'updated_at',
        )


class ProjectDetailSerializer(serializers.ModelSerializer):
    """Full representation for the editor (create / retrieve / update)."""

    video_url = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            'id', 'title', 'description', 'status', 'visibility', 'share_slug',
            'thumbnail_url', 'video_url', 'duration', 'aspect_ratio', 'language',
            'recording_data', 'edit_data', 'script_segments',
            'view_count', 'last_viewed_at', 'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'share_slug', 'view_count', 'last_viewed_at',
            'created_at', 'updated_at', 'video_url',
        )

    def get_video_url(self, obj):
        return resolve_project_video_url(obj, self.context.get('request'))

    def update(self, instance, validated_data):
        incoming_recording = validated_data.get('recording_data')
        if incoming_recording is not None:
            merged = dict(instance.recording_data or {})
            merged.update(incoming_recording)
            existing_path = (instance.recording_data or {}).get('video_storage_path')
            if existing_path:
                merged['video_storage_path'] = existing_path
            validated_data['recording_data'] = merged
        return super().update(instance, validated_data)


class ProjectPublicSerializer(serializers.ModelSerializer):
    """
    Safe, owner-free representation served on the public share view
    (/v/<share_slug>). Never exposes private editor internals or the owner.
    """

    video_url = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            'title', 'description', 'video_url', 'thumbnail_url',
            'duration', 'aspect_ratio', 'language', 'script_segments',
            'view_count', 'created_at',
        )
        read_only_fields = fields

    def get_video_url(self, obj):
        return resolve_project_video_url(obj, self.context.get('request'))
