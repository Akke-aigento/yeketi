import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROD_SITE_URL = "https://yeketimotorworks.com";
const RESET_REDIRECT = `${PROD_SITE_URL}/reset-password`;

async function assertAdmin(ctx: { supabase: SupabaseLike; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

// Minimal shape we use (avoids importing the heavy generated type here)
type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null; error: unknown }>;
};

const DEFAULT_PHASES = [
  "Inspectie",
  "Transport heen",
  "Plaatwerk",
  "Lak & afwerking",
  "Mechaniek",
  "Transport terug",
  "Aflevering",
];

// Find a user by email via the profiles table (scales beyond 200 users) and
// hydrate their auth record so we can branch on email_confirmed_at.
async function findUserByEmail(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();
  if (!profile) return null;
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  return u?.user ?? null;
}

// Send either an invite (new / unconfirmed user) or a password reset (already
// confirmed). Returns the channel actually used so the UI can confirm to admin.
async function inviteOrReset(email: string, fullName?: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const existing = await findUserByEmail(email);
  if (existing && existing.email_confirmed_at) {
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: RESET_REDIRECT,
    });
    if (error) throw error;
    return { user: existing, channel: "reset" as const };
  }
  const inv = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
    redirectTo: RESET_REDIRECT,
  });
  if (inv.error) throw inv.error;
  return { user: inv.data.user, channel: "invite" as const };
}

export const listCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = new Set((adminRoles ?? []).map((r) => r.user_id));
    const customerProfiles = (profiles ?? []).filter((p) => !adminIds.has(p.id));
    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id, customer_id, title, status, created_at, updated_at")
      .order("updated_at", { ascending: false });
    return { profiles: customerProfiles, projects: projects ?? [] };
  });

export const inviteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; full_name?: string; phone?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Ongeldig e-mailadres");

    const { user, channel } = await inviteOrReset(email, data.full_name ?? null);
    if (!user) throw new Error("Kon gebruiker niet aanmaken");

    await supabaseAdmin.from("profiles").upsert({
      id: user.id,
      full_name: data.full_name ?? null,
      phone: data.phone ?? null,
      email,
    });
    return { userId: user.id, email, channel };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const email = data.email.trim().toLowerCase();
    const { channel } = await inviteOrReset(email, null);
    return { ok: true, channel };
  });

export const convertQuoteToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quoteId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: q, error: qe } = await supabaseAdmin
      .from("quote_requests").select("*").eq("id", data.quoteId).maybeSingle();
    if (qe || !q) throw qe ?? new Error("Aanvraag niet gevonden");

    const email = (q.email as string).trim().toLowerCase();
    const { user } = await inviteOrReset(email, q.naam as string);
    if (!user) throw new Error("Kon klant niet aanmaken");

    await supabaseAdmin.from("profiles").upsert({
      id: user.id,
      full_name: q.naam,
      phone: q.telefoon,
      email,
    });

    const title = [q.merk, q.model, q.bouwjaar].filter(Boolean).join(" ") || (q.type_werk as string);
    const { data: project, error: pe } = await supabaseAdmin
      .from("projects").insert({
        customer_id: user.id,
        vehicle_make: q.merk,
        vehicle_model: q.model,
        vehicle_year: q.bouwjaar,
        title,
        status: "intake",
      }).select("*").maybeSingle();
    if (pe || !project) throw pe ?? new Error("Project niet aangemaakt");

    const phaseRows = DEFAULT_PHASES.map((name, i) => ({
      project_id: project.id,
      name,
      sort_order: i,
      status: (i === 0 ? "active" : "pending") as "active" | "pending",
      started_at: i === 0 ? new Date().toISOString() : null,
    }));
    await supabaseAdmin.from("project_phases").insert(phaseRows);

    await supabaseAdmin.from("quote_requests").update({ status: "won" }).eq("id", q.id);

    return { projectId: project.id };
  });