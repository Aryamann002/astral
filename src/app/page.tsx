"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAstral } from "@/lib/store";
import { useHydrated } from "@/lib/useChart";
import { BirthForm } from "@/components/BirthForm";

export default function OnboardingPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const profiles = useAstral((s) => s.profiles);
  const hasChart = profiles.length > 0;

  // Returning users go straight to their chart.
  useEffect(() => {
    if (hydrated && hasChart) router.replace("/chart");
  }, [hydrated, hasChart, router]);

  // Hold the loader while the redirect is in flight rather than flashing the
  // onboarding form at someone who already has a chart.
  if (!hydrated || hasChart) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <span className="animate-pulse text-2xl text-primary/60">✦</span>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-16 pt-14">
      <div className="mb-9 text-center">
        <div className="mb-6 flex justify-center">
          <ConstellationMark />
        </div>
        <h1 className="font-serif text-[34px] leading-[1.15] text-ink">
          Where the sky met you
        </h1>
        <p className="mt-2.5 text-[15px] text-muted">
          Your birth moment, to the minute.
        </p>
      </div>

      <BirthForm
        submitLabel="Cast my chart"
        onDone={() => router.push("/chart")}
        makePrimary
      />

      <p className="mt-7 text-center text-[11px] text-faint">
        Calculated from real ephemeris data. Nothing leaves your device.
      </p>
    </main>
  );
}

function ConstellationMark() {
  return (
    <svg width="72" height="46" viewBox="0 0 72 46" fill="none" aria-hidden>
      <path
        d="M8 34 L24 12 L40 22 L58 8"
        stroke="#e8c58a"
        strokeWidth="0.9"
        strokeOpacity="0.55"
        strokeLinecap="round"
      />
      <path
        d="M24 12 L34 38 L58 8"
        stroke="#e8c58a"
        strokeWidth="0.6"
        strokeOpacity="0.3"
      />
      {(
        [
          [8, 34, 2],
          [24, 12, 2.8],
          [40, 22, 1.8],
          [58, 8, 2.4],
          [34, 38, 1.6],
          [64, 30, 1.2],
        ] as const
      ).map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="#e8c58a" opacity={0.9} />
      ))}
    </svg>
  );
}
