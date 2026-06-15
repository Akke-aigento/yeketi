import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { t } from "@/lib/copy";

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
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    const [p, ph, c] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).maybeSingle(),
      supabase.from("project_phases").select("*").eq("project_id", id).order("sort_order"),
      supabase.from("profiles").select("id, full_name, email, phone").eq("id", (await supabase.from("projects").select("customer_id").eq("id", id).maybeSingle()).data?.customer_id ?? "").maybeSingle(),
    ]);
    setProject((p.data as Project | null) ?? null);
    const phRows = (ph.data as Phase[] | null) ?? [];
    setPhases(phRows);
    setCustomer((c.data as Customer | null) ?? null);
    if (phRows.length > 0) {
      const { data: u } = await supabase
        .from("phase_updates").select("*")
        .in("phase_id", phRows.map((r) => r.id))
        .order("created_at", { ascending: false });
      const upd = (u as Update[] | null) ?? [];
      setUpdates(upd);
      if (upd.length > 0) {
        const { data: ph2 } = await supabase
          .from("update_photos").select("*").in("update_id", upd.map((r) => r.id)).order("sort_order");
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
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const activePhase = phases.find((p) => p.status === "active") ?? phases[0];

  async function updateProject(patch: Partial<Project>) {
    await supabase.from("projects").update(patch).eq("id", id);
    load();
  }

  async function addPhase() {
    const name = prompt("Naam van de fase?");
    if (!name) return;
    const next = (phases[phases.length - 1]?.sort_order ?? -1) + 1;
    await supabase.from("project_phases").insert({ project_id: id, name, sort_order: next, status: "pending" });
    load();
  }
  async function renamePhase(p: Phase) {
    const name = prompt("Nieuwe naam?", p.name);
    if (!name || name === p.name) return;
    await supabase.from("project_phases").update({ name }).eq("id", p.id);
    load();
  }
  async function deletePhase(p: Phase) {
    if (!confirm(`Fase "${p.name}" verwijderen? Alle updates en foto's gaan mee.`)) return;
    await supabase.from("project_phases").delete().eq("id", p.id);
    load();
  }
  async function setPhaseStatus(p: Phase, status: Phase["status"]) {
    await supabase.from("project_phases").update({ status }).eq("id", p.id);
    load();
  }
  async function reorderPhase(p: Phase, dir: -1 | 1) {
    const idx = phases.findIndex((x) => x.id === p.id);
    const neighbor = phases[idx + dir];
    if (!neighbor) return;
    await Promise.all([
      supabase.from("project_phases").update({ sort_order: neighbor.sort_order }).eq("id", p.id),
      supabase.from("project_phases").update({ sort_order: p.sort_order }).eq("id", neighbor.id),
    ]);
    load();
  }
  async function deleteUpdate(u: Update) {
    if (!confirm("Update verwijderen?")) return;
    // Verzamel foto-paden zodat we ze ook uit storage halen
    const { data: ups } = await supabase
      .from("update_photos").select("storage_path").eq("update_id", u.id);
    const paths = (ups ?? []).map((x) => x.storage_path).filter(Boolean) as string[];
    if (paths.length > 0) {
      await supabase.storage.from("project-photos").remove(paths);
    }
    await supabase.from("phase_updates").delete().eq("id", u.id);
    load();
  }

  function waCustomer() {
    if (!customer?.phone) return alert("Geen telefoonnummer voor deze klant.");
    const clean = customer.phone.replace(/[^\d+]/g, "");
    const number = clean.startsWith("+") ? clean.slice(1) : clean;
    const voertuig = [project?.vehicle_make, project?.vehicle_model].filter(Boolean).join(" ") || project?.title;
    const portalUrl = `${window.location.origin}/portaal/${id}`;
    const text = encodeURIComponent(
      `Hoi ${customer.full_name?.split(" ")[0] ?? ""}, er staat een nieuwe update van je ${voertuig} klaar in je Yeketi portaal: ${portalUrl}`,
    );
    window.open(`https://wa.me/${number}?text=${text}`, "_blank");
  }

  if (!project) {
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
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  async function submit() {
    if (!body.trim() && files.length === 0) return;
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: update, error } = await supabase
        .from("phase_updates")
        .insert({ phase_id: phaseId, body: body.trim(), created_by: userData.user?.id ?? null })
        .select("id")
        .maybeSingle();
      if (error || !update) throw error ?? new Error("Kon update niet opslaan");

      for (let i = 0; i < files.length; i++) {
        setProgress(`Foto ${i + 1}/${files.length} verkleinen…`);
        const blob = await compressImage(files[i]);
        setProgress(`Foto ${i + 1}/${files.length} uploaden…`);
        const path = `${projectId}/${update.id}/${Date.now()}-${i}.jpg`;
        const up = await supabase.storage.from("project-photos").upload(path, blob, {
          contentType: "image/jpeg", upsert: false,
        });
        if (up.error) throw up.error;
        await supabase.from("update_photos").insert({
          update_id: update.id, storage_path: path, sort_order: i,
        });
      }
      onSaved();
    } catch (e: unknown) {
      alert((e as Error).message ?? "Fout bij opslaan");
    } finally { setBusy(false); setProgress(""); }
  }

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
            <select className="field-y" value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
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
            />
          </label>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "var(--charcoal-soft)" }}>Foto's</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="btn-y text-center cursor-pointer">
                Camera
                <input
                  type="file" accept="image/*" capture="environment" multiple className="hidden"
                  onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
                />
              </label>
              <label className="btn-y text-center cursor-pointer">
                Galerij
                <input
                  type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
                />
              </label>
            </div>
            {files.length > 0 && (
              <div className="grid grid-cols-4 gap-1 mt-2">
                {files.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full" style={{ aspectRatio: "1/1", objectFit: "cover", border: "1px solid var(--charcoal)" }} />
                    <button
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-0 right-0 px-1 text-xs"
                      style={{ background: "var(--charcoal)", color: "var(--gold)" }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {progress && <p className="text-xs" style={{ color: "var(--charcoal-soft)" }}>{progress}</p>}
          <button onClick={submit} disabled={busy} className="btn-y-solid w-full">
            {busy ? "Versturen…" : "Publiceer update"}
          </button>
        </div>
      </div>
    </div>
  );
}