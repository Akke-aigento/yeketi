// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { loadEnv } from "vite";
import path from "node:path";

// Populate process.env for server routes (e.g. SUPABASE_SERVICE_ROLE_KEY).
// Do NOT expose these to the client bundle.
const serverEnv = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/decode.js",
        ),
        "entities/lib/encode.js": path.resolve(
          import.meta.dirname,
          "node_modules/entities/lib/encode.js",
        ),
        entities: path.resolve(import.meta.dirname, "node_modules/entities"),
      },
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: false,
        includeAssets: [
          "favicon/favicon.ico",
          "favicon/favicon-16.png",
          "favicon/favicon-32.png",
          "favicon/favicon-192.png",
          "favicon/favicon-512.png",
          "favicon/apple-touch-icon-180.png",
          "manifest.json",
        ],
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          navigateFallback: "/",
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/__l5e\//,
            /^\/~oauth/,
            /^\/_serverFn/,
          ],
          runtimeCaching: [
            {
              // HTML navigations: always try the network first, fall back to cache when offline.
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "yeketi-html",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              // Hashed build assets: cache-first, immutable.
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:js|css|woff2?|ttf)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "yeketi-assets",
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Same-origin images.
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:png|jpg|jpeg|svg|webp|avif|ico)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "yeketi-images",
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Google Fonts stylesheets — network first.
              urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
              handler: "StaleWhileRevalidate",
              options: { cacheName: "google-fonts-stylesheets" },
            },
            {
              // Google Fonts files — long-cache.
              urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-webfonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
      }),
    ],
  },
});
