import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell, timeAgo } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createBlankQuote } from "@/lib/quotes.functions";
import { toast } from "sonner";
import { OffertesTabs } from "@/components/OffertesTabs";

export const Route = createFileRoute("/_authenticated/admin/quotes/")({
  head: () => ({ meta: [{ title: "Offertes — Admin" }, { name: "robots", content: "noindex" }] }),
  component: QuotesIndex,
});

type QuoteRow = {
  id: string; quote_number: string | null; title: string; vehicle_label: string;
  status: "concept" | "verstuurd" | "akkoord" | "afgewezen";
  total_amount: number; created_at: string; sent_at: string | null;
  customer_id: string | null;
};

type Profile = { id: string; full_name: string | null; email: string };

const STATUSES = ["concept", "verstuurd", "akkoord", "afgewezen"] as const;
const STATUS_LABEL: Record<string, string> = {
  concept: "Concept", verstuurd: "Verstuurd", akkoord: "Akkoord", afgewezen: "Afgewezen",
};
const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  concept: { bg: "var(--cream-deep)", fg: "var(--charcoal-soft)" },
  verstuurd: { bg: "var(--gold)", fg: "var(--charcoal)" },
  akkoord: { bg: "var(--charcoal)", fg: "var(--gold)" },
  afgewezen: { bg: "var(--cream-deep)", fg: "var(--oxide)" },
};

function eur(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);
}

function QuotesIndex() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [filter, setFilter] = useState<(typeof STATUSES)[number] | "all">("all");
  const createBlank = useServerFn(createBlankQuote);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("quotes")
      .select("id, quote_number, title, vehicle_label, status, total_amount, created_at, sent_at, customer_id")
      .order("created_at", { ascending: false });
    const rows = (data as QuoteRow[] | null) ?? [];
    setQuotes(rows);
    const ids = Array.from(new Set(rows.map((r) => r.customer_id).filter((x): x is string => !!x)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, email").in("id", ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p as Profile; });
      setProfiles(map);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => (quotes ?? []).filter((q) => filter === "all" || q.status === filter),
    [quotes, filter],
  );
  const totalSum = useMemo(
    () => filtered.reduce((s, q) => s + Number(q.total_amount), 0),
    [filtered],
  );

  async function newQuote() {
    setBusy(true);
    try {
      const res = await createBlank({});
      navigate({ to: "/admin/quotes/$id", params: { id: res.quoteId } });
    } catch (e) {
      toast.error("Aanmaken mislukt", { description: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <AdminShell title="Offertes">
      <OffertesTabs />
      <section className="container-edit" style={{ paddingBottom: "3rem" }}>
        <button onClick={newQuote} disabled={busy} className="btn-y-solid w-full">
          {busy ? "Bezig…" : "+ Nieuwe offerte"}
        </button>

        <div className="flex gap-1 overflow-x-auto -mx-1 px-1 py-3">
          {(["all", ...STATUSES] as const).map((s) => (
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
              {s === "all" ? "Alles" : STATUS_LABEL[s]}
            </button>
          ))}
          <div className="ml-auto self-center text-[11px] uppercase tracking-[0.18em] whitespace-nowrap px-2"
               style={{ color: "var(--charcoal-soft)" }}>
            Totaal · <span style={{ color: "var(--brass)", fontWeight: 600 }}>{eur(totalSum)}</span>
          </div>
        </div>

        {quotes === null && (
          <div className="space-y-2">{[0,1,2].map((i) => <div key={i} className="skeleton-y" style={{ height: 72 }} />)}</div>
        )}
        {quotes && filtered.length === 0 && (
          <div className="px-4 py-8 text-center" style={{ border: "1px dashed var(--brass)", background: "var(--cream)" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>Geen offertes in deze status.</p>
            <p className="mt-2 text-sm" style={{ color: "var(--charcoal-soft)" }}>
              Maak een offerte vanuit een aanvraag of begin met een blanco.
            </p>
          </div>
        )}
        <ul className="space-y-2">
          {filtered.map((q) => {
            const prof = q.customer_id ? profiles[q.customer_id] : null;
            const c = STATUS_COLOR[q.status];
            return (
              <li key={q.id}>
                <Link
                  to="/admin/quotes/$id"
                  params={{ id: q.id }}
                  className="block px-3 py-3"
                  style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--brass)" }}>
                        {q.quote_number ?? "Concept"} · {timeAgo(q.created_at)} geleden
                      </div>
                      <div className="truncate mt-1" style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>
                        {q.title || "Naamloze offerte"}
                      </div>
                      <div className="text-xs truncate mt-0.5" style={{ color: "var(--charcoal-soft)" }}>
                        {prof ? `${prof.full_name ?? prof.email}` : "— Geen klant gekoppeld"}
                        {q.vehicle_label ? ` · ${q.vehicle_label}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] tracking-[0.15em] uppercase px-2 py-1 whitespace-nowrap"
                            style={{ background: c.bg, color: c.fg }}>
                        {STATUS_LABEL[q.status]}
                      </span>
                      <div className="mt-2" style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", color: "var(--brass)" }}>
                        {eur(Number(q.total_amount))}
                      </div>
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