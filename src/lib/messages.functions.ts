import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

type AdminCtx = { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }; userId: string };

async function assertAdmin(ctx: AdminCtx) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

function clientIp(): string {
  const req = getRequest();
  const h = req?.headers;
  if (!h) return "unknown";
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0]?.trim() ||
    "unknown"
  );
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// ── Server-side i18n for public form validation errors ────────────────────
type ServerMsgKey =
  | "nameRequired"
  | "invalidEmail"
  | "messageTooShort"
  | "rateLimited"
  | "invalidSession"
  | "alreadySubmitted"
  | "sessionExpired"
  | "nameEmailRequired"
  | "invalidWorkType"
  | "invalidPhotoPath";

const SERVER_MSG: Record<"nl" | "en", Record<ServerMsgKey, string>> = {
  nl: {
    nameRequired: "Vul je naam in.",
    invalidEmail: "Ongeldig e-mailadres.",
    messageTooShort: "Bericht is te kort.",
    rateLimited: "Te veel verzoeken — probeer het later opnieuw.",
    invalidSession: "Ongeldige sessie — herlaad de pagina.",
    alreadySubmitted: "Deze aanvraag is al verstuurd.",
    sessionExpired: "Sessie verlopen — herlaad de pagina.",
    nameEmailRequired: "Vul naam en e-mail correct in.",
    invalidWorkType: "Ongeldig type werk.",
    invalidPhotoPath: "Ongeldig fotopad.",
  },
  en: {
    nameRequired: "Please enter your name.",
    invalidEmail: "Invalid email address.",
    messageTooShort: "Your message is too short.",
    rateLimited: "Too many requests — please try again later.",
    invalidSession: "Invalid session — please reload the page.",
    alreadySubmitted: "This request has already been submitted.",
    sessionExpired: "Session expired — please reload the page.",
    nameEmailRequired: "Please enter a valid name and email address.",
    invalidWorkType: "Invalid type of work.",
    invalidPhotoPath: "Invalid photo path.",
  },
};

function msg(locale: "nl" | "en" | undefined, key: ServerMsgKey): string {
  return SERVER_MSG[locale === "en" ? "en" : "nl"][key];
}

// Best-effort honeypot logging: never blocks or fails the response.
async function logHoneypot(kind: "honeypot_contact" | "honeypot_quote") {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("public_form_submissions").insert({ ip: clientIp(), kind });
  } catch (e) {
    console.warn("honeypot log failed", e);
  }
}

function sanitize(s: string, max = 4000): string {
  return s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim().slice(0, max);
}

async function rateLimitOrThrow(kind: string, ip: string, max: number, windowMinutes: number, locale?: "nl" | "en") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from("public_form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("kind", kind)
    .gte("created_at", since);
  if ((count ?? 0) >= max) {
    throw new Error(msg(locale, "rateLimited"));
  }
  await supabaseAdmin.from("public_form_submissions").insert({ ip, kind });
}

const PROD_SITE_URL = "https://yeketimotorworks.com";
const RESET_REDIRECT = `${PROD_SITE_URL}/reset-password`;

async function findOrInviteUser(email: string, fullName?: string | null, opts?: { skipInvite?: boolean; locale?: "nl" | "en" }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const profilePatch = (id: string) => {
    const p: { id: string; email: string; full_name: string | null; locale?: "nl" | "en" } = {
      id, email, full_name: fullName ?? null,
    };
    if (opts?.locale) p.locale = opts.locale;
    return p;
  };
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("id").eq("email", email).maybeSingle();
  if (profile) {
    // Existing profile: only set locale when caller explicitly asked for 'en'
    // (avoid clobbering Baram's explicit pick).
    if (opts?.locale === "en") {
      await supabaseAdmin.from("profiles").update({ locale: "en" }).eq("id", profile.id);
    }
    return { userId: profile.id as string, created: false };
  }

  if (opts?.skipInvite) {
    // Create a silent (unconfirmed) auth user so a profile exists, no email sent.
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });
    if (error || !data.user) throw new Error(error?.message || "Kon contact niet aanmaken");
    await supabaseAdmin.from("profiles").upsert(profilePatch(data.user.id));
    return { userId: data.user.id, created: true };
  }

  const inv = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
    redirectTo: RESET_REDIRECT,
  });
  if (inv.error || !inv.data.user) throw new Error(inv.error?.message || "Kon uitnodiging niet versturen");
  await supabaseAdmin.from("profiles").upsert(profilePatch(inv.data.user.id));
  return { userId: inv.data.user.id, created: true };
}

