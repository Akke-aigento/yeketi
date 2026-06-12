import { Link } from "@tanstack/react-router";

export function SiteLogo({ variant = "dark" }: { variant?: "dark" | "cream" }) {
  const color = variant === "cream" ? "var(--cream)" : "var(--charcoal)";
  const accent = "var(--brass)";
  return (
    <Link to="/" className="inline-flex flex-col items-start leading-none" aria-label="Yeketi Motorworks — home">
      <span
        style={{
          fontFamily: "var(--font-display)",
          color,
          fontSize: "1.35rem",
          letterSpacing: "0.22em",
        }}
      >
        YEKETI
      </span>
      <span
        style={{
          fontFamily: "var(--font-body)",
          color: accent,
          fontSize: "0.62rem",
          letterSpacing: "0.42em",
          marginTop: "2px",
        }}
      >
        MOTORWORKS
      </span>
    </Link>
  );
}