import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isExternalPhoto, RECENT_WORK_BUCKET } from "./recent-work";

type Ctx = {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null; error: unknown }> };
  userId: string;
};

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

// Public reader — anyone can call. Returns published publications, their items,
// and (because the storage bucket is private) signed URLs for any photo paths
// that point at the bucket.
export const getPublishedRecentWork = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: pubs } = await supabaseAdmin
    .from("recent_work_publications")
    .select("id, title, subtitle, vehicle_label, year_label, sort_order, cover_photo_path, created_at")
    .eq("status", "published")
    .order("sort_order");
  const publications = pubs ?? [];
  const ids = publications.map((p) => p.id);
  const { data: itemsRaw } = ids.length
    ? await supabaseAdmin
        .from("recent_work_items")
        .select("id, publication_id, photo_path, date_label, caption, sort_order, media_type, poster_path")
        .in("publication_id", ids)
        .order("sort_order")
    : { data: [] };
  const items = itemsRaw ?? [];

  const storagePaths = Array.from(new Set([
    ...publications.map((p) => p.cover_photo_path).filter((x): x is string => !!x && !isExternalPhoto(x)),
    ...items.map((i) => i.photo_path).filter((p) => !isExternalPhoto(p)),
    ...items.map((i) => (i as { poster_path: string | null }).poster_path).filter((p): p is string => !!p && !isExternalPhoto(p)),
  ]));
  const urls: Record<string, string> = {};
  if (storagePaths.length) {
    const { data: signed } = await supabaseAdmin.storage
      .from(RECENT_WORK_BUCKET)
      .createSignedUrls(storagePaths, 60 * 60 * 24);
    (signed ?? []).forEach((s, i) => {
      if (s.signedUrl) urls[storagePaths[i]] = s.signedUrl;
    });
  }

  return { publications, items, urls };
});

