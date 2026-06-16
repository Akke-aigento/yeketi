import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useT } from "@/lib/i18n";
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
  const t = useT();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  // If user is already signed in, send them to the right place.
  useEffect(() => {
    let active = true;
    async function go() {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session) return;
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: data.session.user.id,
        _role: "admin",
      });
      navigate({ to: isAdmin ? "/admin" : "/portaal" });
    }
    go();
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        const { data: isAdmin } = await supabase.rpc("has_role", {
          _user_id: session.user.id,
          _role: "admin",
        });
        navigate({ to: isAdmin ? "/admin" : "/portaal" });
      }
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
        // Supabase returns 429 when the same address has been spammed recently.
        const msg = err.message?.toLowerCase() ?? "";
        const status = (err as { status?: number }).status;
        if (status === 429 || msg.includes("rate") || msg.includes("too many")) {
          setError(t.portal.rateLimited);
        } else {
          setError(t.portal.sendError);
        }
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
                        <div className="mt-6 flex items-baseline justify-between">
                          <label htmlFor="password" className="eyebrow" style={{ color: "var(--charcoal-soft)" }}>
                            {t.portal.passwordLabel}
                          </label>
                          <button
                            type="button"
                            onClick={() => { setMode("forgot"); setError(null); }}
                            className="text-sm"
                            style={{ color: "var(--charcoal-soft)", borderBottom: "1px solid var(--charcoal-soft)" }}
                          >
                            {t.portal.forgot}
                          </button>
                        </div>
                        <div className="mt-2" style={{ position: "relative" }}>
                          <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            required
                            className="field-y"
                            style={{ paddingRight: "3.25rem" }}
                            placeholder={t.portal.passwordPlaceholder}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={status === "sending"}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={showPassword ? t.portal.hidePassword : t.portal.showPassword}
                            style={{
                              position: "absolute",
                              right: "0.75rem",
                              top: "50%",
                              transform: "translateY(-50%)",
                              fontSize: "11px",
                              letterSpacing: "0.18em",
                              textTransform: "uppercase",
                              color: "var(--charcoal-soft)",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            {showPassword ? t.portal.hideShort : t.portal.showShort}
                          </button>
                        </div>
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
                    {mode === "forgot" && (
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