import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { renderEmail, renderPlainText } from "./email-template.server";
import { welcomeAfterInvite } from "./email-copy.server";

const PUBLIC_SITE_URL = "https://yeketimotorworks.com";

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
      .from("profiles").select("full_name, locale").eq("id", context.userId).maybeSingle();
    const fullName = profile?.full_name ?? claims.user_metadata?.full_name ?? null;
    const firstName = fullName ? String(fullName).trim().split(/\s+/)[0] : null;
    const locale = (profile as { locale?: string } | null)?.locale === "en" ? "en" : "nl";

    const layout = welcomeAfterInvite(locale, {
      first: firstName,
      portalUrl: `${PUBLIC_SITE_URL}/portaal`,
    });
    // Reply-to: route any stray reply to the admin notify email if configured.
    const replyTo = process.env.ADMIN_NOTIFY_EMAIL || "info@yeketimotorworks.com";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        reply_to: replyTo,
        subject: layout.subject,
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
