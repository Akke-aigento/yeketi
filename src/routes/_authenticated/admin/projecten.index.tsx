import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminShell, statusBadge, timeAgo } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { t } from "@/lib/copy";
import { inviteCustomer as inviteCustomerFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/projecten/")({
  head: () => ({ meta: [{ title: "Projecten — Admin" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    neu: search.neu === 1 || search.neu === "1" ? 1 : undefined,
  }),
  component: ProjectenIndex,
});

type Row = {
  id: string; title: string;
  status: keyof typeof t.portal.statusLabels;
  vehicle_make: string | null; vehicle_model: string | null; vehicle_year: string | null;
  customer_id: string; updated_at: string; cover_photo_url: string | null;
};
type Customer = { id: string; full_name: string | null; email: string | null };

const STATUS_ORDER: (keyof typeof t.portal.statusLabels)[] = [
  "intake", "transport_out", "in_workshop", "transport_return", "delivered", "archived",
];

const DEFAULT_PHASES = [
  "Inspectie", "Transport heen", "Plaatwerk", "Lak & afwerking",
  "Mechaniek", "Transport terug", "Aflevering",
];

function ProjectenIndex() {
  const navigate = useNavigate();
  const routeSearch = Route.useSearch();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [lastUpdateByProject, setLastUpdateByProject] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | keyof typeof t.portal.statusLabels>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (routeSearch.neu === 1) {
      setShowNew(true);
      navigate({ to: "/admin/projecten", search: {}, replace: true });
    }
  }, [routeSearch.neu, navigate]);

  useEffect(() => {
    let active = true;
    (async () => {
      setError(null);
      const { data: projs, error: pe } = await supabase
        .from("projects")
        .select("id, title, status, vehicle_make, vehicle_model, vehicle_year, customer_id, updated_at, cover_photo_url")
        .order("updated_at", { ascending: false });
      if (!active) return;
      if (pe) { setError(pe.message); return; }
      const list = (projs as Row[] | null) ?? [];
      setRows(list);
      const customerIds = Array.from(new Set(list.map((r) => r.customer_id)));
      if (customerIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles").select("id, full_name, email").in("id", customerIds);
        if (!active) return;
        const map: Record<string, Customer> = {};
        (profs as Customer[] | null)?.forEach((c) => { map[c.id] = c; });
        setCustomers(map);
      }
      const coverPaths = list.map((r) => r.cover_photo_url).filter((x): x is string => !!x);
      if (coverPaths.length > 0) {
        const { data: signed } = await supabase.storage
          .from("project-photos").createSignedUrls(coverPaths, 3600);
        const map: Record<string, string> = {};
        (signed ?? []).forEach((s, i) => { if (s.signedUrl) map[coverPaths[i]] = s.signedUrl; });
        if (active) setSignedUrls(map);
      }
      const projectIds = list.map((r) => r.id);
      if (projectIds.length > 0) {
        const { data: phases } = await supabase
          .from("project_phases").select("id, project_id").in("project_id", projectIds);
        const phaseToProject = new Map<string, string>();
        (phases ?? []).forEach((p: { id: string; project_id: string }) => phaseToProject.set(p.id, p.project_id));
        const phaseIds = (phases ?? []).map((p: { id: string }) => p.id);
        if (phaseIds.length > 0) {
          const { data: updates } = await supabase
            .from("phase_updates").select("phase_id, created_at")
            .in("phase_id", phaseIds).order("created_at", { ascending: false });
          const lastBy: Record<string, string> = {};
          (updates ?? []).forEach((u: { phase_id: string; created_at: string }) => {
            const pid = phaseToProject.get(u.phase_id);
            if (pid && !lastBy[pid]) lastBy[pid] = u.created_at;
          });
          if (active) setLastUpdateByProject(lastBy);
        }
      }
    })();
    return () => { active = false; };
  }, [nonce]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      const c = customers[r.customer_id];
      const hay = [r.title, r.vehicle_make, r.vehicle_model, r.vehicle_year, c?.full_name, c?.email]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, customers, filter, search]);

  return (
    <AdminShell title="Projecten">
      <section className="container-edit pb-3">
        <div className="flex items-center justify-between mb-3 gap-3">
          <p className="text-xs" style={{ color: "var(--charcoal-soft)" }}>
            {rows ? `${rows.length} project${rows.length === 1 ? "" : "en"}` : "Laden…"}
          </p>
          <button onClick={() => setShowNew(true)} className="btn-y-solid" style={{ paddingBlock: "0.55rem" }}>
            + Nieuw project
          </button>
        </div>
        <input
          className="field-y"
          placeholder="Zoek op voertuig of klant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1 py-2 mt-2">
          {(["all", ...STATUS_ORDER] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className="text-[11px] tracking-[0.18em] uppercase px-3 py-2 whitespace-nowrap"
              style={{
                border: "1px solid var(--charcoal)",
                background: filter === s ? "var(--charcoal)" : "transparent",
                color: filter === s ? "var(--gold)" : "var(--charcoal)",
              }}
            >
              {s === "all" ? "Alles" : t.portal.statusLabels[s]}
            </button>
          ))}
        </div>
      </section>

      <section className="container-edit pb-12">
        {error && (
          <div className="text-sm" style={{ color: "var(--oxide)" }}>
            Laden mislukt: {error}
            <button onClick={() => setNonce((n) => n + 1)} className="btn-y-solid mt-3">Opnieuw proberen</button>
          </div>
        )}
        {rows === null && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-label="Laden">
            {[0,1,2,3,4,5].map((i) => (
              <li key={i} className="skeleton-y" style={{ height: "220px", border: "1px solid var(--charcoal)" }} />
            ))}
          </ul>
        )}
        {rows && filtered.length === 0 && (
          <div
            className="px-4 py-6 text-sm text-center"
            style={{ border: "1px dashed var(--brass)", background: "var(--cream)", color: "var(--charcoal-soft)" }}
          >
            {rows.length === 0
              ? "Nog geen projecten. Tik op + Nieuw project om er één te starten."
              : "Geen project past bij deze filter."}
          </div>
        )}
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => {
            const b = statusBadge(r.status);
            const c = customers[r.customer_id];
            const voertuig = [r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ");
            const cover = r.cover_photo_url ? signedUrls[r.cover_photo_url] : null;
            const last = lastUpdateByProject[r.id] ?? r.updated_at;
            const days = Math.floor((Date.now() - new Date(last).getTime()) / (24 * 3600 * 1000));
            const isStale = days >= 7 && r.status !== "delivered" && r.status !== "archived";
            return (
              <li key={r.id}>
                <Link
                  to="/admin/projecten/$id"
                  params={{ id: r.id }}
                  className="group block"
                  style={{ border: "1px solid " + (isStale ? "var(--oxide)" : "var(--charcoal)"), background: "var(--cream-deep)" }}
                >
                  <div
                    style={{
                      aspectRatio: "16/10",
                      background: cover ? `center/cover url(${cover})` : "var(--charcoal)",
                      color: "var(--gold)",
                      display: "grid", placeItems: "center",
                      fontFamily: "var(--font-display)", fontSize: "2rem",
                      position: "relative",
                    }}
                  >
                    {!cover && (r.vehicle_make?.[0] ?? r.title[0] ?? "·")}
                    <span
                      className="text-[10px] tracking-[0.15em] uppercase px-2 py-1 whitespace-nowrap absolute top-2 left-2"
                      style={{ background: b.bg, color: b.fg }}
                    >
                      {t.portal.statusLabels[r.status] ?? r.status}
                    </span>
                    <span
                      className="text-[10px] tracking-[0.15em] uppercase px-2 py-1 whitespace-nowrap absolute top-2 right-2 transition-opacity opacity-0 group-hover:opacity-100"
                      style={{ background: "var(--brass)", color: "var(--cream)" }}
                    >
                      + Update
                    </span>
                  </div>
                  <div className="px-3 py-3">
                    <div className="truncate" style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>
                      {r.title}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--charcoal-soft)" }}>
                      {voertuig || "—"} · {c?.full_name ?? c?.email ?? "—"}
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: isStale ? "var(--oxide)" : "var(--charcoal-soft)" }}>
                      {isStale ? `${days} dagen stil` : `update ${timeAgo(last)} geleden`}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {showNew && (
        <NewProjectModal
          onClose={() => setShowNew(false)}
          onCreated={(projectId) => {
            setShowNew(false);
            navigate({ to: "/admin/projecten/$id", params: { id: projectId } });
          }}
        />
      )}
    </AdminShell>
  );
}