async function ensureConversation(profileId: string, source: "contact_form" | "quote_request" | "manual", subject?: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("conversations").select("id").eq("contact_profile_id", profileId).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .insert({ contact_profile_id: profileId, source, subject: subject ?? null })
    .select("id").single();
  if (error) throw error;
  return data.id as string;
}

// ──────────────────────────────────────────────────────────────────────────
// PUBLIC contact form
// ──────────────────────────────────────────────────────────────────────────

export const submitContactForm = createServerFn({ method: "POST" })
  .inputValidator((input: { naam: string; email: string; bericht: string; hp?: string; locale?: "nl" | "en" }) => input)
  .handler(async ({ data }) => {
    // Honeypot: if filled, silently succeed.
    if (data.hp && data.hp.trim() !== "") return { ok: true } as const;

    const naam = sanitize(data.naam ?? "", 120);
    const email = sanitize((data.email ?? "").toLowerCase(), 255);
    const bericht = sanitize(data.bericht ?? "", 3000);
    const locale: "nl" | "en" = data.locale === "en" ? "en" : "nl";
    if (naam.length < 2) throw new Error("Vul je naam in.");
    if (!EMAIL_RE.test(email)) throw new Error("Ongeldig e-mailadres.");
    if (bericht.length < 5) throw new Error("Bericht is te kort.");

    await rateLimitOrThrow("contact_form", clientIp(), 5, 10);

    const { userId } = await findOrInviteUser(email, naam, { locale });
    const convId = await ensureConversation(userId, "contact_form", bericht.slice(0, 80));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("messages").insert({
      conversation_id: convId, author_id: userId, sender: "klant", body: bericht,
    });
    return { ok: true } as const;
  });

// ──────────────────────────────────────────────────────────────────────────
// Public hook for the existing offerte form: rate-limit + honeypot only.
// Conversation linking is handled by the DB trigger when a profile exists.
// ──────────────────────────────────────────────────────────────────────────

export const guardQuoteSubmission = createServerFn({ method: "POST" })
  .inputValidator((input: { hp?: string }) => input)
  .handler(async ({ data }) => {
    if (data.hp && data.hp.trim() !== "") throw new Error("Spam gedetecteerd.");
    const ip = clientIp();
    await rateLimitOrThrow("quote_request", ip, 5, 30);
    // Mint a short-lived upload ticket so anonymous photo uploads to
    // quote-photos are tied to a server-validated submission.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ticketId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : ([1e7] as unknown as string);
    const { error } = await supabaseAdmin
      .from("quote_upload_tickets")
      .insert({ id: ticketId, ip });
    if (error) throw error;
    return { ok: true, ticketId } as const;
  });

