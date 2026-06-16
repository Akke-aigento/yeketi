import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalHeader } from "@/components/PortalHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import {
  fetchProject,
  fetchProjectTimeline,
  fetchReactionsByUpdate,
  signCoverUrl,
  type ProjectRow,
  type ReactionView,
  type TimelinePhase,
} from "@/lib/portal";
import { t } from "@/lib/copy";
import { ReactionThread } from "@/components/ReactionThread";

export const Route = createFileRoute("/_authenticated/portaal/$projectId")({
  head: () => ({
    meta: [
      { title: "Project — Klantenportaal · Yeketi Motorworks" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalProject,
});

function statusLabel(s: ProjectRow["status"]) {
  return t.portal.statusLabels[s] ?? s;
}

function PortalProject() {
  const { projectId } = Route.useParams();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [phases, setPhases] = useState<TimelinePhase[] | null>(null);
  const [reactions, setReactions] = useState<Map<string, ReactionView[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const p = await fetchProject(projectId);
        if (!active) return;
        if (!p) { setError("Project niet gevonden."); return; }
        setProject(p);
        signCoverUrl(p.cover_photo_url).then((u) => active && setCover(u));
        const tl = await fetchProjectTimeline(projectId);
        if (!active) return;
        setPhases(tl);
        const updateIds = tl.flatMap((p) => p.updates.map((u) => u.id));
        if (updateIds.length > 0) {
          const rmap = await fetchReactionsByUpdate(updateIds);
          if (active) setReactions(rmap);
        }
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : "Er ging iets mis.");
      }
    })();
    return () => { active = false; };
  }, [projectId]);

  // Lightbox key handlers
  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((lb) => lb && { ...lb, index: (lb.index + 1) % lb.urls.length });
      if (e.key === "ArrowLeft") setLightbox((lb) => lb && { ...lb, index: (lb.index - 1 + lb.urls.length) % lb.urls.length });
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [lightbox]);

  return (
    <div className="min-h-screen flex flex-col">
      <PortalHeader />
      <main className="flex-1">
        <div className="container-edit" style={{ paddingTop: "2rem" }}>
          <Link to="/portaal" className="eyebrow" style={{ color: "var(--charcoal-soft)" }}>
            ← {t.portal.backToOverview}
          </Link>
        </div>

        {error && (
          <div className="container-edit" style={{ paddingBlock: "4rem" }}>
            <p style={{ color: "var(--oxide)" }}>{error}</p>
          </div>
        )}

        {project && (
          <header className="container-edit" style={{ paddingBlock: "clamp(2.5rem,5vw,4rem)" }}>
            <ScrollReveal>
              <p className="eyebrow" style={{ color: "var(--brass)" }}>{statusLabel(project.status)}</p>
              <h1 className="mt-5" style={{ fontSize: "clamp(2.2rem,5vw,3.8rem)" }}>{project.title}</h1>
              <p className="mt-3" style={{ color: "var(--charcoal-soft)", fontSize: "1.05rem" }}>
                {[project.vehicle_year, project.vehicle_make, project.vehicle_model].filter(Boolean).join(" · ")}
              </p>
              {cover && (
                <img
                  src={cover}
                  alt={project.title}
                  className="mt-8 w-full block"
                  style={{ aspectRatio: "16/9", objectFit: "cover", border: "1px solid var(--charcoal)" }}
                />
              )}
            </ScrollReveal>
          </header>
        )}

        {project && (
          <section className="container-edit" style={{ paddingBottom: "clamp(4rem,8vw,7rem)" }}>
            <ScrollReveal>
              <p className="eyebrow">{t.portal.timelineTitle}</p>
            </ScrollReveal>

            {phases === null && (
              <p className="mt-8 eyebrow" style={{ color: "var(--charcoal-soft)" }}>Laden…</p>
            )}

            {phases && phases.length === 0 && (
              <div className="mt-10 max-w-2xl" style={{ borderTop: "1px solid var(--charcoal)", paddingTop: "2rem" }}>
                <p className="italic-quote" style={{ fontSize: "1.3rem", color: "var(--charcoal-soft)", lineHeight: 1.55 }}>
                  {t.portal.empty}
                </p>
              </div>
            )}

            {phases && phases.length > 0 && (
              <ol className="mt-10 relative" style={{ paddingLeft: "2.25rem" }}>
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "8px",
                    bottom: "8px",
                    width: "1px",
                    background: "var(--charcoal)",
                    opacity: 0.35,
                  }}
                />
                {phases.map((phase, idx) => {
                  const dotClass =
                    "timeline-dot" +
                    (phase.status === "done" ? " is-done" : "") +
                    (phase.status === "active" ? " is-active" : "");
                  return (
                    <li key={phase.id} className="relative" style={{ marginBottom: idx === phases.length - 1 ? 0 : "3.5rem" }}>
                      <span aria-hidden className={dotClass} style={{ position: "absolute", left: 0, top: "4px" }} />
                      <ScrollReveal>
                        <h2 style={{ fontSize: "clamp(1.4rem,2.4vw,1.8rem)" }}>{phase.name}</h2>
                        {phase.updates.length === 0 && (
                          <p className="mt-2 text-sm" style={{ color: "var(--charcoal-soft)" }}>
                            {t.portal.noUpdates}
                          </p>
                        )}
                        <div className="mt-5 space-y-8">
                          {phase.updates.map((u) => {
                            const photoUrls = u.photos.map((p) => p.signedUrl).filter((x): x is string => !!x);
                            return (
                              <article key={u.id} style={{ borderTop: "1px solid var(--charcoal)", paddingTop: "1.25rem" }}>
                                <p className="eyebrow" style={{ color: "var(--charcoal-soft)" }}>
                                  {new Date(u.created_at).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" })}
                                </p>
                                <p className="mt-3" style={{ lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{u.body}</p>
                                {photoUrls.length > 0 && (
                                  <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {photoUrls.map((url, i) => (
                                      <button
                                        key={url}
                                        type="button"
                                        onClick={() => setLightbox({ urls: photoUrls, index: i })}
                                        style={{ padding: 0, border: 0, cursor: "zoom-in" }}
                                      >
                                        <img
                                          src={url}
                                          alt={u.photos[i]?.caption ?? ""}
                                          loading="lazy"
                                          className="w-full block"
                                          style={{ aspectRatio: "1/1", objectFit: "cover", border: "1px solid var(--charcoal)" }}
                                        />
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <ReactionThread
                                  updateId={u.id}
                                  initial={reactions.get(u.id) ?? []}
                                />
                              </article>
                            );
                          })}
                        </div>
                      </ScrollReveal>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}
      </main>
      <SiteFooter />

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          onTouchStart={(e) => {
            (e.currentTarget as HTMLDivElement & { _tsx?: number })._tsx = e.touches[0]?.clientX;
          }}
          onTouchEnd={(e) => {
            const startX = (e.currentTarget as HTMLDivElement & { _tsx?: number })._tsx;
            const endX = e.changedTouches[0]?.clientX;
            if (startX == null || endX == null) return;
            const dx = endX - startX;
            if (Math.abs(dx) < 50) return;
            setLightbox((lb) => lb && {
              ...lb,
              index: dx < 0
                ? (lb.index + 1) % lb.urls.length
                : (lb.index - 1 + lb.urls.length) % lb.urls.length,
            });
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(34,31,27,0.94)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
        >
          <img
            src={lightbox.urls[lightbox.index]}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox.urls.length > 1 && (
            <>
              <button
                aria-label="Vorige"
                onClick={(e) => { e.stopPropagation(); setLightbox((lb) => lb && { ...lb, index: (lb.index - 1 + lb.urls.length) % lb.urls.length }); }}
                style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--cream)", background: "transparent", border: "1px solid var(--cream)", padding: "0.75rem 1rem" }}
              >‹</button>
              <button
                aria-label="Volgende"
                onClick={(e) => { e.stopPropagation(); setLightbox((lb) => lb && { ...lb, index: (lb.index + 1) % lb.urls.length }); }}
                style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--cream)", background: "transparent", border: "1px solid var(--cream)", padding: "0.75rem 1rem" }}
              >›</button>
            </>
          )}
          <button
            aria-label="Sluiten"
            onClick={() => setLightbox(null)}
            style={{ position: "absolute", top: "1rem", right: "1rem", color: "var(--cream)", background: "transparent", border: "1px solid var(--cream)", padding: "0.5rem 0.85rem" }}
          >✕</button>
        </div>
      )}
    </div>
  );
}