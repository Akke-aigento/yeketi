import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { renderEmail, renderPlainText, escapeHtml } from "./email-template.server";
import { quoteSent, quoteReminder } from "./email-copy.server";

const PUBLIC_SITE_URL = "https://yeketimotorworks.com";
const REPLY_TO = "info@yeketimotorworks.com"; // legacy default
function adminReplyTo() { return process.env.ADMIN_NOTIFY_EMAIL || REPLY_TO; }

function eur(n: number, locale: "nl" | "en" = "nl") {
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : "nl-BE", { style: "currency", currency: "EUR" }).format(n);
}

type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

async function assertAdmin(ctx: { supabase: SupabaseLike; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

// --- Create / update -------------------------------------------------------

export const createQuoteFromRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quoteRequestId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req, error } = await supabaseAdmin
      .from("quote_requests").select("*").eq("id", data.quoteRequestId).maybeSingle();
    if (error || !req) throw error ?? new Error("Aanvraag niet gevonden");

    // Try to link an existing profile by email so customer_id is set when possible.
    let customerId: string | null = null;
    if (req.email) {
      const { data: prof } = await supabaseAdmin
        .from("profiles").select("id").eq("email", String(req.email).toLowerCase()).maybeSingle();
      customerId = prof?.id ?? null;
    }
    const vehicle = [req.merk, req.model, req.bouwjaar].filter(Boolean).join(" ");
    const { data: q, error: ie } = await supabaseAdmin
      .from("quotes").insert({
        quote_request_id: req.id,
        customer_id: customerId,
        title: vehicle ? `Offerte ${vehicle}` : `Offerte ${req.naam}`,
        vehicle_label: vehicle,
        intro_text: `Beste ${String(req.naam).split(" ")[0]},\n\nBedankt voor je aanvraag. Hieronder vind je een voorstel voor het werk aan je ${vehicle || "voertuig"}.`,
        notes_text: "Betaling in schijven mogelijk. Doorlooptijd in overleg.",
      }).select("*").maybeSingle();
    if (ie || !q) throw ie ?? new Error("Kon offerte niet aanmaken");
    // Mark aanvraag as quoted
    await supabaseAdmin.from("quote_requests").update({ status: "quoted" }).eq("id", req.id);
    return { quoteId: q.id };
  });

export const createBlankQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: q, error } = await supabaseAdmin
      .from("quotes").insert({ title: "Nieuwe offerte" }).select("*").maybeSingle();
    if (error || !q) throw error ?? new Error("Kon offerte niet aanmaken");
    return { quoteId: q.id };
  });

// --- Send to customer (assign number, status, gen PDF + email) -------------

