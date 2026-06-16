import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { ConfirmModal } from "@/components/AdminModals";
import { supabase } from "@/integrations/supabase/client";
import { isExternalPhoto, RECENT_WORK_BUCKET } from "@/lib/recent-work";
import { deletePublication as deletePublicationFn } from "@/lib/recent-work.functions";

export const Route = createFileRoute("/_authenticated/admin/recent-werk/")({
  head: () => ({ meta: [{ title: "Recent Werk — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminRecentWerk,
});

type Pub = {
  id: string; title: string; subtitle: string | null;
  vehicle_label: string | null; year_label: string | null;
  status: "draft" | "published";
  sort_order: number;
  cover_photo_path: string | null;
  updated_at: string;
};

function AdminRecentWerk() {
  const navigate = useNavigate();
  const deletePub = useServerFn(deletePublicationFn);
  const [pubs, setPubs] = useState<Pub[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Pub | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("recent_work_publications")
      .select("id, title, subtitle, vehicle_label, year_label, status, sort_order, cover_photo_path, updated_at")
      .order("sort_order");
    if (error) { toast.error("Laden mislukt", { description: error.message }); return; }
    const list = (data as Pub[] | null) ?? [];
    setPubs(list);
    const storagePaths = list
      .map((p) => p.cover_photo_path)
      .filter((x): x is string => !!x && !isExternalPhoto(x));
    if (storagePaths.length) {
      const { data: signed } = await supabase.storage
        .from(RECENT_WORK_BUCKET).createSignedUrls(storagePaths, 3600);
      const m: Record<string, string> = {};
      (signed ?? []).forEach((s, i) => { if (s.signedUrl) m[storagePaths[i]] = s.signedUrl; });
      setUrls(m);
    }
  }

  useEffect(() => { load(); }, []);

  async function createDraft() {
    setCreating(true);
    try {
      const next = (pubs?.length ?? 0);
      const { data, error } = await supabase
        .from("recent_work_publications")
        .insert({ title: "Nieuwe publicatie", status: "draft", sort_order: next })
        .select("id").maybeSingle();
      if (error || !data) throw error ?? new Error("Aanmaken mislukt");
      toast.success("Publicatie aangemaakt");
      navigate({ to: "/admin/recent-werk/$id", params: { id: data.id } });
    } catch (e) {
      toast.error("Aanmaken mislukt", { description: (e as Error).message });
    } finally { setCreating(false); }
  }

  async function move(p: Pub, dir: -1 | 1) {
    if (!pubs) return;
    const idx = pubs.findIndex((x) => x.id === p.id);
    const neighbor = pubs[idx + dir];
    if (!neighbor) return;
    const results = await Promise.all([
      supabase.from("recent_work_publications").update({ sort_order: neighbor.sort_order }).eq("id", p.id),
      supabase.from("recent_work_publications").update({ sort_order: p.sort_order }).eq("id", neighbor.id),
    ]);
    const err = results.find((r) => r.error)?.error;
    if (err) { toast.error("Herschikken mislukt", { description: err.message }); return; }
    load();
  }

  async function togglePublish(p: Pub) {
    const next = p.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("recent_work_publications").update({ status: next }).eq("id", p.id);
    if (error) { toast.error("Status wijzigen mislukt", { description: error.message }); return; }
    toast.success(next === "published" ? "Gepubliceerd" : "Teruggezet naar concept");
    load();
  }

  return (
    <AdminShell title="Recent Werk">
      <section className="container-edit pb-3">
        <div className="flex items-center justify-between mb-3 gap-3">
          <p className="text-xs" style={{ color: "var(--charcoal-soft)" }}>
            {pubs ? `${pubs.length} publicatie${pubs.length === 1 ? "" : "s"}` : "Laden…"} · Volgorde bepaalt de wand.
          </p>
          <button onClick={createDraft} disabled={creating} aria-busy={creating} className="btn-y-solid" style={{ paddingBlock: "0.55rem" }}>
            {creating ? "Aanmaken…" : "+ Nieuwe publicatie"}
          </button>
        </div>
      </section>

      <section className="container-edit pb-12">
        {pubs === null && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-label="Laden">
            {[0,1,2].map((i) => <li key={i} className="skeleton-y" style={{ height: 220 }} />)}
          </ul>
        )}
        {pubs && pubs.length === 0 && (
          <div
            className="px-4 py-8 text-center"
            style={{ border: "1px dashed var(--brass)", background: "var(--cream)", color: "var(--charcoal-soft)" }}
          >
            <p className="eyebrow" style={{ color: "var(--brass)" }}>Nog leeg</p>
            <p className="mt-3 text-sm">Nog geen publicaties — maak je eerste showcase.</p>
            <button onClick={createDraft} className="btn-y-solid mt-5">+ Nieuwe publicatie</button>
          </div>
        )}
        {pubs && pubs.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pubs.map((p, idx) => {
              const cover = p.cover_photo_path
                ? (isExternalPhoto(p.cover_photo_path) ? p.cover_photo_path : urls[p.cover_photo_path])
                : null;
              return (
                <li key={p.id} style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}>
                  <Link to="/admin/recent-werk/$id" params={{ id: p.id }} className="block">
                    <div
                      style={{
                        aspectRatio: "4/5",
                        background: cover ? `center/cover url(${cover})` : "var(--charcoal)",
                        color: "var(--gold)", display: "grid", placeItems: "center",
                        fontFamily: "var(--font-display)", fontSize: "2rem", position: "relative",
                      }}
                    >
                      {!cover && (p.title[0] ?? "·")}
                      <span
                        className="text-[10px] tracking-[0.15em] uppercase px-2 py-1 absolute top-2 left-2"
                        style={{
                          background: p.status === "published" ? "var(--brass)" : "var(--cream-deep)",
                          color: p.status === "published" ? "var(--cream)" : "var(--charcoal-soft)",
                        }}
                      >
                        {p.status === "published" ? "Gepubliceerd" : "Concept"}
                      </span>
                    </div>
                  </Link>
                  <div className="px-3 py-3">
                    <div className="truncate" style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>
                      {p.title || "Zonder titel"}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--charcoal-soft)" }}>
                      {[p.vehicle_label, p.year_label].filter(Boolean).join(" · ") || "—"}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => move(p, -1)} disabled={idx === 0} className="px-2 py-1 text-xs disabled:opacity-30" aria-label="Omhoog">↑</button>
                        <button onClick={() => move(p, 1)} disabled={idx === pubs.length - 1} className="px-2 py-1 text-xs disabled:opacity-30" aria-label="Omlaag">↓</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => togglePublish(p)} className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--brass)" }}>
                          {p.status === "published" ? "Verberg" : "Publiceer"}
                        </button>
                        <button onClick={() => setConfirmDel(p)} className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--oxide)" }}>
                          Wissen
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={confirmDel !== null}
        title="Publicatie verwijderen"
        message={`"${confirmDel?.title ?? ""}" verwijderen? Alle foto's worden uit de wand én uit de opslag verwijderd.`}
        destructive
        confirmLabel="Verwijder"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await deletePub({ data: { publicationId: confirmDel.id } });
            toast.success("Publicatie verwijderd");
            load();
          } catch (e) {
            toast.error("Verwijderen mislukt", { description: (e as Error).message });
          }
        }}
        onClose={() => setConfirmDel(null)}
      />
    </AdminShell>
  );
}