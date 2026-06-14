import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://yeketimotorworks.com";
const paths = [
  "/",
  "/diensten",
  "/recent-werk",
  "/restauratie/vw-t2",
  "/over",
  "/offerte",
  "/privacy",
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = paths
          .map(
            (p) =>
              `  <url><loc>${BASE_URL}${p}</loc><changefreq>monthly</changefreq><priority>${p === "/" ? "1.0" : "0.8"}</priority></url>`,
          )
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});