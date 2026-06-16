// Legacy URL kept alive for old bookmarks and external links. The unified
// lead pipeline lives at /admin/aanvragen.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/offertes")({
  beforeLoad: () => { throw redirect({ to: "/admin/aanvragen" }); },
});
