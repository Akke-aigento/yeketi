import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AdminShell, timeAgo } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { convertQuoteToProject, deleteQuoteRequest } from "@/lib/admin.functions";
import { createQuoteFromRequest } from "@/lib/quotes.functions";
import { getConversationForQuoteRequest } from "@/lib/messages.functions";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/AdminModals";
import {
  derivePhase, PHASE_LABEL, PHASE_BADGE,
  type RequestStatus, type QuoteStatus,
} from "@/lib/pipeline";

export const Route = createFileRoute("/_authenticated/admin/aanvragen/$id")({
  head: () => ({ meta: [{ title: "Aanvraag — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AanvraagDetail,
});

type Req = {
  id: string; naam: string; email: string; telefoon: string | null;
  merk: string | null; model: string | null; bouwjaar: string | null;
  type_werk: string; beschrijving: string | null; foto_urls: string[] | null;
  status: RequestStatus; created_at: string;
};
type QuoteRow = {
  id: string; quote_number: string | null; status: QuoteStatus;
  total_amount: number; customer_id: string | null;
  sent_at: string | null; responded_at: string | null; response_reason: string | null;
};

const REQ_STATUSES: RequestStatus[] = ["new", "contacted", "quoted", "won", "lost"];
const REQ_STATUS_LABEL: Record<RequestStatus, string> = {
  new: "Nieuw", contacted: "Gecontacteerd", quoted: "Offerte gemaakt",
  won: "Akkoord", lost: "Verloren",
};

function eur(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);
}

function normaliseWa(phone: string): string | null {
  const raw = phone.replace(/[^\d+]/g, "");
  if (!raw) return null;
  if (raw.startsWith("+")) return raw.slice(1);
  if (raw.startsWith("00")) return raw.slice(2);
  if (raw.startsWith("0")) return `32${raw.slice(1)}`;
  return raw;
}

function AanvraagDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [req, setReq] = useState<Req | null>(null);
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [signedPhotos, setSignedPhotos] = useState<string[] | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; destructive?: boolean; label?: string; onConfirm: () => Promise<void> } | null>(null);

  const makeQuote = useServerFn(createQuoteFromRequest);
  const convertProject = useServerFn(convertQuoteToProject);
  const removeReq = useServerFn(deleteQuoteRequest);
  const openConversation = useServerFn(getConversationForQuoteRequest);

  const load = useCallback(async () => {
    const { data: r } = await supabase.from("quote_requests").select("*").eq("id", id).maybeSingle();
    setReq((r as Req | null) ?? null);
    const { data: qs } = await supabase.from("quotes")
      .select("id, quote_number, status, total_amount, customer_id, sent_at, responded_at, response_reason")
      .eq("quote_request_id", id).order("created_at", { ascending: false }).limit(1);
    const q = ((qs as QuoteRow[] | null) ?? [])[0] ?? null;
    setQuote(q);
    // Project: look it up via the quote's customer or via email→profile.
    let custId = q?.customer_id ?? null;
    if (!custId && r?.email) {
      const { data: prof } = await supabase.from("profiles")
        .select("id").eq("email", String(r.email).toLowerCase()).maybeSingle();
      custId = prof?.id ?? null;
    }
    if (custId) {
      const { data: p } = await supabase.from("projects")
        .select("id").eq("customer_id", custId).maybeSingle();
      setProjectId(p?.id ?? null);
    } else {
      setProjectId(null);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!req?.foto_urls || req.foto_urls.length === 0) { setSignedPhotos([]); return; }
    (async () => {
      const { data, error } = await supabase.storage
        .from("quote-photos").createSignedUrls(req.foto_urls!, 3600);
      if (error) { toast.error("Foto's laden mislukt", { description: error.message }); return; }
      setSignedPhotos((data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[]);
    })();
  }, [req?.foto_urls]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  if (!req) {
    return (
      <AdminShell>
        <section className="container-edit" style={{ paddingTop: "1rem" }}>
          <div className="skeleton-y" style={{ height: 240 }} />
        </section>
      </AdminShell>
    );
  }

  const voertuig = [req.merk, req.model, req.bouwjaar].filter(Boolean).join(" ") || req.type_werk;
  const phase = derivePhase({
    requestStatus: req.status,
    quotes: quote ? [{ status: quote.status }] : [],
    hasProject: !!projectId,
  });
  const phaseBadge = PHASE_BADGE[phase];

  const waNumber = req.telefoon ? normaliseWa(req.telefoon) : null;
  const waLink = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hoi ${req.naam.split(" ")[0] ?? req.naam}, dit is Baram van Yeketi Motorworks. Bedankt voor je aanvraag voor ${voertuig || "je klassieker"}. Wanneer komt het uit om even te bellen?`)}`
    : null;

  async function setStatus(status: RequestStatus) {
    if (busy) return;
    setBusy("status");
    const { error } = await supabase.from("quote_requests").update({ status }).eq("id", id);
    setBusy(null);
    if (error) { toast.error("Status wijzigen mislukt", { description: error.message }); return; }
    load();
  }

  async function openThread() {
    if (busy) return;
    setBusy("msg");
    try {
      const { conversationId } = await openConversation({ data: { quoteRequestId: id } });
      navigate({ to: "/admin/berichten/$id", params: { id: conversationId } });
    } catch (e) {
      toast.error("Kon gesprek niet openen", { description: (e as Error).message });
    } finally { setBusy(null); }
  }

  async function startQuote() {
    if (busy) return;
    setBusy("quote");
    try {
      const res = await makeQuote({ data: { quoteRequestId: id } });
      toast.success("Offerte aangemaakt — vul aan en verstuur");
      navigate({ to: "/admin/quotes/$id", params: { id: res.quoteId } });
    } catch (e) {
      toast.error("Kon offerte niet aanmaken", { description: (e as Error).message });
    } finally { setBusy(null); }
  }

  function startProject() {
    setConfirm({
      title: "Project aanmaken",
      message: `${req!.naam} is bij de aanvraag al uitgenodigd voor het portaal. We maken nu enkel het project aan en zetten de aanvraag op "Akkoord".`,
      onConfirm: async () => {
        setBusy("project");
        try {
          const res = await convertProject({ data: { quoteRequestId: id } });
          toast.success("Project aangemaakt");
          navigate({ to: "/admin/projecten/$id", params: { id: res.projectId } });
        } catch (e) {
          toast.error("Fout bij aanmaken", { description: (e as Error).message });
        } finally { setBusy(null); }
      },
    });
  }

  function askDelete() {
    setConfirm({
      title: "Aanvraag verwijderen",
      message: `Aanvraag van ${req!.naam} verwijderen? Foto's worden ook gewist.`,
      destructive: true,
      label: "Verwijder",
      onConfirm: async () => {
        setBusy("del");
        try {
          await removeReq({ data: { quoteId: id } });
          toast.success("Aanvraag verwijderd");
          navigate({ to: "/admin/aanvragen" });
        } catch (e) {
          toast.error("Verwijderen mislukt", { description: (e as Error).message });
        } finally { setBusy(null); }
      },
    });
  }

  return (
    <AdminShell>
      <section className="container-edit" style={{ paddingBottom: "4rem" }}>
        <div className="flex items-center justify-between pt-3">
          <Link to="/admin/aanvragen" className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--charcoal-soft)" }}>
            ← Pipeline
          </Link>
          <span className="text-[10px] tracking-[0.18em] uppercase px-2 py-1"
                style={{ background: phaseBadge.bg, color: phaseBadge.fg }}>
            {PHASE_LABEL[phase]}
          </span>
        </div>

        <h1 className="mt-2" style={{ fontSize: "1.65rem", fontFamily: "var(--font-display)" }}>{req.naam}</h1>
        <p className="text-xs" style={{ color: "var(--charcoal-soft)" }}>
          {voertuig} · binnengekomen {timeAgo(req.created_at)} geleden
        </p>

        {/* ───── Lead ───── */}
        <Section title="Lead">
          <div className="grid grid-cols-2 gap-2">
            {waLink && <a href={waLink} target="_blank" rel="noreferrer" className="btn-y-solid text-center">WhatsApp</a>}
            {req.telefoon && <a href={`tel:${req.telefoon}`} className="btn-y text-center">Bel</a>}
            <button
              type="button"
              onClick={openThread}
              disabled={busy === "msg"}
              aria-busy={busy === "msg"}
              className="btn-y text-center col-span-2"
            >
              {busy === "msg" ? "Bezig…" : "Stuur bericht in portaal"}
            </button>
            <div className="col-span-2 text-[11px] text-center tracking-[0.08em]"
                 style={{ color: "var(--charcoal-soft)" }}>
              {req.email}
            </div>
          </div>

          <dl className="text-sm space-y-1 mt-4">
            <DLRow k="Type" v={req.type_werk} />
            <DLRow k="Voertuig" v={voertuig || "—"} />
            <DLRow k="Telefoon" v={req.telefoon || "—"} />
          </dl>

          {req.beschrijving && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>Beschrijving</div>
              <p className="mt-1 whitespace-pre-wrap text-sm" style={{ lineHeight: 1.6 }}>{req.beschrijving}</p>
            </div>
          )}

          {req.foto_urls && req.foto_urls.length > 0 && (
            <div className="mt-3">
              {signedPhotos === null ? (
                <div className="grid grid-cols-3 gap-1">
                  {[0,1,2].map((i) => (
                    <div key={i} style={{ aspectRatio: "1/1", border: "1px solid var(--charcoal)", background: "var(--cream)", opacity: 0.5 }} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {signedPhotos.map((u) => (
                    <button key={u} type="button" onClick={() => setLightbox(u)}
                            style={{ padding: 0, border: 0, background: "transparent", cursor: "zoom-in" }}
                            aria-label="Foto vergroten">
                      <img src={u} alt="" className="w-full"
                           style={{ aspectRatio: "1/1", objectFit: "cover", border: "1px solid var(--charcoal)", display: "block" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "var(--charcoal-soft)" }}>
              Handmatige status
            </div>
            <div className="flex flex-wrap gap-1">
              {REQ_STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={busy !== null || req.status === s}
                  aria-busy={busy === "status"}
                  onClick={() => setStatus(s)}
                  className="text-[11px] tracking-[0.15em] uppercase px-3 py-2"
                  style={{
                    border: "1px solid var(--charcoal)",
                    background: req.status === s ? "var(--charcoal)" : "transparent",
                    color: req.status === s ? "var(--gold)" : "var(--charcoal)",
                  }}
                >
                  {REQ_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ───── Offerte ───── */}
        <Section title="Offerte">
          {!quote ? (
            <div>
              <p className="text-sm" style={{ color: "var(--charcoal-soft)" }}>
                Nog geen offerte. Open de editor om een voorstel uit te werken en te versturen.
              </p>
              <button
                onClick={startQuote}
                disabled={busy === "quote"}
                aria-busy={busy === "quote"}
                className="btn-y-solid w-full mt-3"
              >
                {busy === "quote" ? "Bezig…" : "Offerte opmaken"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--brass)" }}>
                    {quote.quote_number ?? "Concept"}
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", color: "var(--brass)" }}>
                    {eur(Number(quote.total_amount))}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--charcoal-soft)" }}>
                    {quote.status === "concept" && "Concept — nog niet verstuurd"}
                    {quote.status === "verstuurd" && quote.sent_at && `Verstuurd op ${new Date(quote.sent_at).toLocaleDateString("nl-BE")}`}
                    {quote.status === "akkoord" && quote.responded_at && `Geaccepteerd op ${new Date(quote.responded_at).toLocaleDateString("nl-BE")}`}
                    {quote.status === "afgewezen" && quote.responded_at && `Afgewezen op ${new Date(quote.responded_at).toLocaleDateString("nl-BE")}`}
                  </div>
                  {quote.response_reason && (
                    <p className="mt-2 text-sm italic" style={{ color: "var(--charcoal-soft)" }}>
                      "{quote.response_reason}"
                    </p>
                  )}
                </div>
              </div>
              <Link
                to="/admin/quotes/$id"
                params={{ id: quote.id }}
                className="btn-y-solid w-full text-center block"
              >
                {quote.status === "concept" ? "Open editor" : "Open offerte"}
              </Link>
            </div>
          )}
        </Section>

        {/* ───── Project ───── */}
        <Section title="Project">
          {projectId ? (
            <div className="space-y-2">
              <p className="text-sm" style={{ color: "var(--charcoal-soft)" }}>
                Project actief — alles loopt verder in het projectdossier.
              </p>
              <Link to="/admin/projecten/$id" params={{ id: projectId }} className="btn-y-solid w-full text-center block">
                Open project
              </Link>
            </div>
          ) : phase === "akkoord" || phase === "offerte" ? (
            <div className="space-y-2">
              <p className="text-sm" style={{ color: "var(--charcoal-soft)" }}>
                {phase === "akkoord"
                  ? "Klant is akkoord. Maak het project aan om de werkfases te starten."
                  : "Nog geen akkoord — je kunt al een project starten als je de opdracht buiten de offerte rond hebt."}
              </p>
              <button
                onClick={startProject}
                disabled={busy === "project"}
                aria-busy={busy === "project"}
                className={phase === "akkoord" ? "btn-y-solid w-full" : "btn-y w-full"}
              >
                {busy === "project" ? "Bezig…" : "Maak project aan"}
              </button>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--charcoal-soft)" }}>
              Er is nog geen offerte of akkoord. Stuur eerst een offerte of zet de status op "Akkoord" om een project te starten.
            </p>
          )}
        </Section>

        <div className="mt-8 pt-4" style={{ borderTop: "1px solid color-mix(in oklab, var(--charcoal) 12%, transparent)" }}>
          <button
            onClick={askDelete}
            disabled={busy === "del"}
            aria-busy={busy === "del"}
            className="w-full text-xs uppercase tracking-[0.18em] py-2"
            style={{ border: "1px solid var(--oxide)", color: "var(--oxide)", background: "transparent" }}
          >
            {busy === "del" ? "Bezig…" : "Aanvraag verwijderen"}
          </button>
        </div>
      </section>

      <ConfirmModal
        open={confirm !== null}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        destructive={confirm?.destructive}
        confirmLabel={confirm?.label ?? (confirm?.destructive ? "Verwijder" : "Bevestig")}
        onConfirm={async () => { await confirm?.onConfirm(); }}
        onClose={() => setConfirm(null)}
      />

      {lightbox && (
        <div role="dialog" aria-modal="true" aria-label="Foto-weergave"
             onClick={() => setLightbox(null)}
             style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 80,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
          <button type="button" aria-label="Sluit"
                  onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
                  style={{ position: "absolute", top: 14, right: 14, width: 44, height: 44, borderRadius: "50%",
                           background: "rgba(255,255,255,0.12)", color: "#fff",
                           border: "1px solid rgba(255,255,255,0.4)", fontSize: 24, lineHeight: 1, cursor: "pointer" }}>
            ×
          </button>
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()}
               style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", boxShadow: "0 30px 60px rgba(0,0,0,0.5)" }} />
        </div>
      )}
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 px-4 py-4" style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}>
      <h2 className="text-[11px] uppercase tracking-[0.22em] mb-3" style={{ color: "var(--brass)" }}>{title}</h2>
      {children}
    </section>
  );
}

function DLRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>{k}</dt>
      <dd className="text-right truncate">{v}</dd>
    </div>
  );
}