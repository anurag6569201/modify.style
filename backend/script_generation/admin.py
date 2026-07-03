from django.contrib import admin
from .models import ScriptGeneration


@admin.register(ScriptGeneration)
class ScriptGenerationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'video_duration', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('user__email', 'id')
    readonly_fields = ('id', 'created_at', 'updated_at')
