import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useT } from "@/lib/i18n";
import portrait from "@/assets/baraam-portrait.jpg.asset.json";
import team from "@/assets/workshop-team.jpg";

export const Route = createFileRoute("/over")({
  head: () => ({
    meta: [
      { title: "Over ons — Yeketi Motorworks" },
      { name: "description", content: "Het verhaal van Yekêtî: hoe een VW T2 uit 1978 en een reis tussen België en Koerdistan uitgroeiden tot een brug tussen twee werelden van vakmanschap." },
      { property: "og:title", content: "Ons verhaal — Yeketi Motorworks" },
      { property: "og:description", content: "Van een oude Volkswagen tot een onderneming die België en Koerdistan verbindt. Het verhaal van Baram, Wasta en de betekenis van Yekêtî." },
      { property: "og:url", content: "https://yeketimotorworks.com/over" },
    ],
    links: [{ rel: "canonical", href: "https://yeketimotorworks.com/over" }],
  }),
  component: Over,
});

function Over() {
  const t = useT();
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="container-edit" style={{ paddingBlock: "clamp(3.5rem,7vw,6rem)" }}>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16 items-start">
            <div className="lg:col-span-7">
              <ScrollReveal>
                <p className="eyebrow">{t.over.eyebrow}</p>
                <h1 className="mt-5" style={{ fontSize: "clamp(2.2rem,5vw,3.8rem)" }}>
                  {t.over.title}
                </h1>
                <div className="mt-10 space-y-6" style={{ color: "var(--charcoal-soft)", lineHeight: 1.75, fontSize: "1.05rem" }}>
                  {t.over.body.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </ScrollReveal>
            </div>
            <div className="lg:col-span-5">
              <ScrollReveal delay={120}>
                <figure>
                  <img
                    src={portrait.url}
                    alt="Portret van Baram, oprichter van Yeketi Motorworks"
                    loading="lazy"
                    width={1200}
                    height={1500}
                    className="w-full block"
                    style={{ aspectRatio: "4/5", objectFit: "cover", border: "1px solid var(--charcoal)" }}
                  />
                  <figcaption className="mt-3 italic-quote" style={{ color: "var(--charcoal-soft)" }}>
                    {t.over.founderName}
                  </figcaption>
                </figure>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section style={{ background: "var(--cream-deep)", paddingBlock: "clamp(3rem,6vw,5rem)" }}>
          <div className="container-edit grid gap-10 lg:grid-cols-12 items-center">
            <div className="lg:col-span-6">
              <img
                src={team}
                alt="Het werkplaatsteam aan het werk"
                loading="lazy"
                className="w-full block"
                style={{ aspectRatio: "16/11", objectFit: "cover", border: "1px solid var(--charcoal)" }}
              />
            </div>
            <div className="lg:col-span-5 lg:col-start-8">
              <blockquote>
                <p className="italic-quote" style={{ fontSize: "clamp(1.4rem,2.4vw,2rem)", lineHeight: 1.45 }}>
                  “{t.over.founderQuote}”
                </p>
                <footer className="mt-5 eyebrow" style={{ color: "var(--brass)" }}>— {t.over.founderName}</footer>
              </blockquote>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}