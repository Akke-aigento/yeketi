import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROD_SITE_URL = "https://yeketimotorworks.com";
const REPLY_TO = "info@yeketimotorworks.com";

function welcomeHtml(firstName: string | null) {
  const hi = firstName ? `Hoi ${firstName},` : "Welkom,";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F7F3EC;font-family:Georgia,'Times New Roman',serif;color:#221F1B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EC;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#FFFFFF;border:1px solid #221F1B;">
        <tr><td style="padding:28px 28px 0;">
          <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#B0832C;font-family:Arial,Helvetica,sans-serif;">Yeketi Motorworks</div>
        </td></tr>
        <tr><td style="padding:18px 28px 4px;">
          <h1 style="margin:0;font-family:'Marcellus',Georgia,serif;font-weight:400;font-size:28px;line-height:1.15;">Je portaal staat klaar</h1>
        </td></tr>
        <tr><td style="padding:14px 28px 24px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#4A453E;">${hi} je toegang tot het klantenportaal is geactiveerd. Vanaf nu zie je hier elke update over je restauratie — fase per fase, met foto's vanuit de werkplaats.</p>
        </td></tr>
        <tr><td style="padding:0 28px 36px;">
          <a href="${PROD_SITE_URL}/portaal" style="display:inline-block;background:#B0832C;color:#F7F3EC;text-decoration:none;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;border:1px solid #B0832C;">Open je portaal</a>
        </td></tr>
        <tr><td style="padding:18px 28px 24px;border-top:1px solid #EFE8DB;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#4A453E;letter-spacing:0.04em;">Yeketi Motorworks · Antwerpen · Erbil<br/>Antwoorden op deze mail komen rechtstreeks bij ons binnen via ${REPLY_TO}.<br/><em style="font-family:Georgia,'Times New Roman',serif;color:#B0832C;">unity in craftsmanship</em></p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function welcomeText(firstName: string | null) {
  const hi = firstName ? `Hoi ${firstName},` : "Welkom,";
  return `${hi}

Je toegang tot het klantenportaal van Yeketi Motorworks is geactiveerd. Vanaf nu zie je hier elke update over je restauratie — fase per fase, met foto's vanuit de werkplaats.

Open je portaal: ${PROD_SITE_URL}/portaal

Vragen? Antwoord gewoon op deze mail (${REPLY_TO}).

— Yeketi Motorworks
unity in craftsmanship`;
}

// Sends a one-time welcome email to the just-activated invitee. Safe to call
// at most once per user; if Resend isn't configured we no-op so the UI flow
// keeps working.
export const sendWelcomeAfterInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.FROM_EMAIL ?? "Yeketi Motorworks <noreply@mail.yeketimotorworks.com>";
    if (!RESEND_API_KEY) return { sent: false, reason: "no_resend_key" };

    const claims = context.claims as { email?: string; user_metadata?: { full_name?: string } };
    const to = claims.email;
    if (!to) return { sent: false, reason: "no_email_in_claims" };

    // Look up display name from profiles so we can greet the user by name.
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const fullName = profile?.full_name ?? claims.user_metadata?.full_name ?? null;
    const firstName = fullName ? String(fullName).trim().split(/\s+/)[0] : null;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        reply_to: REPLY_TO,
        subject: "Welkom bij Yeketi Motorworks — je portaal staat klaar",
        html: welcomeHtml(firstName),
        text: welcomeText(firstName),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Resend welcome error", res.status, text);
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  });