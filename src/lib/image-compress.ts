// Browser-only client-side image compression. Targets ~max edge and ~quality.
export async function compressImage(
  file: File,
  opts: { maxEdge?: number; quality?: number; mimeType?: string } = {},
): Promise<Blob> {
  const { maxEdge = 1920, quality = 0.82, mimeType = "image/jpeg" } = opts;
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
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);

  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b ?? file), mimeType, quality);
  });
}