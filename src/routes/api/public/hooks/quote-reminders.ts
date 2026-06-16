import { createFileRoute } from "@tanstack/react-router";
import { runQuoteReminders } from "@/lib/quotes.functions";

// Cron-invoked endpoint that sends one gentle reminder per quote that has
// been "verstuurd" for >= 7 days without a response.  Auth is handled by the
// pg_cron call supplying the project's anon key as `apikey`; the handler
// trusts the caller and does no destructive operation beyond updating
// reminder_sent_at on quotes that successfully received a mail.
export const Route = createFileRoute("/api/public/hooks/quote-reminders")({
  server: {
    handlers: {
      POST: async () => {
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