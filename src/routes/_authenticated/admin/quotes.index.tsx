// Legacy URL kept alive for old bookmarks. Offertes en aanvragen leven nu
// samen in de pipeline op /admin/aanvragen.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/quotes/")({
  beforeLoad: () => { throw redirect({ to: "/admin/aanvragen" }); },
  component: () => null,
});
