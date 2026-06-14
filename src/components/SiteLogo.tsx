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
        className="h-20 sm:h-24 lg:h-40 xl:h-48"
        style={{ width: "auto", display: "block" }}
      />
    </Link>
  );
}