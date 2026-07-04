/**
 * Guest session — lets people use DemoForge before creating an account.
 *
 * Guests can record, edit, and produce ONE free render. Their in-progress work
 * is stashed locally (JSON only — the video blob lives in memory for the
 * session) so that, when they sign in, we can migrate it into a real,
 * server-side project. Anything beyond the free render (saving to the cloud,
 * sharing, more renders) requires an account.
 */

import { projectsApi, type ProjectDetail } from "@/lib/api/projects";

const KEYS = {
  renderCount: "guest.renderCount",
  draft: "guest.draft",
} as const;

/** How many full renders a guest gets before we ask them to sign in. */
export const GUEST_FREE_RENDERS = 1;

export interface GuestDraft {
  title: string;
  duration?: number;
  recording_data?: Record<string, unknown>;
  edit_data?: Record<string, unknown>;
  script_segments?: ProjectDetail["script_segments"];
  updatedAt: number;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Free-render metering                                                */
/* ------------------------------------------------------------------ */

export function guestRenderCount(): number {
  const raw = safeGet(KEYS.renderCount);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** True when the guest still has a free render left. */
export function guestCanRender(): boolean {
  return guestRenderCount() < GUEST_FREE_RENDERS;
}

export function recordGuestRender(): void {
  try {
    localStorage.setItem(KEYS.renderCount, String(guestRenderCount() + 1));
  } catch {
    /* storage unavailable — fail open, not the end of the world */
  }
}

/* ------------------------------------------------------------------ */
/* Draft stash (for account migration)                                 */
/* ------------------------------------------------------------------ */

export function saveGuestDraft(patch: Partial<GuestDraft>): void {
  try {
    const existing = getGuestDraft();
    const next: GuestDraft = {
      title: patch.title ?? existing?.title ?? "Untitled demo",
      duration: patch.duration ?? existing?.duration,
      recording_data: patch.recording_data ?? existing?.recording_data,
      edit_data: patch.edit_data ?? existing?.edit_data,
      script_segments: patch.script_segments ?? existing?.script_segments,
      updatedAt: Date.now(),
    };
    localStorage.setItem(KEYS.draft, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function getGuestDraft(): GuestDraft | null {
  const raw = safeGet(KEYS.draft);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuestDraft;
  } catch {
    return null;
  }
}

export function hasGuestDraft(): boolean {
  return !!getGuestDraft();
}

export function clearGuestDraft(): void {
  try {
    localStorage.removeItem(KEYS.draft);
  } catch {
    /* ignore */
  }
}

/**
 * Turn the stashed guest draft (and, if available in memory, the recorded
 * video) into a real server-side project. Call this right after the guest
 * signs in. Returns the new project id, or null if there was nothing to
 * migrate.
 */
export async function migrateGuestDraft(
  videoBlob?: Blob | null,
  videoFilename?: string
): Promise<string | null> {
  const draft = getGuestDraft();
  if (!draft) return null;

  try {
    const created = await projectsApi.create({ title: draft.title });

    if (videoBlob) {
      try {
        await projectsApi.uploadVideo(created.id, videoBlob, {
          kind: "source",
          duration: draft.duration,
          filename: videoFilename ?? "recording.webm",
        });
      } catch {
        /* keep going — the edit/script data is still worth saving */
      }
    }

    await projectsApi.update(created.id, {
      ...(draft.recording_data ? { recording_data: draft.recording_data } : {}),
      ...(draft.edit_data ? { edit_data: draft.edit_data } : {}),
      ...(draft.script_segments ? { script_segments: draft.script_segments } : {}),
      ...(draft.duration != null ? { duration: draft.duration } : {}),
    });

    clearGuestDraft();
    return created.id;
  } catch {
    // Migration failed (e.g. offline). Keep the draft so we can retry later.
    return null;
  }
}
