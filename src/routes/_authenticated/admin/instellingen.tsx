import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { getAdminNotifySettings, setAdminNotifyEmail } from "@/lib/messages.functions";

export const Route = createFileRoute("/_authenticated/admin/instellingen")({
  head: () => ({ meta: [{ title: "Instellingen — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Instellingen,
});

function Instellingen() {
  const load = useServerFn(getAdminNotifySettings);
  const save = useServerFn(setAdminNotifyEmail);
  const [email, setEmail] = useState("");
  const [fallback, setFallback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<null | "ok" | "err">(null);

  useEffect(() => {
    load().then((r) => {
      setEmail(r.notifyEmail ?? "");
      setFallback(r.fallback);
      setLoading(false);
    });
  }, [load]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(null);
    try {
      await save({ data: { email: email.trim() ? email.trim() : null } });
      setSaved("ok");
    } catch {
      setSaved("err");
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(null), 3000);
    }
  }

  return (
    <AdminShell title="Instellingen">
      <section className="container-edit pb-12 max-w-xl">
        <p className="eyebrow" style={{ color: "var(--brass)" }}>Persoonlijke alerts</p>
        <h2 className="mt-3" style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem" }}>
          Notificatie-e-mail
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
          Het adres waarop je persoonlijke meldingen wilt ontvangen — nieuwe berichten, offerteaanvragen
          en reacties van klanten. Dit is gescheiden van het publieke <code>info@</code>-adres dat klanten
          zien.
        </p>

        {loading ? (
          <div className="mt-6 h-24" style={{ background: "var(--cream-deep)", border: "1px solid var(--charcoal)" }} />
        ) : (
          <form onSubmit={onSave} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--charcoal-soft)" }}>
                Alert-adres
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={fallback || "baram@…"}
                className="field-y mt-2 w-full"
              />
              {fallback && !email && (
                <span className="block mt-2 text-[11px]" style={{ color: "var(--charcoal-soft)" }}>
                  Standaard wordt <strong>{fallback}</strong> gebruikt.
                </span>
              )}
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="btn-y-solid">
                {saving ? "Opslaan…" : "Opslaan"}
              </button>
              {saved === "ok" && (
                <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--brass)" }}>
                  Opgeslagen
                </span>
              )}
              {saved === "err" && (
                <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--oxide)" }}>
                  Mislukt
                </span>
              )}
            </div>
          </form>
        )}
      </section>
    </AdminShell>
  );
}