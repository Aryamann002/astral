"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useChart, useHydrated } from "@/lib/useChart";
import type { Chart } from "@/lib/astro/chart";
import { Button, Screen } from "./ui";

/**
 * Gate for every screen that needs a chart. Waits for the persisted store to
 * hydrate before deciding, so a returning user never sees the onboarding
 * prompt flash on top of their own data.
 */
export function RequireChart({
  children,
}: {
  children: (chart: Chart) => ReactNode;
}) {
  const hydrated = useHydrated();
  const chart = useChart();

  if (!hydrated) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <span className="animate-pulse text-2xl text-primary/60">✦</span>
      </main>
    );
  }

  if (!chart) {
    return (
      <Screen className="grid place-items-center">
        <div className="text-center">
          <p className="mb-2 font-serif text-2xl">No chart yet</p>
          <p className="mx-auto mb-6 max-w-xs text-sm text-muted">
            Enter a birth date, time and place and the rest of the app comes to
            life.
          </p>
          <Link href="/">
            <Button>Cast a chart</Button>
          </Link>
        </div>
      </Screen>
    );
  }

  return <>{children(chart)}</>;
}
