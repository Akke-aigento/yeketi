import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type PhaseRow = Database["public"]["Tables"]["project_phases"]["Row"];
export type UpdateRow = Database["public"]["Tables"]["phase_updates"]["Row"];
export type PhotoRow = Database["public"]["Tables"]["update_photos"]["Row"];

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

export type TimelinePhoto = PhotoRow & { signedUrl: string | null };
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

  // Sign URLs in one batch per bucket
  const paths = photos.map((p) => p.storage_path);
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
          .map((p) => ({ ...p, signedUrl: signed[p.storage_path] ?? null })),
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