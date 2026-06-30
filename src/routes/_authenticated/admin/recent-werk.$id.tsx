import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { ConfirmModal } from "@/components/AdminModals";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { isExternalPhoto, RECENT_WORK_ASPECT, RECENT_WORK_BUCKET } from "@/lib/recent-work";
import { deletePublicationItem as deletePublicationItemFn } from "@/lib/recent-work.functions";
import {
  ACCEPT_IMAGE_AND_VIDEO,
  detectKind,
  generateVideoPoster,
  validateVideo,
  videoExtensionFor,
  type MediaKind,
} from "@/lib/media";

export const Route = createFileRoute("/_authenticated/admin/recent-werk/$id")({
  head: () => ({ meta: [{ title: "Publicatie — Admin" }, { name: "robots", content: "noindex" }] }),
  component: PublicationEditor,
});

type Pub = {
  id: string; title: string; subtitle: string | null;
  vehicle_label: string | null; year_label: string | null;
  status: "draft" | "published";
  sort_order: number;
  cover_photo_path: string | null;
};
type Item = {
  id: string; publication_id: string; photo_path: string;
  date_label: string | null; caption: string | null; sort_order: number;
  media_type: MediaKind; poster_path: string | null;
};

function PublicationEditor() {
  const { id } = Route.useParams();
  const deleteItem = useServerFn(deletePublicationItemFn);
  const [pub, setPub] = useState<Pub | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploadQueue, setUploadQueue] = useState<UploadCandidate[] | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [confirmItemDel, setConfirmItemDel] = useState<Item | null>(null);
  // Dirty state for bulk save
  const [draftItems, setDraftItems] = useState<Record<string, { date_label: string | null; caption: string | null }>>({});
  const [dirtyPub, setDirtyPub] = useState<Partial<Pub>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p, error: pe }, { data: it, error: ie }] = await Promise.all([
      supabase.from("recent_work_publications").select("*").eq("id", id).maybeSingle(),
      supabase.from("recent_work_items").select("*").eq("publication_id", id).order("sort_order"),
    ]);
    if (pe || ie) { toast.error("Laden mislukt", { description: (pe ?? ie)?.message }); setLoading(false); return; }
    setPub((p as Pub | null) ?? null);
    const list = (it as Item[] | null) ?? [];
    setItems(list);
    setDraftItems({});
    setDirtyPub({});
    // Sign URLs for any storage photos (cover + items).
    const paths = Array.from(new Set([
      ...((p as Pub | null)?.cover_photo_path && !isExternalPhoto(((p as Pub).cover_photo_path) as string)
        ? [((p as Pub).cover_photo_path) as string] : []),
      ...list.map((x) => x.photo_path).filter((pp) => !isExternalPhoto(pp)),
      ...list.map((x) => x.poster_path).filter((pp): pp is string => !!pp && !isExternalPhoto(pp)),
    ]));
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from(RECENT_WORK_BUCKET).createSignedUrls(paths, 3600);
      const m: Record<string, string> = {};
      (signed ?? []).forEach((s, i) => { if (s.signedUrl) m[paths[i]] = s.signedUrl; });
      setUrls(m);
    } else {
      setUrls({});
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function resolvePath(p: string | null) {
    if (!p) return null;
    return isExternalPhoto(p) ? p : (urls[p] ?? null);
  }

  const currentPub = useMemo<Pub | null>(() => {
    if (!pub) return null;
    return { ...pub, ...dirtyPub };
  }, [pub, dirtyPub]);

  const isDirty = Object.keys(dirtyPub).length > 0 || Object.keys(draftItems).length > 0;

  async function saveAll() {
    if (!pub) return;
    if (saving) return;
    setSaving(true);
    try {
      if (Object.keys(dirtyPub).length > 0) {
        const { error } = await supabase.from("recent_work_publications").update(dirtyPub).eq("id", pub.id);
        if (error) throw error;
      }
      const updates = Object.entries(draftItems);
      if (updates.length > 0) {
        await Promise.all(updates.map(([itemId, patch]) =>
          supabase.from("recent_work_items").update(patch).eq("id", itemId),
        ));
      }
      toast.success("Opgeslagen");
      load();
    } catch (e) {
      toast.error("Opslaan mislukt", { description: (e as Error).message });
    } finally { setSaving(false); }
  }

  async function togglePublish() {
    if (!pub) return;
    const next = (currentPub?.status ?? pub.status) === "published" ? "draft" : "published";
    const { error } = await supabase.from("recent_work_publications").update({ status: next }).eq("id", pub.id);
    if (error) { toast.error("Status wijzigen mislukt", { description: error.message }); return; }
    toast.success(next === "published" ? "Gepubliceerd" : "Teruggezet naar concept");
    load();
  }

  async function uploadCover(file: File) {
    if (!pub) return;
    if (coverUploading) return;
    setCoverUploading(true);
    try {
      const blob = await compressImage(file, { aspectRatio: RECENT_WORK_ASPECT, maxEdge: 1920, quality: 0.8 });
      const path = `${pub.id}/cover-${Date.now()}.jpg`;
      const up = await supabase.storage.from(RECENT_WORK_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (up.error) throw up.error;
      // Best-effort cleanup of the previous cover if it lives in our bucket.
      if (pub.cover_photo_path && !isExternalPhoto(pub.cover_photo_path)) {
        await supabase.storage.from(RECENT_WORK_BUCKET).remove([pub.cover_photo_path]);
      }
      const { error } = await supabase.from("recent_work_publications").update({ cover_photo_path: path }).eq("id", pub.id);
      if (error) throw error;
      toast.success("Cover bijgewerkt");
      load();
    } catch (e) {
      toast.error("Cover uploaden mislukt", { description: (e as Error).message });
    } finally { setCoverUploading(false); }
  }

  function queueUploads(files: FileList | null) {
    if (!files) return;
    const list: UploadCandidate[] = Array.from(files).map((f) => {
      const kind = detectKind(f) ?? "image";
      return {
        file: f, kind, focusY: 0.5,
        previewUrl: URL.createObjectURL(f), status: "pending",
      };
    });
    setUploadQueue((prev) => (prev ? [...prev, ...list] : list));
  }

  async function commitUploads() {
    if (!uploadQueue || !pub) return;
    const baseOrder = (items[items.length - 1]?.sort_order ?? -1) + 1;
    for (let i = 0; i < uploadQueue.length; i++) {
      const cand = uploadQueue[i];
      if (cand.status === "done") continue;
      setUploadQueue((prev) => prev?.map((c, j) => j === i ? { ...c, status: "uploading" } : c) ?? null);
      try {
        if (cand.kind === "video") {
          const check = await validateVideo(cand.file);
          if (!check.ok) throw new Error(check.reason);
          const ext = videoExtensionFor(cand.file);
          const stamp = `${Date.now()}-${i.toString().padStart(3, "0")}`;
          const path = `${pub.id}/${stamp}.${ext}`;
          const posterPath = `${pub.id}/${stamp}.poster.jpg`;
          const up = await supabase.storage.from(RECENT_WORK_BUCKET).upload(path, cand.file, {
            contentType: cand.file.type || "video/mp4", upsert: false,
          });
          if (up.error) throw up.error;
          const poster = await generateVideoPoster(cand.file);
          let storedPoster: string | null = null;
          if (poster) {
            const pup = await supabase.storage.from(RECENT_WORK_BUCKET).upload(posterPath, poster, {
              contentType: "image/jpeg", upsert: false,
            });
            if (!pup.error) storedPoster = posterPath;
          }
          const ins = await supabase.from("recent_work_items").insert({
            publication_id: pub.id, photo_path: path, sort_order: baseOrder + i,
            media_type: "video", poster_path: storedPoster,
          });
          if (ins.error) throw ins.error;
        } else {
          const blob = await compressImage(cand.file, {
            aspectRatio: RECENT_WORK_ASPECT, maxEdge: 1920, quality: 0.78, focusY: cand.focusY,
          });
          const path = `${pub.id}/${Date.now()}-${i.toString().padStart(3, "0")}.jpg`;
          const up = await supabase.storage.from(RECENT_WORK_BUCKET).upload(path, blob, {
            contentType: "image/jpeg", upsert: false,
          });
          if (up.error) throw up.error;
          const ins = await supabase.from("recent_work_items").insert({
            publication_id: pub.id, photo_path: path, sort_order: baseOrder + i,
            media_type: "image",
          });
          if (ins.error) throw ins.error;
        }
        setUploadQueue((prev) => prev?.map((c, j) => j === i ? { ...c, status: "done" } : c) ?? null);
      } catch (e) {
        setUploadQueue((prev) => prev?.map((c, j) => j === i ? { ...c, status: "error", error: (e as Error).message } : c) ?? null);
      }
    }
    toast.success("Media toegevoegd");
    setUploadQueue(null);
    load();
  }

  async function moveItem(it: Item, dir: -1 | 1) {
    const idx = items.findIndex((x) => x.id === it.id);
    const neighbor = items[idx + dir];
    if (!neighbor) return;
    await Promise.all([
      supabase.from("recent_work_items").update({ sort_order: neighbor.sort_order }).eq("id", it.id),
      supabase.from("recent_work_items").update({ sort_order: it.sort_order }).eq("id", neighbor.id),
    ]);
    load();
  }

  if (loading || !pub || !currentPub) {
    return (
      <AdminShell title="Publicatie">
        <div className="container-edit pb-8 eyebrow" style={{ color: "var(--charcoal-soft)" }}>Laden…</div>
      </AdminShell>
    );
  }

  const coverUrl = resolvePath(currentPub.cover_photo_path);

  return (
    <AdminShell>
      <div className="container-edit pt-3 pb-2 flex items-center justify-between gap-3">
        <Link to="/admin/recent-werk" className="eyebrow" style={{ color: "var(--charcoal-soft)" }}>← Recent Werk</Link>
        <a
          href={`/recent-werk`} target="_blank" rel="noreferrer"
          className="text-[11px] uppercase tracking-[0.18em]"
          style={{ color: "var(--brass)" }}
        >Bekijk publiek →</a>
      </div>

      {/* Cover */}
      <section className="container-edit pb-4">
        <div
          className="relative max-w-md mx-auto"
          style={{
            aspectRatio: `${RECENT_WORK_ASPECT}`,
            background: coverUrl ? `center/cover url(${coverUrl})` : "var(--charcoal)",
            color: "var(--gold)", display: "grid", placeItems: "center",
            border: "1px solid var(--charcoal)",
            fontFamily: "var(--font-display)", fontSize: "3rem",
          }}
        >
          {!coverUrl && (currentPub.title[0] ?? "·")}
          <label
            className="absolute bottom-2 right-2 text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 cursor-pointer"
            style={{ background: "rgba(34,31,27,0.78)", color: "var(--gold)", border: "1px solid var(--brass)" }}
          >
            {coverUploading ? "Bezig…" : (coverUrl ? "Cover wijzigen" : "+ Cover foto")}
            <input type="file" accept="image/*" className="hidden" disabled={coverUploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }} />
          </label>
        </div>
      </section>

      {/* Meta fields */}
      <section className="container-edit pb-4 space-y-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>Titel</span>
          <input
            className="field-y" value={currentPub.title}
            onChange={(e) => setDirtyPub((d) => ({ ...d, title: e.target.value }))}
            style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem" }}
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>Intro / subtitle</span>
          <textarea
            className="field-y" rows={3} value={currentPub.subtitle ?? ""}
            onChange={(e) => setDirtyPub((d) => ({ ...d, subtitle: e.target.value }))}
            style={{ resize: "vertical" }}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>Voertuig-label</span>
            <input className="field-y" value={currentPub.vehicle_label ?? ""}
              onChange={(e) => setDirtyPub((d) => ({ ...d, vehicle_label: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>Jaar-label</span>
            <input className="field-y" value={currentPub.year_label ?? ""}
              onChange={(e) => setDirtyPub((d) => ({ ...d, year_label: e.target.value }))} />
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={saveAll}
            disabled={!isDirty || saving}
            aria-busy={saving}
            className="btn-y-solid"
            style={{ flex: 1 }}
          >
            {saving ? "Opslaan…" : (isDirty ? "Opslaan" : "Opgeslagen")}
          </button>
          <button onClick={togglePublish} className="btn-y" style={{ flex: 1 }}>
            {currentPub.status === "published" ? "Terug naar concept" : "Publiceer"}
          </button>
        </div>
      </section>

      {/* Items */}
      <section className="container-edit pb-12">
        <div className="flex items-baseline justify-between mt-6 mb-3">
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>Foto's ({items.length})</h2>
          <label className="btn-y-solid cursor-pointer" style={{ paddingBlock: "0.5rem" }}>
            + Foto's toevoegen
            <input type="file" accept={ACCEPT_IMAGE_AND_VIDEO} multiple className="hidden"
              onChange={(e) => { queueUploads(e.target.files); e.target.value = ""; }} />
          </label>
        </div>

        {items.length === 0 && (
          <div
            className="px-4 py-6 text-sm text-center"
            style={{ border: "1px dashed var(--brass)", background: "var(--cream)", color: "var(--charcoal-soft)" }}
          >
            Nog geen foto's — voeg je eerste beelden toe.
          </div>
        )}

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((it, idx) => {
            const url = resolvePath(it.photo_path);
            const draft = draftItems[it.id] ?? { date_label: it.date_label, caption: it.caption };
            function patch(p: Partial<{ date_label: string | null; caption: string | null }>) {
              setDraftItems((d) => ({ ...d, [it.id]: { ...draft, ...p } }));
            }
            return (
              <li key={it.id} style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}>
                {url ? (
                  it.media_type === "video" ? (
                    <video
                      src={url}
                      poster={it.poster_path ? (resolvePath(it.poster_path) ?? undefined) : undefined}
                      controls playsInline preload="metadata"
                      style={{ display: "block", width: "100%", aspectRatio: `${RECENT_WORK_ASPECT}`, objectFit: "cover", background: "#000" }}
                    />
                  ) : (
                    <img src={url} alt={draft.caption ?? ""}
                      style={{ display: "block", width: "100%", aspectRatio: `${RECENT_WORK_ASPECT}`, objectFit: "cover" }} />
                  )
                ) : (
                  <div className="skeleton-y" style={{ aspectRatio: `${RECENT_WORK_ASPECT}` }} />
                )}
                <div className="px-3 py-3 space-y-2">
                  <input
                    className="field-y"
                    placeholder="Datum-label (bv. MEI 2024)"
                    value={draft.date_label ?? ""}
                    onChange={(e) => patch({ date_label: e.target.value })}
                  />
                  <textarea
                    className="field-y" rows={3} placeholder="Caption…"
                    style={{ resize: "vertical" }}
                    value={draft.caption ?? ""}
                    onChange={(e) => patch({ caption: e.target.value })}
                  />
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveItem(it, -1)} disabled={idx === 0} className="px-2 py-1 text-xs disabled:opacity-30">↑</button>
                      <button onClick={() => moveItem(it, 1)} disabled={idx === items.length - 1} className="px-2 py-1 text-xs disabled:opacity-30">↓</button>
                    </div>
                    <button onClick={() => setConfirmItemDel(it)} className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--oxide)" }}>
                      Wissen
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {uploadQueue && (
        <UploadQueueModal
          queue={uploadQueue}
          onUpdate={(idx, focusY) => setUploadQueue((prev) => prev?.map((c, i) => i === idx ? { ...c, focusY } : c) ?? null)}
          onRemove={(idx) => setUploadQueue((prev) => prev?.filter((_, i) => i !== idx) ?? null)}
          onClose={() => setUploadQueue(null)}
          onConfirm={commitUploads}
        />
      )}

      <ConfirmModal
        open={confirmItemDel !== null}
        title="Foto verwijderen"
        message="Deze foto wordt definitief verwijderd uit de wand én uit de opslag."
        destructive confirmLabel="Verwijder"
        onConfirm={async () => {
          if (!confirmItemDel) return;
          try {
            await deleteItem({ data: { itemId: confirmItemDel.id } });
            toast.success("Foto verwijderd");
            load();
          } catch (e) {
            toast.error("Verwijderen mislukt", { description: (e as Error).message });
          }
        }}
        onClose={() => setConfirmItemDel(null)}
      />
    </AdminShell>
  );
}

// ---------------------------------------------------------------------------
// Upload queue modal — center-crop preview to 4:5 with focal-point Y nudge.
// ---------------------------------------------------------------------------

type UploadCandidate = {
  file: File; kind: MediaKind; previewUrl: string; focusY: number;
  status: "pending" | "uploading" | "done" | "error"; error?: string;
};

function UploadQueueModal({
  queue, onUpdate, onRemove, onClose, onConfirm,
}: {
  queue: UploadCandidate[];
  onUpdate: (idx: number, focusY: number) => void;
  onRemove: (idx: number) => void;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 overflow-y-auto" style={{ background: "rgba(34,31,27,0.6)" }}>
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto" style={{ background: "var(--cream)", border: "1px solid var(--charcoal)" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--charcoal)", color: "var(--cream)" }}>
          <span style={{ fontFamily: "var(--font-display)" }}>Foto's voorbereiden</span>
          <button onClick={onClose} disabled={busy} style={{ color: "var(--gold)" }}>✕</button>
        </div>
        <div className="px-4 py-4 space-y-3">
          <p className="text-xs" style={{ color: "var(--charcoal-soft)" }}>
            Foto's worden bijgesneden naar 4:5 (portret) zodat de wand uniform blijft —
            schuif om het brandpunt te kiezen. Video's (≤20s, ≤50 MB) worden ongewijzigd geplaatst.
          </p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {queue.map((c, i) => (
              <li key={i} style={{ border: "1px solid var(--charcoal)" }}>
                <div className="relative" style={{ aspectRatio: `${RECENT_WORK_ASPECT}`, overflow: "hidden", background: "var(--charcoal)" }}>
                  {c.kind === "video" ? (
                    <video
                      src={c.previewUrl} muted playsInline preload="metadata"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <img
                      src={c.previewUrl} alt=""
                      style={{
                        position: "absolute", inset: 0, width: "100%", height: "100%",
                        objectFit: "cover", objectPosition: `50% ${(c.focusY * 100).toFixed(0)}%`,
                      }}
                    />
                  )}
                  {c.status === "done" && (
                    <span className="absolute top-1 right-1 text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5"
                      style={{ background: "var(--brass)", color: "var(--cream)" }}>ok</span>
                  )}
                  {c.status === "uploading" && (
                    <span className="absolute top-1 right-1 text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5"
                      style={{ background: "var(--gold)", color: "var(--charcoal)" }}>bezig</span>
                  )}
                  {c.status === "error" && (
                    <span className="absolute top-1 right-1 text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5"
                      style={{ background: "var(--oxide)", color: "var(--cream)" }}>fout</span>
                  )}
                  {c.kind === "video" && (
                    <span className="absolute top-1 left-1 text-[9px] uppercase tracking-[0.15em] px-1.5 py-0.5"
                      style={{ background: "var(--charcoal)", color: "var(--gold)" }}>video</span>
                  )}
                </div>
                <div className="px-2 py-2">
                  {c.kind === "image" ? (
                    <input
                      type="range" min={0} max={100} step={1}
                      value={Math.round(c.focusY * 100)}
                      disabled={c.status === "done" || c.status === "uploading"}
                      onChange={(e) => onUpdate(i, Number(e.target.value) / 100)}
                      className="w-full" aria-label="Brandpunt verticaal"
                    />
                  ) : (
                    <div style={{ height: "1rem" }} />
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px]" style={{ color: "var(--charcoal-soft)" }}>
                      {c.kind === "image" ? "↑ boven · onder ↓" : c.file.name}
                    </span>
                    <button
                      onClick={() => onRemove(i)}
                      disabled={c.status === "uploading"}
                      className="text-[10px] uppercase tracking-[0.15em]"
                      style={{ color: "var(--oxide)" }}
                    >Weg</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
            disabled={busy || queue.length === 0}
            aria-busy={busy}
            className="btn-y-solid w-full"
          >
            {busy ? "Bezig…" : `Upload ${queue.length} foto${queue.length === 1 ? "" : "'s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}