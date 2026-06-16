import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { submitContactForm } from "@/lib/messages.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Yeketi Motorworks" },
      { name: "description", content: "Stuur een bericht naar Yeketi Motorworks. Persoonlijk antwoord, geen formulierbrij." },
      { property: "og:title", content: "Contact — Yeketi Motorworks" },
      { property: "og:description", content: "Stuur een bericht naar Yeketi Motorworks." },
      { property: "og:url", content: "https://yeketimotorworks.com/contact" },
    ],
    links: [{ rel: "canonical", href: "https://yeketimotorworks.com/contact" }],
  }),
  component: Contact,
});

function Contact() {
  const submit = useServerFn(submitContactForm);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    setStatus("sending");
    try {
      await submit({
        data: {
          naam: String(fd.get("naam") ?? ""),
          email: String(fd.get("email") ?? ""),
          bericht: String(fd.get("bericht") ?? ""),
          hp: String(fd.get("website") ?? ""),
        },
      });
      setStatus("ok");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setStatus("err");
      setErrorMsg((err as Error).message || "Er ging iets mis. Probeer opnieuw.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="container-edit" style={{ paddingBlock: "clamp(3.5rem,7vw,6rem)", maxWidth: "780px" }}>
          <ScrollReveal>
            <p className="eyebrow">Contact</p>
            <h1 className="mt-5" style={{ fontSize: "clamp(2.2rem,5vw,3.6rem)" }}>Stuur een bericht</h1>
            <p className="mt-6" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
              Een vraag, een idee, of gewoon zin om eens te praten over een klassieker?
              Schrijf een bericht. Baram antwoordt persoonlijk.
            </p>
          </ScrollReveal>

          {status === "ok" ? (
            <ScrollReveal>
              <div className="mt-12" style={{ border: "1px solid var(--brass)", padding: "2.5rem" }}>
                <p className="italic-quote" style={{ color: "var(--brass)", fontSize: "1.35rem" }}>
                  Bedankt — je bericht is binnen.
                </p>
                <p className="mt-4" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
                  We sturen je ook een uitnodiging voor het portaal, zodat je het antwoord
                  en alle vervolgberichten op één plek terugvindt.
                </p>
                <Link to="/" className="btn-y mt-8 inline-flex">Terug naar de site</Link>
              </div>
            </ScrollReveal>
          ) : (
            <form onSubmit={onSubmit} className="mt-12 grid gap-6">
              <div>
                <label className="eyebrow block mb-3" htmlFor="naam">Naam *</label>
                <input id="naam" name="naam" required maxLength={120} className="field-y" />
              </div>
              <div>
                <label className="eyebrow block mb-3" htmlFor="email">E-mail *</label>
                <input id="email" name="email" type="email" required maxLength={255} className="field-y" />
              </div>
              <div>
                <label className="eyebrow block mb-3" htmlFor="bericht">Bericht *</label>
                <textarea id="bericht" name="bericht" required rows={6} maxLength={3000} className="field-y" style={{ resize: "vertical" }} />
              </div>
              {/* Honeypot */}
              <div style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              {errorMsg && <p style={{ color: "var(--oxide)" }}>{errorMsg}</p>}
              <div>
                <button type="submit" className="btn-y-solid" disabled={status === "sending"}>
                  {status === "sending" ? "Versturen…" : "Verstuur bericht"}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}