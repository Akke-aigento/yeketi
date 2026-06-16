import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useT } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { guardQuoteSubmission, linkQuoteRequestToConversation } from "@/lib/messages.functions";

export const Route = createFileRoute("/offerte")({
  head: () => ({
    meta: [
      { title: "Offerte aanvragen — Yeketi Motorworks" },
      { name: "description", content: "Vraag een persoonlijke offerte aan voor restauratie of plaatwerk van uw klassieker." },
      { property: "og:title", content: "Offerte aanvragen — Yeketi Motorworks" },
      { property: "og:description", content: "Vraag een persoonlijke offerte aan voor uw klassieker." },
      { property: "og:url", content: "https://yeketimotorworks.com/offerte" },
    ],
    links: [{ rel: "canonical", href: "https://yeketimotorworks.com/offerte" }],
  }),
  component: Offerte,
});

const schema = z.object({
  naam: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  telefoon: z.string().trim().max(40).optional().or(z.literal("")),
  merk: z.string().trim().max(80).optional().or(z.literal("")),
  model: z.string().trim().max(80).optional().or(z.literal("")),
  bouwjaar: z.string().trim().max(8).optional().or(z.literal("")),
  type_werk: z.enum(["plaatwerk", "volledige_restauratie", "advies"]),
  beschrijving: z.string().trim().max(3000).optional().or(z.literal("")),
});

