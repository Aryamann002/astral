"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { buildChart, type Chart } from "./astro/chart";
import { useAstral, useActiveProfile, type Profile } from "./store";

/**
 * Builds a chart from the active profile.
 *
 * Chart construction is pure and fast enough to run on the client, which keeps
 * birth data on the device — it never has to reach a server unless the user
 * asks the AI astrologer a question.
 */
export function useChart(profile?: Profile | null): Chart | null {
  const active = useActiveProfile();
  const houseSystem = useAstral((s) => s.houseSystem);
  const target = profile === undefined ? active : profile;

  return useMemo(() => {
    if (!target) return null;
    try {
      return buildChart({ ...target, houseSystem });
    } catch {
      return null;
    }
  }, [target, houseSystem]);
}

const neverChanges = () => () => {};

/**
 * True once the client has taken over from the server-rendered markup.
 *
 * Zustand's persist middleware only reads localStorage after hydration, so
 * anything driven by stored profiles has to wait or the two renders disagree.
 * Expressed as an external store rather than an effect so React handles the
 * server/client snapshot difference itself.
 */
export function useHydrated() {
  return useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );
}

/** A clock that ticks on an interval. Null until hydrated, to keep SSR stable. */
export function useNow(intervalMs = 60_000) {
  const hydrated = useHydrated();

  const subscribe = useCallback(
    (onChange: () => void) => {
      const timer = setInterval(onChange, intervalMs);
      return () => clearInterval(timer);
    },
    [intervalMs],
  );

  // Bucketing by interval keeps the snapshot stable between ticks, which is
  // what useSyncExternalStore requires, and aligns the clock to the minute.
  const tick = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs),
    () => 0,
  );

  return useMemo(
    () => (hydrated ? new Date(tick * intervalMs) : null),
    [hydrated, tick, intervalMs],
  );
}