// ---------------------------------------------------------------------------
// New project modal
// ---------------------------------------------------------------------------

type CustomerOpt = { id: string; full_name: string | null; email: string | null };

function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const inviteCustomer = useServerFn(inviteCustomerFn);
  const [allCustomers, setAllCustomers] = useState<CustomerOpt[]>([]);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState("");
  const [custQuery, setCustQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("id, full_name, email").order("full_name").then(({ data }) => {
      setAllCustomers((data as CustomerOpt[] | null) ?? []);
    });
  }, []);

  const suggestedTitle = useMemo(() => [make, model, year].filter(Boolean).join(" "), [make, model, year]);

  const filteredCustomers = useMemo(() => {
    const q = custQuery.trim().toLowerCase();
    if (!q) return allCustomers.slice(0, 8);
    return allCustomers
      .filter((c) => `${c.full_name ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allCustomers, custQuery]);

  async function submit() {
    setBusy(true);
    try {
      let cid = customerId;
      if (mode === "new") {
        if (!newEmail.trim()) throw new Error("E-mail klant is verplicht.");
        const res = await inviteCustomer({
          data: { email: newEmail.trim(), full_name: newName.trim() || undefined, phone: newPhone.trim() || undefined },
        });
        cid = res.userId;
      }
      if (!cid) throw new Error("Kies een klant of vul de gegevens in.");
      const finalTitle = (title.trim() || suggestedTitle).trim();
      if (!finalTitle) throw new Error("Geef het project een titel of vul merk/model in.");

      const { data: project, error: pe } = await supabase.from("projects").insert({
        customer_id: cid,
        title: finalTitle,
        vehicle_make: make.trim() || null,
        vehicle_model: model.trim() || null,
        vehicle_year: year.trim() || null,
        status: "intake",
      }).select("id").maybeSingle();
      if (pe || !project) throw pe ?? new Error("Project niet aangemaakt");

      const phaseRows = DEFAULT_PHASES.map((name, i) => ({
        project_id: project.id, name, sort_order: i,
        status: (i === 0 ? "active" : "pending") as "active" | "pending",
        started_at: i === 0 ? new Date().toISOString() : null,
      }));
      const { error: phe } = await supabase.from("project_phases").insert(phaseRows);
      if (phe) throw phe;

      if (cover) {
        try {
          const blob = await compressImage(cover);
          const path = `${project.id}/cover/${Date.now()}.jpg`;
          const up = await supabase.storage.from("project-photos").upload(path, blob, {
            contentType: "image/jpeg", upsert: false,
          });
          if (!up.error) {
            await supabase.from("projects").update({ cover_photo_url: path }).eq("id", project.id);
          }
        } catch {
          toast.message("Project aangemaakt — cover foto kon niet geüpload worden.");
        }
      }

      toast.success("Project aangemaakt");
      onCreated(project.id);
    } catch (e) {
      toast.error("Aanmaken mislukt", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(34,31,27,0.6)" }}>
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" style={{ background: "var(--cream)", border: "1px solid var(--charcoal)" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--charcoal)", color: "var(--cream)" }}>
          <span style={{ fontFamily: "var(--font-display)" }}>Nieuw project</span>
          <button onClick={onClose} style={{ color: "var(--gold)" }}>✕</button>
        </div>
        <div className="px-4 py-4 space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "var(--charcoal-soft)" }}>Klant</div>
            <div className="flex gap-1 mb-2">
              {(["existing", "new"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="text-[11px] uppercase tracking-[0.15em] px-3 py-1.5 flex-1"
                  style={{
                    border: "1px solid var(--charcoal)",
                    background: mode === m ? "var(--charcoal)" : "transparent",
                    color: mode === m ? "var(--gold)" : "var(--charcoal)",
                  }}
                >
                  {m === "existing" ? "Bestaande klant" : "Nieuwe klant"}
                </button>
              ))}
            </div>
            {mode === "existing" ? (
              <>
                <input className="field-y" placeholder="Zoek klant…" value={custQuery} onChange={(e) => setCustQuery(e.target.value)} />
                <ul className="mt-2 max-h-48 overflow-y-auto" style={{ border: "1px solid var(--cream-deep)" }}>
                  {filteredCustomers.length === 0 && (
                    <li className="px-3 py-2 text-xs" style={{ color: "var(--charcoal-soft)" }}>Geen klant gevonden.</li>
                  )}
                  {filteredCustomers.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setCustomerId(c.id)}
                        className="w-full text-left px-3 py-2 text-sm"
                        style={{
                          background: customerId === c.id ? "var(--cream-deep)" : "transparent",
                          borderLeft: "3px solid " + (customerId === c.id ? "var(--brass)" : "transparent"),
                        }}
                      >
                        <div>{c.full_name ?? c.email}</div>
                        {c.full_name && c.email && (
                          <div className="text-[11px]" style={{ color: "var(--charcoal-soft)" }}>{c.email}</div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                <input className="field-y" placeholder="Naam" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input className="field-y" placeholder="E-mail (verplicht)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                <input className="field-y" placeholder="Telefoon (optioneel)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                <p className="text-[11px]" style={{ color: "var(--charcoal-soft)" }}>
                  Klant krijgt automatisch een uitnodiging om in zijn portaal te kijken.
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "var(--charcoal-soft)" }}>Voertuig</div>
            <div className="grid grid-cols-3 gap-2">
              <input className="field-y" placeholder="Merk" value={make} onChange={(e) => setMake(e.target.value)} />
              <input className="field-y" placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
              <input className="field-y" placeholder="Jaar" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
          </div>

          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>Titel</span>
            <input className="field-y" placeholder={suggestedTitle || "Bv. VW T2 restauratie"} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "var(--charcoal-soft)" }}>Cover foto (optioneel)</div>
            <label className="btn-y text-center cursor-pointer block">
              {cover ? cover.name : "Kies foto…"}
              <input
                type="file" accept="image/*" className="hidden"
                onChange={(e) => setCover(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <button onClick={submit} disabled={busy} className="btn-y-solid w-full">
            {busy ? "Aanmaken…" : "Project aanmaken"}
          </button>
        </div>
      </div>
    </div>
  );
}