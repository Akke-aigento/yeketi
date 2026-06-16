import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Yeketi" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppLauncher,
});

function AppLauncher() {
  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: data.session.user.id,
        _role: "admin",
      });
      if (cancelled) return;
      navigate({ to: isAdmin ? "/admin" : "/portaal", replace: true });
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--cream)",
        color: "var(--charcoal-soft)",
        fontSize: "13px",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}
    >
      Laden…
    </div>
  );
}