export const sendQuoteToCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quoteId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: q, error: qe } = await supabaseAdmin
      .from("quotes").select("*").eq("id", data.quoteId).maybeSingle();
    if (qe || !q) throw qe ?? new Error("Offerte niet gevonden");
    if (q.status !== "concept") throw new Error("Deze offerte is al verstuurd");
    if (!q.customer_id) throw new Error("Koppel eerst een klant aan de offerte");

    const { data: customer } = await supabaseAdmin
      .from("profiles").select("email, full_name, locale").eq("id", q.customer_id).maybeSingle();
    if (!customer?.email) throw new Error("Klant heeft geen e-mailadres");

    const { data: lines } = await supabaseAdmin
      .from("quote_lines").select("description, amount").eq("quote_id", q.id)
      .order("sort_order", { ascending: true });
    if (!lines || lines.length === 0) throw new Error("Voeg minstens één regel toe");

    // Quote number (server-side)
    let quoteNumber = q.quote_number;
    if (!quoteNumber) {
      const { data: numData, error: ne } = await supabaseAdmin.rpc("next_quote_number");
      if (ne || !numData) throw ne ?? new Error("Kon offertenummer niet genereren");
      quoteNumber = numData as string;
    }
    const sentAt = new Date().toISOString();

    // Build PDF
    const { renderQuotePdf, toBase64 } = await import("./quote-pdf.server");
    const pdfBytes = await renderQuotePdf({
      quote_number: quoteNumber,
      title: q.title,
      vehicle_label: q.vehicle_label,
      intro_text: q.intro_text,
      notes_text: q.notes_text,
      total_amount: Number(q.total_amount),
      valid_until: q.valid_until,
      sent_at: sentAt,
      customer_name: customer.full_name,
      customer_email: customer.email,
      lines: lines.map((l) => ({ description: l.description, amount: Number(l.amount) })),
    });
    const pdfBase64 = toBase64(pdfBytes);

    // Email via Resend with attachment
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.FROM_EMAIL ?? "Yeketi Motorworks <onboarding@resend.dev>";
    if (RESEND_API_KEY) {
      const firstName = customer.full_name ? String(customer.full_name).split(" ")[0] : null;
      const locale = (customer as { locale?: string }).locale === "en" ? "en" : "nl";
      const layout = quoteSent(locale, {
        first: firstName,
        quoteNumber,
        portalUrl: `${PUBLIC_SITE_URL}/portaal/offerte/${q.id}`,
        intro: q.intro_text ?? "",
        totalStr: eur(Number(q.total_amount), locale),
        vehicle: q.vehicle_label,
      });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [customer.email],
          reply_to: adminReplyTo(),
          subject: layout.subject,
          html: renderEmail(layout),
          text: renderPlainText(layout),
          attachments: [{
            filename: `offerte-${quoteNumber}.pdf`,
            content: pdfBase64,
          }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("Resend quote error", res.status, errText);
        throw new Error(`E-mail verzenden mislukt (${res.status})`);
      }
    }

    const { error: ue } = await supabaseAdmin.from("quotes").update({
      quote_number: quoteNumber,
      status: "verstuurd",
      sent_at: sentAt,
    }).eq("id", q.id);
    if (ue) throw ue;

    return { ok: true, quoteNumber, emailed: !!RESEND_API_KEY };
  });

// --- Download PDF (admin or owning customer) -------------------------------

export const downloadQuotePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quoteId: string }) => input)
  .handler(async ({ data, context }) => {
    // Use the user-scoped client first to enforce RLS access.
    const { data: q, error } = await context.supabase
      .from("quotes").select("*").eq("id", data.quoteId).maybeSingle();
    if (error || !q) throw new Error("Offerte niet gevonden");
    const { data: lines } = await context.supabase
      .from("quote_lines").select("description, amount")
      .eq("quote_id", q.id).order("sort_order", { ascending: true });
    let customerName: string | null = null;
    let customerEmail: string | null = null;
    if (q.customer_id) {
      // Admins can read all profiles; customers can read their own.
      const { data: prof } = await context.supabase
        .from("profiles").select("full_name, email").eq("id", q.customer_id).maybeSingle();
      customerName = prof?.full_name ?? null;
      customerEmail = prof?.email ?? null;
    }
    const { renderQuotePdf, toBase64 } = await import("./quote-pdf.server");
    const bytes = await renderQuotePdf({
      quote_number: q.quote_number ?? "CONCEPT",
      title: q.title, vehicle_label: q.vehicle_label,
      intro_text: q.intro_text, notes_text: q.notes_text,
      total_amount: Number(q.total_amount),
      valid_until: q.valid_until, sent_at: q.sent_at,
      customer_name: customerName, customer_email: customerEmail,
      lines: (lines ?? []).map((l) => ({ description: l.description, amount: Number(l.amount) })),
    });
    return {
      filename: `offerte-${q.quote_number ?? "concept"}.pdf`,
      base64: toBase64(bytes),
    };
  });

// --- Email templates -------------------------------------------------------

