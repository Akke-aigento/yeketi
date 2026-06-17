import { createFileRoute } from "@tanstack/react-router";
import { runQuoteReminders } from "@/lib/quotes.functions";

// Cron-invoked endpoint. Authenticated via a shared secret sent in the
// `x-cron-secret` header (configured on the pg_cron job). Constant-time
// comparison; rejects with 401 on mismatch or missing secret.
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hooks/quote-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_HOOK_SECRET;
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!expected || !provided || !timingSafeEqualStr(provided, expected)) {
          return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const result = await runQuoteReminders();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("quote-reminders failed", e);
          return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});