function Offerte() {
  const t = useT();
  const guard = useServerFn(guardQuoteSubmission);
  const link = useServerFn(linkQuoteRequestToConversation);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [photoCount, setPhotoCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locale, setLocale] = useState<"nl" | "en">("nl");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const hp = String(fd.get("website") ?? "");
    const fileInput = form.elements.namedItem("fotos") as HTMLInputElement | null;
    const files = fileInput?.files ? Array.from(fileInput.files) : [];
    if (files.length > 5) {
      setErrorMsg(t.offerte.photoTooMany);
      return;
    }

    const parsed = schema.safeParse({
      naam: fd.get("naam"),
      email: fd.get("email"),
      telefoon: fd.get("telefoon"),
      merk: fd.get("merk"),
      model: fd.get("model"),
      bouwjaar: fd.get("bouwjaar"),
      type_werk: fd.get("type_werk"),
      beschrijving: fd.get("beschrijving"),
    });
    if (!parsed.success) {
      setErrorMsg(t.offerte.checkFields);
      return;
    }

    setStatus("sending");
    try {
      // Server-side honeypot + per-IP rate limit.
      await guard({ data: { hp } });
      const submissionPrefix = crypto.randomUUID();
      const foto_urls: string[] = [];
      for (const f of files) {
        if (!f.type.startsWith("image/")) {
          throw new Error(t.offerte.onlyImages);
        }
        if (f.size > 8 * 1024 * 1024) {
          throw new Error(t.offerte.photoTooLarge);
        }
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
        const path = `${submissionPrefix}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("quote-photos").upload(path, f, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.type,
        });
        if (upErr) throw upErr;
        foto_urls.push(path);
      }

      const { data: inserted, error } = await supabase.from("quote_requests").insert({
        ...parsed.data,
        telefoon: parsed.data.telefoon || null,
        merk: parsed.data.merk || null,
        model: parsed.data.model || null,
        bouwjaar: parsed.data.bouwjaar || null,
        beschrijving: parsed.data.beschrijving || null,
        foto_urls,
        locale,
      }).select("id").maybeSingle();
      if (error) throw error;
      if (inserted?.id) {
        try { await link({ data: { quoteRequestId: inserted.id } }); }
        catch (e) { console.warn("conversation link failed", e); }
      }
      setStatus("ok");
      form.reset();
      setPhotoCount(0);
    } catch (err) {
      console.error(err);
      setStatus("err");
      setErrorMsg(t.offerte.error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="container-edit" style={{ paddingBlock: "clamp(3.5rem,7vw,6rem)", maxWidth: "880px" }}>
          <ScrollReveal>
            <p className="eyebrow">{t.offerte.eyebrow}</p>
            <h1 className="mt-5" style={{ fontSize: "clamp(2.2rem,5vw,3.6rem)" }}>
              {t.offerte.title}
            </h1>
            <p className="mt-6 max-w-xl" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
              {t.offerte.intro}
            </p>
          </ScrollReveal>

          {status === "ok" ? (
            <ScrollReveal>
              <div className="mt-14" style={{ border: "1px solid var(--brass)", padding: "3rem" }}>
                <p className="italic-quote" style={{ color: "var(--brass)", fontSize: "1.4rem" }}>
                  {t.offerte.success.title}
                </p>
                <p className="mt-4" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
                  {t.offerte.success.body}
                </p>
                <Link to="/" className="btn-y mt-8 inline-flex">{t.offerte.back}</Link>
              </div>
            </ScrollReveal>
          ) : (
            <form onSubmit={onSubmit} className="mt-14 grid gap-8 md:grid-cols-2">
              <div className="md:col-span-2">
                <span className="eyebrow block mb-3">Taal · antwoord per mail</span>
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
                      {l === "nl" ? "Nederlands" : "English"}
                    </button>
                  ))}
                </div>
              </div>
              <Field label={t.offerte.labels.naam} name="naam" required />
              <Field label={t.offerte.labels.email} name="email" type="email" required />
              <Field label={t.offerte.labels.telefoon} name="telefoon" type="tel" />
              <Field label={t.offerte.labels.bouwjaar} name="bouwjaar" />
              <Field label={t.offerte.labels.merk} name="merk" />
              <Field label={t.offerte.labels.model} name="model" />

              <fieldset className="md:col-span-2 mt-4">
                <legend className="eyebrow">{t.offerte.labels.type}</legend>
                <div className="mt-4 flex flex-wrap gap-6">
                  {[
                    { v: "plaatwerk", l: t.offerte.labels.typePlaat },
                    { v: "volledige_restauratie", l: t.offerte.labels.typeFull },
                    { v: "advies", l: t.offerte.labels.typeAdvies },
                  ].map((opt, i) => (
                    <label key={opt.v} className="inline-flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="type_werk"
                        value={opt.v}
                        defaultChecked={i === 0}
                        required
                        className="accent-[var(--brass)]"
                        style={{ width: "16px", height: "16px" }}
                      />
                      <span>{opt.l}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="md:col-span-2">
                <label className="eyebrow block mb-3" htmlFor="beschrijving">{t.offerte.labels.beschrijving}</label>
                <textarea
                  id="beschrijving"
                  name="beschrijving"
                  rows={5}
                  className="field-y"
                  style={{ borderBottom: "1px solid var(--charcoal)", resize: "vertical" }}
                  placeholder={t.offerte.descriptionPlaceholder}
                />
              </div>

              <div className="md:col-span-2">
                <label className="eyebrow block mb-3" htmlFor="fotos">{t.offerte.labels.fotos}</label>
                <input
                  id="fotos"
                  name="fotos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setPhotoCount(e.currentTarget.files?.length ?? 0)}
                  className="block w-full text-sm"
                  style={{ paddingBlock: "0.5rem", color: "var(--charcoal-soft)" }}
                />
                <p className="mt-2 text-xs" style={{ color: "var(--charcoal-soft)" }}>
                  {photoCount > 0 ? t.offerte.photosChosen(photoCount) : t.offerte.photosOptional}
                </p>
              </div>

              {errorMsg && (
                <p className="md:col-span-2" style={{ color: "var(--oxide)" }}>{errorMsg}</p>
              )}

              {/* Honeypot — leave empty */}
              <div className="md:col-span-2" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>

              <div className="md:col-span-2 mt-4">
                <button type="submit" className="btn-y-solid" disabled={status === "sending"}>
                  {status === "sending" ? t.offerte.labels.sending : t.offerte.labels.submit}
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

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="eyebrow block mb-3" htmlFor={name}>
        {label} {required && <span style={{ color: "var(--oxide)" }}>*</span>}
      </label>
      <input id={name} name={name} type={type} required={required} className="field-y" />
    </div>
  );
}