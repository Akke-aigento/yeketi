import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useT } from "@/lib/i18n";
import type { Copy } from "@/lib/copy";
import shot01 from "@/assets/projects/vw-t2/t2-01-aankomst.jpg.asset.json";
import shot02 from "@/assets/projects/vw-t2/t2-02-inspectie-zij.jpg.asset.json";
import shot03 from "@/assets/projects/vw-t2/t2-03-inspectie-voor.jpg.asset.json";
import shot04 from "@/assets/projects/vw-t2/t2-04-strippen.jpg.asset.json";
import shot05 from "@/assets/projects/vw-t2/t2-05-plamuur.jpg.asset.json";
import shot06 from "@/assets/projects/vw-t2/t2-06-eindcontrole-klant.jpg.asset.json";
import shot07 from "@/assets/projects/vw-t2/t2-07-onderweg.jpg.asset.json";

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
  component: RecentWerk,
});

type Shot = { src: string; ratio: string; month: "may" | "jun"; key: keyof Copy["recentWerk"]["shots"] };

const t2Shots: Shot[] = [
  { src: shot01.url, ratio: "4/3", month: "may", key: "aankomst" },
  { src: shot03.url, ratio: "4/3", month: "may", key: "inventaris" },
  { src: shot02.url, ratio: "4/3", month: "may", key: "slaapdak" },
  { src: shot04.url, ratio: "4/3", month: "may", key: "ontmanteling" },
  { src: shot05.url, ratio: "4/3", month: "may", key: "plamuur" },
  { src: shot06.url, ratio: "4/3", month: "may", key: "eindcontrole" },
  { src: shot07.url, ratio: "4/3", month: "jun", key: "onderweg" },
];

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

            {/* Project 01 — VW T2 Westfalia */}
            <article className="mt-16 md:mt-20">
              <ScrollReveal>
                <div className="flex items-baseline gap-4 flex-wrap">
                  <span className="eyebrow" style={{ color: "var(--brass)" }}>{t.recentWerk.projectLabel}</span>
                  <span style={{ height: "1px", background: "var(--brass)", width: "60px" }} />
                </div>
                <h2 className="mt-4" style={{ fontSize: "clamp(1.8rem,3.6vw,2.8rem)" }}>
                  {t.recentWerk.projectTitle}
                </h2>
                <p className="mt-4 max-w-2xl" style={{ color: "var(--charcoal-soft)", lineHeight: 1.75 }}>
                  {t.recentWerk.projectBody}
                </p>
              </ScrollReveal>

              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {t2Shots.map((s, i) => {
                  const shot = t.recentWerk.shots[s.key];
                  const date = s.month === "jun" ? t.recentWerk.monthJun : t.recentWerk.monthMay;
                  return (
                    <ScrollReveal key={s.src} delay={(i % 3) * 80}>
                      <figure style={{ border: "1px solid var(--charcoal)" }}>
                        <img
                          src={s.src}
                          alt={shot.alt}
                          loading="lazy"
                          className="w-full block"
                          style={{ objectFit: "cover", aspectRatio: s.ratio }}
                        />
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
                          <span className="eyebrow" style={{ color: "var(--brass)", display: "block", marginBottom: "0.35rem" }}>
                            {date}
                          </span>
                          {shot.caption}
                        </figcaption>
                      </figure>
                    </ScrollReveal>
                  );
                })}
              </div>
            </article>

            {/* Next-project placeholder */}
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
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}