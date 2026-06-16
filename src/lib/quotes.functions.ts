import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PUBLIC_SITE_URL = "https://yeketimotorworks.com";
const REPLY_TO = "info@yeketimotorworks.com";

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
      .from("profiles").select("email, full_name").eq("id", q.customer_id).maybeSingle();
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
      const html = quoteEmailHtml({
        firstName,
        quoteNumber,
        portalUrl: `${PUBLIC_SITE_URL}/portaal/offerte/${q.id}`,
        intro: q.intro_text,
      });
      const text = quoteEmailText({
        firstName,
        quoteNumber,
        portalUrl: `${PUBLIC_SITE_URL}/portaal/offerte/${q.id}`,
      });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [customer.email],
          reply_to: REPLY_TO,
          subject: `Offerte ${quoteNumber} — Yeketi Motorworks`,
          html, text,
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

function quoteEmailHtml(opts: { firstName: string | null; quoteNumber: string; portalUrl: string; intro: string }) {
  const hi = opts.firstName ? `Hoi ${opts.firstName},` : "Beste,";
  const introPreview = opts.intro
    ? opts.intro.split("\n").slice(0, 2).join("<br/>").replace(/</g, "&lt;")
    : "Hieronder vind je de offerte. De PDF zit als bijlage, en je kan ze ook in je portaal bekijken en goedkeuren.";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F7F3EC;font-family:Georgia,'Times New Roman',serif;color:#221F1B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EC;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#FFFFFF;border:1px solid #221F1B;">
        <tr><td style="padding:28px 28px 0;">
          <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#B0832C;font-family:Arial,Helvetica,sans-serif;">Yeketi Motorworks · Offerte ${opts.quoteNumber}</div>
        </td></tr>
        <tr><td style="padding:18px 28px 4px;">
          <h1 style="margin:0;font-family:'Marcellus',Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;">Je offerte staat klaar</h1>
        </td></tr>
        <tr><td style="padding:14px 28px 8px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#4A453E;">${hi}</p>
        </td></tr>
        <tr><td style="padding:8px 28px 20px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#4A453E;">${introPreview}</p>
        </td></tr>
        <tr><td style="padding:0 28px 36px;">
          <a href="${opts.portalUrl}" style="display:inline-block;background:#B0832C;color:#F7F3EC;text-decoration:none;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;border:1px solid #B0832C;">Open in je portaal</a>
        </td></tr>
        <tr><td style="padding:18px 28px 24px;border-top:1px solid #EFE8DB;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#4A453E;letter-spacing:0.04em;">Yeketi Motorworks · Antwerpen · Erbil<br/>Antwoord op deze mail komt rechtstreeks bij ons binnen via ${REPLY_TO}.<br/><em style="font-family:Georgia,'Times New Roman',serif;color:#B0832C;">unity in craftsmanship</em></p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function quoteEmailText(opts: { firstName: string | null; quoteNumber: string; portalUrl: string }) {
  const hi = opts.firstName ? `Hoi ${opts.firstName},` : "Beste,";
  return `${hi}

Je offerte ${opts.quoteNumber} staat klaar. Je vindt de PDF in bijlage en kan ze ook in je portaal bekijken en goedkeuren:

${opts.portalUrl}

Vragen? Antwoord gewoon op deze mail (${REPLY_TO}).

— Yeketi Motorworks
unity in craftsmanship`;
}