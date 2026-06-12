import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { SiteLogo } from "./SiteLogo";
import { t } from "@/lib/copy";

const links = [
  { to: "/diensten", label: t.nav.diensten },
  { to: "/restauratie/vw-t2", label: t.nav.restauratie },
  { to: "/over", label: t.nav.over },
  { to: "/offerte", label: t.nav.offerte },
] as const;

export function SiteNav() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "color-mix(in oklab, var(--cream) 94%, transparent)",
        backdropFilter: "saturate(140%) blur(8px)",
        borderBottom: "1px solid var(--charcoal)",
      }}
    >
      <div className="container-edit flex items-center justify-between" style={{ paddingBlock: "1rem" }}>
        <SiteLogo />
        <nav className="hidden md:flex items-center gap-9" aria-label="Hoofdnavigatie">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-[13px] tracking-[0.22em] uppercase transition-colors"
              style={{ color: "var(--charcoal)" }}
              activeProps={{ style: { color: "var(--brass)" } }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">
          <Link to="/login" className="btn-y">{t.nav.portal}</Link>
        </div>
        <button
          className="md:hidden p-2 -mr-2"
          aria-label={open ? "Menu sluiten" : "Menu openen"}
          onClick={() => setOpen((v) => !v)}
          style={{ color: "var(--charcoal)" }}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div
          className="md:hidden fixed inset-0 top-[64px] z-40 flex flex-col"
          style={{ background: "var(--cream)", backgroundImage: "var(--paper-grain)" }}
        >
          <nav className="container-edit flex flex-col gap-6 pt-10">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="text-2xl"
                style={{ fontFamily: "var(--font-display)", color: "var(--charcoal)" }}
              >
                {l.label}
              </Link>
            ))}
            <div className="pt-4">
              <Link to="/login" onClick={() => setOpen(false)} className="btn-y">
                {t.nav.portal}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}