function quoteEmailLayout(opts: { firstName: string | null; quoteNumber: string; portalUrl: string; intro: string; total: number; vehicle?: string | null }) {
  const hi = opts.firstName ? `Hoi ${opts.firstName}, ` : "";
  const introPreview = (opts.intro || "")
    .split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 2).join(" ");
  const totalStr = eur(opts.total);
  return {
    preheader: `Offerte ${opts.quoteNumber} · ${totalStr}`,
    eyebrow: `Offerte ${opts.quoteNumber}`,
    headline: opts.vehicle ? `Je offerte voor ${opts.vehicle}` : "Je offerte staat klaar",
    intro: `${hi}we hebben je offerte uitgewerkt. De volledige PDF zit in bijlage; je kan ze ook in je portaal openen om te aanvaarden of te weigeren.`,
    bodyHtml: `
      ${introPreview ? `<p style="margin:0 0 18px;color:#4A453E;">${escapeHtml(introPreview)}</p>` : ""}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 8px;border:1px solid #EFE8DB;background:#F7F3EC;width:100%;">
        <tr>
          <td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6B6459;letter-spacing:0.18em;text-transform:uppercase;">Totaal</td>
          <td style="padding:14px 18px;text-align:right;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#221F1B;">${escapeHtml(totalStr)}</td>
        </tr>
      </table>
    `,
    cta: { label: "Bekijk je offerte", url: opts.portalUrl },
    footerNote: "De PDF van de offerte zit als bijlage bij deze mail.",
  };
}

function quoteEmailHtml(opts: { firstName: string | null; quoteNumber: string; portalUrl: string; intro: string; total: number; vehicle?: string | null }) {
  return renderEmail(quoteEmailLayout(opts));
}

function quoteEmailText(opts: { firstName: string | null; quoteNumber: string; portalUrl: string; total: number }) {
  return renderPlainText(quoteEmailLayout({ ...opts, intro: "", vehicle: null }));
}

// --- Reminder for unresponded sent quotes (K · #17) ------------------------

// Called by pg_cron via /api/public/hooks/quote-reminders. Sends ONE gentle
// nudge per quote: status='verstuurd' for >= 7 days and reminder_sent_at IS NULL.
export const runQuoteReminders = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // reminder_sent_at is added by migration; types may lag, so use a loose cast.
    const qb = supabaseAdmin.from("quotes") as unknown as {
      select: (cols: string) => {
        eq: (a: string, b: string) => {
          is: (a: string, b: null) => {
            lte: (a: string, b: string) => Promise<{ data: Array<{ id: string; quote_number: string; title: string; total_amount: number; customer_id: string | null; sent_at: string | null }> | null; error: unknown }>;
          };
        };
      };
    };
    const { data: quotes, error } = await qb
      .select("id, quote_number, title, total_amount, customer_id, sent_at")
      .eq("status", "verstuurd").is("reminder_sent_at", null).lte("sent_at", cutoff);
    if (error) throw error;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) return { processed: 0, sent: 0, reason: "no_resend_key" };
    const FROM_EMAIL = process.env.FROM_EMAIL ?? "Yeketi Motorworks <info@yeketimotorworks.com>";
    let sent = 0;
    for (const q of quotes ?? []) {
      if (!q.customer_id) continue;
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("email, full_name, locale").eq("id", q.customer_id).maybeSingle();
      if (!profile?.email) continue;
      const first = profile.full_name ? String(profile.full_name).split(" ")[0] : null;
      const locale = (profile as { locale?: string }).locale === "en" ? "en" : "nl";
      const portalUrl = `${PUBLIC_SITE_URL}/portaal/offerte/${q.id}`;
      const layout = quoteReminder(locale, { first, quoteNumber: q.quote_number, title: q.title, portalUrl });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL, to: [profile.email], reply_to: adminReplyTo(),
          subject: layout.subject,
          html: renderEmail(layout), text: renderPlainText(layout),
        }),
      });
      if (res.ok) {
        await (supabaseAdmin.from("quotes") as unknown as { update: (v: Record<string, unknown>) => { eq: (a: string, b: string) => Promise<unknown> } })
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", q.id);
        sent++;
      } else {
        console.error("reminder send failed", res.status, await res.text());
      }
    }
    return { processed: quotes?.length ?? 0, sent };
  });