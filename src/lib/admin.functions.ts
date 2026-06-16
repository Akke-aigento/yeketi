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

// Invite a new admin. Requires explicit confirmation phrase to avoid sending
// admin invites to customers by accident.
export const inviteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; full_name?: string; confirm: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.confirm !== "IK WIL EEN ADMIN UITNODIGEN") {
      throw new Error("Bevestiging onjuist");
    }
    const email = data.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Ongeldig e-mailadres");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { user, channel } = await inviteOrReset(email, data.full_name ?? null);
    if (!user) throw new Error("Kon gebruiker niet aanmaken");

    await supabaseAdmin.from("profiles").upsert({
      id: user.id,
      full_name: data.full_name ?? null,
      email,
    });
    // Grant admin role (idempotent via unique constraint).
    const { error: re } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
    if (re) throw re;
    return { userId: user.id, email, channel };
  });

export const listAdmins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error) throw error;
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return { admins: [] as { id: string; email: string | null; full_name: string | null }[], currentUserId: (context as { userId: string }).userId };
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", ids);
    return { admins: profiles ?? [], currentUserId: (context as { userId: string }).userId };
  });

// Volledig verwijderen van een admin-account: rol, profiel, auth-user,
// sessies en identities worden allemaal weggehaald (FK ON DELETE CASCADE
// op profiles + user_roles vangt de rest). Vereist bevestigingszin.
// Kan zichzelf of de laatste admin niet verwijderen.
export const removeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; confirm: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.confirm !== "VERWIJDER ADMIN") {
      throw new Error("Bevestiging onjuist");
    }
    const ctx = context as { userId: string };
    if (data.userId === ctx.userId) {
      throw new Error("Je kunt jezelf niet als admin verwijderen");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: all, error: le } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "admin");
    if (le) throw le;
    if ((all ?? []).length <= 1) throw new Error("Er moet minstens één admin overblijven");

    // Veiligheidsrem: weiger als deze admin ook klantdata (projecten of
    // offertes) op zijn naam heeft staan – dat is dan geen pure teamaccount.
    const { count: projectCount } = await supabaseAdmin
      .from("projects").select("id", { count: "exact", head: true })
      .eq("customer_id", data.userId);
    if ((projectCount ?? 0) > 0) {
      throw new Error("Deze gebruiker heeft projecten op zijn naam – verwijder die eerst");
    }
    const { count: quoteCount } = await supabaseAdmin
      .from("quotes").select("id", { count: "exact", head: true })
      .eq("customer_id", data.userId);
    if ((quoteCount ?? 0) > 0) {
      throw new Error("Deze gebruiker heeft offertes op zijn naam – verwijder die eerst");
    }

    // Harde verwijdering uit auth.users – cascade ruimt profiles, user_roles,
    // sessions en identities automatisch op.
    const { error: de } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (de) throw de;
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

// ---------------------------------------------------------------------------
// Storage-aware deletes (D-1, D-2) and orphan janitor (S-5)
// ---------------------------------------------------------------------------

async function listAllUnder(bucket: string, prefix: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: string[] = [];
  // Walk recursively – storage.list is one folder level at a time.
  async function walk(p: string) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(p, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    for (const item of data ?? []) {
      // Folders come back with id === null
      const full = p ? `${p}/${item.name}` : item.name;
      if (item.id === null) {
        await walk(full);
      } else {
        out.push(full);
      }
    }
  }
  await walk(prefix);
  return out;
}

async function removeInChunks(bucket: string, paths: string[]) {
  if (paths.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const chunk = 100;
  for (let i = 0; i < paths.length; i += chunk) {
    const { error } = await supabaseAdmin.storage.from(bucket).remove(paths.slice(i, i + chunk));
    if (error) throw error;
  }
}

export const deletePhase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phaseId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Find every update photo path attached to this phase.
    const { data: photos, error: pe } = await supabaseAdmin
      .from("update_photos")
      .select("storage_path, phase_updates!inner(phase_id)")
      .eq("phase_updates.phase_id", data.phaseId);
    if (pe) throw pe;
    const paths = (photos ?? []).map((p) => p.storage_path).filter(Boolean) as string[];
    await removeInChunks("project-photos", paths);
    const { error: de } = await supabaseAdmin
      .from("project_phases").delete().eq("id", data.phaseId);
    if (de) throw de;
    return { removedFiles: paths.length };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Storage layout is `${projectId}/${updateId}/<file>` – nuke the whole prefix.
    const paths = await listAllUnder("project-photos", data.projectId);
    await removeInChunks("project-photos", paths);
    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.projectId);
    if (error) throw error;
    return { removedFiles: paths.length };
  });

export const deleteQuoteRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quoteId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: q, error: qe } = await supabaseAdmin
      .from("quote_requests").select("foto_urls").eq("id", data.quoteId).maybeSingle();
    if (qe) throw qe;
    const stored = (q?.foto_urls ?? []) as string[];
    // Also sweep the submission folder(s) in case extra files were uploaded.
    const prefixes = new Set<string>();
    for (const p of stored) {
      const slash = p.indexOf("/");
      if (slash > 0) prefixes.add(p.slice(0, slash));
    }
    const folderPaths: string[] = [];
    for (const pref of prefixes) {
      folderPaths.push(...(await listAllUnder("quote-photos", pref)));
    }
    const all = Array.from(new Set([...stored, ...folderPaths]));
    await removeInChunks("quote-photos", all);
    const { error: de } = await supabaseAdmin
      .from("quote_requests").delete().eq("id", data.quoteId);
    if (de) throw de;
    return { removedFiles: all.length };
  });

// Janitor: remove every quote-photos object not referenced by any quote_request.
export const cleanupOrphanQuotePhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const allPaths = await listAllUnder("quote-photos", "");
    if (allPaths.length === 0) return { removedFiles: 0, scanned: 0 };
    const { data: rows, error } = await supabaseAdmin
      .from("quote_requests").select("foto_urls");
    if (error) throw error;
    const referenced = new Set<string>();
    for (const r of rows ?? []) {
      for (const p of (r.foto_urls ?? []) as string[]) referenced.add(p);
    }
    const orphans = allPaths.filter((p) => !referenced.has(p));
    await removeInChunks("quote-photos", orphans);
    return { removedFiles: orphans.length, scanned: allPaths.length };
  });