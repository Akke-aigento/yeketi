import { Link, useRouterState } from "@tanstack/react-router";
import { useAdminUnreadCounts } from "@/hooks/useAdminUnreadCounts";

export function OffertesTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const counts = useAdminUnreadCounts();
  const onRequests = pathname === "/admin/offertes" || pathname.startsWith("/admin/offertes/");
  const onDocs = pathname === "/admin/quotes" || pathname.startsWith("/admin/quotes/");
  const tab = (active: boolean) => ({
    border: "1px solid var(--charcoal)",
    background: active ? "var(--charcoal)" : "transparent",
    color: active ? "var(--gold)" : "var(--charcoal)",
  });
  return (
    <div className="container-edit" style={{ paddingTop: "0.25rem" }}>
      <div className="flex gap-1">
        <Link
          to="/admin/offertes"
          className="relative text-[11px] tracking-[0.18em] uppercase px-3 py-2 inline-flex items-center gap-1.5"
          style={tab(onRequests)}
        >
          <span>Aanvragen</span>
          {counts.requests > 0 && (
            <span
              aria-label={`${counts.requests} nieuw`}
              style={{
                display: "inline-block", minWidth: 16, height: 16, padding: "0 4px",
                borderRadius: 999, background: "#E11D2E", color: "#fff",
                fontSize: 10, lineHeight: "16px", textAlign: "center", fontWeight: 600,
              }}
            >
              {counts.requests}
            </span>
          )}
        </Link>
        <Link
          to="/admin/quotes"
          className="text-[11px] tracking-[0.18em] uppercase px-3 py-2"
          style={tab(onDocs)}
        >
          Documenten
        </Link>
      </div>
    </div>
  );
}