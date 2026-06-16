// Browser-only client-side image compression. Targets ~max edge and ~quality.
// Optional `aspectRatio` performs a crop with adjustable focal point.
export async function compressImage(
  file: File,
  opts: {
    maxEdge?: number;
    quality?: number;
    mimeType?: string;
    aspectRatio?: number;
    // 0..1, defaults to 0.5 (center). Y focal point for the crop.
    focusY?: number;
    focusX?: number;
  } = {},
): Promise<Blob> {
  const {
    maxEdge = 1920,
    quality = 0.82,
    mimeType = "image/jpeg",
    aspectRatio,
    focusY = 0.5,
    focusX = 0.5,
  } = opts;
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file).catch(async () => {
    // Safari fallback
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    URL.revokeObjectURL(url);
    return img as unknown as ImageBitmap;
  });

  const srcW = (bitmap as ImageBitmap).width;
  const srcH = (bitmap as ImageBitmap).height;

  // Determine crop region.
  let sx = 0, sy = 0, sw = srcW, sh = srcH;
  if (aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0) {
    const srcRatio = srcW / srcH;
    if (srcRatio > aspectRatio) {
      // Source wider than target → crop horizontally.
      sw = Math.round(srcH * aspectRatio);
      sh = srcH;
      sx = Math.max(0, Math.min(srcW - sw, Math.round((srcW - sw) * focusX)));
      sy = 0;
    } else {
      // Source taller than target → crop vertically.
      sw = srcW;
      sh = Math.round(srcW / aspectRatio);
      sx = 0;
      sy = Math.max(0, Math.min(srcH - sh, Math.round((srcH - sh) * focusY)));
    }
  }

  // Scale down so the longest output edge fits maxEdge.
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap as CanvasImageSource, sx, sy, sw, sh, 0, 0, w, h);

  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b ?? file), mimeType, quality);
  });
}