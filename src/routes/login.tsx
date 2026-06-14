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
  const [email, setEmail] = useState("");
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
    setStatus("sending");
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/portaal` : undefined;
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
    });
    if (err) {
      const msg = err.message?.toLowerCase() ?? "";
      if (msg.includes("not allowed") || msg.includes("signup") || msg.includes("not found")) {
        setError(t.portal.notRegistered);
      } else {
        setError(t.portal.sendError);
      }
      setStatus("idle");
      return;
    }
    setStatus("sent");
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
                  <p className="eyebrow">{t.portal.sentTitle}</p>
                  <h1 className="mt-5" style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)" }}>
                    {t.portal.sentBody}
                  </h1>
                  <p className="mt-3" style={{ fontFamily: "var(--font-display)", color: "var(--brass)", fontSize: "1.15rem" }}>
                    {email}
                  </p>
                  <p className="mt-6" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
                    {t.portal.sentHint}
                  </p>
                  <div className="mt-10">
                    <Link to="/" className="btn-y">{t.login.back}</Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <p className="eyebrow">{t.nav.portal}</p>
                    <h1 className="mt-5" style={{ fontSize: "clamp(1.8rem,3.4vw,2.6rem)" }}>
                      {t.portal.loginTitle}
                    </h1>
                    <p className="mt-5 mx-auto" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7, maxWidth: "360px" }}>
                      {t.portal.loginSubline}
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
                      {status === "sending" ? t.portal.sending : t.portal.send}
                    </button>
                  </form>
                  <p className="mt-8 text-center text-sm" style={{ color: "var(--charcoal-soft)" }}>
                    <Link to="/" style={{ borderBottom: "1px solid var(--charcoal-soft)" }}>{t.login.back}</Link>
                  </p>
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