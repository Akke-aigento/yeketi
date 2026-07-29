import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { z } from "zod";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useT } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { guardQuoteSubmission, submitQuoteRequest } from "@/lib/messages.functions";

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
  const submit = useServerFn(submitQuoteRequest);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [photos, setPhotos] = useState<File[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locale, setLocale] = useState<"nl" | "en">("nl");
  const successRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status === "ok" && successRef.current) {
      successRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [status]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;
    setErrorMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const hp = String(fd.get("y_hp_field") ?? "");
    const files = photos;
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
      // Server-side honeypot + per-IP rate limit. Returns a short-lived
      // upload ticket whose UUID is the only prefix accepted by the
      // quote-photos storage policy.
      const guardRes = await guard({ data: { hp, locale } });
      const ticketId = (guardRes as { ticketId: string | null }).ticketId;
      if (!ticketId) {
        // Honeypot tripped — behave exactly like a successful submission.
        setStatus("ok");
        form.reset();
        setPhotos([]);
        return;
      }
      const submissionPrefix = ticketId;
      const foto_urls: string[] = [];
      for (const f of files) {
        const isVideo = f.type.startsWith("video/");
        const isImage = f.type.startsWith("image/");
        if (!isImage && !isVideo) {
          throw new Error(t.offerte.onlyImages);
        }
        if (isImage && f.size > 8 * 1024 * 1024) {
          throw new Error(t.offerte.photoTooLarge);
        }
        if (isVideo) {
          const { validateVideo } = await import("@/lib/media");
          const check = await validateVideo(f);
          if (!check.ok) throw new Error(check.reason);
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

      await submit({
        data: {
          ticketId,
          naam: parsed.data.naam,
          email: parsed.data.email,
          telefoon: parsed.data.telefoon || null,
          merk: parsed.data.merk || null,
          model: parsed.data.model || null,
          bouwjaar: parsed.data.bouwjaar || null,
          type_werk: parsed.data.type_werk,
          beschrijving: parsed.data.beschrijving || null,
          foto_urls,
          locale,
        },
      });
      setStatus("ok");
      form.reset();
      setPhotos([]);
    } catch (err) {
      console.error(err);
      setStatus("err");
      setErrorMsg(t.offerte.error);
    }
  };

  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
    );
    setPhotos((prev) => {
      const merged = [...prev];
      for (const f of arr) {
        if (merged.length >= 5) break;
        // skip dupes (by name + size)
        if (merged.some((m) => m.name === f.name && m.size === f.size)) continue;
        merged.push(f);
      }
      return merged;
    });
  };
  const removeFile = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
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
              <div ref={successRef} className="mt-14" style={{ border: "1px solid var(--brass)", padding: "3rem" }}>
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
                <PhotoUploader
                  label={t.offerte.labels.fotos}
                  addLabel={t.offerte.addPhotos}
                  hint={t.offerte.addPhotosHint}
                  optional={t.offerte.photosOptional}
                  count={photos.length}
                  countLabel={t.offerte.photosChosen(photos.length)}
                  removeLabel={t.offerte.removePhoto}
                  files={photos}
                  onAdd={addFiles}
                  onRemove={removeFile}
                />
              </div>

              {errorMsg && (
                <p className="md:col-span-2" style={{ color: "var(--oxide)" }}>{errorMsg}</p>
              )}

              {/* Honeypot — leave empty */}
              <div className="md:col-span-2" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
                <label htmlFor="y_hp_field">Laat dit veld leeg</label>
                <input id="y_hp_field" name="y_hp_field" type="text" tabIndex={-1} autoComplete="off" />
              </div>

              <div className="md:col-span-2 mt-4">
                <button
                  type="submit"
                  className="btn-y-solid inline-flex items-center gap-2"
                  disabled={status === "sending"}
                >
                  {status === "sending" && (
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
                  )}
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

function PhotoUploader({
  label,
  addLabel,
  hint,
  optional,
  count,
  countLabel,
  removeLabel,
  files,
  onAdd,
  onRemove,
}: {
  label: string;
  addLabel: string;
  hint: string;
  optional: string;
  count: number;
  countLabel: string;
  removeLabel: string;
  files: File[];
  onAdd: (f: FileList | File[] | null) => void;
  onRemove: (i: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => { next.forEach((u) => URL.revokeObjectURL(u)); };
  }, [files]);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    onAdd(e.dataTransfer.files);
  };

  const full = count >= 5;

  return (
    <div>
      <span className="eyebrow block mb-3">{label}</span>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !full && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !full) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        style={{
          cursor: full ? "not-allowed" : "pointer",
          border: `1.5px dashed ${dragging ? "var(--brass)" : "var(--charcoal)"}`,
          background: dragging ? "color-mix(in oklab, var(--brass) 8%, transparent)" : "transparent",
          padding: "1.5rem",
          textAlign: "center",
          transition: "border-color .15s, background .15s",
          opacity: full ? 0.55 : 1,
        }}
      >
        <div style={{ fontSize: "0.95rem", color: "var(--charcoal)", fontWeight: 500 }}>
          + {addLabel}
        </div>
        <div className="mt-2 text-xs" style={{ color: "var(--charcoal-soft)" }}>
          {hint}
        </div>
      </div>
      <input
        ref={inputRef}
        id="fotos"
        type="file"
        accept="image/*,video/mp4,video/quicktime,video/webm"
        multiple
        onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }}
        style={{ display: "none" }}
      />
      <p className="mt-3 text-xs" style={{ color: count > 0 ? "var(--brass)" : "var(--charcoal-soft)" }}>
        {count > 0 ? countLabel : optional}
      </p>
      {count > 0 && (
        <ul
          className="mt-3 grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", listStyle: "none", padding: 0 }}
        >
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              style={{ position: "relative", border: "1px solid var(--charcoal)", background: "var(--cream)" }}
            >
              <div style={{ aspectRatio: "1 / 1", overflow: "hidden", background: "#000" }}>
                {urls[i] && (
                  f.type.startsWith("video/") ? (
                    <video
                      src={urls[i]} muted playsInline preload="metadata"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <img
                      src={urls[i]}
                      alt={f.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  )
                )}
              </div>
              <div
                className="text-[11px]"
                style={{
                  padding: "6px 8px",
                  color: "var(--charcoal)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={f.name}
              >
                {f.name}
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                aria-label={removeLabel}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "var(--charcoal)",
                  color: "var(--cream)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}