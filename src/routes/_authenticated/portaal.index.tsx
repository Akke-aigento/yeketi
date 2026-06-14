import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalHeader } from "@/components/PortalHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { fetchMyProjects, signCoverUrl, type ProjectRow } from "@/lib/portal";
import { t } from "@/lib/copy";

export const Route = createFileRoute("/_authenticated/portaal/")({
  head: () => ({
    meta: [
      { title: "Klantenportaal — Yeketi Motorworks" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalIndex,
});

function statusLabel(s: ProjectRow["status"]) {
  return t.portal.statusLabels[s] ?? s;
}

function PortalIndex() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);

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
                          {statusLabel(p.status)}
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