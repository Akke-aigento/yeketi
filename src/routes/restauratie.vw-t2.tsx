import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useT } from "@/lib/i18n";
import { WeldingVideo } from "@/components/WeldingVideo";
import arrivalAsset from "@/assets/projects/vw-t2/t2-01-aankomst.jpg.asset.json";
import strippenAsset from "@/assets/projects/vw-t2/t2-04-strippen.jpg.asset.json";
import plamuurAsset from "@/assets/projects/vw-t2/t2-05-plamuur.jpg.asset.json";
import trotsAsset from "@/assets/projects/vw-t2/t2-06-baraam-trots.jpg.asset.json";
import eindcontroleAsset from "@/assets/projects/vw-t2/t2-06-eindcontrole-klant.jpg.asset.json";
import onderwegAsset from "@/assets/projects/vw-t2/t2-07-onderweg.jpg.asset.json";

const chapterImages = [
  arrivalAsset.url,
  strippenAsset.url,
  plamuurAsset.url,
  trotsAsset.url,
  eindcontroleAsset.url,
  onderwegAsset.url,
];
const ogImage = onderwegAsset.url;

export const Route = createFileRoute("/restauratie/vw-t2")({
  head: () => ({
    meta: [
      { title: "Restauratie — onze werkwijze · Yeketi Motorworks" },
      { name: "description", content: "Van aankomst tot aflevering: hoe wij een klassieker in ongeveer drie maanden terugbrengen in originele staat — parallel werk in gespecialiseerde werkplaatsen." },
      { property: "og:title", content: "Restauratie — onze werkwijze" },
      { property: "og:description", content: "Chronologisch verslag van een volledige oldtimer-restauratie." },
      { property: "og:type", content: "article" },
      { property: "og:image", content: ogImage },
      { name: "twitter:image", content: ogImage },
      { property: "og:url", content: "https://yeketimotorworks.com/restauratie/vw-t2" },
    ],
    links: [{ rel: "canonical", href: "https://yeketimotorworks.com/restauratie/vw-t2" }],
  }),
  component: CaseStudy,
});

function CaseStudy() {
  const t = useT();
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <header className="container-edit" style={{ paddingBlock: "clamp(3.5rem,7vw,6rem)" }}>
          <ScrollReveal>
            <p className="eyebrow">{t.caseT2.eyebrow}</p>
            <h1 className="mt-5 max-w-4xl" style={{ fontSize: "clamp(2.4rem,6vw,4.8rem)" }}>
              {t.caseT2.title}
            </h1>
            <p className="mt-7 max-w-2xl italic-quote" style={{ color: "var(--charcoal-soft)", fontSize: "1.25rem", lineHeight: 1.55 }}>
              {t.caseT2.lead}
            </p>
          </ScrollReveal>
        </header>

        <section className="container-edit" style={{ paddingBlock: "clamp(4rem,8vw,7rem)" }}>
          <div className="grid lg:grid-cols-12 gap-10">
            {/* phase rail */}
            <aside className="hidden lg:block lg:col-span-1 relative">
              <div className="sticky top-28">
                <div
                  aria-hidden
                  style={{
                    width: "1px",
                    height: "200px",
                    background: "var(--brass)",
                    marginLeft: "10px",
                  }}
                />
                <p
                  className="eyebrow rotate-90 origin-top-left whitespace-nowrap"
                  style={{ transformOrigin: "0 0", marginTop: "-180px", marginLeft: "30px", color: "var(--brass)" }}
                >
                  Fase 01 — Fase 06
                </p>
              </div>
            </aside>

            <div className="lg:col-span-10 lg:col-start-2 space-y-24">
              {t.caseT2.chapters.map((c, i) => (
                <ScrollReveal key={c.t} delay={i * 60}>
                  <article className={`grid gap-8 md:grid-cols-12 items-center ${i % 2 === 1 ? "md:[direction:rtl]" : ""}`}>
                    <div className="md:col-span-6" style={{ direction: "ltr" }}>
                      {i === 1 ? (
                        <WeldingVideo
                          caption={t.caseT2.weldingVideoCaption}
                          ariaLabel={t.caseT2.weldingVideoAria}
                        />
                      ) : (
                        <img
                          src={chapterImages[i % chapterImages.length]}
                          alt={c.t}
                          loading="lazy"
                          className="w-full block"
                          style={{ aspectRatio: "4/3", objectFit: "cover", border: "1px solid var(--charcoal)" }}
                        />
                      )}
                    </div>
                    <div className="md:col-span-6" style={{ direction: "ltr" }}>
                      <div className="flex items-center gap-3">
                        <span className="eyebrow" style={{ color: "var(--brass)" }}>{c.date}</span>
                        <span style={{ height: "1px", background: "var(--brass)", width: "40px" }} />
                      </div>
                      <h2 className="mt-4" style={{ fontSize: "clamp(1.6rem,2.8vw,2.2rem)" }}>{c.t}</h2>
                      <p className="mt-4" style={{ color: "var(--charcoal-soft)", lineHeight: 1.75 }}>
                        {c.d}
                      </p>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section style={{ background: "var(--charcoal)", color: "var(--cream)", paddingBlock: "clamp(4rem,8vw,6rem)" }}>
          <div className="container-edit text-center max-w-3xl mx-auto">
            <ScrollReveal>
              <p className="italic-quote" style={{ color: "var(--gold)", fontSize: "clamp(1.5rem,2.6vw,2rem)", lineHeight: 1.5 }}>
                “{t.caseT2.closing}”
              </p>
              <div className="mt-10">
                <Link to="/offerte" className="btn-y-ghost-cream">{t.caseT2.cta}</Link>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}