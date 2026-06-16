import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminBottomNav } from "./AdminBottomNav";

const tabs: { to: "/admin" | "/admin/projecten" | "/admin/offertes" | "/admin/quotes" | "/admin/berichten" | "/admin/klanten" | "/admin/recent-werk" | "/admin/instellingen"; label: string; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", exact: true },
  { to: "/admin/berichten", label: "Berichten" },
  { to: "/admin/offertes", label: "Aanvragen" },
  { to: "/admin/quotes", label: "Offertes" },
  { to: "/admin/projecten", label: "Projecten" },
  { to: "/admin/klanten", label: "Klanten" },
  { to: "/admin/recent-werk", label: "Recent Werk" },
  { to: "/admin/instellingen", label: "Instellingen" },
];

export function AdminShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>("[data-active='true']");
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--cream)" }}>
      <header
        className="sticky top-0 z-40"
        style={{ background: "var(--charcoal)", color: "var(--cream)", borderBottom: "1px solid var(--brass)" }}
      >
        <div className="container-edit flex items-center justify-between gap-3" style={{ paddingBlock: "0.85rem" }}>
          <Link to="/admin" className="flex items-center gap-3 min-w-0 shrink-0" style={{ color: "var(--cream)" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>Yeketi</span>
            <span className="eyebrow" style={{ color: "var(--gold)", fontSize: "0.65rem" }}>Admin</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <span className="hidden md:inline text-xs opacity-70 truncate max-w-[200px]">{email}</span>
            <Link
              to="/"
              className="text-[11px] uppercase tracking-[0.2em] inline-flex items-center gap-1.5 hover:opacity-100 shrink-0"
              style={{ color: "var(--cream)", opacity: 0.8 }}
              title="Naar de website"
            >
              <span aria-hidden="true">←</span> Site
            </Link>
            <span aria-hidden="true" className="shrink-0" style={{ width: 1, height: 12, background: "var(--cream)", opacity: 0.25 }} />
            <button
              onClick={logout}
              className="text-[11px] uppercase tracking-[0.2em] shrink-0"
              style={{ color: "var(--gold)" }}
            >
              Uitloggen
            </button>
          </div>
        </div>
        <nav
          ref={navRef}
          className="container-edit hidden lg:flex gap-1 flex-wrap"
          style={{ paddingBottom: "0.5rem" }}
        >
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: t.exact }}
              className="text-[11px] tracking-[0.2em] uppercase px-3 py-2 whitespace-nowrap"
              style={{ color: "var(--cream)", opacity: 0.65 }}
              activeProps={{
                style: { color: "var(--gold)", opacity: 1, borderBottom: "1px solid var(--gold)" },
                "data-active": "true",
              } as never}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 pb-20 lg:pb-0">
        {title && (
          <div className="container-edit" style={{ paddingBlock: "1.25rem 0.5rem" }}>
            <h1 style={{ fontSize: "1.65rem" }}>{title}</h1>
          </div>
        )}
        {children}
      </main>
      <AdminBottomNav email={email} />
    </div>
  );
}

export function statusBadge(status: string) {
  const map: Record<string, { bg: string; fg: string }> = {
    intake: { bg: "var(--cream-deep)", fg: "var(--charcoal)" },
    transport_out: { bg: "var(--gold)", fg: "var(--charcoal)" },
    in_workshop: { bg: "var(--brass)", fg: "var(--cream)" },
    transport_return: { bg: "var(--gold)", fg: "var(--charcoal)" },
    delivered: { bg: "var(--charcoal)", fg: "var(--cream)" },
    archived: { bg: "var(--cream-deep)", fg: "var(--charcoal-soft)" },
    new: { bg: "var(--brass)", fg: "var(--cream)" },
    contacted: { bg: "var(--gold)", fg: "var(--charcoal)" },
    quoted: { bg: "var(--cream-deep)", fg: "var(--charcoal)" },
    won: { bg: "var(--charcoal)", fg: "var(--gold)" },
    lost: { bg: "var(--cream-deep)", fg: "var(--oxide)" },
  };
  return map[status] ?? { bg: "var(--cream-deep)", fg: "var(--charcoal)" };
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "zojuist";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} u`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} d`;
  return new Date(iso).toLocaleDateString("nl-BE");
}