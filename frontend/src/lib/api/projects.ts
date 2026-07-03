/**
 * Projects API — durable, server-side demo projects.
 * Talks to the Django `projects` app (owner-scoped CRUD + public share view).
 */

import { authFetch } from "@/lib/auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export type ProjectStatus = "draft" | "rendering" | "ready";
export type ProjectVisibility = "private" | "unlisted" | "public";

export interface ProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  share_slug: string;
  thumbnail_url: string;
  duration: number;
  aspect_ratio: string;
  language: string;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends ProjectSummary {
  description: string;
  video_url: string;
  recording_data: Record<string, unknown>;
  edit_data: Record<string, unknown>;
  script_segments: Array<{ text: string; timestamp: number }>;
  last_viewed_at: string | null;
}

function authHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

function authHeadersMultipart(): HeadersInit {
  return {};
}

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return authFetch(url, init);
}

class UnauthorizedError extends Error {}
export { UnauthorizedError };

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new UnauthorizedError("Session expired");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Request failed (${res.status})`);
  }
  // DELETE returns 204 with no body.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const projectsApi = {
  async list(): Promise<ProjectSummary[]> {
    const res = await authedFetch(`${API_BASE_URL}/api/projects/`, {
      headers: authHeaders(),
    });
    return handle<ProjectSummary[]>(res);
  },

  async create(data: Partial<ProjectDetail> = {}): Promise<ProjectDetail> {
    const res = await authedFetch(`${API_BASE_URL}/api/projects/`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ title: "Untitled demo", ...data }),
    });
    return handle<ProjectDetail>(res);
  },

  async get(id: string): Promise<ProjectDetail> {
    const res = await authedFetch(`${API_BASE_URL}/api/projects/${id}/`, {
      headers: authHeaders(),
    });
    return handle<ProjectDetail>(res);
  },

  async update(id: string, data: Partial<ProjectDetail>): Promise<ProjectDetail> {
    const res = await authedFetch(`${API_BASE_URL}/api/projects/${id}/`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    return handle<ProjectDetail>(res);
  },

  async remove(id: string): Promise<void> {
    const res = await authedFetch(`${API_BASE_URL}/api/projects/${id}/`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return handle<void>(res);
  },

  /** Public share view (no auth) — backs the /v/<slug> player. */
  async getPublic(slug: string): Promise<ProjectDetail> {
    const res = await fetch(`${API_BASE_URL}/api/projects/public/${slug}/`);
    return handle<ProjectDetail>(res);
  },

  /** Upload source recording or rendered export (multipart). */
  async uploadVideo(
    id: string,
    file: Blob,
    options: { kind?: "source" | "render"; duration?: number; filename?: string } = {}
  ): Promise<{ video_url: string; duration: number; status: ProjectStatus }> {
    const { kind = "source", duration, filename } = options;
    const form = new FormData();
    form.append("file", file, filename ?? `${kind}.webm`);
    form.append("kind", kind);
    if (duration != null) form.append("duration", String(duration));

    const res = await authedFetch(`${API_BASE_URL}/api/projects/${id}/upload-video/`, {
      method: "POST",
      headers: authHeadersMultipart(),
      body: form,
    });
    return handle(res);
  },

  async saveRecordingData(
    id: string,
    recording_data: Record<string, unknown>,
    extra: Partial<ProjectDetail> = {}
  ): Promise<ProjectDetail> {
    return this.update(id, { recording_data, ...extra });
  },

  async saveEditData(
    id: string,
    edit_data: Record<string, unknown>,
    script_segments?: ProjectDetail["script_segments"]
  ): Promise<ProjectDetail> {
    return this.update(id, {
      edit_data,
      ...(script_segments ? { script_segments } : {}),
    });
  },
};
