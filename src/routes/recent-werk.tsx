import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useT } from "@/lib/i18n";
import { getPublishedRecentWork } from "@/lib/recent-work.functions";
import { isExternalPhoto } from "@/lib/recent-work";

const recentWorkQuery = queryOptions({
  queryKey: ["recent-werk", "public"],
  queryFn: () => getPublishedRecentWork(),
});

export const Route = createFileRoute("/recent-werk")({
  head: () => ({
    meta: [
      { title: "Recent werk · Yeketi Motorworks" },
      { name: "description", content: "Een visueel overzicht van recente restauraties — de beelden spreken voor zich." },
      { property: "og:title", content: "Recent werk · Yeketi Motorworks" },
      { property: "og:description", content: "Een visueel overzicht van recente restauraties." },
      { property: "og:url", content: "https://yeketimotorworks.com/recent-werk" },
    ],
    links: [{ rel: "canonical", href: "https://yeketimotorworks.com/recent-werk" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(recentWorkQuery),
  errorComponent: ({ error }) => (
    <div className="container-edit" style={{ paddingBlock: "5rem" }}>
      <p style={{ color: "var(--oxide)" }}>Laden mislukt: {error.message}</p>
    </div>
  ),
  notFoundComponent: () => null,
  component: RecentWerk,
});

function RecentWerk() {
  const t = useT();
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <section style={{ paddingBlock: "clamp(3rem,7vw,6rem)" }}>
          <div className="container-edit">
            <ScrollReveal>
              <p className="eyebrow">{t.recentWerk.eyebrow}</p>
              <h1 className="mt-5 max-w-3xl" style={{ fontSize: "clamp(2rem,4.4vw,3.6rem)" }}>
                {t.recentWerk.title}
              </h1>
              <p className="mt-5 max-w-xl italic-quote" style={{ color: "var(--charcoal-soft)", fontSize: "1.1rem" }}>
                {t.recentWerk.intro}
              </p>
            </ScrollReveal>
            <Suspense fallback={<p className="mt-12 eyebrow" style={{ color: "var(--charcoal-soft)" }}>Laden…</p>}>
              <PublicationsList />
            </Suspense>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function PublicationsList() {
  const t = useT();
  const { data } = useSuspenseQuery(recentWorkQuery);
  const { publications, items, urls } = data;

  function photoUrl(p: string) {
    return isExternalPhoto(p) ? p : (urls[p] ?? "");
  }

  if (publications.length === 0) {
    return (
      <ScrollReveal>
        <div
          className="mt-16 text-center"
          style={{
            border: "1px dashed var(--brass)",
            padding: "clamp(2.5rem,5vw,4rem) 1.5rem",
            background: "color-mix(in srgb, var(--cream) 70%, transparent)",
          }}
        >
          <p className="eyebrow" style={{ color: "var(--brass)" }}>{t.recentWerk.comingSoonLabel}</p>
          <p className="mt-4 italic-quote mx-auto max-w-xl" style={{ color: "var(--charcoal-soft)", fontSize: "1.1rem" }}>
            {t.recentWerk.comingSoonBody}
          </p>
        </div>
      </ScrollReveal>
    );
  }

  return (
    <>
      {publications.map((pub, pi) => {
        const projectNumber = `Project ${String(pi + 1).padStart(2, "0")}`;
        const projectLabel = pub.year_label ? `${projectNumber} · ${pub.year_label}` : projectNumber;
        const pubItems = items.filter((it) => it.publication_id === pub.id);
        return (
          <article key={pub.id} className="mt-16 md:mt-20">
            <ScrollReveal>
              <div className="flex items-baseline gap-4 flex-wrap">
                <span className="eyebrow" style={{ color: "var(--brass)" }}>{projectLabel}</span>
                <span style={{ height: "1px", background: "var(--brass)", width: "60px" }} />
              </div>
              <h2 className="mt-4" style={{ fontSize: "clamp(1.8rem,3.6vw,2.8rem)" }}>
                {pub.title}
              </h2>
              {pub.subtitle && (
                <p className="mt-4 max-w-2xl" style={{ color: "var(--charcoal-soft)", lineHeight: 1.75 }}>
                  {pub.subtitle}
                </p>
              )}
            </ScrollReveal>

            {pubItems.length > 0 && (
              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {pubItems.map((it, i) => (
                  <ScrollReveal key={it.id} delay={(i % 3) * 80}>
                    <figure style={{ border: "1px solid var(--charcoal)" }}>
                      {(it as { media_type?: string }).media_type === "video" ? (
                        <video
                          src={photoUrl(it.photo_path)}
                          poster={(it as { poster_path?: string | null }).poster_path
                            ? photoUrl((it as { poster_path: string }).poster_path)
                            : undefined}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full block"
                          style={{ objectFit: "cover", aspectRatio: "4/5", background: "#000" }}
                        />
                      ) : (
                        <img
                          src={photoUrl(it.photo_path)}
                          alt={it.caption ?? pub.title}
                          loading="lazy"
                          className="w-full block"
                          style={{ objectFit: "cover", aspectRatio: "4/5" }}
                        />
                      )}
                      <figcaption
                        style={{
                          padding: "0.9rem 1rem 1rem",
                          background: "var(--cream)",
                          borderTop: "1px solid var(--charcoal)",
                          fontSize: "0.85rem",
                          color: "var(--charcoal-soft)",
                          lineHeight: 1.55,
                        }}
                      >
                        {it.date_label && (
                          <span className="eyebrow" style={{ color: "var(--brass)", display: "block", marginBottom: "0.35rem" }}>
                            {it.date_label}
                          </span>
                        )}
                        {it.caption}
                      </figcaption>
                    </figure>
                  </ScrollReveal>
                ))}
              </div>
            )}
          </article>
        );
      })}

      {publications.length === 1 && (
        <ScrollReveal>
          <div
            className="mt-20 md:mt-28 text-center"
            style={{
              border: "1px dashed var(--charcoal)",
              padding: "clamp(2.5rem,5vw,4rem) 1.5rem",
              background: "color-mix(in srgb, var(--cream) 70%, transparent)",
            }}
          >
            <p className="eyebrow" style={{ color: "var(--brass)" }}>{t.recentWerk.comingSoonLabel}</p>
            <p
              className="mt-4 italic-quote mx-auto max-w-xl"
              style={{ color: "var(--charcoal-soft)", fontSize: "1.1rem", lineHeight: 1.6 }}
            >
              {t.recentWerk.comingSoonBody}
            </p>
          </div>
        </ScrollReveal>
      )}
    </>
  );
}