// Shared media helpers for image + short-video uploads.
// Limits intentionally generous on duration to allow iPhone (HEVC) ±15s clips
// to still pass after browser-detected duration variance.

export const MAX_VIDEO_DURATION_SEC = 20;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const ACCEPTED_VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"];
export const ACCEPT_IMAGE_AND_VIDEO =
  "image/*,video/mp4,video/quicktime,video/webm";

export type MediaKind = "image" | "video";

export function detectKind(file: File): MediaKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export function isAcceptedVideo(file: File): boolean {
  // Some browsers report empty type for .mov; accept by extension as fallback.
  if (ACCEPTED_VIDEO_MIMES.includes(file.type)) return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".mp4") || name.endsWith(".mov") || name.endsWith(".webm");
}

export type VideoValidation = { ok: true; durationSec: number } | { ok: false; reason: string };

export async function validateVideo(file: File): Promise<VideoValidation> {
  if (!isAcceptedVideo(file)) {
    return { ok: false, reason: "Alleen MP4, MOV of WebM video's worden ondersteund." };
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return { ok: false, reason: `Video is groter dan ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB.` };
  }
  const duration = await readVideoDuration(file);
  if (!Number.isFinite(duration)) {
    return { ok: false, reason: "Kon de duur van de video niet lezen." };
  }
  if (duration > MAX_VIDEO_DURATION_SEC) {
    return { ok: false, reason: `Video is te lang (${Math.round(duration)}s). Maximaal ${MAX_VIDEO_DURATION_SEC}s.` };
  }
  return { ok: true, durationSec: duration };
}

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = url;
    const done = (val: number) => {
      URL.revokeObjectURL(url);
      resolve(val);
    };
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(Number.NaN);
  });
}

/** Capture a frame from a video file as a JPEG blob (~1s in). */
export async function generateVideoPoster(file: File, atSeconds = 1): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    v.onloadedmetadata = () => {
      const target = Math.min(atSeconds, Math.max(0, (v.duration || 0) - 0.05));
      try { v.currentTime = target; } catch { resolve(null); cleanup(); }
    };
    v.onseeked = () => {
      try {
        const w = v.videoWidth || 720;
        const h = v.videoHeight || 1280;
        const maxEdge = 1280;
        const scale = Math.min(1, maxEdge / Math.max(w, h));
        const cw = Math.round(w * scale);
        const ch = Math.round(h * scale);
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) { cleanup(); resolve(null); return; }
        ctx.drawImage(v, 0, 0, cw, ch);
        canvas.toBlob((b) => { cleanup(); resolve(b); }, "image/jpeg", 0.82);
      } catch {
        cleanup();
        resolve(null);
      }
    };
    v.onerror = () => { cleanup(); resolve(null); };
  });
}

export function videoExtensionFor(file: File): string {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mp4")) return "mp4";
  if (lower.endsWith(".mov")) return "mov";
  if (lower.endsWith(".webm")) return "webm";
  if (file.type === "video/mp4") return "mp4";
  if (file.type === "video/quicktime") return "mov";
  if (file.type === "video/webm") return "webm";
  return "mp4";
}