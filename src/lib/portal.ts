import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type PhaseRow = Database["public"]["Tables"]["project_phases"]["Row"];
export type UpdateRow = Database["public"]["Tables"]["phase_updates"]["Row"];
export type PhotoRow = Database["public"]["Tables"]["update_photos"]["Row"];
export type ReactionRow = Database["public"]["Tables"]["update_reactions"]["Row"];

export type ReactionView = {
  id: string;
  phase_update_id: string;
  author_id: string;
  author_name: string;
  is_admin: boolean;
  body: string;
  created_at: string;
};

export async function fetchReactionsByUpdate(updateIds: string[]): Promise<Map<string, ReactionView[]>> {
  const out = new Map<string, ReactionView[]>();
  if (updateIds.length === 0) return out;
  const { data: rs, error } = await supabase
    .from("update_reactions")
    .select("id, phase_update_id, author_id, body, created_at")
    .in("phase_update_id", updateIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = rs ?? [];
  if (rows.length === 0) return out;
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
  const [{ data: profs }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", authorIds),
    supabase.from("user_roles").select("user_id").eq("role", "admin").in("user_id", authorIds),
  ]);
  const nameById = new Map<string, string>();
  (profs ?? []).forEach((p) => nameById.set(p.id, p.full_name ?? p.email ?? "Klant"));
  const adminSet = new Set<string>((roles ?? []).map((r) => r.user_id));
  rows.forEach((r) => {
    const view: ReactionView = {
      id: r.id,
      phase_update_id: r.phase_update_id,
      author_id: r.author_id,
      author_name: adminSet.has(r.author_id) ? "Yeketi" : (nameById.get(r.author_id) ?? "Klant"),
      is_admin: adminSet.has(r.author_id),
      body: r.body,
      created_at: r.created_at,
    };
    const arr = out.get(r.phase_update_id) ?? [];
    arr.push(view);
    out.set(r.phase_update_id, arr);
  });
  return out;
}

export async function addReaction(updateId: string, body: string): Promise<ReactionView> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Reactie is leeg");
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Niet ingelogd");
  const { data, error } = await supabase
    .from("update_reactions")
    .insert({ phase_update_id: updateId, author_id: uid, body: trimmed })
    .select("id, phase_update_id, author_id, body, created_at")
    .single();
  if (error) throw error;
  // Detect admin
  const { data: roleRow } = await supabase
    .from("user_roles").select("user_id").eq("user_id", uid).eq("role", "admin").maybeSingle();
  const isAdmin = !!roleRow;
  let name = "Jij";
  if (!isAdmin) {
    const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", uid).maybeSingle();
    name = prof?.full_name ?? prof?.email ?? "Klant";
  } else {
    name = "Yeketi";
  }
  return {
    id: data.id,
    phase_update_id: data.phase_update_id,
    author_id: data.author_id,
    author_name: name,
    is_admin: isAdmin,
    body: data.body,
    created_at: data.created_at,
  };
}

export async function deleteReaction(id: string): Promise<void> {
  const { error } = await supabase.from("update_reactions").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchMyProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchProject(id: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type TimelinePhoto = PhotoRow & { signedUrl: string | null; posterUrl: string | null };
export type TimelineUpdate = UpdateRow & { photos: TimelinePhoto[] };
export type TimelinePhase = PhaseRow & { updates: TimelineUpdate[] };

export async function fetchProjectTimeline(projectId: string): Promise<TimelinePhase[]> {
  const { data: phases, error: pe } = await supabase
    .from("project_phases")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (pe) throw pe;
  if (!phases || phases.length === 0) return [];

  const phaseIds = phases.map((p) => p.id);
  const { data: updates, error: ue } = await supabase
    .from("phase_updates")
    .select("*")
    .in("phase_id", phaseIds)
    .order("created_at", { ascending: false });
  if (ue) throw ue;

  const updateIds = (updates ?? []).map((u) => u.id);
  let photos: PhotoRow[] = [];
  if (updateIds.length > 0) {
    const { data: ph, error: phe } = await supabase
      .from("update_photos")
      .select("*")
      .in("update_id", updateIds)
      .order("sort_order", { ascending: true });
    if (phe) throw phe;
    photos = ph ?? [];
  }

  // Sign URLs in one batch per bucket (include video posters when present).
  const paths = Array.from(new Set([
    ...photos.map((p) => p.storage_path),
    ...photos
      .map((p) => (p as PhotoRow & { poster_path: string | null }).poster_path)
      .filter((x): x is string => !!x),
  ]));
  const signed: Record<string, string | null> = {};
  if (paths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from("project-photos")
      .createSignedUrls(paths, 60 * 60);
    (signedData ?? []).forEach((s, i) => {
      signed[paths[i]] = s.signedUrl ?? null;
    });
  }

  return phases.map((phase) => ({
    ...phase,
    updates: (updates ?? [])
      .filter((u) => u.phase_id === phase.id)
      .map((u) => ({
        ...u,
        photos: photos
          .filter((p) => p.update_id === u.id)
          .map((p) => {
            const withPoster = p as PhotoRow & { poster_path: string | null };
            return {
              ...p,
              signedUrl: signed[p.storage_path] ?? null,
              posterUrl: withPoster.poster_path ? (signed[withPoster.poster_path] ?? null) : null,
            };
          }),
      })),
  }));
}

export async function signCoverUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  // If a full URL is stored, return as-is
  if (/^https?:\/\//.test(path)) return path;
  const { data } = await supabase.storage.from("project-photos").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}