import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    // Force first-time invitees to finish setting their password before
    // they can reach any authenticated area.
    const { data: profile } = await supabase
      .from("profiles")
      .select("password_set")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && profile.password_set === false) {
      throw redirect({ to: "/reset-password", hash: "type=invite" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});