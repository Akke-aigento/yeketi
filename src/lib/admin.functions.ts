import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: SupabaseLike; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", ctx.userId)
    .maybeSingle();
  if (error || !data?.is_admin) throw new Error("Forbidden");
}

// Minimal shape we use (avoids importing the heavy generated type here)
type SupabaseLike = {
  from: (t: string) => {
    select: (q: string) => {
      eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { is_admin?: boolean } | null; error: unknown }> };
    };
  };
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

export const listCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, is_admin, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id, customer_id, title, status, created_at, updated_at")
      .order("updated_at", { ascending: false });
    return { profiles: profiles ?? [], projects: projects ?? [] };
  });

export const inviteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; full_name?: string; phone?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Ongeldig e-mailadres");

    // Find existing user
    const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let user = list.data.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      const inv = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: data.full_name ?? null },
      });
      if (inv.error) throw inv.error;
      user = inv.data.user;
    }
    if (!user) throw new Error("Kon gebruiker niet aanmaken");

    await supabaseAdmin.from("profiles").upsert({
      id: user.id,
      full_name: data.full_name ?? null,
      phone: data.phone ?? null,
      email,
    });
    return { userId: user.id, email };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email.trim().toLowerCase());
    if (error) throw error;
    return { ok: true };
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

    // Ensure user
    const email = (q.email as string).trim().toLowerCase();
    const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let user = list.data.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      const inv = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: q.naam },
      });
      if (inv.error) throw inv.error;
      user = inv.data.user;
    }
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