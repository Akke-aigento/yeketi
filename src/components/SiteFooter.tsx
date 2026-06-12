import { Link } from "@tanstack/react-router";
import { t } from "@/lib/copy";

export function SiteFooter() {
  return (
    <footer style={{ background: "var(--charcoal)", color: "var(--cream)" }}>
      <div className="container-edit" style={{ paddingBlock: "4.5rem" }}>
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", letterSpacing: "0.22em" }}>
              YEKETI
            </div>
            <div className="mt-1" style={{ color: "var(--gold)", fontSize: "0.7rem", letterSpacing: "0.42em" }}>
              MOTORWORKS
            </div>
            <p className="italic-quote mt-6" style={{ color: "var(--gold)", fontSize: "1.15rem" }}>
              {t.footer.tagline}
            </p>
          </div>

          <div>
            <div className="eyebrow" style={{ color: "var(--gold)" }}>Contact</div>
            <ul className="mt-4 space-y-2 text-sm" style={{ color: "var(--cream)" }}>
              <li>{t.footer.contact}</li>
              <li>
                <a href={`mailto:${t.footer.email}`} className="hover:text-[var(--gold)] transition-colors">
                  {t.footer.email}
                </a>
              </li>
              <li>
                <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hover:text-[var(--gold)] transition-colors">
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