import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const KEY = "yeketi.cookie.ack.v1";

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      // localStorage blocked — don't show anything
    }
  }, []);

  if (!show) return null;

  const accept = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookiemelding"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-3xl flex-col gap-3 rounded-md px-5 py-4 shadow-lg sm:flex-row sm:items-center sm:justify-between"
      style={{
        background: "var(--charcoal)",
        color: "var(--cream)",
        border: "1px solid color-mix(in oklab, var(--gold) 35%, transparent)",
      }}
    >
      <p className="text-sm leading-relaxed" style={{ color: "var(--cream)" }}>
        Wij gebruiken alleen functionele cookies — nodig om in te loggen op het klantenportaal.
        Geen tracking, geen advertenties.{" "}
        <Link to="/privacy" className="underline" style={{ color: "var(--gold)" }}>
          Lees meer
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={accept}
        className="btn-y-solid shrink-0"
        style={{ alignSelf: "flex-start" }}
      >
        Begrepen
      </button>
    </div>
  );
}