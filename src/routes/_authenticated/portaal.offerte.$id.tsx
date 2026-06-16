import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalHeader } from "@/components/PortalHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { downloadQuotePdf } from "@/lib/quotes.functions";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/AdminModals";

export const Route = createFileRoute("/_authenticated/portaal/offerte/$id")({
  head: () => ({
    meta: [
      { title: "Offerte — Yeketi Motorworks" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalQuote,
});

type Quote = {
  id: string; quote_number: string | null; title: string; vehicle_label: string;
  intro_text: string; notes_text: string; valid_until: string | null;
  status: "verstuurd" | "akkoord" | "afgewezen" | "concept";
  total_amount: number; sent_at: string | null; responded_at: string | null;
  response_reason: string | null;
};
type Line = { id: string; description: string; amount: number; sort_order: number };

function eur(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);
}

function PortalQuote() {
  const { id } = Route.useParams();
  const dl = useServerFn(downloadQuotePdf);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acceptOpen, setAcceptOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: q, error: qe }, { data: ls }] = await Promise.all([
      supabase.from("quotes").select("*").eq("id", id).maybeSingle(),
      supabase.from("quote_lines").select("*").eq("quote_id", id).order("sort_order"),
    ]);
    if (qe || !q) { setError("Offerte niet gevonden of niet beschikbaar."); setLoading(false); return; }
    setQuote(q as Quote);
    setLines((ls as Line[] | null) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function respond(status: "akkoord" | "afgewezen", reason?: string) {
    if (!quote) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("quotes")
        .update({ status, response_reason: reason ?? null })
        .eq("id", quote.id);
      if (error) throw error;
      toast.success(status === "akkoord" ? "Bedankt — Baram krijgt bericht." : "Bericht verzonden.");
      await load();
    } catch (e) {
      toast.error("Kon antwoord niet bewaren", { description: (e as Error).message });
    } finally { setBusy(false); }
  }

  async function download() {
    if (!quote) return;
    try {
      const { filename, base64 } = await dl({ data: { quoteId: quote.id } });
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("PDF mislukt", { description: (e as Error).message });
    }
  }

  const responded = quote && quote.status !== "verstuurd";

  return (
    <div className="min-h-screen flex flex-col">
      <PortalHeader />
      <main className="flex-1">
        <section className="container-edit" style={{ paddingBlock: "clamp(2.5rem,5vw,4rem)" }}>
          <Link to="/portaal" className="text-[11px] uppercase tracking-[0.2em]"
                style={{ color: "var(--charcoal-soft)" }}>← Terug naar portaal</Link>

          {loading && <div className="mt-6 skeleton-y" style={{ height: 240 }} />}
          {error && <p className="mt-6" style={{ color: "var(--oxide)" }}>{error}</p>}

          {quote && (
            <article className="mt-6" style={{ background: "var(--cream-deep)", border: "1px solid var(--charcoal)" }}>
              <header className="px-5 py-5" style={{ borderBottom: "1px solid var(--charcoal)" }}>
                <p className="eyebrow" style={{ color: "var(--brass)" }}>
                  Offerte {quote.quote_number ?? ""}
                </p>
                <h1 className="mt-2" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.6rem,3vw,2.2rem)" }}>
                  {quote.title}
                </h1>
                {quote.vehicle_label && (
                  <p className="mt-1 text-sm" style={{ color: "var(--charcoal-soft)" }}>{quote.vehicle_label}</p>
                )}
                {quote.sent_at && (
                  <p className="mt-3 text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--charcoal-soft)" }}>
                    Verstuurd · {new Date(quote.sent_at).toLocaleDateString("nl-BE")}
                    {quote.valid_until && ` · Geldig tot ${new Date(quote.valid_until).toLocaleDateString("nl-BE")}`}
                  </p>
                )}
              </header>

              <div className="px-5 py-5 space-y-5">
                {quote.intro_text && (
                  <p className="whitespace-pre-wrap" style={{ lineHeight: 1.7 }}>{quote.intro_text}</p>
                )}

                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] pb-2"
                       style={{ color: "var(--charcoal-soft)", borderBottom: "1px solid var(--charcoal)" }}>
                    <span>Omschrijving</span>
                    <span style={{ float: "right" }}>Bedrag</span>
                  </div>
                  <ul className="divide-y" style={{ borderColor: "var(--cream)" }}>
                    {lines.map((l) => (
                      <li key={l.id} className="flex gap-3 py-3">
                        <span className="flex-1 whitespace-pre-wrap" style={{ lineHeight: 1.55 }}>{l.description}</span>
                        <span style={{ fontFamily: "var(--font-display)", whiteSpace: "nowrap" }}>{eur(Number(l.amount))}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between items-center mt-2 px-3 py-3"
                       style={{ background: "var(--charcoal)", color: "var(--cream)" }}>
                    <span className="text-[11px] uppercase tracking-[0.22em]">Totaal</span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: "var(--gold)" }}>
                      {eur(Number(quote.total_amount))}
                    </span>
                  </div>
                </div>

                {quote.notes_text && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>
                      Opmerkingen
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm" style={{ lineHeight: 1.7, color: "var(--charcoal-soft)" }}>
                      {quote.notes_text}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <button onClick={download} className="btn-y">PDF downloaden</button>
                </div>

                {!responded && (
                  <div className="pt-4" style={{ borderTop: "1px solid var(--charcoal)" }}>
                    <p className="text-sm" style={{ color: "var(--charcoal-soft)" }}>
                      Geef hier je antwoord op deze offerte. Je kan altijd nog bellen of mailen als je vragen hebt.
                    </p>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button onClick={() => setAcceptOpen(true)} disabled={busy} className="btn-y-solid">Akkoord</button>
                      <button onClick={() => setRejectOpen(true)} disabled={busy} className="btn-y"
                              style={{ borderColor: "var(--oxide)", color: "var(--oxide)" }}>
                        Afwijzen
                      </button>
                    </div>
                  </div>
                )}

                {responded && (
                  <div className="pt-4" style={{ borderTop: "1px solid var(--charcoal)" }}>
                    {quote.status === "akkoord" ? (
                      <p style={{ color: "var(--brass)", fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>
                        Je bent akkoord — bedankt voor het vertrouwen.
                      </p>
                    ) : (
                      <>
                        <p style={{ color: "var(--oxide)", fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>
                          Offerte afgewezen
                        </p>
                        {quote.response_reason && (
                          <p className="mt-2 text-sm italic" style={{ color: "var(--charcoal-soft)" }}>
                            "{quote.response_reason}"
                          </p>
                        )}
                      </>
                    )}
                    {quote.responded_at && (
                      <p className="mt-2 text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--charcoal-soft)" }}>
                        {new Date(quote.responded_at).toLocaleDateString("nl-BE")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </article>
          )}
        </section>
      </main>
      <SiteFooter />

      <ConfirmModal
        open={acceptOpen}
        title="Akkoord met offerte"
        message="Bevestig dat je akkoord gaat. Baram krijgt meteen bericht en neemt contact op om de volgende stappen af te spreken."
        confirmLabel="Akkoord"
        onConfirm={async () => { await respond("akkoord"); }}
        onClose={() => setAcceptOpen(false)}
      />

      {rejectOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
             style={{ background: "rgba(34,31,27,0.6)" }}>
          <div className="w-full sm:max-w-sm" style={{ background: "var(--cream)", border: "1px solid var(--charcoal)" }}>
            <div className="px-4 py-3" style={{ background: "var(--charcoal)", color: "var(--cream)", fontFamily: "var(--font-display)" }}>
              Offerte afwijzen
            </div>
            <div className="px-4 py-4 space-y-3">
              <p className="text-sm">Korte reden (optioneel) — helpt ons om een betere offerte te maken.</p>
              <textarea className="form-y" rows={3} value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="bv. budget, andere planning…" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setRejectOpen(false)} className="btn-y">Annuleer</button>
                <button
                  disabled={busy}
                  onClick={async () => { await respond("afgewezen", rejectReason.trim() || undefined); setRejectOpen(false); }}
                  className="text-xs uppercase tracking-[0.18em] py-3"
                  style={{ background: "var(--oxide)", color: "var(--cream)", border: "1px solid var(--oxide)" }}
                >
                  Afwijzen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}