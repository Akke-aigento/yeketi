// Read-only health endpoint. Not callable anonymously: caller must present a
// matching `x-health-token` header. The expected token lives in private.config
// and is read via the SECURITY DEFINER RPC public.get_health_token(), which is
// executable by service_role only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type Status = "ok" | "warn" | "fail";
type Check = { key: string; status: Status; detail: string };

const RANK: Record<Status, number> = { ok: 0, warn: 1, fail: 2 };

function worst(checks: Check[]): Status {
  return checks.reduce<Status>((acc, c) => (RANK[c.status] > RANK[acc] ? c.status : acc), "ok");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const fmt = (iso: string | null) => (iso ? new Date(iso).toISOString() : "nooit");

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- auth ---
  const provided = req.headers.get("x-health-token") ?? "";
  const { data: expected, error: tokenErr } = await supabase.rpc("get_health_token");
  if (tokenErr) {
    console.error("health: token lookup failed", tokenErr);
    return json({ error: "unauthorized" }, 401);
  }
  if (!expected || !provided || !timingSafeEqual(provided, String(expected))) {
    return json({ error: "unauthorized" }, 401);
  }

  const checks: Check[] = [];
  const since7 = daysAgo(7);

  // 1. notify_failures
  try {
    const { data, count, error } = await supabase
      .from("notify_event_failures")
      .select("event_type, error_message, created_at", { count: "exact" })
      .gte("created_at", since7)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const n = count ?? 0;
    const last = data?.[0];
    checks.push({
      key: "notify_failures",
      status: n > 0 ? "fail" : "ok",
      detail:
        n > 0
          ? `${n} mislukte notificatie(s) in 7 dagen. Meest recent: ${last?.event_type ?? "?"} — ${last?.error_message ?? "geen foutmelding"}`
          : "0 mislukte notificaties in de laatste 7 dagen",
    });
  } catch (e) {
    checks.push({ key: "notify_failures", status: "fail", detail: `check mislukt: ${(e as Error).message}` });
  }

  // 2. form_activity + 3. honeypot_hits
  try {
    const { data, error } = await supabase
      .from("public_form_submissions")
      .select("kind, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    const rows = data ?? [];

    const perKind = new Map<string, { last: string | null; recent: number }>();
    let overallLast: string | null = null;
    for (const r of rows) {
      const cur = perKind.get(r.kind) ?? { last: null, recent: 0 };
      if (!cur.last || r.created_at > cur.last) cur.last = r.created_at;
      if (r.created_at >= since7) cur.recent += 1;
      perKind.set(r.kind, cur);
      if (!overallLast || r.created_at > overallLast) overallLast = r.created_at;
    }

    const stale = !overallLast || overallLast < daysAgo(14);
    const detailParts = [...perKind.entries()].map(
      ([k, v]) => `${k}: laatst ${fmt(v.last)}, ${v.recent} in 7d`,
    );
    checks.push({
      key: "form_activity",
      status: stale ? "warn" : "ok",
      detail:
        (detailParts.length ? detailParts.join("; ") : "geen submissions") +
        (stale ? " — laatste submission ouder dan 14 dagen, test het formulier handmatig" : ""),
    });

    const hp = [...perKind.entries()].filter(([k]) => k.startsWith("honeypot"));
    const hpCount = hp.reduce((s, [, v]) => s + v.recent, 0);
    checks.push({
      key: "honeypot_hits",
      status: hpCount > 0 ? "warn" : "ok",
      detail:
        hpCount > 0
          ? hp.filter(([, v]) => v.recent > 0).map(([k, v]) => `${k}: ${v.recent}`).join("; ")
          : "0 honeypot-hits in de laatste 7 dagen",
    });
  } catch (e) {
    const msg = `check mislukt: ${(e as Error).message}`;
    checks.push({ key: "form_activity", status: "fail", detail: msg });
    checks.push({ key: "honeypot_hits", status: "fail", detail: msg });
  }

  // 4. suppressed_recent
  try {
    const { data, count, error } = await supabase
      .from("suppressed_emails")
      .select("reason, created_at", { count: "exact" })
      .gte("created_at", since7)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const n = count ?? 0;
    checks.push({
      key: "suppressed_recent",
      status: n > 0 ? "warn" : "ok",
      detail:
        n > 0
          ? `${n} onderdrukte e-mail(s) in 7 dagen. Meest recente reden: ${data?.[0]?.reason ?? "onbekend"}`
          : "0 onderdrukte e-mails in de laatste 7 dagen",
    });
  } catch (e) {
    checks.push({ key: "suppressed_recent", status: "fail", detail: `check mislukt: ${(e as Error).message}` });
  }

  // 5. cron_reminders
  try {
    const { data, error } = await supabase.rpc("get_last_cron_run", {
      p_jobname: "yeketi-quote-reminders",
    });
    if (error) throw error;
    const run = Array.isArray(data) ? data[0] : data;
    if (!run || !run.start_time) {
      checks.push({ key: "cron_reminders", status: "fail", detail: "cron-job heeft nog nooit gedraaid" });
    } else {
      const started = new Date(run.start_time).getTime();
      const tooOld = Date.now() - started > 26 * 3_600_000;
      const failed = String(run.status ?? "").toLowerCase() === "failed";
      checks.push({
        key: "cron_reminders",
        status: failed || tooOld ? "fail" : "ok",
        detail: `status ${run.status ?? "?"}, laatste run ${new Date(started).toISOString()}${tooOld ? " (ouder dan 26 uur)" : ""}`,
      });
    }
  } catch (e) {
    checks.push({ key: "cron_reminders", status: "fail", detail: `check mislukt: ${(e as Error).message}` });
  }

  // 6. open_invites
  try {
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("password_set", false)
      .lt("created_at", since7);
    if (error) throw error;
    const n = count ?? 0;
    checks.push({
      key: "open_invites",
      status: n > 0 ? "warn" : "ok",
      detail:
        n > 0
          ? `${n} uitgenodigde gebruiker(s) ouder dan 7 dagen zonder wachtwoord`
          : "geen openstaande uitnodigingen ouder dan 7 dagen",
    });
  } catch (e) {
    checks.push({ key: "open_invites", status: "fail", detail: `check mislukt: ${(e as Error).message}` });
  }

  return json({ status: worst(checks), generated_at: new Date().toISOString(), checks });
});