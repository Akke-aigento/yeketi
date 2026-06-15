import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy & cookies — Yeketi Motorworks" },
      { name: "description", content: "Hoe Yeketi Motorworks omgaat met je persoonlijke gegevens en cookies." },
      { property: "og:title", content: "Privacy & cookies — Yeketi Motorworks" },
      { property: "og:description", content: "Privacyverklaring en cookiebeleid." },
      { property: "og:url", content: "https://yeketimotorworks.com/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://yeketimotorworks.com/privacy" }],
  }),
  component: Privacy,
});

function Privacy() {
  const t = useT();
  const s = t.privacy.sections;
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="container-edit" style={{ paddingBlock: "clamp(3.5rem,7vw,6rem)", maxWidth: "780px" }}>
          <ScrollReveal>
            <p className="eyebrow">{t.privacy.eyebrow}</p>
            <h1 className="mt-5" style={{ fontSize: "clamp(2rem,4.5vw,3.2rem)" }}>
              {t.privacy.title}
            </h1>
            <p className="mt-6" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
              {t.privacy.lastUpdate}
            </p>
          </ScrollReveal>

          <div className="mt-12 space-y-10" style={{ color: "var(--charcoal-soft)", lineHeight: 1.75 }}>
            <ScrollReveal>
              <h2 style={{ fontSize: "1.5rem", color: "var(--charcoal)" }}>{s.responsibleTitle}</h2>
              <p className="mt-3">
                Yeketi Motorworks — <strong>Baram Maro</strong><br />
                {s.responsibleAddr}<br />
                {s.responsibleVat}<br />
                {s.contactLabel} <a href="mailto:info@yeketimotorworks.com" style={{ color: "var(--brass)" }}>info@yeketimotorworks.com</a>
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <h2 style={{ fontSize: "1.5rem", color: "var(--charcoal)" }}>{s.dataTitle}</h2>
              <ul className="mt-3 list-disc pl-5 space-y-2">
                {s.dataItems.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </ScrollReveal>

            <ScrollReveal>
              <h2 style={{ fontSize: "1.5rem", color: "var(--charcoal)" }}>{s.useTitle}</h2>
              <p className="mt-3">{s.useBody}</p>
            </ScrollReveal>

            <ScrollReveal>
              <h2 style={{ fontSize: "1.5rem", color: "var(--charcoal)" }}>{s.cookiesTitle}</h2>
              <p className="mt-3">{s.cookiesBody}</p>
            </ScrollReveal>

            <ScrollReveal>
              <h2 style={{ fontSize: "1.5rem", color: "var(--charcoal)" }}>{s.retentionTitle}</h2>
              <p className="mt-3">{s.retentionBody}</p>
            </ScrollReveal>

            <ScrollReveal>
              <h2 style={{ fontSize: "1.5rem", color: "var(--charcoal)" }}>{s.rightsTitle}</h2>
              <p className="mt-3">
                {s.rightsBefore}
                <a href="mailto:info@yeketimotorworks.com" style={{ color: "var(--brass)" }}>info@yeketimotorworks.com</a>
                {s.rightsAfter}
              </p>
            </ScrollReveal>

            <div className="pt-6">
              <Link to="/" className="btn-y">{t.privacy.back}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
