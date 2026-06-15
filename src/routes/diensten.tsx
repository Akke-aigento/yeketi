import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useT } from "@/lib/i18n";
export const Route = createFileRoute("/diensten")({
  head: () => ({
    meta: [
      { title: "Diensten — Yeketi Motorworks" },
      { name: "description", content: "Plaatwerk, carrosserie en volledige restauratie van klassiekers — door meester-ambachtslieden." },
      { property: "og:title", content: "Diensten — Yeketi Motorworks" },
      { property: "og:description", content: "Plaatwerk en volledige restauratie van klassiekers." },
      { property: "og:url", content: "https://yeketimotorworks.com/diensten" },
    ],
    links: [{ rel: "canonical", href: "https://yeketimotorworks.com/diensten" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Restauratie van klassieke voertuigen",
          provider: { "@type": "LocalBusiness", name: "Yeketi Motorworks", url: "https://yeketimotorworks.com" },
          areaServed: ["NL", "BE", "DE", "LU", "FR"],
          description: "Plaatwerk, carrosserie en volledige restauratie van klassiekers door meester-ambachtslieden.",
        }),
      },
    ],
  }),
  component: Diensten,
});

function Diensten() {
  const t = useT();
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <header className="container-edit" style={{ paddingBlock: "clamp(3.5rem,7vw,6rem)" }}>
          <ScrollReveal>
            <p className="eyebrow">{t.diensten.eyebrow}</p>
            <h1 className="mt-5 max-w-3xl" style={{ fontSize: "clamp(2.2rem,5vw,3.8rem)" }}>
              {t.diensten.title}
            </h1>
            <p className="mt-6 max-w-2xl" style={{ color: "var(--charcoal-soft)", fontSize: "1.05rem", lineHeight: 1.7 }}>
              {t.diensten.intro}
            </p>
          </ScrollReveal>
        </header>

        <span className="hairline-brass" />

        <section className="container-edit" style={{ paddingBlock: "clamp(3rem,7vw,6rem)" }}>
          <div className="grid gap-10 md:grid-cols-2">
            {t.diensten.tiers.map((tier, i) => (
              <ScrollReveal key={tier.t} delay={i * 100}>
                <article style={{ border: "1px solid var(--charcoal)", padding: "2.5rem", height: "100%", display: "flex", flexDirection: "column" }}>
                  <p className="eyebrow">0{i + 1}</p>
                  <h2 className="mt-4" style={{ fontSize: "clamp(1.6rem,2.8vw,2.2rem)" }}>{tier.t}</h2>
                  <p className="italic-quote mt-2" style={{ color: "var(--brass)", fontSize: "1.1rem" }}>{tier.sub}</p>
                  <ul className="mt-6 space-y-3" style={{ color: "var(--charcoal-soft)" }}>
                    {tier.items.map((it) => (
                      <li key={it} className="flex gap-3">
                        <span style={{ color: "var(--brass)", marginTop: "2px" }}>—</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-10">
                    <Link to="/offerte" className="btn-y">{tier.cta}</Link>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </section>

        <section style={{ background: "var(--cream-deep)", paddingBlock: "clamp(3rem,7vw,6rem)" }}>
          <div className="container-edit grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <ScrollReveal>
                <p className="eyebrow">FAQ</p>
                <h2 className="mt-4" style={{ fontSize: "clamp(1.8rem,3.4vw,2.6rem)" }}>{t.diensten.faqTitle}</h2>
              </ScrollReveal>
            </div>
            <div className="lg:col-span-7 lg:col-start-6">
              <div style={{ borderTop: "1px solid var(--charcoal)" }}>
                {t.diensten.faq.map((item, i) => (
                  <FaqRow key={i} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid var(--charcoal)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-6 text-left"
        style={{ paddingBlock: "1.4rem" }}
        aria-expanded={open}
      >
        <span style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", color: "var(--charcoal)" }}>{q}</span>
        <span style={{ color: "var(--brass)" }}>{open ? <Minus size={18} /> : <Plus size={18} />}</span>
      </button>
      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? "400px" : "0",
          transition: "max-height 360ms ease",
        }}
      >
        <p className="pb-6 pr-8" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
          {a}
        </p>
      </div>
    </div>
  );
}