// Server-side insert for the public offerte form. Requires a valid ticket
// minted by guardQuoteSubmission. Performs validation, inserts via the
// admin client (RLS no longer allows anonymous direct inserts on
// quote_requests), consumes the ticket, and links a conversation.
export const submitQuoteRequest = createServerFn({ method: "POST" })
  .inputValidator((input: {
    ticketId: string;
    naam: string;
    email: string;
    telefoon?: string | null;
    merk?: string | null;
    model?: string | null;
    bouwjaar?: string | null;
    type_werk: "plaatwerk" | "volledige_restauratie" | "advies";
    beschrijving?: string | null;
    foto_urls?: string[];
    locale?: "nl" | "en";
  }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ticket must exist, be recent (<1h), and unconsumed.
    const { data: ticket, error: tErr } = await supabaseAdmin
      .from("quote_upload_tickets")
      .select("id, created_at, consumed_at")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!ticket) throw new Error("Ongeldige sessie — herlaad de pagina.");
    if (ticket.consumed_at) throw new Error("Deze aanvraag is al verstuurd.");
    if (new Date(ticket.created_at as string).getTime() < Date.now() - 60 * 60_000) {
      throw new Error("Sessie verlopen — herlaad de pagina.");
    }

    const naam = sanitize(data.naam, 120);
    const email = sanitize((data.email || "").toLowerCase(), 255);
    if (!naam || !EMAIL_RE.test(email)) throw new Error("Vul naam en e-mail correct in.");
    const type_werk = data.type_werk;
    if (!["plaatwerk", "volledige_restauratie", "advies"].includes(type_werk)) {
      throw new Error("Ongeldig type werk.");
    }

    // foto_urls must all live under the ticket prefix.
    const photos = (data.foto_urls ?? []).slice(0, 5);
    for (const p of photos) {
      if (typeof p !== "string" || !p.startsWith(`${data.ticketId}/`)) {
        throw new Error("Ongeldig fotopad.");
      }
    }

    const locale: "nl" | "en" = data.locale === "en" ? "en" : "nl";

    const { error: insErr } = await supabaseAdmin.from("quote_requests").insert({
      id: data.ticketId,
      naam,
      email,
      telefoon: data.telefoon ? sanitize(data.telefoon, 40) : null,
      merk: data.merk ? sanitize(data.merk, 80) : null,
      model: data.model ? sanitize(data.model, 80) : null,
      bouwjaar: data.bouwjaar ? sanitize(data.bouwjaar, 8) : null,
      type_werk,
      beschrijving: data.beschrijving ? sanitize(data.beschrijving, 3000) : null,
      foto_urls: photos,
      locale,
    });
    if (insErr) throw insErr;

    await supabaseAdmin
      .from("quote_upload_tickets")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", data.ticketId);

    // Link conversation / invite profile (best-effort).
    try {
      const { userId } = await findOrInviteUser(email, naam, { locale });
      const subject =
        [data.merk, data.model, data.bouwjaar].filter(Boolean).join(" ") || "Offerteaanvraag";
      const convId = await ensureConversation(userId, "quote_request", subject);
      const { count } = await supabaseAdmin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convId);
      if ((count ?? 0) === 0) {
        await supabaseAdmin.from("messages").insert({
          conversation_id: convId,
          author_id: null,
          sender: "systeem",
          body: `Nieuwe offerteaanvraag: ${subject}${
            data.beschrijving ? `\n\n${data.beschrijving}` : ""
          }`,
        });
      }
    } catch (e) {
      console.warn("conversation link failed", e);
    }

    return { ok: true, quoteRequestId: data.ticketId } as const;
  });

// After an anon offerte insert succeeds, the client calls this to ensure a
// profile + conversation exist for the lead and a portal invite is sent
// (same behaviour as the contact form). Existing profiles are not re-mailed
// — findOrInviteUser short-circuits when a profile already exists.
export const linkQuoteRequestToConversation = createServerFn({ method: "POST" })
  .inputValidator((input: { quoteRequestId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: qr } = await supabaseAdmin
      .from("quote_requests").select("id, email, naam, merk, model, bouwjaar, beschrijving, locale")
      .eq("id", data.quoteRequestId).maybeSingle();
    if (!qr) return { ok: false } as const;
    const email = (qr.email ?? "").toString().toLowerCase().trim();
    if (!EMAIL_RE.test(email)) return { ok: false } as const;
    const qrLocale = (qr as { locale?: string }).locale === "en" ? "en" : "nl";
    const { userId } = await findOrInviteUser(email, qr.naam ?? null, { locale: qrLocale });
    const subject = [qr.merk, qr.model, qr.bouwjaar].filter(Boolean).join(" ") || "Offerteaanvraag";
    const convId = await ensureConversation(userId, "quote_request", subject);
    // If trigger didn't write the systeem message (because profile didn't exist yet), write it now.
    const { count } = await supabaseAdmin
      .from("messages").select("id", { count: "exact", head: true })
      .eq("conversation_id", convId);
    if ((count ?? 0) === 0) {
      await supabaseAdmin.from("messages").insert({
        conversation_id: convId, author_id: null, sender: "systeem",
        body: `Nieuwe offerteaanvraag: ${subject}${qr.beschrijving ? `\n\n${qr.beschrijving}` : ""}`,
      });
    }
    return { ok: true, conversationId: convId } as const;
  });

