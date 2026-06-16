// Supabase Auth "Send Email" hook target.
//
// Replaces the default plain Supabase auth mails (Reset password, Signup
// confirmation, Magic link, Invite, Email change, Reauthentication) with
// brand-styled HTML emails sent from info@yeketimotorworks.com via Resend —
// the same pipeline and template as the customer notifications in
// notify-events. Locale (nl/en) is taken from the user's profile or
// user_metadata.locale (defaults to nl).
//
// Auth: Standard Webhooks signature, verified with the SEND_EMAIL_HOOK_SECRET
// secret (format: v1,whsec_<base64>). The same secret is configured on the
// Supabase auth hook side.
import {
  renderEmail,
  renderPlainText,
  type EmailLayoutOpts,
  type Locale,
} from "../_shared/email-template.ts";
import * as copy from "../_shared/email-copy.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Yeketi Motorworks <info@yeketimotorworks.com>";
const REPLY_TO_FALLBACK = Deno.env.get("REPLY_TO_EMAIL") ?? "info@yeketimotorworks.com";
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL") ?? "https://yeketimotorworks.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";

// ── Standard Webhooks signature verification ─────────────────────────────
function base64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function base64Encode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verifySignature(
  rawBody: string,
  headers: Headers,
): Promise<boolean> {
  if (!HOOK_SECRET) {
    console.error("SEND_EMAIL_HOOK_SECRET is not set");
    return false;
  }
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return false;

  // Reject stale (>5 min) timestamps
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
    console.warn("webhook timestamp out of tolerance");
    return false;
  }

  // HOOK_SECRET is "v1,whsec_<base64>"; the actual key is the base64 after whsec_
  const m = HOOK_SECRET.match(/^v1,whsec_(.+)$/);
  if (!m) {
    console.error("SEND_EMAIL_HOOK_SECRET malformed (expected v1,whsec_<base64>)");
    return false;
  }
  const keyBytes = base64Decode(m[1]);
  const signed = `${id}.${ts}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed)),
  );
  const expected = base64Encode(sigBytes);
  // Header is space-separated list of "v1,<sig>" pairs
  return sigHeader.split(" ").some((p) => {
    const idx = p.indexOf(",");
    if (idx < 0) return false;
    const v = p.slice(idx + 1);
    return timingSafeEqual(v, expected);
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────
async function sbFetch(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}
async function localeForEmail(
  email: string,
  fallback: Locale,
): Promise<Locale> {
  if (!email) return fallback;
  try {
    const rows = await sbFetch(
      `profiles?email=eq.${encodeURIComponent(email.toLowerCase())}&select=locale`,
    );
    const l = rows?.[0]?.locale;
    return l === "en" ? "en" : l === "nl" ? "nl" : fallback;
  } catch {
    return fallback;
  }
}
async function logFailure(eventType: string, payload: unknown, errorMessage: string) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/notify_event_failures`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event_type: eventType,
        source: "auth-email",
        payload_summary: payload,
        error_message: errorMessage.slice(0, 2000),
      }),
    });
  } catch (e) {
    console.error("notify_event_failures insert failed", e);
  }
}
async function sendEmail(opts: { to: string; subject: string; html: string; text?: string }) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set; skipping send");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [opts.to],
      reply_to: REPLY_TO_FALLBACK,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text}`);
  }
}
function send(layout: { subject: string } & EmailLayoutOpts, to: string) {
  const merged: EmailLayoutOpts = { ...layout, isCustomer: true };
  return sendEmail({
    to,
    subject: layout.subject,
    html: renderEmail(merged),
    text: renderPlainText(merged),
  });
}

// Build the GoTrue verify link for token_hash based flows.
function actionUrl(
  siteUrl: string,
  emailActionType: string,
  tokenHash: string,
  redirectTo: string,
): string {
  const base = (SUPABASE_URL || "").replace(/\/$/, "");
  const target = redirectTo || siteUrl || PUBLIC_SITE_URL;
  // Supabase Auth verify endpoint — handles confirmation then redirects
  return `${base}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(emailActionType)}&redirect_to=${encodeURIComponent(target)}`;
}

type AuthHookPayload = {
  user: {
    email?: string;
    new_email?: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const rawBody = await req.text();

  // Verify Standard Webhooks signature
  const ok = await verifySignature(rawBody, req.headers);
  if (!ok) return new Response("Unauthorized", { status: 401 });

  let payload: AuthHookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    await logFailure("auth_email", null, `Bad JSON: ${(e as Error).message}`);
    return new Response("Bad Request", { status: 400 });
  }

  const { user, email_data } = payload;
  const action = String(email_data?.email_action_type ?? "");
  const recipient = action === "email_change_new" || action === "email_change"
    ? (user?.new_email || user?.email || "")
    : (user?.email || "");
  if (!recipient) {
    await logFailure("auth_email", { action }, "no recipient email on payload");
    return new Response("ok");
  }

  // Locale: prefer user_metadata.locale, then existing profile, fallback nl.
  const metaLocale = (user?.user_metadata?.locale as string | undefined);
  const fallback: Locale = metaLocale === "en" ? "en" : "nl";
  const locale = await localeForEmail(recipient, fallback);

  const link = actionUrl(
    email_data.site_url,
    action,
    email_data.token_hash,
    email_data.redirect_to,
  );
  const siteUrl = email_data.site_url || PUBLIC_SITE_URL;

  try {
    let out: ({ subject: string } & EmailLayoutOpts) | null = null;
    switch (action) {
      case "signup":
        out = copy.authSignup(locale, { actionUrl: link, siteUrl });
        break;
      case "recovery":
        out = copy.authRecovery(locale, { actionUrl: link, siteUrl });
        break;
      case "magiclink":
        out = copy.authMagicLink(locale, { actionUrl: link, siteUrl });
        break;
      case "invite":
        out = copy.authInvite(locale, { actionUrl: link, siteUrl });
        break;
      case "email_change":
      case "email_change_new":
        out = copy.authEmailChange(locale, { actionUrl: link, siteUrl });
        break;
      case "reauthentication":
        out = copy.authReauthentication(locale, { code: email_data.token, siteUrl });
        break;
      default:
        console.warn("unknown auth action", action);
        return new Response("ok");
    }
    await send(out, recipient);
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("auth-email send failed", e);
    await logFailure("auth_email", { action, to: recipient }, (e as Error).message);
    return new Response(`Error: ${(e as Error).message}`, { status: 500 });
  }
});