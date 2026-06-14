import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell, statusBadge, timeAgo } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { convertQuoteToProject } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/admin/offertes")({
  head: () => ({ meta: [{ title: "Offertes — Admin" }, { name: "robots", content: "noindex" }] }),
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

function waLink(phone: string | null, naam: string, voertuig: string) {
  if (!phone) return null;
  const clean = phone.replace(/[^\d+]/g, "");
  const number = clean.startsWith("+") ? clean.slice(1) : clean;
  const text = encodeURIComponent(
    `Hoi ${naam.split(" ")[0] ?? naam}, dit is Baraam van Yeketi Motorworks. Bedankt voor je aanvraag voor ${voertuig || "je klassieker"}. Wanneer komt het uit om even te bellen?`,
  );
  return `https://wa.me/${number}?text=${text}`;
}

function Offertes() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [filter, setFilter] = useState<(typeof STATUSES)[number] | "all">("new");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const convert = useServerFn(convertQuoteToProject);

  async function load() {
    const { data } = await supabase.from("quote_requests").select("*").order("created_at", { ascending: false });
    setQuotes((data as Quote[] | null) ?? []);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => (quotes ?? []).filter((q) => filter === "all" || q.status === filter),
    [quotes, filter],
  );

  async function setStatus(id: string, status: Quote["status"]) {
    setBusy(id);
    await supabase.from("quote_requests").update({ status }).eq("id", id);
    setBusy(null);
    load();
  }

  async function convertNow(q: Quote) {
    if (!confirm(`Project aanmaken voor ${q.naam} en uitnodigingsmail sturen naar ${q.email}?`)) return;
    setBusy(q.id);
    try {
      await convert({ data: { quoteId: q.id } });
      alert("Project aangemaakt. Klant heeft een inloglink ontvangen.");
      load();
    } catch (e: unknown) {
      alert((e as Error).message ?? "Fout bij aanmaken");
    } finally { setBusy(null); }
  }

  return (
    <AdminShell title="Offertes">
      <section className="container-edit" style={{ paddingBottom: "3rem" }}>
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
                      <a href={`mailto:${q.email}`} className="btn-y text-center col-span-2">{q.email}</a>
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
                      <div className="grid grid-cols-3 gap-1">
                        {q.foto_urls.map((u) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer">
                            <img src={u} alt="" className="w-full" style={{ aspectRatio: "1/1", objectFit: "cover", border: "1px solid var(--charcoal)" }} />
                          </a>
                        ))}
                      </div>
                    )}

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: "var(--charcoal-soft)" }}>Status</div>
                      <div className="flex flex-wrap gap-1">
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            disabled={busy === q.id || q.status === s}
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
                      className="btn-y-solid w-full"
                    >
                      {busy === q.id ? "Bezig…" : "Maak project + nodig klant uit"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
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