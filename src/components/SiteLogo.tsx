import { Link } from "@tanstack/react-router";
import logoLight from "@/assets/yeketi-logo-horizontal-light.svg.asset.json";
import logoDark from "@/assets/yeketi-logo-horizontal-dark.svg.asset.json";

export function SiteLogo({ variant = "dark" }: { variant?: "dark" | "cream" }) {
  // "dark" = dark text on cream background (header) -> use horizontal-light
  // "cream" = cream text on dark background (footer) -> use horizontal-dark
  const src = variant === "cream" ? logoDark.url : logoLight.url;
  return (
    <Link to="/" className="inline-flex items-center leading-none" aria-label="Yeketi Motorworks — home">
      <img
        src={src}
        alt="Yeketi Motorworks"
        style={{ height: "44px", width: "auto", display: "block" }}
      />
    </Link>
  );
}