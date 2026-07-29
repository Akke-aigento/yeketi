import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalHeader } from "@/components/PortalHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { fetchMyProjects, signCoverUrl, type ProjectRow } from "@/lib/portal";
import { useT } from "@/lib/i18n";
import type { Copy } from "@/lib/copy";

export const Route = createFileRoute("/_authenticated/portaal/")({
  head: () => ({
    meta: [
      { title: "Klantenportaal — Yeketi Motorworks" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalIndex,
});

function statusLabel(t: Copy, s: ProjectRow["status"]) {
  return t.portal.statusLabels[s] ?? s;
}

function PortalIndex() {
  const t = useT();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Array<{ id: string; quote_number: string | null; title: string; status: string; total_amount: number; sent_at: string | null }> | null>(null);

  useEffect(() => {
    let active = true;
    fetchMyProjects()
      .then(async (rows) => {
        if (!active) return;
        setProjects(rows);
        const entries = await Promise.all(
          rows.map(async (r) => [r.id, await signCoverUrl(r.cover_photo_url)] as const),
        );
        if (!active) return;
        setCovers(Object.fromEntries(entries));
      })
      .catch((e) => active && setError(e.message ?? "Er ging iets mis."));
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("quotes")
        .select("id, quote_number, title, status, total_amount, sent_at")
        .order("sent_at", { ascending: false });
      if (active) setQuotes(data ?? []);
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <PortalHeader />
      <main className="flex-1">
        <section className="container-edit" style={{ paddingBlock: "clamp(3rem,6vw,5rem)" }}>
          <ScrollReveal>
            <p className="eyebrow">{t.portal.welcome}</p>
            <h1 className="mt-5" style={{ fontSize: "clamp(2rem,4.5vw,3.2rem)" }}>
              {t.portal.overviewTitle}
            </h1>
            <p className="mt-5 max-w-xl" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
              {t.portal.overviewIntro}
            </p>
          </ScrollReveal>

          {quotes && quotes.length > 0 && (
            <div className="mt-12">
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem" }}>Offertes</h2>
              <ul className="mt-4 space-y-2">
                {quotes.map((q) => {
                  const responded = q.status === "akkoord" || q.status === "afgewezen";
                  const accent =
                    q.status === "akkoord" ? "var(--brass)" :
                    q.status === "afgewezen" ? "var(--oxide)" :
                    "var(--gold)";
                  return (
                    <li key={q.id}>
                      <Link
                        to="/portaal/offerte/$id"
                        params={{ id: q.id }}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                        style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}
                      >
                        <div className="min-w-0">
                          <div className="eyebrow" style={{ color: accent }}>
                            {q.quote_number ?? "Offerte"} · {q.status === "verstuurd" ? "wacht op antwoord" : q.status === "akkoord" ? "akkoord" : "afgewezen"}
                          </div>
                          <div className="truncate mt-1" style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>
                            {q.title}
                          </div>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <div style={{ fontFamily: "var(--font-display)", color: "var(--brass)", fontSize: "1.15rem" }}>
                            {new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(Number(q.total_amount))}
                          </div>
                          {!responded && (
                            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--brass)" }}>
                              Bekijk →
                            </div>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="mt-14">
            {error && (
              <p style={{ color: "var(--oxide)" }}>{error}</p>
            )}
            {!error && projects === null && (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3" aria-label="Laden">
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}>
                    <div className="skeleton-y" style={{ aspectRatio: "4/3", borderBottom: "1px solid var(--charcoal)" }} />
                    <div className="p-5">
                      <div className="skeleton-y" style={{ height: "10px", width: "40%" }} />
                      <div className="skeleton-y mt-4" style={{ height: "20px", width: "75%" }} />
                      <div className="skeleton-y mt-3" style={{ height: "12px", width: "55%" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {projects && projects.length === 0 && (
              <div
                className="max-w-2xl"
                style={{ borderTop: "1px solid var(--charcoal)", paddingTop: "2rem" }}
              >
                <p className="italic-quote" style={{ fontSize: "1.4rem", color: "var(--charcoal-soft)", lineHeight: 1.55 }}>
                  {t.portal.empty}
                </p>
              </div>
            )}
            {projects && projects.length > 0 && (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    to="/portaal/$projectId"
                    params={{ projectId: p.id }}
                    className="group block"
                    style={{ border: "1px solid var(--charcoal)", background: "var(--cream-deep)" }}
                  >
                    <div
                      style={{
                        aspectRatio: "4/3",
                        background: "var(--charcoal)",
                        backgroundImage: covers[p.id] ? `url(${covers[p.id]})` : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        borderBottom: "1px solid var(--charcoal)",
                      }}
                    />
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="eyebrow" style={{ color: "var(--brass)" }}>
                          {statusLabel(t, p.status)}
                        </span>
                        {p.vehicle_year && (
                          <span className="text-xs" style={{ color: "var(--charcoal-soft)" }}>
                            {p.vehicle_year}
                          </span>
                        )}
                      </div>
                      <h2 className="mt-3" style={{ fontSize: "1.4rem" }}>{p.title}</h2>
                      <p className="mt-1 text-sm" style={{ color: "var(--charcoal-soft)" }}>
                        {[p.vehicle_make, p.vehicle_model].filter(Boolean).join(" ")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}