// Admin helper: given a quote_request id, return the conversation id for the
// requester so the admin UI can jump straight to the in-portal thread instead
// of opening a mailto: link. If no profile/conversation exists yet (legacy
// requests submitted before the trigger was in place), one is created on the
// fly using the same silent-profile flow as the public form.
export const getConversationForQuoteRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quoteRequestId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: qr } = await supabaseAdmin
      .from("quote_requests")
      .select("id, email, naam, merk, model, bouwjaar, locale")
      .eq("id", data.quoteRequestId)
      .maybeSingle();
    if (!qr) throw new Error("Aanvraag niet gevonden");
    const email = (qr.email ?? "").toString().toLowerCase().trim();
    if (!EMAIL_RE.test(email)) throw new Error("Aanvraag heeft geen geldig e-mailadres");
    const qrLocale = (qr as { locale?: string }).locale === "en" ? "en" : "nl";
    const { userId } = await findOrInviteUser(email, qr.naam ?? null, { skipInvite: true, locale: qrLocale });
    const subject = [qr.merk, qr.model, qr.bouwjaar].filter(Boolean).join(" ") || "Offerteaanvraag";
    const convId = await ensureConversation(userId, "quote_request", subject);
    return { conversationId: convId } as const;
  });

// ──────────────────────────────────────────────────────────────────────────
// Admin: inbox
// ──────────────────────────────────────────────────────────────────────────

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: convos } = await supabaseAdmin
      .from("conversations")
      .select("id, contact_profile_id, project_id, subject, source, status, last_message_at, admin_last_seen_at, created_at")
      .order("last_message_at", { ascending: false });
    const list = convos ?? [];
    const ids = list.map((c) => c.id);
    const profileIds = Array.from(new Set(list.map((c) => c.contact_profile_id)));

    const profilesById = new Map<string, { full_name: string | null; email: string | null }>();
    if (profileIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles").select("id, full_name, email").in("id", profileIds);
      for (const p of profs ?? []) profilesById.set(p.id, { full_name: p.full_name, email: p.email });
    }
    const lastByConv = new Map<string, { body: string; sender: string; created_at: string }>();
    if (ids.length) {
      // last message per conversation
      const { data: msgs } = await supabaseAdmin
        .from("messages")
        .select("conversation_id, body, sender, created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false });
      for (const m of msgs ?? []) {
        if (!lastByConv.has(m.conversation_id)) {
          lastByConv.set(m.conversation_id, { body: m.body, sender: m.sender, created_at: m.created_at });
        }
      }
    }
    return list.map((c) => {
      const last = lastByConv.get(c.id);
      const seen = c.admin_last_seen_at ? new Date(c.admin_last_seen_at).getTime() : 0;
      const lastTs = new Date(c.last_message_at).getTime();
      const unread =
        lastTs > seen &&
        !!last &&
        last.sender !== "admin";
      return {
        ...c,
        contact: profilesById.get(c.contact_profile_id) ?? { full_name: null, email: null },
        last_snippet: last?.body?.slice(0, 160) ?? null,
        last_sender: last?.sender ?? null,
        unread,
      };
    });
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv, error } = await supabaseAdmin
      .from("conversations").select("*").eq("id", data.conversationId).single();
    if (error || !conv) throw new Error("Gesprek niet gevonden");
    const { data: contact } = await supabaseAdmin
      .from("profiles").select("id, full_name, email, phone").eq("id", conv.contact_profile_id).maybeSingle();
    const { data: messages } = await supabaseAdmin
      .from("messages").select("id, sender, author_id, body, created_at")
      .eq("conversation_id", conv.id).order("created_at", { ascending: true });
    // Mark seen.
    await supabaseAdmin.from("conversations")
      .update({ admin_last_seen_at: new Date().toISOString() })
      .eq("id", conv.id);
    return { conversation: conv, contact, messages: messages ?? [] };
  });

export const adminReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; body: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const body = sanitize(data.body, 5000);
    if (body.length < 1) throw new Error("Bericht is leeg.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ctx = context as unknown as AdminCtx;
    const { data: conv } = await supabaseAdmin
      .from("conversations").select("id, contact_profile_id, subject").eq("id", data.conversationId).maybeSingle();
    if (!conv) throw new Error("Gesprek niet gevonden");
    const { data: contact } = await supabaseAdmin
      .from("profiles").select("email, full_name").eq("id", conv.contact_profile_id).maybeSingle();

    const { error } = await supabaseAdmin.from("messages").insert({
      conversation_id: conv.id, author_id: ctx.userId, sender: "admin", body,
    });
    if (error) throw error;

    if (contact?.email) {
      try {
        await sendCustomerReplyEmail({
          to: contact.email,
          name: contact.full_name ?? null,
          subject: conv.subject ?? "Bericht van Yeketi Motorworks",
          preview: body,
          conversationId: conv.id,
        });
      } catch (e) {
        console.error("sendCustomerReplyEmail failed", e);
      }
    }
    return { ok: true } as const;
  });

