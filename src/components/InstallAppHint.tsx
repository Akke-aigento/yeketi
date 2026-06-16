import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "yeketi.installHint.dismissedAt";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function recentlyDismissed(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    return Date.now() - Number(v) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com")
  );
}

export function InstallAppHint() {
  const [variant, setVariant] = useState<"android" | "ios" | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isPreviewHost() || isStandalone() || recentlyDismissed()) return;

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVariant("android");
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS has no beforeinstallprompt — show a manual one-time hint after a delay.
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) {
      iosTimer = setTimeout(() => setVariant("ios"), 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
    setVariant(null);
  }

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      dismiss();
    }
  }

  if (!variant) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,420px)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)",
        background: "var(--charcoal)",
        color: "var(--cream)",
        border: "1px solid var(--brass)",
        borderRadius: 14,
        padding: "0.85rem 1rem",
        boxShadow: "0 12px 32px -12px rgba(0,0,0,0.45)",
      }}
      role="dialog"
      aria-label="Installeer Yeketi"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "var(--gold)" }}
          >
            Yeketi op je beginscherm
          </p>
          {variant === "android" ? (
            <p className="mt-1 text-[13px] leading-snug" style={{ opacity: 0.9 }}>
              Installeer Yeketi voor sneller toegang — opent als app, zonder browserbalk.
            </p>
          ) : (
            <p className="mt-1 text-[13px] leading-snug" style={{ opacity: 0.9 }}>
              Tik op <span aria-hidden>⬆︎</span> <strong>Deel</strong> en kies{" "}
              <strong>"Zet op beginscherm"</strong> om Yeketi te installeren.
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            {variant === "android" && (
              <button
                type="button"
                onClick={install}
                className="text-[11px] uppercase tracking-[0.2em] px-3 py-1.5 rounded"
                style={{ background: "var(--gold)", color: "var(--charcoal)" }}
              >
                Installeer
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="text-[11px] uppercase tracking-[0.2em]"
              style={{ color: "var(--cream)", opacity: 0.7 }}
            >
              Niet nu
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Sluit"
          onClick={dismiss}
          className="shrink-0 text-[14px] leading-none"
          style={{ color: "var(--cream)", opacity: 0.6 }}
        >
          ×
        </button>
      </div>
    </div>
  );
}