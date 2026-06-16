// Shared client+server helpers for Recent Werk.
export function isExternalPhoto(p: string): boolean {
  return p.startsWith("http://") || p.startsWith("https://") || p.startsWith("/");
}

export const RECENT_WORK_BUCKET = "recent-work";
// Public showcase uses a uniform portrait crop.
export const RECENT_WORK_ASPECT = 4 / 5;