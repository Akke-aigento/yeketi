import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CookieBanner } from "../components/CookieBanner";
import { LangProvider } from "../lib/i18n";

function NotFoundComponent() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: "var(--cream, #F7F3EC)", color: "var(--charcoal, #221F1B)" }}
    >
      <div className="max-w-xl text-center">
        <p className="eyebrow" style={{ color: "var(--brass, #B08D57)" }}>404</p>
        <h1
          className="mt-5"
          style={{ fontFamily: "var(--font-display, 'Marcellus', serif)", fontSize: "clamp(1.8rem,3.6vw,2.8rem)", lineHeight: 1.15 }}
        >
          Deze weg loopt dood — maar elke klassieker verdient een tweede kans.
        </h1>
        <p className="mt-6" style={{ color: "var(--charcoal-soft, #4A463F)", lineHeight: 1.7 }}>
          De pagina die je zocht bestaat niet (meer). Keer terug naar de werkplaats.
        </p>
        <div className="mt-10">
          <Link to="/" className="btn-y-solid">Terug naar home</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Yeketi Motorworks — Restauratie van klassiekers" },
      {
        name: "description",
        content:
          "Restauratie van klassiekers door meester-ambachtslieden. Persoonlijk begeleid, eerlijke prijs, kortere doorlooptijd.",
      },
      { name: "author", content: "Yeketi Motorworks" },
      { property: "og:site_name", content: "Yeketi Motorworks" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#221F1B" },
      { property: "og:title", content: "Yeketi Motorworks — Restauratie van klassiekers" },
      { name: "twitter:title", content: "Yeketi Motorworks — Restauratie van klassiekers" },
      { name: "description", content: "Yeketi Motorworks: premium classic car restoration connecting owners with master craftsmen." },
      { property: "og:description", content: "Yeketi Motorworks: premium classic car restoration connecting owners with master craftsmen." },
      { name: "twitter:description", content: "Yeketi Motorworks: premium classic car restoration connecting owners with master craftsmen." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/TimPydBg63UjBhATfb8zJJR9ank2/social-images/social-1781522840245-og-share-1200x630.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/TimPydBg63UjBhATfb8zJJR9ank2/social-images/social-1781522840245-og-share-1200x630.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon/favicon-16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/favicon/apple-touch-icon-180.png" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Marcellus&family=Jost:wght@300;400;500&family=Cormorant+Garamond:ital,wght@1,400;1,500&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "Yeketi Motorworks",
          description:
            "Restauratie van klassiekers door meester-ambachtslieden. Persoonlijk begeleid van inspectie tot aflevering.",
          url: "https://yeketimotorworks.com",
          email: "info@yeketimotorworks.com",
          image: "https://yeketimotorworks.com/favicon/favicon-512.png",
          priceRange: "€€€",
          areaServed: ["NL", "BE", "DE", "LU", "FR"],
          sameAs: ["https://instagram.com/yeketimotorworks"],
          founder: { "@type": "Person", name: "Baram Maaruf" },
          vatID: "BE0694858510",
          address: {
            "@type": "PostalAddress",
            streetAddress: "Vredeplein 23",
            postalCode: "3010",
            addressLocality: "Kessel-Lo",
            addressCountry: "BE",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <CookieBanner />
      </LangProvider>
    </QueryClientProvider>
  );
}
