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
        const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).maybeSingle();
        setIsAdmin(!!p?.is_admin);
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
        className="container-edit flex items-center justify-between gap-6"
        style={{ paddingBlock: "1.25rem" }}
      >
        <SiteLogo />
        <div className="flex items-center gap-5">
          {email && (
            <span
              className="hidden md:inline text-[12px] tracking-[0.18em] uppercase"
              style={{ color: "var(--charcoal-soft)" }}
            >
              {email}
            </span>
          )}
          {isAdmin && (
            <Link
              to="/admin"
              className="text-[12px] tracking-[0.22em] uppercase"
              style={{ color: "var(--brass)" }}
            >
              Admin
            </Link>
          )}
          <Link
            to="/portaal"
            className="hidden sm:inline text-[12px] tracking-[0.22em] uppercase"
            style={{ color: "var(--charcoal)" }}
            activeProps={{ style: { color: "var(--brass)" } }}
          >
            {t.portal.overviewTitle}
          </Link>
          <button onClick={handleLogout} className="btn-y" type="button">
            {t.portal.logout}
          </button>
        </div>
      </div>
    </header>
  );
}