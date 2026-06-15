import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import logoFullDark from "@/assets/yeketi-logo-full-dark.svg.asset.json";

export function SiteFooter() {
  const t = useT();
  return (
    <footer style={{ background: "var(--charcoal)", color: "var(--cream)" }}>
      <div className="container-edit" style={{ paddingBlock: "4.5rem" }}>
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <img
              src={logoFullDark.url}
              alt="Yeketi Motorworks"
              style={{ height: "180px", width: "auto", display: "block" }}
            />
            <p className="italic-quote mt-4" style={{ color: "var(--gold)", fontSize: "1.15rem" }}>
              {t.footer.tagline}
            </p>
          </div>

          <div>
            <div className="eyebrow" style={{ color: "var(--gold)" }}>{t.footer.contactTitle}</div>
            <ul className="mt-4 space-y-2 text-sm" style={{ color: "var(--cream)" }}>
              <li>{t.footer.contact}</li>
              <li>
                <a href="mailto:info@yeketimotorworks.com" className="hover:text-[var(--gold)] transition-colors">
                  info@yeketimotorworks.com
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/barammaro?utm_source=qr&igsh=N3FsNzNuNG1wZGVk" target="_blank" rel="noreferrer" className="hover:text-[var(--gold)] transition-colors">
                  {t.footer.instagram}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="eyebrow" style={{ color: "var(--gold)" }}>{t.footer.companyTitle}</div>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/diensten" className="hover:text-[var(--gold)] transition-colors">{t.footer.links.diensten}</Link></li>
              <li><Link to="/over" className="hover:text-[var(--gold)] transition-colors">{t.footer.links.over}</Link></li>
              <li><Link to="/offerte" className="hover:text-[var(--gold)] transition-colors">{t.footer.links.offerte}</Link></li>
              <li><Link to="/login" className="hover:text-[var(--gold)] transition-colors">{t.footer.links.portal}</Link></li>
              <li><Link to="/privacy" className="hover:text-[var(--gold)] transition-colors">{t.footer.links.privacy}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-14" style={{ height: "1px", background: "color-mix(in oklab, var(--gold) 40%, transparent)" }} />

        <div className="mt-6 flex flex-col md:flex-row justify-between gap-2 text-xs" style={{ color: "color-mix(in oklab, var(--cream) 70%, transparent)" }}>
          <span>{t.footer.rights}</span>
          <span>{t.footer.kvk}</span>
        </div>
      </div>
    </footer>
  );
}