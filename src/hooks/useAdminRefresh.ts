import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

type Listener = (key: number) => void;

let currentKey = 0;
const listeners = new Set<Listener>();

function bump() {
  currentKey += 1;
  listeners.forEach((l) => l(currentKey));
}

/** Manually trigger a refresh of all admin screens subscribed via useAdminRefreshKey. */
export function triggerAdminRefresh() {
  bump();
}

/**
 * Returns a refresh key that bumps on:
 *  - focus / visibilitychange (admin tab becoming visible again)
 *  - manual triggerAdminRefresh() calls
 *
 * Add this value to your effect deps to refetch on demand.
 * Navigation refreshes happen automatically because admin pages unmount
 * when navigating between distinct routes.
 */
export function useAdminRefreshKey(): number {
  const [key, setKey] = useState(currentKey);

  useEffect(() => {
    const listener: Listener = (k) => setKey(k);
    listeners.add(listener);

    const onFocus = () => bump();
    const onVisibility = () => {
      if (document.visibilityState === "visible") bump();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      listeners.delete(listener);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return key;
}

/**
 * Lightweight interval that triggers an admin-wide refresh every `ms` while
 * the tab is visible. Pauses when hidden. Used on dashboard + berichten only.
 */
export function useAdminInterval(ms = 60_000): void {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      stop();
      timer = setInterval(() => bump(), ms);
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    function onVis() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      start();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ms, pathname]);
}
