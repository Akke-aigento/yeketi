import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export function useAdminUnreadCounts() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [counts, setCounts] = useState<{ messages: number; requests: number }>({ messages: 0, requests: 0 });

  useEffect(() => {
    let active = true;
    (async () => {
      const [reqRes, convRes] = await Promise.all([
        supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("conversations").select("id, last_message_at, admin_last_seen_at"),
      ]);
      const requests = reqRes.count ?? 0;
      const messages = (convRes.data ?? []).reduce((n, c) => {
        if (!c.last_message_at) return n;
        const seen = c.admin_last_seen_at ? new Date(c.admin_last_seen_at).getTime() : 0;
        return new Date(c.last_message_at).getTime() > seen ? n + 1 : n;
      }, 0);
      if (active) setCounts({ messages, requests });
    })();
    return () => { active = false; };
  }, [pathname]);

  return counts;
}