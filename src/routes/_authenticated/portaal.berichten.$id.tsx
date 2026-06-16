import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/portaal/berichten/$id")({
  beforeLoad: () => {
    throw redirect({ to: "/portaal/berichten" });
  },
  component: () => null,
});