export const closeConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; status: "open" | "gesloten" }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("conversations").update({ status: data.status }).eq("id", data.conversationId);
    if (error) throw error;
    return { ok: true } as const;
  });

export const markConversationSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("conversations")
      .update({ admin_last_seen_at: new Date().toISOString() })
      .eq("id", data.conversationId);
    return { ok: true } as const;
  });

export const findOrCreateConversationForContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profileId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const id = await ensureConversation(data.profileId, "manual");
    return { conversationId: id };
  });

export const linkConversationToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; projectId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("conversations").update({ project_id: data.projectId }).eq("id", data.conversationId);
    if (error) throw error;
    return { ok: true } as const;
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profileId: string; full_name?: string | null; phone?: string | null; email?: string | null; locale?: "nl" | "en" }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { full_name?: string | null; phone?: string | null; email?: string; locale?: "nl" | "en" } = {};
    if (typeof data.full_name !== "undefined") patch.full_name = data.full_name?.toString().trim() || null;
    if (typeof data.phone !== "undefined") patch.phone = data.phone?.toString().trim() || null;
    if (data.locale === "nl" || data.locale === "en") patch.locale = data.locale;
    if (typeof data.email !== "undefined" && data.email) {
      const email = data.email.toString().trim().toLowerCase();
      if (!EMAIL_RE.test(email)) throw new Error("Ongeldig e-mailadres");
      patch.email = email;
      // Also update the auth user's email so the customer can sign in.
      try {
        await supabaseAdmin.auth.admin.updateUserById(data.profileId, { email });
      } catch (e) {
        console.warn("auth email update failed", (e as Error).message);
      }
    }
    if (Object.keys(patch).length === 0) return { ok: true } as const;
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.profileId);
    if (error) throw error;
    return { ok: true } as const;
  });

export const unreadConversationCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("conversations")
      .select("id, last_message_at, admin_last_seen_at");
    let n = 0;
    for (const c of data ?? []) {
      const seen = c.admin_last_seen_at ? new Date(c.admin_last_seen_at).getTime() : 0;
      if (new Date(c.last_message_at).getTime() > seen) n += 1;
    }
    return { count: n };
  });

// ──────────────────────────────────────────────────────────────────────────
// Customer portal (RLS-enforced via the authenticated client)
// ──────────────────────────────────────────────────────────────────────────

type AuthCtx = { supabase: SupabaseClient<Database>; userId: string };

export const getMyConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthCtx;
    // RLS: only the user's own row is visible.
    const { data: conv } = await ctx.supabase
      .from("conversations")
      .select("id, status, subject, contact_profile_id")
      .eq("contact_profile_id", ctx.userId)
      .maybeSingle();
    if (!conv) {
      return { conversation: null, messages: [] as Array<{ id: string; sender: string; author_id: string | null; body: string; created_at: string }> };
    }
    const { data: messages } = await ctx.supabase
      .from("messages")
      .select("id, sender, author_id, body, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });
    // Mark seen by the customer (RLS: own conversation only).
    await ctx.supabase
      .from("conversations")
      .update({ customer_last_seen_at: new Date().toISOString() })
      .eq("id", conv.id);
    return { conversation: conv, messages: messages ?? [] };
  });

export const getMyUnreadMessagesCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthCtx;
    const { data: conv } = await ctx.supabase
      .from("conversations")
      .select("id, last_message_at, customer_last_seen_at")
      .eq("contact_profile_id", ctx.userId)
      .maybeSingle();
    if (!conv || !conv.last_message_at) return { unread: 0 };
    const seen = conv.customer_last_seen_at ? new Date(conv.customer_last_seen_at).getTime() : 0;
    if (new Date(conv.last_message_at).getTime() <= seen) return { unread: 0 };
    // Only flag unread if the latest message is NOT from the customer.
    const { data: last } = await ctx.supabase
      .from("messages")
      .select("sender")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last || last.sender === "klant") return { unread: 0 };
    return { unread: 1 };
  });

