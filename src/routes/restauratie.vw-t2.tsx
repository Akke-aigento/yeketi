import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { BeforeAfter } from "@/components/BeforeAfter";
import { t } from "@/lib/copy";
import beforeImg from "@/assets/vw-t2-before.jpg";
import afterImg from "@/assets/vw-t2-after.jpg";
import handsImg from "@/assets/craftsman-hands.jpg";
import teamImg from "@/assets/workshop-team.jpg";
import heroImg from "@/assets/hero-workshop.jpg";
import arrivalImg from "@/assets/oldtimer-arrival.jpg";
import interiorImg from "@/assets/oldtimer-interior.jpg";
import deliveryImg from "@/assets/oldtimer-delivery.jpg";

const chapterImages = [arrivalImg, handsImg, teamImg, heroImg, interiorImg, deliveryImg];

export const Route = createFileRoute("/restauratie/vw-t2")({
  head: () => ({
    meta: [
      { title: "Een VW T2, herboren — Yeketi Motorworks" },
      { name: "description", content: "Negen maanden, drie ambachtslieden, één doel: een VW T2 uit 1972 terugbrengen in fabrieksstaat." },
      { property: "og:title", content: "Een VW T2, herboren" },
      { property: "og:description", content: "Chronologisch foto-verslag van een volledige VW T2-restauratie." },
      { property: "og:type", content: "article" },
      { property: "og:image", content: afterImg },
      { name: "twitter:image", content: afterImg },
      { property: "og:url", content: "/restauratie/vw-t2" },
    ],
    links: [{ rel: "canonical", href: "/restauratie/vw-t2" }],
  }),
  component: CaseStudy,
});

function CaseStudy() {
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

        <div className="container-edit">
          <ScrollReveal delay={80}>
            <BeforeAfter before={beforeImg} after={afterImg} alt="VW T2 voor en na restauratie" />
          </ScrollReveal>
        </div>

        <section className="container-edit" style={{ paddingBlock: "clamp(4rem,8vw,7rem)" }}>
          <div className="grid lg:grid-cols-12 gap-10">
            {/* timeline rail */}
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
                  Maand 1 — Maand 9
                </p>
              </div>
            </aside>

            <div className="lg:col-span-10 lg:col-start-2 space-y-24">
              {t.caseT2.chapters.map((c, i) => (
                <ScrollReveal key={c.t} delay={i * 60}>
                  <article className={`grid gap-8 md:grid-cols-12 items-center ${i % 2 === 1 ? "md:[direction:rtl]" : ""}`}>
                    <div className="md:col-span-6" style={{ direction: "ltr" }}>
                      <img
                        src={chapterImages[i % chapterImages.length]}
                        alt={c.t}
                        loading="lazy"
                        className="w-full block"
                        style={{ aspectRatio: "4/3", objectFit: "cover", border: "1px solid var(--charcoal)" }}
                      />
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
                <Link to="/offerte" className="btn-y-ghost-cream">Start uw restauratie</Link>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}