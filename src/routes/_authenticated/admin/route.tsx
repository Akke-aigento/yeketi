import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const user = (context as { user?: { id: string } }).user;
    if (!user) throw redirect({ to: "/login" });
    const { data: profile } = await supabase
      .from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!profile?.is_admin) throw redirect({ to: "/portaal" });
  },
  component: () => <Outlet />,
});