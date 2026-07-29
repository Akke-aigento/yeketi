import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteLogo } from "./SiteLogo";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { getMyUnreadMessagesCount } from "@/lib/messages.functions";

export function PortalHeader() {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLang();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unread, setUnread] = useState(0);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchUnread = useServerFn(getMyUnreadMessagesCount);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);
      if (data.user) {
        // Portal language follows the customer's profile preference.
        const { data: profile } = await supabase
          .from("profiles")
          .select("locale")
          .eq("id", data.user.id)
          .maybeSingle();
        const profileLocale = profile?.locale;
        if ((profileLocale === "nl" || profileLocale === "en") && profileLocale !== lang) {
          setLang(profileLocale);
        }
        const { data: isAdminRpc } = await supabase.rpc("has_role", {
          _user_id: data.user.id,
          _role: "admin",
        });
        setIsAdmin(!!isAdminRpc);
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    fetchUnread()
      .then((r) => { if (active) setUnread(r?.unread ?? 0); })
      .catch(() => { /* not signed in or other — ignore */ });
    return () => { active = false; };
  }, [pathname, fetchUnread]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <header
      className="sticky top-0 z-50"
      style={{ background: "var(--cream)", borderBottom: "1px solid var(--charcoal)" }}
    >
      <div
        className="container-edit grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between sm:gap-6"
        style={{ paddingBlock: "0.85rem" }}
      >
        <div className="min-w-0 flex items-center [&_img]:!h-10 sm:[&_img]:!h-14 lg:[&_img]:!h-20 [&_img]:max-w-[160px] sm:[&_img]:max-w-none [&_img]:w-auto">
          <SiteLogo />
        </div>
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          {email && (
            <span
              className="hidden md:inline text-[12px] tracking-[0.18em] uppercase truncate max-w-[200px]"
              style={{ color: "var(--charcoal-soft)" }}
            >
              {email}
            </span>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              className="hidden sm:inline text-[12px] tracking-[0.22em] uppercase whitespace-nowrap"
              style={{ color: "var(--brass)" }}
            >
              Admin
            </Link>
          )}
          <button onClick={handleLogout} className="btn-y whitespace-nowrap text-[11px] sm:text-[12px]" type="button">
            {t.portal.logout}
          </button>
        </div>
      </div>
      <nav
        className="container-edit flex gap-4 overflow-x-auto sm:gap-6"
        style={{
          paddingBottom: "0.55rem",
          paddingTop: "0.1rem",
          borderTop: "1px solid color-mix(in oklab, var(--charcoal) 10%, transparent)",
        }}
      >
        <Link
          to="/portaal"
          className="text-[11px] tracking-[0.22em] uppercase whitespace-nowrap py-1"
          style={{ color: "var(--charcoal)" }}
          activeOptions={{ exact: true }}
          activeProps={{ style: { color: "var(--brass)", borderBottom: "1px solid var(--brass)" } }}
        >
          {t.portal.overviewTitle}
        </Link>
        <Link
          to="/portaal/berichten"
          className="relative text-[11px] tracking-[0.22em] uppercase whitespace-nowrap py-1 inline-flex items-center gap-1.5"
          style={{ color: "var(--charcoal)" }}
          activeProps={{ style: { color: "var(--brass)", borderBottom: "1px solid var(--brass)" } }}
        >
          <span>Berichten</span>
          {unread > 0 && (
            <span
              aria-label="ongelezen berichten"
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#E11D2E",
                boxShadow: "0 0 0 2px var(--cream)",
              }}
            />
          )}
        </Link>
        {isAdmin && (
          <Link
            to="/admin"
            className="sm:hidden text-[11px] tracking-[0.22em] uppercase whitespace-nowrap py-1"
            style={{ color: "var(--brass)" }}
          >
            Admin
          </Link>
        )}
      </nav>
    </header>
  );
}