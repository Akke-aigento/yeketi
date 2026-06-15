import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell, statusBadge, timeAgo } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/copy";

export const Route = createFileRoute("/_authenticated/admin/projecten/")({
  head: () => ({ meta: [{ title: "Projecten — Admin" }, { name: "robots", content: "noindex" }] }),
  component: ProjectenIndex,
});

type Row = {
  id: string; title: string;
  status: keyof typeof t.portal.statusLabels;
  vehicle_make: string | null; vehicle_model: string | null; vehicle_year: string | null;
  customer_id: string; updated_at: string;
};
type Customer = { id: string; full_name: string | null; email: string | null };

const STATUS_ORDER: (keyof typeof t.portal.statusLabels)[] = [
  "intake", "transport_out", "in_workshop", "transport_return", "delivered", "archived",
];

function ProjectenIndex() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [filter, setFilter] = useState<"all" | keyof typeof t.portal.statusLabels>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: projs } = await supabase
        .from("projects")
        .select("id, title, status, vehicle_make, vehicle_model, vehicle_year, customer_id, updated_at")
        .order("updated_at", { ascending: false });
      if (!active) return;
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
    })();
    return () => { active = false; };
  }, []);

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
        {rows === null && (
          <ul className="space-y-2" aria-label="Laden">
            {[0,1,2,3].map((i) => (
              <li key={i} className="skeleton-y" style={{ height: "62px", border: "1px solid var(--charcoal)" }} />
            ))}
          </ul>
        )}
        {rows && filtered.length === 0 && (
          <p className="text-sm" style={{ color: "var(--charcoal-soft)" }}>Geen projecten gevonden.</p>
        )}
        <ul className="space-y-2">
          {filtered.map((r) => {
            const b = statusBadge(r.status);
            const c = customers[r.customer_id];
            const voertuig = [r.vehicle_make, r.vehicle_model].filter(Boolean).join(" ");
            return (
              <li key={r.id}>
                <Link
                  to="/admin/projecten/$id"
                  params={{ id: r.id }}
                  className="flex items-center justify-between gap-3 px-3 py-3"
                  style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}
                >
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>
                      {r.title}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--charcoal-soft)" }}>
                      {voertuig || "—"} · {c?.full_name ?? c?.email ?? "—"} · {timeAgo(r.updated_at)} geleden
                    </div>
                  </div>
                  <span
                    className="text-[10px] tracking-[0.15em] uppercase px-2 py-1 whitespace-nowrap"
                    style={{ background: b.bg, color: b.fg }}
                  >
                    {t.portal.statusLabels[r.status] ?? r.status}
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