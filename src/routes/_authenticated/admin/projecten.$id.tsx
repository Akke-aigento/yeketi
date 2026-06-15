import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { t } from "@/lib/copy";
import { deletePhase as deletePhaseFn, deleteProject as deleteProjectFn } from "@/lib/admin.functions";
import { ConfirmModal, PromptModal } from "@/components/AdminModals";

export const Route = createFileRoute("/_authenticated/admin/projecten/$id")({
  head: () => ({ meta: [{ title: "Project — Admin" }, { name: "robots", content: "noindex" }] }),
  component: ProjectAdmin,
});

type Project = {
  id: string; title: string; status: keyof typeof t.portal.statusLabels;
  vehicle_make: string | null; vehicle_model: string | null; vehicle_year: string | null;
  start_date: string | null; expected_end_date: string | null;
  customer_id: string; cover_photo_url: string | null;
};
type Phase = {
  id: string; project_id: string; name: string; sort_order: number;
  status: "pending" | "active" | "done"; started_at: string | null; completed_at: string | null;
};
type Update = { id: string; phase_id: string; body: string; created_at: string };
type Photo = { id: string; update_id: string; storage_path: string; sort_order: number };
type Customer = { id: string; full_name: string | null; email: string | null; phone: string | null };

function ProjectAdmin() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const deletePhaseSrv = useServerFn(deletePhaseFn);
  const deleteProjectSrv = useServerFn(deleteProjectFn);
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Modal state for prompt/confirm replacements
  const [phaseNamePrompt, setPhaseNamePrompt] = useState<{ initial: string; onSave: (v: string) => void } | null>(null);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; destructive?: boolean; onConfirm: () => void } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [p, ph, c] = await Promise.all([
        supabase.from("projects").select("*").eq("id", id).maybeSingle(),
        supabase.from("project_phases").select("*").eq("project_id", id).order("sort_order"),
        supabase.from("profiles").select("id, full_name, email, phone").eq("id", (await supabase.from("projects").select("customer_id").eq("id", id).maybeSingle()).data?.customer_id ?? "").maybeSingle(),
      ]);
      if (p.error) throw p.error;
      if (ph.error) throw ph.error;
      setProject((p.data as Project | null) ?? null);
      const phRows = (ph.data as Phase[] | null) ?? [];
      setPhases(phRows);
      setCustomer((c.data as Customer | null) ?? null);
      if (phRows.length > 0) {
        const { data: u, error: ue } = await supabase
          .from("phase_updates").select("*")
          .in("phase_id", phRows.map((r) => r.id))
          .order("created_at", { ascending: false });
        if (ue) throw ue;
        const upd = (u as Update[] | null) ?? [];
        setUpdates(upd);
        if (upd.length > 0) {
          const { data: ph2, error: pe2 } = await supabase
            .from("update_photos").select("*").in("update_id", upd.map((r) => r.id)).order("sort_order");
          if (pe2) throw pe2;
          const photosData = (ph2 as Photo[] | null) ?? [];
          setPhotos(photosData);
          if (photosData.length > 0) {
            const { data: signed } = await supabase.storage
              .from("project-photos")
              .createSignedUrls(photosData.map((x) => x.storage_path), 3600);
            const map: Record<string, string> = {};
            (signed ?? []).forEach((s, i) => { if (s.signedUrl) map[photosData[i].storage_path] = s.signedUrl; });
            setSignedUrls(map);
          }
        } else { setPhotos([]); }
      } else { setUpdates([]); setPhotos([]); }
    } catch (e) {
      setLoadError((e as Error).message ?? "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const activePhase = phases.find((p) => p.status === "active") ?? phases[0];

  async function updateProject(patch: Partial<Project>) {
    const { error } = await supabase.from("projects").update(patch).eq("id", id);
    if (error) { toast.error("Project bijwerken mislukt", { description: error.message }); return; }
    load();
  }

  async function addPhase() {
    setPhaseNamePrompt({
      initial: "",
      onSave: async (name) => {
        const next = (phases[phases.length - 1]?.sort_order ?? -1) + 1;
        const { error } = await supabase.from("project_phases").insert({ project_id: id, name, sort_order: next, status: "pending" });
        if (error) { toast.error("Fase toevoegen mislukt", { description: error.message }); return; }
        toast.success("Fase toegevoegd");
        load();
      },
    });
  }
  async function renamePhase(p: Phase) {
    setPhaseNamePrompt({
      initial: p.name,
      onSave: async (name) => {
        if (name === p.name) return;
        const { error } = await supabase.from("project_phases").update({ name }).eq("id", p.id);
        if (error) { toast.error("Hernoemen mislukt", { description: error.message }); return; }
        toast.success("Fase hernoemd");
        load();
      },
    });
  }
  async function deletePhase(p: Phase) {
    setConfirmState({
      title: "Fase verwijderen",
      message: `Fase "${p.name}" verwijderen? Alle updates en foto's gaan mee.`,
      destructive: true,
      onConfirm: async () => {
        try {
          await deletePhaseSrv({ data: { phaseId: p.id } });
          toast.success("Fase verwijderd");
          load();
        } catch (e) {
          toast.error("Verwijderen mislukt", { description: (e as Error).message });
        }
      },
    });
  }
  async function deleteProject() {
    if (!project) return;
    setConfirmState({
      title: "Project verwijderen",
      message: `Project "${project.title}" volledig verwijderen? Alle fases, updates en foto's gaan mee.`,
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteProjectSrv({ data: { projectId: id } });
          toast.success("Project verwijderd");
          navigate({ to: "/admin/projecten" });
        } catch (e) {
          toast.error("Verwijderen mislukt", { description: (e as Error).message });
        }
      },
    });
  }
  async function setPhaseStatus(p: Phase, status: Phase["status"]) {
    const { error } = await supabase.from("project_phases").update({ status }).eq("id", p.id);
    if (error) { toast.error("Status wijzigen mislukt", { description: error.message }); return; }
    load();
  }
  async function reorderPhase(p: Phase, dir: -1 | 1) {
    const idx = phases.findIndex((x) => x.id === p.id);
    const neighbor = phases[idx + dir];
    if (!neighbor) return;
    const results = await Promise.all([
      supabase.from("project_phases").update({ sort_order: neighbor.sort_order }).eq("id", p.id),
      supabase.from("project_phases").update({ sort_order: p.sort_order }).eq("id", neighbor.id),
    ]);
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) { toast.error("Herschikken mislukt", { description: firstError.message }); return; }
    load();
  }
  async function deleteUpdate(u: Update) {
    setConfirmState({
      title: "Update verwijderen",
      message: "Deze update en bijhorende foto's worden definitief verwijderd.",
      destructive: true,
      onConfirm: async () => {
        const { data: ups, error: lerr } = await supabase
          .from("update_photos").select("storage_path").eq("update_id", u.id);
        if (lerr) { toast.error("Verwijderen mislukt", { description: lerr.message }); return; }
        const paths = (ups ?? []).map((x) => x.storage_path).filter(Boolean) as string[];
        if (paths.length > 0) {
          const { error: re } = await supabase.storage.from("project-photos").remove(paths);
          if (re) { toast.error("Foto's verwijderen mislukt", { description: re.message }); return; }
        }
        const { error: de } = await supabase.from("phase_updates").delete().eq("id", u.id);
        if (de) { toast.error("Update verwijderen mislukt", { description: de.message }); return; }
        toast.success("Update verwijderd");
        load();
      },
    });
  }

  function waCustomer() {
    if (!customer?.phone) { toast.error("Geen telefoonnummer voor deze klant."); return; }
    const clean = customer.phone.replace(/[^\d+]/g, "");
    const number = clean.startsWith("+") ? clean.slice(1) : clean;
    const voertuig = [project?.vehicle_make, project?.vehicle_model].filter(Boolean).join(" ") || project?.title;
    const portalUrl = `${window.location.origin}/portaal/${id}`;
    const text = encodeURIComponent(
      `Hoi ${customer.full_name?.split(" ")[0] ?? ""}, er staat een nieuwe update van je ${voertuig} klaar in je Yeketi portaal: ${portalUrl}`,
    );
    window.open(`https://wa.me/${number}?text=${text}`, "_blank");
  }

  if (loadError) {
    return (
      <AdminShell title="Project">
        <div className="container-edit pb-8">
          <p className="text-sm" style={{ color: "var(--oxide)" }}>Laden mislukt: {loadError}</p>
          <button onClick={load} className="btn-y-solid mt-3">Opnieuw proberen</button>
        </div>
      </AdminShell>
    );
  }
  if (loading || !project) {
    return <AdminShell title="Project"><div className="container-edit pb-8 eyebrow" style={{ color: "var(--charcoal-soft)" }}>Laden…</div></AdminShell>;
  }

  return (
    <AdminShell>
      <div className="container-edit pt-3 pb-2">
        <Link to="/admin" className="eyebrow" style={{ color: "var(--charcoal-soft)" }}>← Dashboard</Link>
      </div>

      <section className="container-edit pb-4">
        <input
          value={project.title}
          onChange={(e) => setProject({ ...project, title: e.target.value })}
          onBlur={() => updateProject({ title: project.title })}
          className="field-y"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem" }}
        />
        <div className="grid grid-cols-3 gap-2 mt-3">
          <FieldText label="Merk" value={project.vehicle_make ?? ""} onSave={(v) => updateProject({ vehicle_make: v })} />
          <FieldText label="Model" value={project.vehicle_model ?? ""} onSave={(v) => updateProject({ vehicle_model: v })} />
          <FieldText label="Jaar" value={project.vehicle_year ?? ""} onSave={(v) => updateProject({ vehicle_year: v })} />
        </div>

        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "var(--charcoal-soft)" }}>Status</div>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(t.portal.statusLabels) as (keyof typeof t.portal.statusLabels)[]).map((s) => (
              <button
                key={s}
                onClick={() => updateProject({ status: s })}
                className="text-[10px] tracking-[0.15em] uppercase px-2 py-1.5"
                style={{
                  border: "1px solid var(--charcoal)",
                  background: project.status === s ? "var(--charcoal)" : "transparent",
                  color: project.status === s ? "var(--gold)" : "var(--charcoal)",
                }}
              >
                {t.portal.statusLabels[s]}
              </button>
            ))}
          </div>
        </div>

        {customer && (
          <div className="mt-4 px-3 py-3 text-sm" style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}>
            <div style={{ fontFamily: "var(--font-display)" }}>{customer.full_name ?? customer.email}</div>
            <div className="text-xs" style={{ color: "var(--charcoal-soft)" }}>{customer.email} {customer.phone ? `· ${customer.phone}` : ""}</div>
            <button onClick={waCustomer} className="btn-y-solid mt-3 w-full">WhatsApp klant</button>
          </div>
        )}
        <button
          onClick={deleteProject}
          className="mt-4 w-full text-xs uppercase tracking-[0.18em] py-2"
          style={{ border: "1px solid var(--oxide)", color: "var(--oxide)", background: "transparent" }}
        >
          Project verwijderen
        </button>
      </section>

      <section className="container-edit pb-3">
        <button
          onClick={() => setShowNew(true)}
          className="btn-y-solid w-full"
          style={{ position: "sticky", bottom: "1rem", zIndex: 20, padding: "1.1rem" }}
        >
          + Nieuwe update
        </button>
      </section>

      <section className="container-edit pb-12">
        <div className="flex items-center justify-between mt-4">
          <h2 style={{ fontSize: "1.1rem" }}>Fases</h2>
          <button onClick={addPhase} className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--brass)" }}>+ Fase</button>
        </div>
        <ol className="mt-3 space-y-3">
          {phases.map((p, idx) => {
            const phaseUpdates = updates.filter((u) => u.phase_id === p.id);
            return (
              <li key={p.id} style={{ border: "1px solid var(--charcoal)", background: "var(--cream)" }}>
                <div className="flex items-center gap-2 px-3 py-2" style={{ background: "var(--cream-deep)" }}>
                  <span className="text-xs" style={{ color: "var(--charcoal-soft)", width: "1.5rem" }}>≡</span>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => renamePhase(p)} className="text-left truncate" style={{ fontFamily: "var(--font-display)", fontSize: "1rem" }}>
                      {p.name}
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => reorderPhase(p, -1)} disabled={idx === 0} className="px-2 py-1 text-xs disabled:opacity-30">↑</button>
                    <button onClick={() => reorderPhase(p, 1)} disabled={idx === phases.length - 1} className="px-2 py-1 text-xs disabled:opacity-30">↓</button>
                    <button onClick={() => deletePhase(p)} className="px-2 py-1 text-xs" style={{ color: "var(--oxide)" }}>✕</button>
                  </div>
                </div>
                <div className="flex gap-1 px-3 py-2 border-t" style={{ borderColor: "var(--charcoal)" }}>
                  {(["pending", "active", "done"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setPhaseStatus(p, s)}
                      className="text-[10px] tracking-[0.15em] uppercase px-2 py-1"
                      style={{
                        border: "1px solid var(--charcoal)",
                        background: p.status === s ? "var(--brass)" : "transparent",
                        color: p.status === s ? "var(--cream)" : "var(--charcoal)",
                      }}
                    >
                      {s === "pending" ? "Te doen" : s === "active" ? "Actief" : "Klaar"}
                    </button>
                  ))}
                </div>
                {phaseUpdates.length > 0 && (
                  <ul className="px-3 py-2 space-y-3 border-t" style={{ borderColor: "var(--charcoal)" }}>
                    {phaseUpdates.map((u) => {
                      const ups = photos.filter((ph) => ph.update_id === u.id);
                      return (
                        <li key={u.id}>
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-sm whitespace-pre-wrap flex-1" style={{ lineHeight: 1.55 }}>{u.body}</p>
                            <button onClick={() => deleteUpdate(u)} className="text-xs" style={{ color: "var(--oxide)" }}>✕</button>
                          </div>
                          <div className="text-[10px] uppercase tracking-[0.15em] mt-1" style={{ color: "var(--charcoal-soft)" }}>
                            {new Date(u.created_at).toLocaleString("nl-BE")}
                          </div>
                          {ups.length > 0 && (
                            <div className="grid grid-cols-4 gap-1 mt-2">
                              {ups.map((ph) => (
                                <img key={ph.id} src={signedUrls[ph.storage_path]} alt="" className="w-full" style={{ aspectRatio: "1/1", objectFit: "cover", border: "1px solid var(--charcoal)" }} />
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {showNew && activePhase && (
        <NewUpdateModal
          projectId={id}
          phases={phases}
          defaultPhaseId={activePhase.id}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
    </AdminShell>
  );
}

function FieldText({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>{label}</span>
      <input className="field-y" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />
    </label>
  );
}

function NewUpdateModal({
  projectId, phases, defaultPhaseId, onClose, onSaved,
}: { projectId: string; phases: { id: string; name: string }[]; defaultPhaseId: string; onClose: () => void; onSaved: () => void }) {
  const [phaseId, setPhaseId] = useState(defaultPhaseId);
  const [body, setBody] = useState("");
  type FileItem = { file: File; status: "pending" | "uploading" | "done" | "error"; error?: string };
  const [items, setItems] = useState<FileItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [updateId, setUpdateId] = useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setItems((prev) => [...prev, ...Array.from(list).map((file) => ({ file, status: "pending" as const }))]);
  }

  async function uploadOne(updId: string, item: FileItem, sortIndex: number): Promise<FileItem> {
    try {
      const blob = await compressImage(item.file);
      const safeIdx = String(sortIndex).padStart(3, "0");
      const path = `${projectId}/${updId}/${Date.now()}-${safeIdx}.jpg`;
      const up = await supabase.storage.from("project-photos").upload(path, blob, {
        contentType: "image/jpeg", upsert: false,
      });
      if (up.error) throw up.error;
      const ins = await supabase.from("update_photos").insert({
        update_id: updId, storage_path: path, sort_order: sortIndex,
      });
      if (ins.error) throw ins.error;
      return { ...item, status: "done" };
    } catch (e: unknown) {
      return { ...item, status: "error", error: e instanceof Error ? e.message : "Upload mislukt" };
    }
  }

  async function runUploads(updId: string, current: FileItem[]) {
    const toDo = current.map((it, i) => ({ it, i })).filter(({ it }) => it.status !== "done");
    // Mark in-progress
    setItems((prev) => prev.map((it, i) =>
      toDo.some((x) => x.i === i) ? { ...it, status: "uploading", error: undefined } : it,
    ));
    for (const { it, i } of toDo) {
      const res = await uploadOne(updId, it, i);
      setItems((prev) => prev.map((p, idx) => (idx === i ? res : p)));
    }
  }

  async function submit() {
    if (!body.trim() && items.length === 0) return;
    setBusy(true);
    try {
      let updId = updateId;
      if (!updId) {
        const { data: userData } = await supabase.auth.getUser();
        const { data: update, error } = await supabase
          .from("phase_updates")
          .insert({ phase_id: phaseId, body: body.trim(), created_by: userData.user?.id ?? null })
          .select("id")
          .maybeSingle();
        if (error || !update) throw error ?? new Error("Kon update niet opslaan");
        updId = update.id;
        setUpdateId(updId);
      }
      await runUploads(updId, items);
    } catch (e: unknown) {
      alert((e as Error).message ?? "Fout bij opslaan");
    } finally { setBusy(false); }
  }

  async function retryFailed() {
    if (!updateId) return;
    setBusy(true);
    try { await runUploads(updateId, items); }
    finally { setBusy(false); }
  }

  function finish() {
    onSaved();
  }

  const failedCount = items.filter((i) => i.status === "error").length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const allDone = items.length > 0 && doneCount === items.length;
  const published = updateId !== null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(34,31,27,0.6)" }}>
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" style={{ background: "var(--cream)", border: "1px solid var(--charcoal)" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--charcoal)", color: "var(--cream)" }}>
          <span style={{ fontFamily: "var(--font-display)" }}>Nieuwe update</span>
          <button onClick={onClose} style={{ color: "var(--gold)" }}>✕</button>
        </div>
        <div className="px-4 py-4 space-y-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>Fase</span>
            <select className="field-y" value={phaseId} onChange={(e) => setPhaseId(e.target.value)} disabled={published}>
              {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>Tekst</span>
            <textarea
              className="field-y"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Korte beschrijving voor de klant…"
              style={{ resize: "vertical" }}
              disabled={published}
            />
          </label>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "var(--charcoal-soft)" }}>Foto's</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="btn-y text-center cursor-pointer">
                Camera
                <input
                  type="file" accept="image/*" capture="environment" multiple className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                />
              </label>
              <label className="btn-y text-center cursor-pointer">
                Galerij
                <input
                  type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                />
              </label>
            </div>
            {items.length > 0 && (
              <div className="grid grid-cols-4 gap-1 mt-2">
                {items.map((it, i) => {
                  const ring =
                    it.status === "done" ? "var(--brass)" :
                    it.status === "error" ? "var(--oxide)" :
                    it.status === "uploading" ? "var(--gold)" : "var(--charcoal)";
                  return (
                    <div key={i} className="relative">
                      <img
                        src={URL.createObjectURL(it.file)}
                        alt=""
                        className="w-full"
                        style={{
                          aspectRatio: "1/1",
                          objectFit: "cover",
                          border: "2px solid " + ring,
                          opacity: it.status === "done" ? 0.7 : 1,
                        }}
                      />
                      <div
                        className="absolute bottom-0 left-0 right-0 text-[9px] tracking-[0.1em] uppercase text-center py-0.5"
                        style={{ background: "rgba(34,31,27,0.78)", color: ring }}
                      >
                        {it.status === "pending" ? "wacht" :
                         it.status === "uploading" ? "bezig" :
                         it.status === "done" ? "ok" : "fout"}
                      </div>
                      {!published && (
                        <button
                          onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute top-0 right-0 px-1 text-xs"
                          style={{ background: "var(--charcoal)", color: "var(--gold)" }}
                        >✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {published && failedCount > 0 && (
              <p className="text-xs mt-2" style={{ color: "var(--oxide)" }}>
                {failedCount} foto{failedCount === 1 ? "" : "'s"} mislukt — probeer opnieuw, de rest blijft staan.
              </p>
            )}
          </div>
          {!published && (
            <button onClick={submit} disabled={busy} className="btn-y-solid w-full">
              {busy ? "Versturen…" : "Publiceer update"}
            </button>
          )}
          {published && failedCount > 0 && (
            <button onClick={retryFailed} disabled={busy} className="btn-y-solid w-full">
              {busy ? "Bezig…" : `Probeer ${failedCount} mislukte opnieuw`}
            </button>
          )}
          {published && (
            <button onClick={finish} disabled={busy} className="btn-y w-full">
              {allDone || failedCount === 0 ? "Klaar" : "Sluiten — mislukte foto's overslaan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}