import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { submitContactForm } from "@/lib/messages.functions";
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const submit = useServerFn(submitContactForm);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locale, setLocale] = useState<"nl" | "en">("nl");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;
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
          locale,
        },
      });
      setStatus("ok");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setStatus("err");
      setErrorMsg((err as Error).message || t.contact.error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="container-edit" style={{ paddingBlock: "clamp(3.5rem,7vw,6rem)", maxWidth: "780px" }}>
          <ScrollReveal>
            <p className="eyebrow">{t.contact.eyebrow}</p>
            <h1 className="mt-5" style={{ fontSize: "clamp(2.2rem,5vw,3.6rem)" }}>{t.contact.title}</h1>
            <p className="mt-6" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
              {t.contact.intro}
            </p>
          </ScrollReveal>

          {status === "ok" ? (
            <ScrollReveal>
              <div className="mt-12" style={{ border: "1px solid var(--brass)", padding: "2.5rem" }}>
                <p className="italic-quote" style={{ color: "var(--brass)", fontSize: "1.35rem" }}>
                  {t.contact.successTitle}
                </p>
                <p className="mt-4" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
                  {t.contact.successBody}
                </p>
                <Link to="/" className="btn-y mt-8 inline-flex">{t.contact.back}</Link>
              </div>
            </ScrollReveal>
          ) : (
            <form onSubmit={onSubmit} className="mt-12 grid gap-6">
              <div>
                <span className="eyebrow block mb-3">{t.contact.langLabel}</span>
                <div className="flex gap-2">
                  {(["nl", "en"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLocale(l)}
                      className="text-[11px] uppercase tracking-[0.18em] px-4 py-2"
                      style={{
                        border: "1px solid var(--charcoal)",
                        background: locale === l ? "var(--charcoal)" : "transparent",
                        color: locale === l ? "var(--cream)" : "var(--charcoal)",
                      }}
                    >
                      {l === "nl" ? t.contact.langNl : t.contact.langEn}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="eyebrow block mb-3" htmlFor="naam">{t.contact.nameLabel} *</label>
                <input id="naam" name="naam" required maxLength={120} className="field-y" />
              </div>
              <div>
                <label className="eyebrow block mb-3" htmlFor="email">{t.contact.emailLabel} *</label>
                <input id="email" name="email" type="email" required maxLength={255} className="field-y" />
              </div>
              <div>
                <label className="eyebrow block mb-3" htmlFor="bericht">{t.contact.messageLabel} *</label>
                <textarea id="bericht" name="bericht" required rows={6} maxLength={3000} className="field-y" style={{ resize: "vertical" }} />
              </div>
              {/* Honeypot */}
              <div style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
              {errorMsg && <p style={{ color: "var(--oxide)" }}>{errorMsg}</p>}
              <div>
                <button type="submit" className="btn-y-solid inline-flex items-center gap-2" disabled={status === "sending"}>
                  {status === "sending" && <Spinner />}
                  {status === "sending" ? t.contact.sending : t.contact.submit}
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

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: "2px solid currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "yeketi-spin 0.7s linear infinite",
      }}
    />
  );
}