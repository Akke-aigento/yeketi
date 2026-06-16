import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gauge, MessageSquare, FileText, Wrench, MoreHorizontal, Users, Hammer, Settings, LogOut, ArrowLeft } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAdminUnreadCounts } from "@/hooks/useAdminUnreadCounts";

type Primary = { to: "/admin" | "/admin/berichten" | "/admin/aanvragen" | "/admin/projecten"; label: string; icon: typeof Gauge; exact?: boolean; badgeKey?: "messages" | "requests"; activePrefixes?: string[] };

const primary: Primary[] = [
  { to: "/admin", label: "Dashboard", icon: Gauge, exact: true },
  { to: "/admin/berichten", label: "Berichten", icon: MessageSquare, badgeKey: "messages" },
  { to: "/admin/aanvragen", label: "Aanvragen", icon: FileText, badgeKey: "requests", activePrefixes: ["/admin/aanvragen", "/admin/offertes", "/admin/quotes"] },
  { to: "/admin/projecten", label: "Projecten", icon: Wrench },
];

const overflow: { to: "/admin/klanten" | "/admin/recent-werk" | "/admin/instellingen"; label: string; icon: typeof FileText }[] = [
  { to: "/admin/klanten", label: "Klanten", icon: Users },
  { to: "/admin/recent-werk", label: "Recent Werk", icon: Hammer },
  { to: "/admin/instellingen", label: "Instellingen", icon: Settings },
];

export function AdminBottomNav({ email }: { email: string | null }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const counts = useAdminUnreadCounts();

  useEffect(() => { setOpen(false); }, [pathname]);

  const overflowActive = overflow.some((o) => pathname.startsWith(o.to));

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  function Dot({ show }: { show: boolean }) {
    if (!show) return null;
    return (
      <span
        aria-hidden="true"
        className="absolute"
        style={{ top: 4, right: "calc(50% - 16px)", width: 8, height: 8, borderRadius: 999, background: "#E11D2E", boxShadow: "0 0 0 2px var(--charcoal)" }}
      />
    );
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5"
      style={{
        background: "var(--charcoal)",
        borderTop: "1px solid var(--brass)",
        paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))",
        paddingTop: "0.35rem",
      }}
    >
      {primary.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.activePrefixes
          ? tab.activePrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
          : tab.exact ? pathname === tab.to : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
        const badge = tab.badgeKey ? counts[tab.badgeKey] > 0 : false;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className="relative flex flex-col items-center gap-1 py-1"
            style={{ color: isActive ? "var(--gold)" : "var(--cream)", opacity: isActive ? 1 : 0.65 }}
          >
            {isActive && (
              <span aria-hidden="true" className="absolute top-0 left-1/2 -translate-x-1/2" style={{ width: 24, height: 2, background: "var(--gold)" }} />
            )}
            <Icon size={20} strokeWidth={1.6} />
            <Dot show={badge} />
            <span className="text-[10px] uppercase tracking-[0.16em]">{tab.label}</span>
          </Link>
        );
      })}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="relative flex flex-col items-center gap-1 py-1"
            style={{ color: overflowActive ? "var(--gold)" : "var(--cream)", opacity: overflowActive ? 1 : 0.65 }}
          >
            {overflowActive && (
              <span aria-hidden="true" className="absolute top-0 left-1/2 -translate-x-1/2" style={{ width: 24, height: 2, background: "var(--gold)" }} />
            )}
            <MoreHorizontal size={20} strokeWidth={1.6} />
            <span className="text-[10px] uppercase tracking-[0.16em]">Meer</span>
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-0 p-0"
          style={{ background: "var(--cream)", color: "var(--charcoal)", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <SheetHeader className="px-5 pt-5 pb-2 text-left">
            <SheetTitle style={{ fontFamily: "var(--font-display)", color: "var(--charcoal)" }}>Meer</SheetTitle>
          </SheetHeader>
          <ul className="px-2 pb-2">
            {overflow.map((o) => {
              const Icon = o.icon;
              const active = pathname.startsWith(o.to);
              return (
                <li key={o.to}>
                  <Link
                    to={o.to}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg"
                    style={{ color: active ? "var(--brass)" : "var(--charcoal)" }}
                  >
                    <Icon size={18} strokeWidth={1.6} />
                    <span className="text-[13px] tracking-[0.18em] uppercase">{o.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mx-5 my-2" style={{ height: 1, background: "color-mix(in oklab, var(--charcoal) 12%, transparent)" }} />
          {email && (
            <div className="px-5 pb-2 text-[11px] tracking-[0.18em] uppercase" style={{ color: "var(--charcoal-soft)" }}>
              {email}
            </div>
          )}
          <div className="px-5 pb-3 flex items-center justify-between gap-3">
            <Link
              to="/"
              className="text-[11px] uppercase tracking-[0.2em] inline-flex items-center gap-1.5"
              style={{ color: "var(--charcoal)" }}
            >
              <ArrowLeft size={14} /> Naar de site
            </Link>
            <button
              type="button"
              onClick={logout}
              className="text-[11px] uppercase tracking-[0.2em] inline-flex items-center gap-1.5"
              style={{ color: "var(--gold)" }}
            >
              <LogOut size={14} /> Uitloggen
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}