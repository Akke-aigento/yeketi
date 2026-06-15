import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { t } from "@/lib/copy";
import logoHorizontalLight from "@/assets/yeketi-logo-horizontal-light.svg.asset.json";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Wachtwoord opnieuw instellen — Yeketi Motorworks" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash and emits PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t.portal.passwordTooShort);
      return;
    }
    setStatus("saving");
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(t.portal.sendError);
      setStatus("idle");
      return;
    }
    setStatus("saved");
    setTimeout(() => navigate({ to: "/portaal" }), 1200);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <main className="flex-1 flex items-center">
        <section className="container-edit" style={{ paddingBlock: "clamp(3rem,8vw,6rem)" }}>
          <ScrollReveal>
            <div className="mx-auto" style={{ maxWidth: "440px" }}>
              <img
                src={logoHorizontalLight.url}
                alt="Yeketi Motorworks"
                style={{ height: "72px", width: "auto", display: "block", margin: "0 auto 2.5rem", background: "transparent" }}
              />
              <div className="text-center">
                <p className="eyebrow">{t.nav.portal}</p>
                <h1 className="mt-5" style={{ fontSize: "clamp(1.8rem,3.4vw,2.6rem)" }}>
                  {t.portal.newPasswordTitle}
                </h1>
              </div>
              {status === "saved" ? (
                <p className="mt-10 text-center" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
                  {t.portal.newPasswordSaved}
                </p>
              ) : (
                <form onSubmit={onSubmit} className="mt-10">
                  <label htmlFor="password" className="eyebrow block" style={{ color: "var(--charcoal-soft)" }}>
                    {t.portal.newPasswordLabel}
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="field-y mt-2"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={status === "saving" || !ready}
                  />
                  {error && (
                    <p className="mt-4 text-sm" style={{ color: "var(--oxide)", lineHeight: 1.6 }}>
                      {error}
                    </p>
                  )}
                  {!ready && (
                    <p className="mt-4 text-sm" style={{ color: "var(--charcoal-soft)", lineHeight: 1.6 }}>
                      Recovery-link wordt geverifieerd…
                    </p>
                  )}
                  <button
                    type="submit"
                    className="btn-y-solid mt-8 w-full"
                    disabled={status === "saving" || !ready}
                  >
                    {status === "saving" ? t.portal.sending : t.portal.newPasswordSave}
                  </button>
                </form>
              )}
              <p className="mt-8 text-center text-sm" style={{ color: "var(--charcoal-soft)" }}>
                <Link to="/login" style={{ borderBottom: "1px solid var(--charcoal-soft)" }}>{t.portal.backToLogin}</Link>
              </p>
            </div>
          </ScrollReveal>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}