// Admin: copy a finished customer project into a draft publication.
// All photos are downloaded from `project-photos` and re-uploaded to
// `recent-work` so the publication is a snapshot, not a live link.
export const publishProjectToRecentWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; consent: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (!data.consent) throw new Error("Toestemming klant ontbreekt.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load project, phases, updates, photos in order.
    const { data: project, error: pe } = await supabaseAdmin
      .from("projects")
      .select("id, title, vehicle_make, vehicle_model, vehicle_year, cover_photo_url")
      .eq("id", data.projectId)
      .maybeSingle();
    if (pe || !project) throw pe ?? new Error("Project niet gevonden");
    const { data: phases } = await supabaseAdmin
      .from("project_phases")
      .select("id, sort_order")
      .eq("project_id", data.projectId)
      .order("sort_order");
    const phaseIds = (phases ?? []).map((p) => p.id);
    const phaseOrder = new Map((phases ?? []).map((p) => [p.id, p.sort_order] as const));
    const updates = phaseIds.length
      ? (await supabaseAdmin
          .from("phase_updates")
          .select("id, phase_id, body, created_at")
          .in("phase_id", phaseIds)
          .order("created_at", { ascending: true })).data ?? []
      : [];
    const updateIds = updates.map((u) => u.id);
    const photos = updateIds.length
      ? (await supabaseAdmin
          .from("update_photos")
          .select("id, update_id, storage_path, sort_order")
          .in("update_id", updateIds)
          .order("sort_order")).data ?? []
      : [];

    const vehicle_label = [project.vehicle_make, project.vehicle_model].filter(Boolean).join(" ") || null;
    const year_label = project.vehicle_year ?? null;

    // Create the publication first so we know the destination prefix.
    const { data: pub, error: ce } = await supabaseAdmin
      .from("recent_work_publications")
      .insert({
        title: project.title,
        subtitle: null,
        vehicle_label,
        year_label,
        status: "draft",
        sort_order: 9999,
      })
      .select("id")
      .maybeSingle();
    if (ce || !pub) throw ce ?? new Error("Kon publicatie niet aanmaken");

    // Copy each photo: download from project-photos → upload to recent-work.
    const months = ["JAN", "FEB", "MRT", "APR", "MEI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEC"];
    const items: Array<{
      publication_id: string; photo_path: string; date_label: string | null;
      caption: string | null; sort_order: number;
    }> = [];
    let order = 0;
    // Sort photos by (phase order, update created_at, photo sort_order).
    const updateById = new Map(updates.map((u) => [u.id, u] as const));
    const sortedPhotos = [...photos].sort((a, b) => {
      const ua = updateById.get(a.update_id);
      const ub = updateById.get(b.update_id);
      const pa = phaseOrder.get(ua?.phase_id ?? "") ?? 0;
      const pb = phaseOrder.get(ub?.phase_id ?? "") ?? 0;
      if (pa !== pb) return pa - pb;
      const ta = new Date(ua?.created_at ?? 0).getTime();
      const tb = new Date(ub?.created_at ?? 0).getTime();
      if (ta !== tb) return ta - tb;
      return a.sort_order - b.sort_order;
    });

    let firstUploadedPath: string | null = null;
    for (const ph of sortedPhotos) {
      const dl = await supabaseAdmin.storage.from("project-photos").download(ph.storage_path);
      if (dl.error || !dl.data) continue;
      const filename = ph.storage_path.split("/").pop() ?? `${Date.now()}.jpg`;
      const destPath = `${pub.id}/${order.toString().padStart(3, "0")}-${filename}`;
      const up = await supabaseAdmin.storage.from(RECENT_WORK_BUCKET).upload(destPath, dl.data, {
        contentType: "image/jpeg", upsert: false,
      });
      if (up.error) continue;
      if (!firstUploadedPath) firstUploadedPath = destPath;
      const u = updateById.get(ph.update_id);
      const dt = u ? new Date(u.created_at) : null;
      const dateLabel = dt ? `${months[dt.getMonth()]} ${dt.getFullYear()}` : null;
      items.push({
        publication_id: pub.id,
        photo_path: destPath,
        date_label: dateLabel,
        caption: u?.body ?? null,
        sort_order: order,
      });
      order += 1;
    }
    if (items.length) {
      await supabaseAdmin.from("recent_work_items").insert(items);
    }
    // Cover: prefer the project cover if present, else first uploaded item.
    let coverPath: string | null = null;
    if (project.cover_photo_url) {
      // Copy the project's cover photo into recent-work too.
      const dl = await supabaseAdmin.storage.from("project-photos").download(project.cover_photo_url);
      if (!dl.error && dl.data) {
        const dest = `${pub.id}/cover-${Date.now()}.jpg`;
        const up = await supabaseAdmin.storage.from(RECENT_WORK_BUCKET).upload(dest, dl.data, {
          contentType: "image/jpeg", upsert: false,
        });
        if (!up.error) coverPath = dest;
      }
    }
    if (!coverPath) coverPath = firstUploadedPath;
    if (coverPath) {
      await supabaseAdmin.from("recent_work_publications")
        .update({ cover_photo_path: coverPath }).eq("id", pub.id);
    }

    return { publicationId: pub.id, copiedItems: items.length };
  });

// Admin: delete a publication and its photos from storage.
export const deletePublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { publicationId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Collect storage paths for cleanup.
    const { data: items } = await supabaseAdmin
      .from("recent_work_items").select("photo_path")
      .eq("publication_id", data.publicationId);
    const { data: pub } = await supabaseAdmin
      .from("recent_work_publications").select("cover_photo_path")
      .eq("id", data.publicationId).maybeSingle();
    const paths = [
      ...((items ?? []).map((i) => i.photo_path).filter((p) => !isExternalPhoto(p))),
      ...(pub?.cover_photo_path && !isExternalPhoto(pub.cover_photo_path) ? [pub.cover_photo_path] : []),
    ];
    if (paths.length) {
      await supabaseAdmin.storage.from(RECENT_WORK_BUCKET).remove(paths);
    }
    const { error } = await supabaseAdmin.from("recent_work_publications")
      .delete().eq("id", data.publicationId);
    if (error) throw error;
    return { ok: true, removedFiles: paths.length };
  });

// Admin: delete a single item and its photo from storage.
export const deletePublicationItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: it } = await supabaseAdmin
      .from("recent_work_items").select("photo_path").eq("id", data.itemId).maybeSingle();
    if (it?.photo_path && !isExternalPhoto(it.photo_path)) {
      await supabaseAdmin.storage.from(RECENT_WORK_BUCKET).remove([it.photo_path]);
    }
    const { error } = await supabaseAdmin.from("recent_work_items")
      .delete().eq("id", data.itemId);
    if (error) throw error;
    return { ok: true };
  });