export const sendCustomerMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { body: string }) => input)
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthCtx;
    const body = sanitize(data.body, 5000);
    if (body.length < 1) throw new Error("Bericht is leeg.");

    // Find or create the user's own conversation (RLS-enforced — contact_profile_id = auth.uid()).
    const { data: existing } = await ctx.supabase
      .from("conversations")
      .select("id, status, subject, contact_profile_id")
      .eq("contact_profile_id", ctx.userId)
      .maybeSingle();

    let convId: string;
    if (existing) {
      if (existing.status !== "open") throw new Error("Gesprek is gesloten.");
      convId = existing.id;
    } else {
      const { data: created, error } = await ctx.supabase
        .from("conversations")
        .insert({ contact_profile_id: ctx.userId, source: "manual", subject: body.slice(0, 80) })
        .select("id")
        .single();
      if (error || !created) throw new Error("Kon gesprek niet starten.");
      convId = created.id;
    }

    const ins = await ctx.supabase.from("messages").insert({
      conversation_id: convId,
      author_id: ctx.userId,
      sender: "klant",
      body,
    });
    if (ins.error) {
      console.error("sendCustomerMessage insert failed", {
        userId: ctx.userId,
        convId,
        error: ins.error,
      });
      throw new Error(`Bericht kon niet verstuurd worden: ${ins.error.message}`);
    }
    return { ok: true, conversationId: convId } as const;
  });

// ──────────────────────────────────────────────────────────────────────────
// Admin notification settings
// ──────────────────────────────────────────────────────────────────────────

const NOTIFY_KEY = "admin_notify_email";

export const getAdminNotifySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", NOTIFY_KEY).maybeSingle();
    return {
      notifyEmail: (data?.value as string | null) ?? null,
      fallback: process.env.ADMIN_NOTIFY_EMAIL || null,
    };
  });

export const setAdminNotifyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string | null }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as AdminCtx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const value = data.email ? data.email.trim().toLowerCase() : null;
    if (value && !EMAIL_RE.test(value)) throw new Error("Ongeldig e-mailadres.");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: NOTIFY_KEY, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { ok: true } as const;
  });

// ──────────────────────────────────────────────────────────────────────────
// Email helper
// ──────────────────────────────────────────────────────────────────────────

async function sendCustomerReplyEmail(opts: {
  to: string; name: string | null; subject: string; preview: string; conversationId: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const from = process.env.FROM_EMAIL || "Yeketi Motorworks <info@yeketimotorworks.com>";
  const replyTo = process.env.REPLY_TO_EMAIL || "info@yeketimotorworks.com";
  const site = process.env.PUBLIC_SITE_URL || PROD_SITE_URL;
  void opts.conversationId;
  const portalUrl = `${site}/portaal/berichten`;
  const first = opts.name ? String(opts.name).split(" ")[0] : null;
  const safePreview = opts.preview.length > 320 ? opts.preview.slice(0, 320) + "…" : opts.preview;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F7F3EC;font-family:Georgia,'Times New Roman',serif;color:#221F1B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EC;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#FFFFFF;border:1px solid #221F1B;">
        <tr><td style="padding:28px 28px 0;">
          <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#B0832C;font-family:Arial,Helvetica,sans-serif;">Yeketi Motorworks</div>
        </td></tr>
        <tr><td style="padding:18px 28px 4px;">
          <h1 style="margin:0;font-family:'Marcellus',Georgia,serif;font-weight:400;font-size:26px;line-height:1.2;color:#221F1B;">${first ? `Hoi ${esc(first)},` : "Bericht van Yeketi"}</h1>
        </td></tr>
        <tr><td style="padding:14px 28px 8px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#4A453E;">Er staat een nieuw bericht voor je klaar.</p>
        </td></tr>
        <tr><td style="padding:8px 28px 14px;">
          <blockquote style="margin:0;padding:14px 16px;border-left:3px solid #B0832C;background:#FBF8F1;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#221F1B;white-space:pre-wrap;">${esc(safePreview)}</blockquote>
        </td></tr>
        <tr><td style="padding:8px 28px 32px;">
          <a href="${portalUrl}" style="display:inline-block;background:#B0832C;color:#F7F3EC;text-decoration:none;padding:14px 26px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;border:1px solid #B0832C;">Reageren</a>
        </td></tr>
        <tr><td style="padding:18px 28px 24px;border-top:1px solid #EFE8DB;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#7A7367;">
          Yeketi Motorworks · info@yeketimotorworks.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [opts.to], reply_to: replyTo,
      subject: `Re: ${opts.subject}`,
      html,
      text: `${first ? `Hoi ${first},\n\n` : ""}Er staat een nieuw bericht voor je klaar:\n\n${safePreview}\n\nReageren: ${portalUrl}`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}