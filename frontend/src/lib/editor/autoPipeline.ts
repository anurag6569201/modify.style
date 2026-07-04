/**
 * Auto-pipeline — the "record and we do everything" magic for signed-in users.
 *
 * After a fresh recording, this generates a script from the captured clicks and
 * frames, then a voiceover for each segment, and flips captions/voiceover on.
 * It is best-effort and fully defensive: any failure (AI not configured,
 * offline, auth) leaves the already-applied visual template in place so the
 * user still has a finished-looking demo.
 *
 * NOTE: the AI endpoints require a logged-in token, so this must only be run
 * for authenticated users. Guests get the visual template only (no AI cost).
 */

import { editorStore, generateId } from "@/lib/editor/store";
import { scriptAPI } from "@/lib/api/script";
import { generateVoiceAudio } from "@/lib/api/voice-generation";

/** Grab a single frame from the video at `timestamp` as a JPEG data URL. */
function captureVideoFrame(videoUrl: string, timestamp: number): Promise<string | null> {
  return new Promise((resolve) => {
    const videoEl = document.createElement("video");
    videoEl.crossOrigin = "anonymous";
    videoEl.preload = "metadata";
    videoEl.muted = true;
    videoEl.playsInline = true;
    let resolved = false;
    const finish = (result: string | null) => {
      if (resolved) return;
      resolved = true;
      videoEl.remove();
      resolve(result);
    };
    videoEl.onloadedmetadata = () => {
      videoEl.currentTime = Math.min(Math.max(0, timestamp), videoEl.duration);
    };
    videoEl.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx && videoEl.videoWidth > 0) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          finish(canvas.toDataURL("image/jpeg", 0.85));
        } else {
          finish(null);
        }
      } catch {
        finish(null);
      }
    };
    videoEl.onerror = () => finish(null);
    setTimeout(() => finish(null), 10000);
    videoEl.src = videoUrl;
  });
}

export interface AutoPipelineResult {
  scriptGenerated: boolean;
  segments: number;
  voiceGenerated: number;
}

export interface AutoPipelineHooks {
  onStage?: (stage: "script" | "voice" | "done", detail?: string) => void;
}

/**
 * Run script + voice generation over the current editor state. Safe to call
 * once after a fresh recording. Resolves with a summary; never throws.
 */
export async function runAutoPipeline(
  hooks: AutoPipelineHooks = {}
): Promise<AutoPipelineResult> {
  const result: AutoPipelineResult = {
    scriptGenerated: false,
    segments: 0,
    voiceGenerated: 0,
  };

  const state = editorStore.getState();
  const { video, events, voiceover } = state;

  if (!video.url || video.duration <= 0) return result;

  // 1) Script — capture a handful of frames at click moments, then ask the AI.
  try {
    hooks.onStage?.("script");
    const clicks = events.clicks ?? [];
    const clicksToCapture = clicks.slice(0, 15);
    const screenshots: Array<{ timestamp: number; image: string }> = [];
    for (const c of clicksToCapture) {
      const shot = await captureVideoFrame(video.url, c.timestamp);
      if (shot) screenshots.push({ timestamp: c.timestamp, image: shot });
    }

    const response = await scriptAPI.generateScriptWithTimestamps({
      video_url: video.url,
      video_duration: video.duration,
      events: {
        clicks: clicks.map((c) => ({ timestamp: c.timestamp, x: c.x, y: c.y })),
        moves: (events.moves ?? []).map((m) => ({ timestamp: m.timestamp, x: m.x, y: m.y })),
      },
      screenshots,
      style: {
        template: voiceover.scriptStyle.template,
        tone: voiceover.scriptStyle.tone,
        audience: voiceover.scriptStyle.audience,
        instructions: voiceover.scriptStyle.instructions,
      },
    });

    const generated = response.script_segments ?? [];
    if (generated.length > 0) {
      editorStore.setScriptSegments(
        generated.map((segment) => ({
          id: generateId("seg"),
          text: segment.text,
          timestamp: segment.timestamp,
          audioUrl: null,
          audioBlob: null,
          duration: 0,
          isGenerated: false,
        }))
      );
      result.scriptGenerated = true;
      result.segments = generated.length;
    }
  } catch (err) {
    console.warn("[autoPipeline] script generation skipped:", err);
    // No script → nothing to voice. Return with the visual template intact.
    hooks.onStage?.("done");
    return result;
  }

  if (!result.scriptGenerated) {
    hooks.onStage?.("done");
    return result;
  }

  // 2) Voice — one clip per segment, best-effort.
  try {
    hooks.onStage?.("voice");
    const segments = editorStore.getState().voiceover.scriptSegments;
    for (let i = 0; i < segments.length; i++) {
      const vs = editorStore.getState().voiceover;
      const seg = vs.scriptSegments[i];
      if (!seg?.text.trim()) continue;
      try {
        const { audioBlob, audioUrl, duration } = await generateVoiceAudio({
          text: seg.text,
          voiceId: vs.voiceId,
          speed: vs.speed,
          title: `Segment ${i + 1}`,
        });
        editorStore.updateSegment(i, { audioUrl, audioBlob, duration, isGenerated: true });
        result.voiceGenerated++;
      } catch (err) {
        console.warn(`[autoPipeline] voice segment ${i + 1} failed:`, err);
      }
    }
    if (result.voiceGenerated > 0) {
      editorStore.updateVoiceover({ isGenerated: true, generatedAt: Date.now() });
    }
  } catch (err) {
    console.warn("[autoPipeline] voice generation skipped:", err);
  }

  hooks.onStage?.("done");
  return result;
}
