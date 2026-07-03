from django.contrib import admin

from .models import Project


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'status', 'visibility', 'view_count', 'updated_at')
    list_filter = ('status', 'visibility', 'created_at')
    search_fields = ('title', 'owner__username', 'owner__email', 'share_slug')
    readonly_fields = ('id', 'share_slug', 'view_count', 'last_viewed_at', 'created_at', 'updated_at')
    ordering = ('-updated_at',)
