import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell, timeAgo } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createBlankQuote } from "@/lib/quotes.functions";
import { toast } from "sonner";
import {
  derivePhase, PHASE_ORDER, PHASE_LABEL, PHASE_BADGE,
  type Phase, type RequestStatus, type QuoteStatus,
} from "@/lib/pipeline";
import { useAdminRefreshKey } from "@/hooks/useAdminRefresh";

export const Route = createFileRoute("/_authenticated/admin/aanvragen/")({
  head: () => ({ meta: [{ title: "Aanvragen — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AanvragenIndex,
});

type Request = {
  id: string; naam: string; email: string;
  merk: string | null; model: string | null; bouwjaar: string | null;
  type_werk: string; status: RequestStatus; created_at: string;
};
type QuoteRow = {
  id: string; quote_number: string | null; status: QuoteStatus;
  total_amount: number; customer_id: string | null;
  quote_request_id: string | null; created_at: string; title: string;
  vehicle_label: string;
};
type ProjectRow = { id: string; customer_id: string | null };
type Profile = { id: string; full_name: string | null; email: string };

type Entry = {
  key: string;
  kind: "request" | "orphan-quote";
  requestId?: string;
  quoteId?: string;
  naam: string;
  email: string | null;
  voertuig: string;
  created_at: string;
  phase: Phase;
  quote?: { id: string; quote_number: string | null; status: QuoteStatus; total: number };
  projectId?: string;
};

function eur(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);
}

function AanvragenIndex() {
  const navigate = useNavigate();
  const refreshKey = useAdminRefreshKey();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [filter, setFilter] = useState<Phase | "all">("nieuw");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const createBlank = useServerFn(createBlankQuote);

  async function load() {
    const [reqRes, qRes, projRes] = await Promise.all([
      supabase.from("quote_requests")
        .select("id, naam, email, merk, model, bouwjaar, type_werk, status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("quotes")
        .select("id, quote_number, status, total_amount, customer_id, quote_request_id, created_at, title, vehicle_label")
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id, customer_id"),
    ]);
    const requests = (reqRes.data as Request[] | null) ?? [];
    const quotes = (qRes.data as QuoteRow[] | null) ?? [];
    const projects = (projRes.data as ProjectRow[] | null) ?? [];

    // Profiles for orphan quotes that have a customer.
    const orphanCustomerIds = Array.from(new Set(
      quotes.filter((q) => !q.quote_request_id && q.customer_id).map((q) => q.customer_id!)
    ));
    let profiles: Record<string, Profile> = {};
    if (orphanCustomerIds.length > 0) {
      const { data } = await supabase.from("profiles")
        .select("id, full_name, email").in("id", orphanCustomerIds);
      profiles = Object.fromEntries(((data as Profile[] | null) ?? []).map((p) => [p.id, p]));
    }

    // Index quotes by request id; pick newest per request.
    const quotesByRequest = new Map<string, QuoteRow>();
    for (const q of quotes) {
      if (!q.quote_request_id) continue;
      if (!quotesByRequest.has(q.quote_request_id)) quotesByRequest.set(q.quote_request_id, q);
    }
    // Project lookup by customer_id (won-requests get projects keyed on the lead's customer).
    const projectByCustomer = new Map<string, string>();
    for (const p of projects) if (p.customer_id) projectByCustomer.set(p.customer_id, p.id);

    const out: Entry[] = [];

    // 1. Requests
    for (const r of requests) {
      const q = quotesByRequest.get(r.id);
      // Find project via customer email (we don't store customer_id on request).
      // We'll resolve later via the quote's customer_id; for requests without a
      // quote yet we don't try — keeps the join cheap.
      let projectId: string | undefined;
      if (q?.customer_id) projectId = projectByCustomer.get(q.customer_id);
      const phase = derivePhase({
        requestStatus: r.status,
        quotes: q ? [{ status: q.status }] : [],
        hasProject: !!projectId,
      });
      const voertuig = [r.merk, r.model, r.bouwjaar].filter(Boolean).join(" ") || r.type_werk;
      out.push({
        key: `r:${r.id}`,
        kind: "request",
        requestId: r.id,
        naam: r.naam,
        email: r.email,
        voertuig,
        created_at: r.created_at,
        phase,
        quote: q ? { id: q.id, quote_number: q.quote_number, status: q.status, total: Number(q.total_amount) } : undefined,
        projectId,
      });
    }

    // 2. Orphan quotes (created via "+ Snelle offerte", no aanvraag)
    for (const q of quotes) {
      if (q.quote_request_id) continue;
      const prof = q.customer_id ? profiles[q.customer_id] : null;
      const naam = prof?.full_name ?? prof?.email ?? q.title ?? "Losse offerte";
      const projectId = q.customer_id ? projectByCustomer.get(q.customer_id) : undefined;
      const phase = derivePhase({ quotes: [{ status: q.status }], hasProject: !!projectId });
      out.push({
        key: `q:${q.id}`,
        kind: "orphan-quote",
        quoteId: q.id,
        naam,
        email: prof?.email ?? null,
        voertuig: q.vehicle_label || "",
        created_at: q.created_at,
        phase,
        quote: { id: q.id, quote_number: q.quote_number, status: q.status, total: Number(q.total_amount) },
        projectId,
      });
    }

    setEntries(out);
  }
  useEffect(() => { load(); }, [refreshKey]);

  const counts = useMemo(() => {
    const c: Record<Phase | "all", number> = { all: 0, nieuw: 0, gesprek: 0, offerte: 0, akkoord: 0, project: 0, verloren: 0 };
    for (const e of entries ?? []) { c[e.phase]++; c.all++; }
    return c;
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (entries ?? []).filter((e) => {
      if (filter !== "all" && e.phase !== filter) return false;
      if (!q) return true;
      return (
        e.naam.toLowerCase().includes(q) ||
        (e.email ?? "").toLowerCase().includes(q) ||
        e.voertuig.toLowerCase().includes(q) ||
        (e.quote?.quote_number ?? "").toLowerCase().includes(q)
      );
    });
  }, [entries, filter, search]);

  async function newBlank() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await createBlank({});
      toast.success("Lege offerte aangemaakt");
      navigate({ to: "/admin/quotes/$id", params: { id: res.quoteId } });
    } catch (e) {
      toast.error("Aanmaken mislukt", { description: (e as Error).message });
    } finally { setBusy(false); }
  }

  function entryHref(e: Entry): { to: "/admin/aanvragen/$id" | "/admin/quotes/$id"; params: { id: string } } {
    if (e.kind === "request") return { to: "/admin/aanvragen/$id", params: { id: e.requestId! } };
    return { to: "/admin/quotes/$id", params: { id: e.quoteId! } };
  }

  return (
    <AdminShell title="Aanvragen">
      <section className="container-edit" style={{ paddingBottom: "3rem" }}>
        <div className="flex gap-2 pt-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek op naam, e-mail, voertuig of offertenummer…"
            className="form-y flex-1"
          />
          <button onClick={newBlank} disabled={busy} aria-busy={busy} className="btn-y-solid whitespace-nowrap">
            {busy ? "…" : "+ Snelle offerte"}
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto -mx-1 px-1 py-3">
          {(["all", ...PHASE_ORDER] as const).map((s) => {
            const active = filter === s;
            const label = s === "all" ? "Alles" : PHASE_LABEL[s];
            const n = counts[s];
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="text-[11px] tracking-[0.18em] uppercase px-3 py-2 whitespace-nowrap inline-flex items-center gap-2"
                style={{
                  border: "1px solid var(--charcoal)",
                  background: active ? "var(--charcoal)" : "transparent",
                  color: active ? "var(--gold)" : "var(--charcoal)",
                }}
              >
                <span>{label}</span>
                <span
                  className="text-[10px]"
                  style={{
                    padding: "1px 6px",
                    borderRadius: 999,
                    background: active ? "var(--gold)" : "var(--cream-deep)",
                    color: active ? "var(--charcoal)" : "var(--charcoal-soft)",
                  }}
                >{n}</span>
              </button>
            );
          })}
        </div>

        {entries === null && (
          <div className="space-y-2">{[0,1,2].map((i) => <div key={i} className="skeleton-y" style={{ height: 72 }} />)}</div>
        )}
        {entries && filtered.length === 0 && (
          <div className="px-4 py-8 text-center" style={{ border: "1px dashed var(--brass)", background: "var(--cream)" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>Niets in deze fase.</p>
            <p className="mt-2 text-sm" style={{ color: "var(--charcoal-soft)" }}>
              Nieuwe aanvragen komen automatisch binnen via het formulier.
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {filtered.map((e) => {
            const b = PHASE_BADGE[e.phase];
            const href = entryHref(e);
            return (
              <li key={e.key}>
                <Link
                  to={href.to}
                  params={href.params}
                  className="block px-3 py-3"
                  style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--brass)" }}>
                        {e.quote?.quote_number ?? (e.kind === "orphan-quote" ? "Losse offerte" : "Aanvraag")}
                        {" · "}{timeAgo(e.created_at)} geleden
                      </div>
                      <div className="truncate mt-1" style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>
                        {e.naam}
                      </div>
                      <div className="text-xs truncate mt-0.5" style={{ color: "var(--charcoal-soft)" }}>
                        {e.voertuig || "—"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] tracking-[0.15em] uppercase px-2 py-1 whitespace-nowrap"
                            style={{ background: b.bg, color: b.fg }}>
                        {PHASE_LABEL[e.phase]}
                      </span>
                      {e.quote && e.quote.total > 0 && (
                        <div className="mt-2" style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", color: "var(--brass)" }}>
                          {eur(e.quote.total)}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </AdminShell>
  );
}