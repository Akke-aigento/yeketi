import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell, statusBadge, timeAgo } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { convertQuoteToProject, deleteQuoteRequest, cleanupOrphanQuotePhotos } from "@/lib/admin.functions";
import { createQuoteFromRequest } from "@/lib/quotes.functions";
import { getConversationForQuoteRequest } from "@/lib/messages.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/AdminModals";
import { useAdminRefreshKey } from "@/hooks/useAdminRefresh";
import { OffertesTabs } from "@/components/OffertesTabs";

export const Route = createFileRoute("/_authenticated/admin/offertes")({
  head: () => ({ meta: [{ title: "Aanvragen — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Offertes,
});

const STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;
const STATUS_LABEL: Record<string, string> = {
  new: "Nieuw", contacted: "Gecontacteerd", quoted: "Offerte verstuurd",
  won: "Gewonnen", lost: "Verloren",
};

type Quote = {
  id: string; naam: string; email: string; telefoon: string | null;
  merk: string | null; model: string | null; bouwjaar: string | null;
  type_werk: string; beschrijving: string | null; foto_urls: string[] | null;
  status: typeof STATUSES[number]; created_at: string;
};

// Normalise a phone number to wa.me's expected international format:
// digits only, no leading "+" or "00". Belgian local numbers (leading "0")
// get "32" prepended. Anything else is passed through unchanged so foreign
// numbers entered in international format still work.
function normaliseWa(phone: string): string | null {
  const raw = phone.replace(/[^\d+]/g, "");
  if (!raw) return null;
  if (raw.startsWith("+")) return raw.slice(1);
  if (raw.startsWith("00")) return raw.slice(2);
  if (raw.startsWith("0")) return `32${raw.slice(1)}`;
  return raw;
}

function waLink(phone: string | null, naam: string, voertuig: string) {
  if (!phone) return null;
  const number = normaliseWa(phone);
  if (!number) return null;
  const text = encodeURIComponent(
    `Hoi ${naam.split(" ")[0] ?? naam}, dit is Baram van Yeketi Motorworks. Bedankt voor je aanvraag voor ${voertuig || "je klassieker"}. Wanneer komt het uit om even te bellen?`,
  );
  return `https://wa.me/${number}?text=${text}`;
}

function Offertes() {
  const navigate = useNavigate();
  const refreshKey = useAdminRefreshKey();
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [filter, setFilter] = useState<(typeof STATUSES)[number] | "all">("new");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const convert = useServerFn(convertQuoteToProject);
  const removeQuote = useServerFn(deleteQuoteRequest);
  const cleanupOrphans = useServerFn(cleanupOrphanQuotePhotos);
  const makeQuote = useServerFn(createQuoteFromRequest);
  const openConversation = useServerFn(getConversationForQuoteRequest);
  // Cache of signed URLs per quote id, plus the currently-open lightbox image.
  const [signedPhotos, setSignedPhotos] = useState<Record<string, string[]>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; destructive?: boolean; onConfirm: () => void | Promise<void> } | null>(null);

  async function load() {
    const { data } = await supabase.from("quote_requests").select("*").order("created_at", { ascending: false });
    setQuotes((data as Quote[] | null) ?? []);
  }
  useEffect(() => { load(); }, [refreshKey]);

  // ESC closes the lightbox so admins don't get stuck on mobile/desktop.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // Fetch signed URLs for an opened request on demand; bucket is private so a
  // bare storage path renders as a broken image.
  async function ensureSignedPhotos(q: Quote) {
    if (signedPhotos[q.id] || !q.foto_urls || q.foto_urls.length === 0) return;
    const { data, error } = await supabase.storage
      .from("quote-photos")
      .createSignedUrls(q.foto_urls, 3600);
    if (error) {
      toast.error("Foto's laden mislukt", { description: error.message });
      return;
    }
    setSignedPhotos((prev) => ({
      ...prev,
      [q.id]: (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[],
    }));
  }

  const filtered = useMemo(
    () => (quotes ?? []).filter((q) => filter === "all" || q.status === filter),
    [quotes, filter],
  );

  async function setStatus(id: string, status: Quote["status"]) {
    if (busy === id) return;
    setBusy(id);
    const { error } = await supabase.from("quote_requests").update({ status }).eq("id", id);
    setBusy(null);
    if (error) { toast.error("Status wijzigen mislukt", { description: error.message }); return; }
    load();
  }

  async function convertNow(q: Quote) {
    setConfirmState({
      title: "Project aanmaken",
      message: `${q.naam} is bij de aanvraag al uitgenodigd voor het portaal. We maken nu enkel het project aan. Doorgaan?`,
      onConfirm: async () => {
        setBusy(q.id);
        try {
          await convert({ data: { quoteId: q.id } });
          toast.success("Project aangemaakt.");
          load();
        } catch (e) {
          toast.error("Fout bij aanmaken", { description: (e as Error).message });
        } finally { setBusy(null); }
      },
    });
  }

  async function openMessageThread(q: Quote) {
    if (busy === q.id) return;
    setBusy(q.id);
    try {
      const { conversationId } = await openConversation({ data: { quoteRequestId: q.id } });
      navigate({ to: "/admin/berichten/$id", params: { id: conversationId } });
    } catch (e) {
      toast.error("Kon gesprek niet openen", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function deleteNow(q: Quote) {
    setConfirmState({
      title: "Aanvraag verwijderen",
      message: `Aanvraag van ${q.naam} verwijderen? Foto's worden ook gewist.`,
      destructive: true,
      onConfirm: async () => {
        setBusy(q.id);
        try {
          await removeQuote({ data: { quoteId: q.id } });
          toast.success("Aanvraag verwijderd");
          load();
        } catch (e) {
          toast.error("Verwijderen mislukt", { description: (e as Error).message });
        } finally { setBusy(null); }
      },
    });
  }

  async function runCleanup() {
    setConfirmState({
      title: "Wees-foto's opruimen",
      message: "Verwijdert alle foto's in quote-photos die niet meer aan een aanvraag hangen.",
      onConfirm: async () => {
        try {
          const res = await cleanupOrphans({});
          toast.success(`Opgeruimd: ${res.removedFiles} bestand(en) (van ${res.scanned} gescand).`);
        } catch (e) {
          toast.error("Cleanup mislukt", { description: (e as Error).message });
        }
      },
    });
  }

  return (
    <AdminShell title="Offertes">
      <OffertesTabs />
      <section className="container-edit" style={{ paddingBottom: "3rem" }}>
        <div className="flex justify-end pt-2">
          <button onClick={runCleanup} className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>
            Wees-foto's opruimen
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1 py-2">
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
        </div>

        {quotes === null && <p className="eyebrow mt-4" style={{ color: "var(--charcoal-soft)" }}>Laden…</p>}
        {quotes && filtered.length === 0 && (
          <p className="text-sm mt-4" style={{ color: "var(--charcoal-soft)" }}>Geen aanvragen in deze status.</p>
        )}

        <ul className="mt-3 space-y-2">
          {filtered.map((q) => {
            const b = statusBadge(q.status);
            const voertuig = [q.merk, q.model, q.bouwjaar].filter(Boolean).join(" ");
            const wa = waLink(q.telefoon, q.naam, voertuig);
            const open = openId === q.id;
            return (
              <li key={q.id} style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}>
                <button
                  onClick={() => setOpenId(open ? null : q.id)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>
                      {q.naam}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--charcoal-soft)" }}>
                      {voertuig || q.type_werk} · {timeAgo(q.created_at)} geleden
                    </div>
                  </div>
                  <span className="text-[10px] tracking-[0.15em] uppercase px-2 py-1 whitespace-nowrap"
                        style={{ background: b.bg, color: b.fg }}>
                    {STATUS_LABEL[q.status]}
                  </span>
                </button>

                {open && (
                  <div className="border-t px-3 py-4 space-y-4" style={{ borderColor: "var(--charcoal)" }}>
                    <div className="grid grid-cols-2 gap-2">
                      {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-y-solid text-center">WhatsApp</a>}
                      {q.telefoon && <a href={`tel:${q.telefoon}`} className="btn-y text-center">Bel</a>}
                      <button
                        type="button"
                        onClick={() => openMessageThread(q)}
                        disabled={busy === q.id}
                        aria-busy={busy === q.id}
                        className="btn-y text-center col-span-2"
                      >
                        Stuur bericht in portaal
                      </button>
                      <div
                        className="col-span-2 text-[11px] text-center tracking-[0.08em]"
                        style={{ color: "var(--charcoal-soft)" }}
                      >
                        {q.email}
                      </div>
                    </div>

                    <dl className="text-sm space-y-1">
                      <DLRow k="Type" v={q.type_werk} />
                      <DLRow k="Voertuig" v={voertuig || "—"} />
                      <DLRow k="Telefoon" v={q.telefoon || "—"} />
                      {q.beschrijving && (
                        <div className="pt-2">
                          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--charcoal-soft)" }}>Beschrijving</div>
                          <p className="mt-1 whitespace-pre-wrap" style={{ lineHeight: 1.6 }}>{q.beschrijving}</p>
                        </div>
                      )}
                    </dl>

                    {q.foto_urls && q.foto_urls.length > 0 && (
                      <PhotoGrid
                        urls={signedPhotos[q.id]}
                        onMount={() => ensureSignedPhotos(q)}
                        onOpen={(u) => setLightbox(u)}
                      />
                    )}

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "var(--charcoal-soft)" }}>Status</div>
                      <div className="flex flex-wrap gap-1">
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            disabled={busy === q.id || q.status === s}
                            aria-busy={busy === q.id}
                            onClick={() => setStatus(q.id, s)}
                            className="text-[11px] tracking-[0.15em] uppercase px-3 py-2"
                            style={{
                              border: "1px solid var(--charcoal)",
                              background: q.status === s ? "var(--charcoal)" : "transparent",
                              color: q.status === s ? "var(--gold)" : "var(--charcoal)",
                            }}
                          >
                            {STATUS_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => convertNow(q)}
                      disabled={busy === q.id}
                      aria-busy={busy === q.id}
                      className="btn-y-solid w-full"
                    >
                      {busy === q.id ? "Bezig…" : "Maak project aan"}
                    </button>
                    <button
                      onClick={async () => {
                        if (busy === q.id) return;
                        setBusy(q.id);
                        try {
                          const res = await makeQuote({ data: { quoteRequestId: q.id } });
                          toast.success("Offerte aangemaakt — vul aan en verstuur");
                          navigate({ to: "/admin/quotes/$id", params: { id: res.quoteId } });
                        } catch (e) {
                          toast.error("Kon offerte niet aanmaken", { description: (e as Error).message });
                        } finally { setBusy(null); }
                      }}
                      disabled={busy === q.id}
                      aria-busy={busy === q.id}
                      className="btn-y w-full"
                    >
                      Maak offerte
                    </button>
                    <button
                      onClick={() => deleteNow(q)}
                      disabled={busy === q.id}
                      aria-busy={busy === q.id}
                      className="w-full text-xs uppercase tracking-[0.18em] py-2"
                      style={{ border: "1px solid var(--oxide)", color: "var(--oxide)", background: "transparent" }}
                    >
                      Aanvraag verwijderen
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <ConfirmModal
        open={confirmState !== null}
        title={confirmState?.title ?? ""}
        message={confirmState?.message ?? ""}
        destructive={confirmState?.destructive}
        confirmLabel={confirmState?.destructive ? "Verwijder" : "Bevestig"}
        onConfirm={async () => { await confirmState?.onConfirm(); }}
        onClose={() => setConfirmState(null)}
      />
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto-weergave"
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
        >
          <button
            type="button"
            aria-label="Sluit"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.4)",
              fontSize: 24,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>
          <img
            src={lightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
            }}
          />
        </div>
      )}
    </AdminShell>
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

// Renders the thumbnail grid for an opened request. Triggers signed-URL
// loading via onMount the first time it appears, and shows a quiet skeleton
// state until the URLs arrive instead of broken-image icons.
function PhotoGrid({
  urls,
  onMount,
  onOpen,
}: {
  urls: string[] | undefined;
  onMount: () => void;
  onOpen: (url: string) => void;
}) {
  // Trigger the signed-URL fetch once when the grid first appears. onMount
  // is recreated each parent render, so we intentionally fire only on mount
  // and rely on the parent's own cache guard to dedupe.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onMount(); }, []);
  if (!urls) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              aspectRatio: "1/1",
              border: "1px solid var(--charcoal)",
              background: "var(--cream)",
              opacity: 0.5,
            }}
          />
        ))}
      </div>
    );
  }
  if (urls.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-1">
      {urls.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onOpen(u)}
          style={{ padding: 0, border: 0, background: "transparent", cursor: "zoom-in" }}
          aria-label="Foto vergroten"
        >
          <img
            src={u}
            alt=""
            className="w-full"
            style={{ aspectRatio: "1/1", objectFit: "cover", border: "1px solid var(--charcoal)", display: "block" }}
          />
        </button>
      ))}
    </div>
  );
}