import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/login" });
    const { data: profile } = await supabase
      .from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle();
    if (!profile?.is_admin) throw redirect({ to: "/portaal" });
  },
  component: () => <Outlet />,
});