"use client";

import { useMemo } from "react";
import { Card, Pill, Screen, SectionLabel, TabBar } from "@/components/ui";
import { RequireChart } from "@/components/RequireChart";
import { useNow } from "@/lib/useChart";
import { dailyReading } from "@/lib/astro/horoscope";
import type { Chart } from "@/lib/astro/chart";
import { formatLongDate, cn } from "@/lib/utils";

export default function TodayPage() {
  return <RequireChart>{(chart) => <TodayView chart={chart} />}</RequireChart>;
}

function TodayView({ chart }: { chart: Chart }) {
  const now = useNow();
  // Recompute only when the minute rolls over, not on every render.
  const reading = useMemo(
    () => (now ? dailyReading(chart, now) : null),
    [chart, now],
  );

  if (!now || !reading) {
    return (
      <Screen className="grid place-items-center">
        <span className="animate-pulse text-2xl text-primary/60">☾</span>
      </Screen>
    );
  }

  return (
    <>
      <Screen>
        <header className="mb-6">
          <SectionLabel className="mb-2">{formatLongDate(now)}</SectionLabel>
          <h1 className="font-serif text-[30px] leading-tight">
            {reading.headline}
          </h1>
        </header>

        <Card className="mb-5">
          <div className="flex items-center gap-4">
            <MoonDial
              illumination={reading.moon.illumination}
              waxing={reading.moon.waxing}
            />
            <div className="min-w-0 flex-1">
              <p className="font-serif text-lg">
                Moon in {reading.moonSign}{" "}
                <span className="text-gold">{reading.moonSignGlyph}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {reading.moon.name} ·{" "}
                {Math.round(reading.moon.illumination * 100)}% lit
              </p>
              {reading.moonHouse && (
                <p className="mt-1.5">
                  <Pill tone="aqua">
                    crossing your {reading.moonHouse}th house
                  </Pill>
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="mb-5">
          <p className="text-sm leading-relaxed text-ink/85">{reading.body}</p>
        </Card>

        <div className="mb-5 space-y-3">
          <SectionLabel>Today&apos;s weather</SectionLabel>
          {reading.scores.map((score) => (
            <Card key={score.domain} className="p-3.5">
              <div className="mb-2 flex items-center gap-3">
                <span className="w-16 text-[13px] text-ink">{score.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-gold transition-[width] duration-700"
                    style={{ width: `${score.score * 10}%` }}
                  />
                </div>
                <span className="tabular w-9 text-right text-[13px] text-gold">
                  {score.score}/10
                </span>
              </div>
              <p className="text-[12px] text-faint">{score.note}</p>
            </Card>
          ))}
        </div>

        <div className="mb-5">
          <SectionLabel className="mb-3">Today&apos;s aspects</SectionLabel>
          {reading.aspects.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">
                Nothing within orb of your chart today. A genuinely quiet sky —
                treat it as permission rather than absence.
              </p>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {reading.aspects.map((line, i) => {
                const tone =
                  line.aspect.info.nature === "harmonious"
                    ? "text-aqua"
                    : line.aspect.info.nature === "challenging"
                      ? "text-fire"
                      : "text-gold";
                return (
                  <Card key={i} className="p-3.5">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className={cn("text-base", tone)}>
                        {line.aspect.info.glyph}
                      </span>
                      <span className="flex-1 text-[13px] text-ink">
                        {line.title}
                      </span>
                      <Pill tone={line.applying ? "primary" : "default"}>
                        {line.orbLabel}
                        {line.applying ? " ↗" : " ↘"}
                      </Pill>
                    </div>
                    <p className="text-[12px] leading-relaxed text-muted">
                      {line.meaning}
                    </p>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {reading.retrogrades.length > 0 && (
          <Card className="mb-5">
            <SectionLabel className="mb-2.5">Retrograde now</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {reading.retrogrades.map((r) => (
                <Pill key={r.name} tone="warm">
                  {r.glyph} {r.name} ℞
                </Pill>
              ))}
            </div>
          </Card>
        )}

        <Card glow>
          <p className="mb-2 text-2xl leading-none text-gold">&ldquo;</p>
          <p className="font-serif text-[17px] italic leading-relaxed text-ink/90">
            {reading.advice}
          </p>
        </Card>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-faint">
          Scores are computed from the actual transits to your chart at this
          moment — same chart, same date, same reading.
        </p>
      </Screen>
      <TabBar />
    </>
  );
}

/**
 * Moon phase as a drawn disc rather than an emoji, so it matches the palette.
 *
 * The lit region is bounded by two arcs: the outer limb, and the terminator —
 * an ellipse whose x-radius shrinks to zero at the quarters and grows back to
 * the full radius at new and full. Which way each arc bows is what separates a
 * crescent from a gibbous, so the sweep flags carry all the meaning.
 */
function MoonDial({
  illumination,
  waxing,
}: {
  illumination: number;
  waxing: boolean;
}) {
  const size = 56;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const rx = r * Math.abs(1 - 2 * illumination);
  const gibbous = illumination > 0.5;

  // Outer limb runs down the lit side; the terminator returns bowing away from
  // it for a crescent and toward it for a gibbous.
  const outerSweep = waxing ? 1 : 0;
  const innerSweep = waxing ? (gibbous ? 1 : 0) : gibbous ? 0 : 1;

  const lit = `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${innerSweep} ${cx} ${cy - r} Z`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      className="shrink-0"
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#16142a"
        stroke="rgba(232,197,138,0.3)"
      />
      {illumination > 0.005 && <path d={lit} fill="#e8c58a" opacity={0.92} />}
    </svg>
  );
}
