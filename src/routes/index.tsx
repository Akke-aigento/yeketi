import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useT } from "@/lib/i18n";
import handsImg from "@/assets/craftsman-hands.jpg";
import heroAsset from "@/assets/projects/vw-t2/t2-hero-workshop.jpg.asset.json";
import { WeldingVideo } from "@/components/WeldingVideo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Yeketi Motorworks — Restauratie van klassiekers" },
      {
        name: "description",
        content:
          "Vakmanschap dat verdwijnt, leeft hier verder. Restauratie van klassiekers door meester-ambachtslieden — persoonlijk begeleid van inspectie tot aflevering.",
      },
      { property: "og:title", content: "Yeketi Motorworks" },
      { property: "og:description", content: "Restauratie van klassiekers door meester-ambachtslieden." },
      { property: "og:url", content: "https://yeketimotorworks.com/" },
    ],
    links: [{ rel: "canonical", href: "https://yeketimotorworks.com/" }],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <Story />
        <Process />
        <Why />
        <Recent />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  const t = useT();
  return (
    <section className="relative" style={{ background: "var(--cream)" }}>
      <div className="container-edit grid gap-10 lg:grid-cols-12 lg:gap-16" style={{ paddingBlock: "clamp(3rem,8vw,7rem)" }}>
        <div className="lg:col-span-6 flex flex-col justify-center">
          <ScrollReveal>
            <p className="eyebrow">{t.hero.eyebrow}</p>
            <h1 className="mt-6" style={{ fontSize: "clamp(2.4rem, 5.8vw, 4.6rem)" }}>
              {t.hero.headline}
            </h1>
            <p className="mt-7 max-w-xl" style={{ color: "var(--charcoal-soft)", fontSize: "1.05rem", lineHeight: 1.65 }}>
              {t.hero.subline}
            </p>
            <p className="italic-quote mt-6" style={{ color: "var(--brass)", fontSize: "1.4rem" }}>
              {t.brand.tagline}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/offerte" className="btn-y-solid">
                {t.hero.ctaQuote} <ArrowRight size={16} />
              </Link>
              <Link to="/login" className="btn-y">
                {t.hero.ctaFollow}
              </Link>
            </div>
          </ScrollReveal>
        </div>
        <div className="lg:col-span-6">
          <ScrollReveal delay={120}>
            <figure className="relative">
              <img
                src={heroAsset.url}
                alt={t.hero.imageAlt}
                width={1920}
                height={1280}
                className="w-full h-auto block"
                style={{ aspectRatio: "16/11", objectFit: "cover", border: "1px solid var(--charcoal)" }}
              />
              <figcaption
                className="absolute -bottom-px right-0 px-4 py-2"
                style={{
                  background: "var(--cream)",
                  borderLeft: "1px solid var(--charcoal)",
                  borderTop: "1px solid var(--charcoal)",
                  fontFamily: "var(--font-italic)",
                  fontStyle: "italic",
                  color: "var(--charcoal-soft)",
                  fontSize: "0.85rem",
                }}
              >
                {t.hero.imageCaption}
              </figcaption>
            </figure>
          </ScrollReveal>
        </div>
      </div>
      <span className="hairline-brass" />
    </section>
  );
}

