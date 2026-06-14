import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell, statusBadge, timeAgo } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/copy";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Yeketi" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

type ProjectRow = {
  id: string; title: string; status: string; updated_at: string; created_at: string;
  vehicle_make: string | null; vehicle_model: string | null; customer_id: string;
};

function Dashboard() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [newQuotes, setNewQuotes] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [p, q] = await Promise.all([
        supabase.from("projects").select("id, title, status, updated_at, created_at, vehicle_make, vehicle_model, customer_id"),
        supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
      ]);
      if (!active) return;
      const rows = (p.data ?? []).filter((r) => r.status !== "archived" && r.status !== "delivered");
      rows.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
      setProjects(rows as ProjectRow[]);
      setNewQuotes(q.count ?? 0);
    })();
    return () => { active = false; };
  }, []);

  return (
    <AdminShell title="Vandaag">
      <section className="container-edit" style={{ paddingBottom: "2rem" }}>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Stat label="Actieve projecten" value={projects?.length} accent="var(--brass)" />
          <Link to="/admin/offertes" className="block">
            <Stat label="Nieuwe offertes" value={newQuotes} accent="var(--oxide)" />
          </Link>
        </div>

        <h2 className="mt-8" style={{ fontSize: "1.1rem" }}>Projecten — oudste update eerst</h2>
        <p className="text-xs mt-1" style={{ color: "var(--charcoal-soft)" }}>
          Zo gaat niets in de werkplaats vergeten worden.
        </p>
        <ul className="mt-4 space-y-2">
          {projects === null && <li className="eyebrow" style={{ color: "var(--charcoal-soft)" }}>Laden…</li>}
          {projects && projects.length === 0 && (
            <li className="text-sm" style={{ color: "var(--charcoal-soft)" }}>Geen actieve projecten.</li>
          )}
          {projects?.map((p) => {
            const b = statusBadge(p.status);
            return (
              <li key={p.id}>
                <Link
                  to="/admin/projecten/$id"
                  params={{ id: p.id }}
                  className="flex items-center justify-between gap-3 px-3 py-3"
                  style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}
                >
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>
                      {p.title}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--charcoal-soft)" }}>
                      {[p.vehicle_make, p.vehicle_model].filter(Boolean).join(" ")} · update {timeAgo(p.updated_at)} geleden
                    </div>
                  </div>
                  <span
                    className="text-[10px] tracking-[0.15em] uppercase px-2 py-1 whitespace-nowrap"
                    style={{ background: b.bg, color: b.fg }}
                  >
                    {t.portal.statusLabels[p.status as keyof typeof t.portal.statusLabels] ?? p.status}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </AdminShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | null | undefined; accent: string }) {
  return (
    <div className="px-4 py-4" style={{ border: "1px solid var(--charcoal)", background: "var(--cream)" }}>
      <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--charcoal-soft)" }}>{label}</div>
      <div className="mt-2" style={{ fontFamily: "var(--font-display)", fontSize: "2rem", color: accent }}>
        {value ?? "—"}
      </div>
    </div>
  );
}