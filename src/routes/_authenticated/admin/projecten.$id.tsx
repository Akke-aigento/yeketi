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
import { publishProjectToRecentWork as publishProjectToRecentWorkFn } from "@/lib/recent-work.functions";
import { fetchReactionsByUpdate, type ReactionView } from "@/lib/portal";
import { ReactionThread } from "@/components/ReactionThread";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  const publishToRecentWork = useServerFn(publishProjectToRecentWorkFn);
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [reactions, setReactions] = useState<Map<string, ReactionView[]>>(new Map());
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Modal state for prompt/confirm replacements
  const [phaseNamePrompt, setPhaseNamePrompt] = useState<{ initial: string; onSave: (v: string) => void } | null>(null);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; destructive?: boolean; onConfirm: () => void } | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishConsent, setPublishConsent] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
      const proj = p.data as Project | null;
      if (proj?.cover_photo_url) {
        const { data: signed } = await supabase.storage
          .from("project-photos").createSignedUrl(proj.cover_photo_url, 3600);
        setCoverUrl(signed?.signedUrl ?? null);
      } else {
        setCoverUrl(null);
      }
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
          const rmap = await fetchReactionsByUpdate(upd.map((u) => u.id));
          setReactions(rmap);
        } else { setPhotos([]); }
      } else { setUpdates([]); setPhotos([]); }
      // Mark customer reactions as read for the admin
      await supabase.rpc("mark_project_reactions_seen", { _project_id: id });
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

  async function uploadCover(file: File) {
    if (!project) return;
    setUploadingCover(true);
    try {
      const blob = await compressImage(file);
      const path = `${id}/cover/${Date.now()}.jpg`;
      const up = await supabase.storage.from("project-photos").upload(path, blob, {
        contentType: "image/jpeg", upsert: false,
      });
      if (up.error) throw up.error;
      const { error: ue } = await supabase.from("projects").update({ cover_photo_url: path }).eq("id", id);
      if (ue) throw ue;
      toast.success("Cover bijgewerkt");
      load();
    } catch (e) {
      toast.error("Cover uploaden mislukt", { description: (e as Error).message });
    } finally {
      setUploadingCover(false);
    }
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
  async function confirmPublishToRecentWork() {
    if (!publishConsent) return;
    if (publishing) return;
    setPublishing(true);
    try {
      const res = await publishToRecentWork({ data: { projectId: id, consent: true } });
      toast.success("Concept-publicatie aangemaakt", { description: `${res.copiedItems} foto's gekopieerd.` });
      setPublishOpen(false); setPublishConsent(false);
      navigate({ to: "/admin/recent-werk/$id", params: { id: res.publicationId } });
    } catch (e) {
      toast.error("Publiceren mislukt", { description: (e as Error).message });
    } finally { setPublishing(false); }
  }
  async function setPhaseStatus(p: Phase, status: Phase["status"]) {
    const { error } = await supabase.from("project_phases").update({ status }).eq("id", p.id);
    if (error) { toast.error("Status wijzigen mislukt", { description: error.message }); return; }
    load();
  }
  async function deletePhoto(ph: Photo) {
    setConfirmState({
      title: "Foto verwijderen",
      message: "Deze foto wordt definitief verwijderd uit de update.",
      destructive: true,
      onConfirm: async () => {
        const rm = await supabase.storage.from("project-photos").remove([ph.storage_path]);
        if (rm.error) { toast.error("Foto verwijderen mislukt", { description: rm.error.message }); return; }
        const { error } = await supabase.from("update_photos").delete().eq("id", ph.id);
        if (error) { toast.error("Foto verwijderen mislukt", { description: error.message }); return; }
        toast.success("Foto verwijderd");
        load();
      },
    });
  }
  async function addPhotosToUpdate(u: Update, files: File[]) {
    if (!files || files.length === 0) return;
    const existing = photos.filter((p) => p.update_id === u.id).length;
    let okCount = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const blob = await compressImage(f);
        const safeIdx = String(existing + i).padStart(3, "0");
        const path = `${id}/${u.id}/${Date.now()}-${safeIdx}-${i}.jpg`;
        const up = await supabase.storage.from("project-photos").upload(path, blob, {
          contentType: "image/jpeg", upsert: false,
        });
        if (up.error) throw up.error;
        const ins = await supabase.from("update_photos").insert({
          update_id: u.id, storage_path: path, sort_order: existing + i,
        });
        if (ins.error) throw ins.error;
        okCount++;
      }
      toast.success(`${okCount} foto${okCount === 1 ? "" : "'s"} toegevoegd`);
      load();
    } catch (e) {
      toast.error("Toevoegen mislukt", { description: (e as Error).message });
      if (okCount > 0) load();
    }
  }
  async function persistPhaseOrder(ordered: Phase[]) {
    // Assign sequential sort_order = index, persist any that changed.
    const changed = ordered
      .map((p, i) => ({ p, sort_order: i }))
      .filter(({ p, sort_order }) => p.sort_order !== sort_order);
    if (changed.length === 0) return;
    const results = await Promise.all(
      changed.map(({ p, sort_order }) =>
        supabase.from("project_phases").update({ sort_order }).eq("id", p.id),
      ),
    );
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) {
      toast.error("Herschikken mislukt", { description: firstError.message });
      load();
    }
  }
  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = phases.findIndex((p) => p.id === active.id);
    const newIndex = phases.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(phases, oldIndex, newIndex);
    setPhases(next); // optimistic
    void persistPhaseOrder(next);
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
        <Link to="/admin/projecten" className="eyebrow" style={{ color: "var(--charcoal-soft)" }}>← Projecten</Link>
      </div>

      {/* Cover hero */}
      <section className="container-edit pb-4">
        <div
          className="relative"
          style={{
            aspectRatio: "21/9",
            background: coverUrl ? `center/cover url(${coverUrl})` : "var(--charcoal)",
            color: "var(--gold)",
            display: "grid", placeItems: "center",
            border: "1px solid var(--charcoal)",
            fontFamily: "var(--font-display)", fontSize: "3rem",
          }}
        >
          {!coverUrl && (project.vehicle_make?.[0] ?? project.title[0] ?? "·")}
          <label
            className="absolute bottom-2 right-2 text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 cursor-pointer"
            style={{ background: "rgba(34,31,27,0.78)", color: "var(--gold)", border: "1px solid var(--brass)" }}
          >
            {uploadingCover ? "Bezig…" : (coverUrl ? "Cover wijzigen" : "+ Cover foto")}
            <input
              type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }}
              disabled={uploadingCover}
            />
          </label>
        </div>
      </section>

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
        <button
          onClick={() => { setPublishConsent(false); setPublishOpen(true); }}
          className="mt-3 w-full text-xs uppercase tracking-[0.18em] py-2"
          style={{ border: "1px solid var(--brass)", color: "var(--brass)", background: "transparent" }}
        >
          Publiceer naar Recent Werk
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
        <p className="text-[10px] uppercase tracking-[0.15em] mt-2" style={{ color: "var(--charcoal-soft)" }}>
          Sleep aan de greep ≡ om fases te herschikken
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={phases.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ol className="mt-3 space-y-3">
              {phases.map((p) => (
                <SortablePhaseItem
                  key={p.id}
                  phase={p}
                  phaseUpdates={updates.filter((u) => u.phase_id === p.id)}
                  photos={photos}
                  signedUrls={signedUrls}
                  reactions={reactions}
                  onRename={() => renamePhase(p)}
                  onDelete={() => deletePhase(p)}
                  onSetStatus={(s) => setPhaseStatus(p, s)}
                  onDeleteUpdate={(u) => deleteUpdate(u)}
                  onDeletePhoto={(ph) => deletePhoto(ph)}
                  onAddPhotos={(u, files) => addPhotosToUpdate(u, files)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
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
      <PromptModal
        open={phaseNamePrompt !== null}
        title={phaseNamePrompt?.initial ? "Fase hernoemen" : "Nieuwe fase"}
        initial={phaseNamePrompt?.initial ?? ""}
        placeholder="Naam van de fase"
        confirmLabel="Opslaan"
        onSave={async (v) => { await phaseNamePrompt?.onSave(v); }}
        onClose={() => setPhaseNamePrompt(null)}
      />
      <ConfirmModal
        open={confirmState !== null}
        title={confirmState?.title ?? ""}
        message={confirmState?.message ?? ""}
        destructive={confirmState?.destructive}
        confirmLabel="Verwijder"
        onConfirm={async () => { await confirmState?.onConfirm(); }}
        onClose={() => setConfirmState(null)}
      />
      {publishOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 overflow-y-auto" style={{ background: "rgba(34,31,27,0.6)" }}>
          <div className="w-full sm:max-w-md" style={{ background: "var(--cream)", border: "1px solid var(--charcoal)" }}>
            <div className="px-4 py-3" style={{ background: "var(--charcoal)", color: "var(--cream)", fontFamily: "var(--font-display)" }}>
              Publiceer naar Recent Werk
            </div>
            <div className="px-4 py-4 space-y-4">
              <p className="text-sm" style={{ lineHeight: 1.55 }}>
                Er wordt een <strong>concept-publicatie</strong> aangemaakt met een kopie van alle foto's en
                update-teksten van dit project. Het origineel van de klant blijft onaangetast — latere
                wijzigingen aan de publicatie raken het klantdossier niet.
              </p>
              <label className="flex items-start gap-3 text-sm" style={{ lineHeight: 1.5 }}>
                <input
                  type="checkbox" checked={publishConsent}
                  onChange={(e) => setPublishConsent(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>De klant gaf toestemming om dit project publiek te tonen.</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPublishOpen(false)} disabled={publishing} aria-busy={publishing} className="btn-y">Annuleer</button>
                <button
                  onClick={confirmPublishToRecentWork}
                  disabled={!publishConsent || publishing}
                  aria-busy={publishing}
                  className="btn-y-solid"
                >
                  {publishing ? "Bezig…" : "Maak concept"}
                </button>
              </div>
            </div>
          </div>
        </div>
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

function SortablePhaseItem({
  phase, phaseUpdates, photos, signedUrls, reactions,
  onRename, onDelete, onSetStatus, onDeleteUpdate, onDeletePhoto, onAddPhotos,
}: {
  phase: Phase;
  phaseUpdates: Update[];
  photos: Photo[];
  signedUrls: Record<string, string>;
  reactions: Map<string, ReactionView[]>;
  onRename: () => void;
  onDelete: () => void;
  onSetStatus: (s: Phase["status"]) => void;
  onDeleteUpdate: (u: Update) => void;
  onDeletePhoto: (ph: Photo) => void;
  onAddPhotos: (u: Update, files: File[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: phase.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    border: "1px solid var(--charcoal)",
    background: "var(--cream)",
    opacity: isDragging ? 0.7 : 1,
    boxShadow: isDragging ? "0 10px 24px rgba(0,0,0,0.18)" : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  };
  return (
    <li ref={setNodeRef} style={style}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: "var(--cream-deep)" }}>
        <button
          type="button"
          aria-label="Versleep fase"
          {...attributes}
          {...listeners}
          className="text-base"
          style={{ color: "var(--charcoal-soft)", width: "1.5rem", cursor: "grab", touchAction: "none" }}
        >≡</button>
        <div className="flex-1 min-w-0">
          <button onClick={onRename} className="text-left truncate" style={{ fontFamily: "var(--font-display)", fontSize: "1rem" }}>
            {phase.name}
          </button>
        </div>
        <button onClick={onDelete} className="px-2 py-1 text-xs" style={{ color: "var(--oxide)" }}>✕</button>
      </div>
      <div className="flex gap-1 px-3 py-2 border-t" style={{ borderColor: "var(--charcoal)" }}>
        {(["pending", "active", "done"] as const).map((s) => (
          <button
            key={s}
            onClick={() => onSetStatus(s)}
            className="text-[10px] tracking-[0.15em] uppercase px-2 py-1"
            style={{
              border: "1px solid var(--charcoal)",
              background: phase.status === s ? "var(--brass)" : "transparent",
              color: phase.status === s ? "var(--cream)" : "var(--charcoal)",
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
                  <button onClick={() => onDeleteUpdate(u)} className="text-xs" style={{ color: "var(--oxide)" }}>✕</button>
                </div>
                <div className="text-[10px] uppercase tracking-[0.15em] mt-1" style={{ color: "var(--charcoal-soft)" }}>
                  {new Date(u.created_at).toLocaleString("nl-BE")}
                </div>
                {ups.length > 0 && (
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {ups.map((ph) => (
                      <div key={ph.id} className="relative group">
                        <a
                          href={signedUrls[ph.storage_path]}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Foto openen"
                        >
                          <img
                            src={signedUrls[ph.storage_path]}
                            alt=""
                            className="w-full block"
                            style={{ aspectRatio: "1/1", objectFit: "cover", border: "1px solid var(--charcoal)", cursor: "zoom-in" }}
                          />
                        </a>
                        <button
                          type="button"
                          aria-label="Foto verwijderen"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeletePhoto(ph); }}
                          className="absolute top-1 right-1 text-xs leading-none"
                          style={{
                            width: "1.4rem", height: "1.4rem",
                            background: "rgba(34,31,27,0.78)", color: "var(--cream)",
                            border: "1px solid var(--brass)",
                          }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <label
                  className="inline-block mt-2 text-[10px] uppercase tracking-[0.18em] px-2 py-1.5 cursor-pointer"
                  style={{ color: "var(--brass)", border: "1px solid var(--brass)" }}
                >
                  + Foto's toevoegen
                  <input
                    type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => {
                      const picked = e.target.files ? Array.from(e.target.files) : [];
                      e.target.value = "";
                      onAddPhotos(u, picked);
                    }}
                  />
                </label>
                <ReactionThread
                  updateId={u.id}
                  initial={reactions.get(u.id) ?? []}
                  canDelete
                  placeholder="Antwoord als Yeketi…"
                />
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function NewUpdateModal({
  projectId, phases, defaultPhaseId, onClose, onSaved,
}: { projectId: string; phases: { id: string; name: string }[]; defaultPhaseId: string; onClose: () => void; onSaved: () => void }) {
  const [phaseId, setPhaseId] = useState(defaultPhaseId);
  const [body, setBody] = useState("");
  type FileItem = {
    file: File;
    previewUrl: string;
    status: "pending" | "uploading" | "done" | "error";
    error?: string;
  };
  const [items, setItems] = useState<FileItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [updateId, setUpdateId] = useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      status: "pending" as const,
    }));
    setItems((prev) => [...prev, ...next]);
  }

  // Revoke object URLs on unmount to prevent leaks
  useEffect(() => {
    return () => {
      setItems((prev) => {
        prev.forEach((it) => {
          try { URL.revokeObjectURL(it.previewUrl); } catch { /* ignore */ }
        });
        return prev;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeItem(index: number) {
    setItems((prev) => {
      const target = prev[index];
      if (target) {
        try { URL.revokeObjectURL(target.previewUrl); } catch { /* ignore */ }
      }
      return prev.filter((_, j) => j !== index);
    });
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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 overflow-y-auto" style={{ background: "rgba(34,31,27,0.6)" }}>
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
            <button onClick={submit} disabled={busy} aria-busy={busy} className="btn-y-solid w-full">
              {busy ? "Versturen…" : "Publiceer update"}
            </button>
          )}
          {published && failedCount > 0 && (
            <button onClick={retryFailed} disabled={busy} aria-busy={busy} className="btn-y-solid w-full">
              {busy ? "Bezig…" : `Probeer ${failedCount} mislukte opnieuw`}
            </button>
          )}
          {published && (
            <button onClick={finish} disabled={busy} aria-busy={busy} className="btn-y w-full">
              {allDone || failedCount === 0 ? "Klaar" : "Sluiten — mislukte foto's overslaan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}