function Story() {
  const t = useT();
  return (
    <section style={{ paddingBlock: "clamp(4rem,9vw,8rem)" }}>
      <div className="container-edit grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <ScrollReveal>
            <p className="eyebrow">{t.story.eyebrow}</p>
            <h2 className="mt-5" style={{ fontSize: "clamp(1.8rem,3.4vw,2.8rem)" }}>
              {t.story.title}
            </h2>
          </ScrollReveal>
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <ScrollReveal delay={120}>
            <div className="space-y-6" style={{ color: "var(--charcoal-soft)", fontSize: "1.05rem", lineHeight: 1.75 }}>
              {t.story.body.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <figure className="mt-12 flex flex-col md:flex-row gap-8 items-center">
              <img
                src={handsImg}
                alt="Handen van een meester-ambachtsman met een brass hamer"
                loading="lazy"
                width={1280}
                height={1600}
                className="w-full md:w-1/2"
                style={{ aspectRatio: "4/5", objectFit: "cover", border: "1px solid var(--charcoal)" }}
              />
              <blockquote className="md:w-1/2">
                <p className="italic-quote" style={{ fontSize: "clamp(1.3rem,2.2vw,1.8rem)", lineHeight: 1.4, color: "var(--charcoal)" }}>
                  “{t.story.pullQuote}”
                </p>
                <footer className="mt-5 eyebrow" style={{ color: "var(--brass)" }}>
                  {t.story.pullAttribution}
                </footer>
              </blockquote>
            </figure>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

function Process() {
  const t = useT();
  return (
    <section style={{ background: "var(--cream-deep)", paddingBlock: "clamp(4rem,9vw,7rem)" }}>
      <div className="container-edit">
        <ScrollReveal>
          <p className="eyebrow">{t.process.eyebrow}</p>
          <h2 className="mt-4 max-w-3xl" style={{ fontSize: "clamp(1.8rem,3.4vw,2.8rem)" }}>
            {t.process.title}
          </h2>
        </ScrollReveal>

        <div className="mt-16 grid gap-y-12 md:grid-cols-5 md:gap-x-6 relative">
          {/* horizontal brass connector on desktop */}
          <div
            className="hidden md:block absolute left-0 right-0"
            style={{ top: "26px", height: "1px", background: "var(--brass)", opacity: 0.5 }}
            aria-hidden
          />
          {t.process.steps.map((s, i) => (
            <ScrollReveal key={s.n} delay={i * 80}>
              <div className="relative pl-0">
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: "52px",
                    height: "52px",
                    background: "var(--cream-deep)",
                    border: "1px solid var(--brass)",
                    color: "var(--brass)",
                    fontFamily: "var(--font-display)",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {s.n}
                </div>
                <h3 className="mt-5" style={{ fontSize: "1.15rem" }}>{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--charcoal-soft)" }}>
                  {s.d}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Why() {
  const t = useT();
  return (
    <section style={{ paddingBlock: "clamp(4rem,9vw,8rem)" }}>
      <div className="container-edit">
        <ScrollReveal>
          <p className="eyebrow">{t.why.eyebrow}</p>
          <h2 className="mt-4 max-w-3xl" style={{ fontSize: "clamp(1.8rem,3.4vw,2.8rem)" }}>
            {t.why.title}
          </h2>
        </ScrollReveal>
        <div className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {t.why.items.map((it, i) => (
            <ScrollReveal key={it.t} delay={i * 90}>
              <article style={{ borderTop: "1px solid var(--brass)" }} className="pt-6">
                <h3 style={{ fontSize: "1.45rem" }}>{it.t}</h3>
                <p className="mt-3" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
                  {it.d}
                </p>
              </article>
            </ScrollReveal>
          ))}
        </div>
        <ScrollReveal delay={120}>
          <div className="mt-14 grid gap-8 md:grid-cols-12 items-center">
            <div className="md:col-span-7">
              <WeldingVideo
                caption={t.why.weldingVideo.caption}
                ariaLabel={t.why.weldingVideo.aria}
              />
            </div>
            <div className="md:col-span-5">
              <p className="eyebrow" style={{ color: "var(--brass)" }}>{t.why.proof.eyebrow}</p>
              <p className="mt-4" style={{ color: "var(--charcoal-soft)", lineHeight: 1.75 }}>
                {t.why.proof.body}
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function Recent() {
  const t = useT();
  return (
    <section style={{ paddingBlock: "clamp(4rem,9vw,8rem)", borderTop: "1px solid var(--charcoal)" }}>
      <div className="container-edit max-w-3xl">
        <ScrollReveal>
          <p className="eyebrow">{t.recent.eyebrow}</p>
          <h2 className="mt-5" style={{ fontSize: "clamp(1.8rem,3.4vw,2.8rem)" }}>
            {t.recent.title}
          </h2>
          <p className="mt-5" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
            {t.recent.body}
          </p>
          <Link to={t.recent.href} className="btn-y mt-8">
            {t.recent.cta} <ArrowRight size={16} />
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
