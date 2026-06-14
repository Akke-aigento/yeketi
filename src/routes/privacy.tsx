import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";

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
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="container-edit" style={{ paddingBlock: "clamp(3.5rem,7vw,6rem)", maxWidth: "780px" }}>
          <ScrollReveal>
            <p className="eyebrow">Juridisch</p>
            <h1 className="mt-5" style={{ fontSize: "clamp(2rem,4.5vw,3.2rem)" }}>
              Privacy &amp; cookies
            </h1>
            <p className="mt-6" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
              Laatste update: juni 2026. Deze verklaring is een plaatsing — definitieve juridische tekst wordt
              toegevoegd na controle door Nomadix BV.
            </p>
          </ScrollReveal>

          <div className="mt-12 space-y-10" style={{ color: "var(--charcoal-soft)", lineHeight: 1.75 }}>
            <ScrollReveal>
              <h2 style={{ fontSize: "1.5rem", color: "var(--charcoal)" }}>Verantwoordelijke</h2>
              <p className="mt-3">
                Yeketi Motorworks is een handelsnaam van <strong>Nomadix BV</strong>. Vestigings- en KvK-gegevens
                worden hier opgenomen zodra deze beschikbaar zijn. Contact:
                {" "}<a href="mailto:info@yeketimotorworks.com" style={{ color: "var(--brass)" }}>info@yeketimotorworks.com</a>.
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <h2 style={{ fontSize: "1.5rem", color: "var(--charcoal)" }}>Welke gegevens verzamelen wij</h2>
              <ul className="mt-3 list-disc pl-5 space-y-2">
                <li>Contactgegevens die je zelf invult via het offerteformulier (naam, e-mail, telefoon).</li>
                <li>Voertuiggegevens en foto&apos;s die je ons toestuurt voor een inschatting of restauratie.</li>
                <li>Inloggegevens van het klantenportaal (e-mailadres voor magic-link login).</li>
              </ul>
            </ScrollReveal>

            <ScrollReveal>
              <h2 style={{ fontSize: "1.5rem", color: "var(--charcoal)" }}>Waarvoor gebruiken wij ze</h2>
              <p className="mt-3">
                Uitsluitend om je offerteaanvraag te beantwoorden, je restauratie voor te bereiden en uit te voeren,
                en om je via het portaal en e-mail op de hoogte te houden van de voortgang.
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <h2 style={{ fontSize: "1.5rem", color: "var(--charcoal)" }}>Cookies</h2>
              <p className="mt-3">
                Wij gebruiken alleen functionele cookies die noodzakelijk zijn voor het inloggen op het
                klantenportaal. Geen tracking, geen advertentiecookies, geen analytics van derden.
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <h2 style={{ fontSize: "1.5rem", color: "var(--charcoal)" }}>Bewaartermijn</h2>
              <p className="mt-3">
                Offerteaanvragen worden 24 maanden bewaard. Project- en restauratiedossiers worden zolang bewaard
                als de wettelijke administratieplicht vereist (7 jaar).
              </p>
            </ScrollReveal>

            <ScrollReveal>
              <h2 style={{ fontSize: "1.5rem", color: "var(--charcoal)" }}>Jouw rechten</h2>
              <p className="mt-3">
                Je hebt recht op inzage, correctie en verwijdering van je gegevens. Stuur een e-mail naar
                {" "}<a href="mailto:info@yeketimotorworks.com" style={{ color: "var(--brass)" }}>info@yeketimotorworks.com</a>
                {" "}en we reageren binnen 30 dagen.
              </p>
            </ScrollReveal>

            <div className="pt-6">
              <Link to="/" className="btn-y">Terug naar home</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}