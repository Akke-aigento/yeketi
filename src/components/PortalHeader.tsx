import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLogo } from "./SiteLogo";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/copy";

export function PortalHeader() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setEmail(data.user?.email ?? null);
      if (data.user) {
        const { data: isAdminRpc } = await supabase.rpc("has_role", {
          _user_id: data.user.id,
          _role: "admin",
        });
        setIsAdmin(!!isAdminRpc);
      }
    });
  }, []);

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
          className="text-[11px] tracking-[0.22em] uppercase whitespace-nowrap py-1"
          style={{ color: "var(--charcoal)" }}
          activeProps={{ style: { color: "var(--brass)", borderBottom: "1px solid var(--brass)" } }}
        >
          Berichten
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