import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { t } from "@/lib/copy";
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

type Shot = { src: string; alt: string; ratio: string; caption: string; date: string };

const t2Shots: Shot[] = [
  { src: shot01.url, alt: "VW T2 Westfalia bij aankomst, achterklep open", ratio: "4/3", date: "Mei 2024", caption: "Aankomst — Baraam en de eigenaar overlopen de staat van de bus." },
  { src: shot03.url, alt: "VW T2 Westfalia vooraanzicht in tweekleurige originele lak", ratio: "4/3", date: "Mei 2024", caption: "Inventaris — alle originele delen blijven behouden waar het kan." },
  { src: shot02.url, alt: "VW T2 Westfalia zijaanzicht met opgeklapt slaapdak", ratio: "4/3", date: "Mei 2024", caption: "Slaapdak opgemeten, kap en scharnieren grondig nagekeken." },
  { src: shot04.url, alt: "VW T2 ontdaan van rubbers en ramen, klaar voor schuurwerk", ratio: "4/3", date: "Mei 2024", caption: "Ontmanteling — rubbers, ramen en sierlijsten gaan eruit voor het plaatwerk." },
  { src: shot05.url, alt: "VW T2 in plamuur, gemaskeerd voor spuitwerk", ratio: "4/3", date: "Mei 2024", caption: "Plamuur en schuurwerk — laag per laag tot het oppervlak weer strak is." },
  { src: shot06.url, alt: "Baraam Yeketi en klant bij de afgewerkte VW T2 Westfalia", ratio: "4/3", date: "Mei 2024", caption: "Eindcontrole — Baraam tekent pas af als élk detail klopt." },
  { src: shot07.url, alt: "Gerestaureerde VW T2 Westfalia in een bergachtig landschap", ratio: "4/3", date: "Juni 2024", caption: "Onderweg — de bus rijdt weer waar hij thuishoort." },
];

function RecentWerk() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <section style={{ paddingBlock: "clamp(3rem,7vw,6rem)" }}>
          <div className="container-edit">
            <ScrollReveal>
              <p className="eyebrow">{t.recent.eyebrow}</p>
              <h1 className="mt-5 max-w-3xl" style={{ fontSize: "clamp(2rem,4.4vw,3.6rem)" }}>
                Recent werk.
              </h1>
              <p className="mt-5 max-w-xl italic-quote" style={{ color: "var(--charcoal-soft)", fontSize: "1.1rem" }}>
                Elke restauratie krijgt hier zijn eigen verhaal. We beginnen bij het allereerste project — en bouwen verder, bus per bus.
              </p>
            </ScrollReveal>

            {/* Project 01 — VW T2 Westfalia */}
            <article className="mt-16 md:mt-20">
              <ScrollReveal>
                <div className="flex items-baseline gap-4 flex-wrap">
                  <span className="eyebrow" style={{ color: "var(--brass)" }}>Project 01 · 2024</span>
                  <span style={{ height: "1px", background: "var(--brass)", width: "60px" }} />
                </div>
                <h2 className="mt-4" style={{ fontSize: "clamp(1.8rem,3.6vw,2.8rem)" }}>
                  VW T2 Westfalia — van schuurvondst tot bergpas.
                </h2>
                <p className="mt-4 max-w-2xl" style={{ color: "var(--charcoal-soft)", lineHeight: 1.75 }}>
                  Een originele Westfalia camper, binnengebracht met sporen van jarenlang stilstaan. Plaatwerk, slaapdak, lak en
                  techniek — alles ging eerst uit elkaar voor het er weer in mocht. Hieronder de chronologie, van eerste inspectie
                  tot eerste rit door de bergen.
                </p>
              </ScrollReveal>

              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {t2Shots.map((s, i) => (
                  <ScrollReveal key={s.src} delay={(i % 3) * 80}>
                    <figure style={{ border: "1px solid var(--charcoal)" }}>
                      <img
                        src={s.src}
                        alt={s.alt}
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
                          {s.date}
                        </span>
                        {s.caption}
                      </figcaption>
                    </figure>
                  </ScrollReveal>
                ))}
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
                <p className="eyebrow" style={{ color: "var(--brass)" }}>Project 02 · binnenkort</p>
                <p
                  className="mt-4 italic-quote mx-auto max-w-xl"
                  style={{ color: "var(--charcoal-soft)", fontSize: "1.1rem", lineHeight: 1.6 }}
                >
                  De volgende klassieker staat al in de werkplaats. Foto's en verhaal volgen zodra het werk vordert.
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