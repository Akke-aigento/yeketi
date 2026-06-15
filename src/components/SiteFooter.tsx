import { Link } from "@tanstack/react-router";
import { t } from "@/lib/copy";
import logoFullDark from "@/assets/yeketi-logo-full-dark.svg.asset.json";

export function SiteFooter() {
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
            <div className="eyebrow" style={{ color: "var(--gold)" }}>Contact</div>
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
            <div className="eyebrow" style={{ color: "var(--gold)" }}>Bedrijf</div>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/diensten" className="hover:text-[var(--gold)] transition-colors">Diensten</Link></li>
              <li><Link to="/over" className="hover:text-[var(--gold)] transition-colors">Over ons</Link></li>
              <li><Link to="/offerte" className="hover:text-[var(--gold)] transition-colors">Offerte</Link></li>
              <li><Link to="/login" className="hover:text-[var(--gold)] transition-colors">Klantenportaal</Link></li>
              <li><Link to="/privacy" className="hover:text-[var(--gold)] transition-colors">Privacy &amp; cookies</Link></li>
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