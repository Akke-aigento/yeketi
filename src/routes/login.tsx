import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { t } from "@/lib/copy";
import logoHorizontalLight from "@/assets/yeketi-logo-horizontal-light.svg.asset.json";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Klantenportaal — Yeketi Motorworks" },
      { name: "description", content: "Beveiligd klantenportaal voor lopende restauraties." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  // If user is already signed in, send them to the portal.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: "/portaal" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/portaal" });
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError(t.portal.invalidEmail);
      return;
    }
    if (mode === "login") {
      if (password.length < 1) {
        setError(t.portal.invalidCredentials);
        return;
      }
      setStatus("sending");
      const { error: err } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (err) {
        setError(t.portal.invalidCredentials);
        setStatus("idle");
        return;
      }
      // onAuthStateChange handler will navigate
    } else {
      setStatus("sending");
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
      const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (err) {
        setError(t.portal.sendError);
        setStatus("idle");
        return;
      }
      setStatus("sent");
    }
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
              {status === "sent" ? (
                <div className="text-center">
                  <p className="eyebrow">{t.portal.resetTitle}</p>
                  <h1 className="mt-5" style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)" }}>
                    {t.portal.resetSent}
                  </h1>
                  <div className="mt-10">
                    <button
                      type="button"
                      className="btn-y"
                      onClick={() => { setMode("login"); setStatus("idle"); setError(null); }}
                    >
                      {t.portal.backToLogin}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <p className="eyebrow">{t.nav.portal}</p>
                    <h1 className="mt-5" style={{ fontSize: "clamp(1.8rem,3.4vw,2.6rem)" }}>
                      {mode === "login" ? t.portal.loginTitle : t.portal.resetTitle}
                    </h1>
                    <p className="mt-5 mx-auto" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7, maxWidth: "360px" }}>
                      {mode === "login" ? t.portal.loginSubline : t.portal.resetSubline}
                    </p>
                  </div>
                  <form onSubmit={onSubmit} className="mt-10">
                    <label htmlFor="email" className="eyebrow block" style={{ color: "var(--charcoal-soft)" }}>
                      {t.portal.emailLabel}
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="field-y mt-2"
                      placeholder={t.portal.emailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={status === "sending"}
                    />
                    {mode === "login" && (
                      <>
                        <label htmlFor="password" className="eyebrow block mt-6" style={{ color: "var(--charcoal-soft)" }}>
                          {t.portal.passwordLabel}
                        </label>
                        <input
                          id="password"
                          type="password"
                          autoComplete="current-password"
                          required
                          className="field-y mt-2"
                          placeholder={t.portal.passwordPlaceholder}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={status === "sending"}
                        />
                      </>
                    )}
                    {error && (
                      <p className="mt-4 text-sm" style={{ color: "var(--oxide)", lineHeight: 1.6 }}>
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      className="btn-y-solid mt-8 w-full"
                      disabled={status === "sending"}
                    >
                      {status === "sending" ? t.portal.sending : (mode === "login" ? t.portal.send : t.portal.resetSend)}
                    </button>
                  </form>
                  <div className="mt-8 flex flex-col items-center gap-3 text-sm" style={{ color: "var(--charcoal-soft)" }}>
                    {mode === "login" ? (
                      <button
                        type="button"
                        onClick={() => { setMode("forgot"); setError(null); }}
                        style={{ borderBottom: "1px solid var(--charcoal-soft)" }}
                      >
                        {t.portal.forgot}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setMode("login"); setError(null); }}
                        style={{ borderBottom: "1px solid var(--charcoal-soft)" }}
                      >
                        {t.portal.backToLogin}
                      </button>
                    )}
                    <Link to="/" style={{ borderBottom: "1px solid var(--charcoal-soft)" }}>{t.login.back}</Link>
                  </div>
                </>
              )}
            </div>
          </ScrollReveal>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}