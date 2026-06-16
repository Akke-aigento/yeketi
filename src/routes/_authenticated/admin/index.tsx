import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell, statusBadge, timeAgo } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/copy";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Yeketi" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

type ProjectRow = {
  id: string; title: string; status: string; updated_at: string; created_at: string;
  vehicle_make: string | null; vehicle_model: string | null; customer_id: string;
  cover_photo_url: string | null;
  last_update_at?: string;
};

type ActivityItem = {
  id: string;
  body: string;
  created_at: string;
  project_id: string;
  project_title: string;
  photo_path: string | null;
};

function Dashboard() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [newQuotes, setNewQuotes] = useState<number | null>(null);
  const [stale, setStale] = useState<number | null>(null);
  const [notifyFailures, setNotifyFailures] = useState<{ count: number; recent: Array<{ id: string; event_type: string; error_message: string | null; created_at: string }> } | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [recentQuoteEvents, setRecentQuoteEvents] = useState<Array<{ id: string; quote_number: string | null; title: string; status: string; total_amount: number; responded_at: string | null }>>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [updateSpark, setUpdateSpark] = useState<number[]>([]);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [p, q] = await Promise.all([
        supabase.from("projects").select("id, title, status, updated_at, created_at, vehicle_make, vehicle_model, customer_id, cover_photo_url"),
        supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
      ]);
      if (!active) return;
      const rows = (p.data ?? []).filter((r) => r.status !== "archived" && r.status !== "delivered");
      // Stale = active project waarvan laatste phase_update ouder is dan 7d (of nooit een update)
      const projectIds = rows.map((r) => r.id);
      let lastUpdateByProject = new Map<string, string>();
      let recentUpdates: Array<{ id: string; body: string; created_at: string; project_id: string; phase_id: string }> = [];
      const phaseToProject = new Map<string, string>();
      if (projectIds.length > 0) {
        const { data: phases } = await supabase
          .from("project_phases").select("id, project_id").in("project_id", projectIds);
        (phases ?? []).forEach((ph) => phaseToProject.set(ph.id, ph.project_id));
        const phaseIds = (phases ?? []).map((ph) => ph.id);
        if (phaseIds.length > 0) {
          const { data: updates } = await supabase
            .from("phase_updates").select("id, phase_id, body, created_at")
            .in("phase_id", phaseIds)
            .order("created_at", { ascending: false });
          (updates ?? []).forEach((u: { id: string; phase_id: string; body: string; created_at: string }) => {
            const pid = phaseToProject.get(u.phase_id);
            if (pid && !lastUpdateByProject.has(pid)) lastUpdateByProject.set(pid, u.created_at);
            if (pid) recentUpdates.push({ id: u.id, body: u.body, created_at: u.created_at, project_id: pid, phase_id: u.phase_id });
          });
        }
      }
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const rowsAnnotated = rows.map((r) => ({
        ...r,
        last_update_at: lastUpdateByProject.get(r.id) ?? r.created_at,
      }));
      const staleCount = rowsAnnotated.filter(
        (r) => now - new Date(r.last_update_at).getTime() >= sevenDaysMs,
      ).length;
      rowsAnnotated.sort(
        (a, b) => new Date(a.last_update_at).getTime() - new Date(b.last_update_at).getTime(),
      );
      setProjects(rowsAnnotated as ProjectRow[]);
      setNewQuotes(q.count ?? 0);
      setStale(staleCount);

      // Sparkline: updates per day, last 14 days
      const buckets = new Array(14).fill(0) as number[];
      const dayMs = 24 * 3600 * 1000;
      const startDay = Math.floor(now / dayMs) - 13;
      recentUpdates.forEach((u) => {
        const d = Math.floor(new Date(u.created_at).getTime() / dayMs);
        const i = d - startDay;
        if (i >= 0 && i < 14) buckets[i] += 1;
      });
      setUpdateSpark(buckets);

      // Activity feed — 8 most recent updates
      const titleByProject = new Map(rows.map((r) => [r.id, r.title] as const));
      const top = recentUpdates
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8);
      let photoByUpdate = new Map<string, string>();
      if (top.length > 0) {
        const { data: photoRows } = await supabase
          .from("update_photos")
          .select("update_id, storage_path, sort_order")
          .in("update_id", top.map((u) => u.id))
          .order("sort_order");
        (photoRows ?? []).forEach((ph: { update_id: string; storage_path: string }) => {
          if (!photoByUpdate.has(ph.update_id)) photoByUpdate.set(ph.update_id, ph.storage_path);
        });
        const paths = Array.from(photoByUpdate.values());
        if (paths.length > 0) {
          const { data: signed } = await supabase.storage
            .from("project-photos").createSignedUrls(paths, 3600);
          const map: Record<string, string> = {};
          (signed ?? []).forEach((s, i) => { if (s.signedUrl) map[paths[i]] = s.signedUrl; });
          if (active) setSignedUrls((prev) => ({ ...prev, ...map }));
        }
      }
      const activityItems: ActivityItem[] = top.map((u) => ({
        id: u.id,
        body: u.body,
        created_at: u.created_at,
        project_id: u.project_id,
        project_title: titleByProject.get(u.project_id) ?? "Project",
        photo_path: photoByUpdate.get(u.id) ?? null,
      }));
      if (active) setActivity(activityItems);

      // Recent quote responses (accepted / rejected) — newest first
      const { data: qEvents } = await supabase
        .from("quotes")
        .select("id, quote_number, title, status, total_amount, responded_at")
        .in("status", ["akkoord", "afgewezen"])
        .order("responded_at", { ascending: false })
        .limit(4);
      if (active) setRecentQuoteEvents(qEvents ?? []);

      const { data: failRows, count: failCount } = await supabase
        .from("notify_event_failures")
        .select("id, event_type, error_message, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(5);
      if (!active) return;
      setNotifyFailures({
        count: failCount ?? 0,
        recent: (failRows as Array<{ id: string; event_type: string; error_message: string | null; created_at: string }> | null) ?? [],
      });
    })();
    return () => { active = false; };
  }, []);

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 6) return "Goeienacht";
    if (h < 12) return "Goeiemorgen";
    if (h < 18) return "Goeiemiddag";
    return "Goeienavond";
  }, [now]);
  const dateLong = now.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });

  // Cover photos for "vraagt om aandacht" cards
  useEffect(() => {
    if (!projects) return;
    const paths = projects.map((p) => p.cover_photo_url).filter((x): x is string => !!x);
    if (paths.length === 0) return;
    const missing = paths.filter((p) => !signedUrls[p]);
    if (missing.length === 0) return;
    let active = true;
    supabase.storage.from("project-photos").createSignedUrls(missing, 3600).then(({ data }) => {
      if (!active || !data) return;
      const map: Record<string, string> = {};
      data.forEach((s, i) => { if (s.signedUrl) map[missing[i]] = s.signedUrl; });
      setSignedUrls((prev) => ({ ...prev, ...map }));
    });
    return () => { active = false; };
  }, [projects, signedUrls]);

  const staleProjects = (projects ?? []).filter((p) => {
    const last = p.last_update_at ?? p.created_at;
    return Date.now() - new Date(last).getTime() >= 7 * 24 * 3600 * 1000;
  }).slice(0, 6);

  return (
    <AdminShell>
      <section className="container-edit" style={{ paddingBottom: "2rem" }}>
        {/* Greeting */}
        <div style={{ paddingBlock: "1.5rem 0.75rem" }}>
          <div className="eyebrow" style={{ color: "var(--brass)" }}>{dateLong}</div>
          <h1 className="mt-1" style={{ fontFamily: "var(--font-display)", fontSize: "1.9rem", lineHeight: 1.1 }}>
            {greeting}, Baram.
          </h1>
        </div>

        {/* Quick add */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Link to="/admin/projecten" search={{ neu: 1 } as never} className="btn-y-solid text-center">
            + Nieuw project
          </Link>
          <Link to="/admin/quotes" className="btn-y text-center">
            + Nieuwe offerte
          </Link>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <StatTile
            to="/admin/projecten"
            label="Actieve projecten"
            value={projects?.length ?? null}
            emptyHint="Begin met je eerste project."
            sparkline={updateSpark}
            accent="var(--brass)"
          />
          <StatTile
            to="/admin/offertes"
            label="Nieuwe aanvragen"
            value={newQuotes}
            emptyHint="Nog geen nieuwe aanvragen — deel je offertepagina."
            accent="var(--gold)"
          />
          <StatTile
            to="/admin/projecten"
            label="Stil ≥ 7 dagen"
            value={stale}
            emptyHint="Alles loopt. Goed bezig."
            accent={stale && stale > 0 ? "var(--oxide)" : "var(--brass)"}
            warn={!!stale && stale > 0}
          />
        </div>

        {notifyFailures && notifyFailures.count > 0 && (
          <div className="mt-4 px-3 py-3" style={{ border: "1px solid var(--oxide)", background: "var(--cream-deep)" }}>
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--oxide)" }}>
                Notificaties niet bezorgd
              </div>
              <span style={{ fontFamily: "var(--font-display)", color: "var(--oxide)" }}>{notifyFailures.count}</span>
            </div>
            <ul className="mt-2 space-y-1">
              {notifyFailures.recent.map((f) => (
                <li key={f.id} className="text-xs" style={{ color: "var(--charcoal-soft)" }}>
                  <span style={{ color: "var(--charcoal)" }}>{f.event_type}</span> · {timeAgo(f.created_at)} geleden — {f.error_message ?? "onbekende fout"}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Vraagt om aandacht */}
        <div className="mt-8 flex items-baseline justify-between">
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>Vraagt om aandacht</h2>
          {projects && (
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--charcoal-soft)" }}>
              ≥ 7 dagen stil
            </span>
          )}
        </div>
        {projects === null && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[0,1].map((i) => <div key={i} className="skeleton-y" style={{ height: 96 }} />)}
          </div>
        )}
        {projects && staleProjects.length === 0 && (
          <div
            className="mt-3 px-4 py-5 text-sm"
            style={{ border: "1px dashed var(--brass)", background: "var(--cream)", color: "var(--charcoal-soft)" }}
          >
            Alles fris. Geen project langer dan een week stil — netjes.
          </div>
        )}
        {projects && staleProjects.length > 0 && (
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {staleProjects.map((p) => {
              const last = p.last_update_at ?? p.created_at;
              const days = Math.floor((Date.now() - new Date(last).getTime()) / (24 * 3600 * 1000));
              const cover = p.cover_photo_url ? signedUrls[p.cover_photo_url] : null;
              return (
                <li key={p.id}>
                  <Link
                    to="/admin/projecten/$id"
                    params={{ id: p.id }}
                    className="flex gap-3 items-stretch"
                    style={{ border: "1px solid var(--oxide)", background: "var(--cream-deep)" }}
                  >
                    <div
                      style={{
                        width: 92, flexShrink: 0, aspectRatio: "1/1",
                        background: cover ? `center/cover url(${cover})` : "var(--charcoal)",
                        color: "var(--gold)", display: "grid", placeItems: "center",
                        fontFamily: "var(--font-display)", fontSize: "1.4rem",
                      }}
                    >
                      {!cover && (p.vehicle_make?.[0] ?? p.title[0] ?? "·")}
                    </div>
                    <div className="flex-1 min-w-0 py-2.5 pr-3">
                      <div className="truncate" style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>
                        {p.title}
                      </div>
                      <div className="text-xs truncate" style={{ color: "var(--charcoal-soft)" }}>
                        {[p.vehicle_make, p.vehicle_model].filter(Boolean).join(" ") || "—"}
                      </div>
                      <div className="text-[11px] mt-1 flex items-center gap-2">
                        <span style={{ color: "var(--oxide)", fontWeight: 500 }}>{days} dagen stil</span>
                        <span aria-hidden style={{ color: "var(--charcoal-soft)" }}>·</span>
                        <span style={{ color: "var(--brass)" }}>+ Update →</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Recente activiteit */}
        <h2 className="mt-10" style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem" }}>Recente activiteit</h2>
        {activity === null && (
          <div className="mt-3 space-y-2">{[0,1,2].map((i) => <div key={i} className="skeleton-y" style={{ height: 56 }} />)}</div>
        )}
        {activity && activity.length === 0 && (
          <div
            className="mt-3 px-4 py-5 text-sm"
            style={{ border: "1px dashed var(--brass)", background: "var(--cream)", color: "var(--charcoal-soft)" }}
          >
            Nog geen updates. Zodra je er één plaatst zie je hier de hartslag van de werkplaats.
          </div>
        )}
        {activity && activity.length > 0 && (
          <ul className="mt-3 divide-y" style={{ borderTop: "1px solid var(--cream-deep)", borderBottom: "1px solid var(--cream-deep)" }}>
            {activity.map((a) => {
              const url = a.photo_path ? signedUrls[a.photo_path] : null;
              return (
                <li key={a.id}>
                  <Link to="/admin/projecten/$id" params={{ id: a.project_id }} className="flex gap-3 py-3 items-center">
                    <div
                      style={{
                        width: 44, height: 44, flexShrink: 0,
                        background: url ? `center/cover url(${url})` : "var(--cream-deep)",
                        border: "1px solid var(--cream-deep)",
                      }}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs uppercase tracking-[0.15em]" style={{ color: "var(--brass)" }}>
                        {a.project_title}
                      </div>
                      <div className="text-sm truncate" style={{ color: "var(--charcoal)" }}>
                        {a.body || "Foto-update"}
                      </div>
                    </div>
                    <div className="text-[11px] whitespace-nowrap" style={{ color: "var(--charcoal-soft)" }}>
                      {timeAgo(a.created_at)}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}

function StatTile({
  to, label, value, emptyHint, sparkline, accent, warn,
}: {
  to: "/admin/projecten" | "/admin/offertes";
  label: string;
  value: number | null;
  emptyHint: string;
  sparkline?: number[];
  accent: string;
  warn?: boolean;
}) {
  const loading = value === null;
  const isZero = value === 0;
  return (
    <Link
      to={to}
      className="block px-3 py-3 transition-colors"
      style={{
        border: "1px solid " + (warn ? "var(--oxide)" : "var(--charcoal)"),
        background: "var(--cream)",
        position: "relative",
        minHeight: 108,
      }}
    >
      <div className="text-[9.5px] uppercase tracking-[0.2em]" style={{ color: "var(--charcoal-soft)" }}>{label}</div>
      {loading ? (
        <div className="mt-2 skeleton-y" style={{ height: 36, width: "60%" }} />
      ) : isZero ? (
        <div className="mt-1.5 text-[11px]" style={{ color: "var(--charcoal-soft)", lineHeight: 1.35 }}>
          {emptyHint}
        </div>
      ) : (
        <div className="mt-1 flex items-end justify-between gap-2">
          <div style={{ fontFamily: "var(--font-display)", fontSize: "2.1rem", color: accent, lineHeight: 1 }}>
            {value}
          </div>
          {sparkline && sparkline.some((n) => n > 0) && <Sparkline values={sparkline} color={accent} />}
        </div>
      )}
      <div
        aria-hidden
        style={{
          position: "absolute", left: 0, bottom: 0, height: 2, background: accent,
          width: isZero || loading ? "20%" : "100%", transition: "width .4s ease",
        }}
      />
    </Link>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 56, h = 22, max = Math.max(1, ...values);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ opacity: 0.7 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}