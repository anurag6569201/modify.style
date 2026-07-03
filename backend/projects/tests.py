from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Project


class ProjectApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='a@example.com', email='a@example.com', password='pw')
        self.other = User.objects.create_user(username='b@example.com', email='b@example.com', password='pw')

    def test_create_and_scope_to_owner(self):
        self.client.force_authenticate(self.user)
        res = self.client.post('/api/projects/', {'title': 'My demo'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['share_slug'])

        # Other user cannot see it.
        self.client.force_authenticate(self.other)
        res = self.client.get('/api/projects/')
        self.assertEqual(len(res.data), 0)

    def test_public_view_requires_shared_visibility(self):
        p = Project.objects.create(owner=self.user, title='Hidden')
        # Private -> 404 on public endpoint.
        res = self.client.get(f'/api/projects/public/{p.share_slug}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        p.visibility = Project.Visibility.UNLISTED
        p.save()
        res = self.client.get(f'/api/projects/public/{p.share_slug}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # View counter increments.
        p.refresh_from_db()
        self.assertEqual(p.view_count, 1)
