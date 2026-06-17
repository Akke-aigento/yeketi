import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ScrollReveal } from "@/components/ScrollReveal";
import { useT } from "@/lib/i18n";
import { t as nlCopy } from "@/lib/copy";
import logoHorizontalLight from "@/assets/yeketi-logo-horizontal-light.svg.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { sendWelcomeAfterInvite } from "@/lib/email.functions";

function getResetLinkError() {
  if (typeof window === "undefined") return null;
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  const authError = hashParams.get("error_code") || searchParams.get("error_code") || hashParams.get("error") || searchParams.get("error");
  const authDescription = hashParams.get("error_description") || searchParams.get("error_description");

  if (!authError) return null;
  return authError === "otp_expired"
    ? nlCopy.portal.resetLinkExpired
    : authDescription?.replace(/\+/g, " ") || nlCopy.portal.resetLinkInvalid;
}

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
  const t = useT();
  const navigate = useNavigate();
  const sendWelcome = useServerFn(sendWelcomeAfterInvite);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(() => getResetLinkError());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isInvite, setIsInvite] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.get("type") === "invite") setIsInvite(true);
  }, []);

  useEffect(() => {
    const initialLinkError = getResetLinkError();
    if (initialLinkError) {
      setLinkError(initialLinkError);
      setReady(false);
      return;
    }

    // Supabase parses the recovery token from the URL hash and emits PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        if (session?.user.email) setAccountEmail(session.user.email);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true);
        if (data.session.user.email) setAccountEmail(data.session.user.email);
      }
    });

    // If the recovery token never resolved (expired/invalid) and there is no
    // active session, surface a clear error after a short grace period instead
    // of leaving the form disabled forever.
    const timeout = window.setTimeout(() => {
      setReady((r) => {
        if (!r) setLinkError(t.portal.linkExpiredAfterWait);
        return r;
      });
    }, 4000);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t.portal.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.portal.passwordsDoNotMatch);
      return;
    }
    setStatus("saving");
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message || t.portal.sendError);
      setStatus("idle");
      return;
    }
    // Mark this account as having completed password setup so the
    // authenticated guard stops redirecting them back to /reset-password.
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase
        .from("profiles")
        .update({ password_set: true })
        .eq("id", userData.user.id);
    }
    if (isInvite) {
      // Fire-and-forget welcome mail; never block redirect on email delivery.
      sendWelcome({ data: undefined }).catch((e) => console.warn("welcome mail failed", e));
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
                  {isInvite ? t.portal.inviteWelcomeTitle : t.portal.newPasswordTitle}
                </h1>
                {isInvite && (
                  <p className="mt-4" style={{ color: "var(--charcoal-soft)", lineHeight: 1.6 }}>
                    {t.portal.inviteWelcomeBody}
                  </p>
                )}
                {accountEmail && (
                  <p className="mt-3 text-sm" style={{ color: "var(--charcoal-soft)" }}>
                    {t.portal.settingPasswordFor}: <strong style={{ color: "var(--charcoal)" }}>{accountEmail}</strong>
                  </p>
                )}
              </div>
              {status === "saved" ? (
                <p className="mt-10 text-center" style={{ color: "var(--charcoal-soft)", lineHeight: 1.7 }}>
                  {t.portal.newPasswordSaved}
                </p>
              ) : linkError ? (
                <div className="mt-10 text-center">
                  <p style={{ color: "var(--oxide)", lineHeight: 1.7 }}>{linkError}</p>
                  <Link to="/login" className="btn-y-solid mt-8 w-full">
                    {t.portal.requestNewResetLink}
                  </Link>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="mt-10">
                  <label htmlFor="password" className="eyebrow block" style={{ color: "var(--charcoal-soft)" }}>
                    {t.portal.newPasswordLabel}
                  </label>
                  <div className="mt-2" style={{ position: "relative" }}>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className="field-y"
                      style={{ paddingRight: "3.25rem" }}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={status === "saving" || !ready}
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
                  <label
                    htmlFor="confirm-password"
                    className="eyebrow block mt-6"
                    style={{ color: "var(--charcoal-soft)" }}
                  >
                    {t.portal.confirmPasswordLabel}
                  </label>
                  <div className="mt-2">
                    <input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className="field-y"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={status === "saving" || !ready}
                    />
                  </div>
                  {error && (
                    <p className="mt-4 text-sm" style={{ color: "var(--oxide)", lineHeight: 1.6 }}>
                      {error}
                    </p>
                  )}
                  {!ready && (
                    <p className="mt-4 text-sm" style={{ color: "var(--charcoal-soft)", lineHeight: 1.6 }}>
                      {t.portal.verifyingLink}
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