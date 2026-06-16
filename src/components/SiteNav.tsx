import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { SiteLogo } from "./SiteLogo";
import { LanguageToggle, useT } from "@/lib/i18n";

export function SiteNav() {
  const t = useT();
  const links = [
    { to: "/diensten", label: t.nav.diensten },
    { to: "/restauratie/vw-t2", label: t.nav.restauratie },
    { to: "/recent-werk", label: t.nav.recent },
    { to: "/over", label: t.nav.over },
    { to: "/offerte", label: t.nav.offerte },
  ] as const;
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
        background: "var(--cream)",
        borderBottom: "1px solid var(--charcoal)",
      }}
    >
      <div
        className="container-edit grid grid-cols-[1fr_auto_1fr] items-center gap-6 lg:flex lg:justify-between"
        style={{ paddingBlock: "1.25rem" }}
      >
        <div className="lg:contents flex justify-center col-start-2">
          <SiteLogo />
        </div>
        <nav className="hidden lg:flex items-center gap-7 xl:gap-9" aria-label={t.nav.aria}>
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-[12px] xl:text-[13px] tracking-[0.22em] uppercase whitespace-nowrap transition-colors"
              style={{ color: "var(--charcoal)" }}
              activeProps={{ style: { color: "var(--brass)" } }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-6">
          <LanguageToggle />
          <span aria-hidden="true" style={{ width: 1, height: 14, background: "var(--charcoal)", opacity: 0.25 }} />
          <Link
            to="/login"
            className="text-[12px] xl:text-[13px] tracking-[0.22em] uppercase whitespace-nowrap inline-flex items-center gap-2 group"
            style={{ color: "var(--charcoal)" }}
          >
            {t.nav.portal}
            <span aria-hidden="true" style={{ color: "var(--brass)", transition: "transform .2s" }} className="group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
        <button
          className="lg:hidden p-2 -mr-2 col-start-3 justify-self-end"
          aria-label={open ? t.nav.menuClose : t.nav.menuOpen}
          onClick={() => setOpen((v) => !v)}
          style={{ color: "var(--charcoal)" }}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div
          className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-y-auto"
          style={{
            top: "var(--nav-h, 96px)",
            background: "var(--cream)",
            backgroundImage: "var(--paper-grain)",
            borderTop: "1px solid var(--charcoal)",
          }}
        >
          <nav className="container-edit flex flex-col gap-6 pt-10 pb-12">
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
            <div className="pt-4 flex items-center justify-between gap-4">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="text-[13px] tracking-[0.22em] uppercase inline-flex items-center gap-2"
                style={{ color: "var(--charcoal)" }}
              >
                {t.nav.portal}
                <span aria-hidden="true" style={{ color: "var(--brass)" }}>→</span>
              </Link>
              <LanguageToggle />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}