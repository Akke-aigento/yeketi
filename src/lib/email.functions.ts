import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { renderEmail, renderPlainText } from "./email-template.server";

const PUBLIC_SITE_URL = "https://yeketimotorworks.com";
const REPLY_TO = "info@yeketimotorworks.com";

// Sends a one-time welcome email to the just-activated invitee (A · #5).
// Safe to call at most once per user; if Resend isn't configured we no-op so
// the UI flow keeps working.
export const sendWelcomeAfterInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.FROM_EMAIL ?? "Yeketi Motorworks <info@yeketimotorworks.com>";
    if (!RESEND_API_KEY) return { sent: false, reason: "no_resend_key" };

    const claims = context.claims as { email?: string; user_metadata?: { full_name?: string } };
    const to = claims.email;
    if (!to) return { sent: false, reason: "no_email_in_claims" };

    const { data: profile } = await context.supabase
      .from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
    const fullName = profile?.full_name ?? claims.user_metadata?.full_name ?? null;
    const firstName = fullName ? String(fullName).trim().split(/\s+/)[0] : null;

    const layout = {
      preheader: "Je portaal staat klaar — volg je restauratie van dichtbij.",
      eyebrow: "Welkom",
      headline: firstName ? `Welkom bij Yeketi, ${firstName}` : "Welkom bij Yeketi Motorworks",
      intro:
        "Je toegang tot het klantenportaal is geactiveerd. Vanaf nu zie je hier elke update over je restauratie — fase per fase, met foto's vanuit de werkplaats.",
      bodyHtml:
        `<p style="margin:0;">Je kan rechtstreeks reageren onder elke update en berichten sturen naar Baram. Geen tussenstap, geen formulier — gewoon contact.</p>`,
      cta: { label: "Open je portaal", url: `${PUBLIC_SITE_URL}/portaal` },
      replyTo: REPLY_TO,
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        reply_to: REPLY_TO,
        subject: "Welkom bij Yeketi Motorworks — je portaal staat klaar",
        html: renderEmail(layout),
        text: renderPlainText(layout),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Resend welcome error", res.status, text);
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  });
