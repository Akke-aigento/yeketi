import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dict, nl, type Copy, type Lang } from "./copy";

const STORAGE_KEY = "yeketi.lang";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Copy };
const LangContext = createContext<Ctx>({ lang: "nl", setLang: () => {}, t: nl });

function detect(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "nl" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  try {
    const nav = navigator.language?.toLowerCase() ?? "";
    if (nav.startsWith("nl")) return "nl";
    if (nav.startsWith("en")) return "en";
  } catch {
    /* ignore */
  }
  return "nl";
}

export function LangProvider({ children }: { children: ReactNode }) {
  // Start as NL to match SSR output, then sync to detected language client-side
  // to avoid hydration mismatches.
  const [lang, setLangState] = useState<Lang>("nl");

  useEffect(() => {
    const detected = detect();
    if (detected !== lang) setLangState(detected);
    // Update <html lang>
    document.documentElement.lang = detected;
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    setLangState(l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t: dict[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

export function useT(): Copy {
  return useContext(LangContext).t;
}

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  const other: Lang = lang === "nl" ? "en" : "nl";
  return (
    <button
      type="button"
      onClick={() => setLang(other)}
      aria-label={lang === "nl" ? "Switch to English" : "Schakel naar Nederlands"}
      className={className}
      style={{
        fontSize: "0.72rem",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        padding: 0,
        border: "none",
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
        lineHeight: 1,
      }}
    >
      <span aria-hidden="true">
        <span style={{ color: lang === "nl" ? "var(--brass)" : "inherit", opacity: lang === "nl" ? 1 : 0.55 }}>NL</span>
        <span style={{ opacity: 0.35, margin: "0 0.45rem" }}>·</span>
        <span style={{ color: lang === "en" ? "var(--brass)" : "inherit", opacity: lang === "en" ? 1 : 0.55 }}>EN</span>
      </span>
    </button>
  );
}