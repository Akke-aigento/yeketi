import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-webhook-secret");
        if (!secret || secret !== process.env.WEBHOOK_SHARED_SECRET) {
          return new Response("Unauthorized", { status: 401 });
        }
        const body = await request.json() as { email: string; password: string };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (listErr) return new Response(listErr.message, { status: 500 });
        const user = list.users.find((u) => u.email?.toLowerCase() === body.email.toLowerCase());
        if (!user) return new Response("User not found", { status: 404 });
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: body.password,
          email_confirm: true,
        });
        if (updErr) return new Response(updErr.message, { status: 500 });
        return new Response(JSON.stringify({ ok: true, id: user.id }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});