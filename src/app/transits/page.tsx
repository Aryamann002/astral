"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Pill, Screen, SectionLabel, TabBar } from "@/components/ui";
import { RequireChart } from "@/components/RequireChart";
import {
  forecastTransits,
  lifeCycles,
  type TransitHit,
} from "@/lib/astro/transits";
import { ELEMENT_COLORS, PLANET_MAP } from "@/lib/astro/constants";
import type { Chart } from "@/lib/astro/chart";
import { formatShortDate, cn } from "@/lib/utils";

type Filter = "all" | "major" | "personal" | "slow";
const RANGES = [90, 180, 365] as const;

export default function TransitsPage() {
  return (
    <RequireChart>{(chart) => <TransitsView chart={chart} />}</RequireChart>
  );
}

function TransitsView({ chart }: { chart: Chart }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(90);
  const [filter, setFilter] = useState<Filter>("all");
  const [scan, setScan] = useState<{ key: string; hits: TransitHit[] } | null>(
    null,
  );
  const [from] = useState(() => new Date());

  // The scan is heavy enough to block paint, so it runs after the first frame.
  // Results carry the inputs they were computed for, so a stale set is
  // discarded by comparison rather than by clearing state inside the effect.
  const scanKey = `${chart.birth.utc}|${chart.houses.system}|${days}`;

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setScan({
        key: scanKey,
        hits: forecastTransits(chart, { from, days, majorOnly: true }),
      });
    });
    return () => cancelAnimationFrame(id);
  }, [scanKey, chart, days, from]);

  const hits = scan?.key === scanKey ? scan.hits : null;

  const filtered = useMemo(() => {
    if (!hits) return [];
    switch (filter) {
      case "major":
        return hits.filter((h) => h.intensity >= 0.5);
      case "personal":
        return hits.filter((h) => !h.slow);
      case "slow":
        return hits.filter((h) => h.slow);
      default:
        return hits;
    }
  }, [hits, filter]);

  const peak = useMemo(
    () =>
      hits?.length
        ? hits.reduce((a, b) => (b.intensity > a.intensity ? b : a))
        : null,
    [hits],
  );

  const cycles = useMemo(
    () => lifeCycles(chart, from).filter((c) => c.active),
    [chart, from],
  );

  return (
    <>
      <Screen>
        <header className="mb-5 flex items-center justify-between">
          <h1 className="font-serif text-[30px] leading-tight">Transits</h1>
          <div className="flex gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  days === r
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-white/10 text-muted hover:text-ink",
                )}
              >
                {r}d
              </button>
            ))}
          </div>
        </header>

        {cycles.length > 0 && (
          <Card glow className="mb-5">
            <SectionLabel className="mb-2">Active life cycle</SectionLabel>
            {cycles.map((c) => (
              <div key={c.name} className="mb-2 last:mb-0">
                <p className="font-serif text-lg">{c.name}</p>
                <p className="mb-1 text-[11px] text-gold/80">{c.window}</p>
                <p className="text-[13px] leading-relaxed text-muted">
                  {c.description}
                </p>
              </div>
            ))}
          </Card>
        )}

        {hits && hits.length > 0 && (
          <Timeline hits={hits} from={from} days={days} />
        )}

        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
          {(
            [
              ["all", "All"],
              ["major", "Major"],
              ["personal", "Personal"],
              ["slow", "Slow-moving"],
            ] as [Filter, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                filter === value
                  ? "border-primary/40 bg-primary/12 text-primary"
                  : "border-white/10 text-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {!hits && (
          <Card className="text-center">
            <span className="animate-pulse text-xl text-primary/60">✧</span>
            <p className="mt-2 text-xs text-muted">
              Scanning the next {days} days…
            </p>
          </Card>
        )}

        {hits && filtered.length === 0 && (
          <Card>
            <p className="text-sm text-muted">
              No transits in this band over the next {days} days. Widen the
              range or drop the filter.
            </p>
          </Card>
        )}

        {filtered.length > 0 && (
          // Remounting on a filter or range change resets the paging window
          // without an effect reaching in to do it.
          <TransitList
            key={`${filter}-${days}`}
            hits={filtered}
            chart={chart}
            peakId={peak?.id}
          />
        )}
      </Screen>
      <TabBar />
    </>
  );
}

const PAGE = 12;

/**
 * Grouped by month and revealed a page at a time. A year of transits runs to
 * several hundred perfections, and dumping them all into one column makes the
 * page unreadable and unscrollable.
 */
function TransitList({
  hits,
  chart,
  peakId,
}: {
  hits: TransitHit[];
  chart: Chart;
  peakId?: string;
}) {
  const [limit, setLimit] = useState(PAGE);
  const visible = hits.slice(0, limit);

  const groups: { label: string; items: TransitHit[] }[] = [];
  for (const hit of visible) {
    const label = hit.exact.toLocaleString("en", {
      month: "long",
      year: "numeric",
    });
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(hit);
    else groups.push({ label, items: [hit] });
  }

  return (
    <>
      {groups.map((group) => (
        <section key={group.label} className="mb-5">
          <SectionLabel className="mb-2.5">{group.label}</SectionLabel>
          <div className="space-y-2.5">
            {group.items.map((hit) => (
              <TransitCard
                key={hit.id}
                hit={hit}
                chart={chart}
                isPeak={hit.id === peakId}
              />
            ))}
          </div>
        </section>
      ))}

      {limit < hits.length && (
        <button
          onClick={() => setLimit((n) => n + PAGE)}
          className="hairline w-full rounded-full py-3 text-xs text-muted transition-colors hover:bg-white/5 hover:text-ink"
        >
          Show {Math.min(PAGE, hits.length - limit)} more ·{" "}
          {hits.length - limit} remaining
        </button>
      )}
    </>
  );
}

function TransitCard({
  hit,
  chart,
  isPeak,
}: {
  hit: TransitHit;
  chart: Chart;
  isPeak: boolean;
}) {
  const natal = chart.byId[hit.natal];
  const rail = natal ? ELEMENT_COLORS[natal.sign.element] : "#6f63c4";
  const transitingGlyph = PLANET_MAP[hit.transiting].glyph;
  const tone =
    hit.nature === "harmonious"
      ? "text-aqua"
      : hit.nature === "challenging"
        ? "text-fire"
        : "text-gold";

  return (
    <Card glow={isPeak} className="relative overflow-hidden p-0">
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: rail }}
      />
      <div className="py-3.5 pl-4 pr-3.5">
        <div className="mb-1.5 flex items-center gap-2.5">
          <span className="text-primary">{transitingGlyph}</span>
          <span className={cn("text-[15px]", tone)}>{hit.aspectGlyph}</span>
          <span className="text-gold">{natal?.glyph}</span>
          {isPeak && (
            <span className="ml-auto text-[11px] text-gold">★ peak</span>
          )}
        </div>

        <p className="text-[14px] text-ink">{hit.title}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Pill>
            {formatShortDate(hit.start)} – {formatShortDate(hit.end)}
          </Pill>
          <Pill tone="gold">exact {formatShortDate(hit.exact)}</Pill>
          {hit.currentOrb !== null && <Pill tone="primary">live now</Pill>}
        </div>

        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-gold"
            style={{ width: `${hit.intensity * 100}%` }}
          />
        </div>

        <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
          {hit.interpretation}
        </p>
      </div>
    </Card>
  );
}

/** A luminous strip with a dot for each perfection, sized by intensity. */
function Timeline({
  hits,
  from,
  days,
}: {
  hits: TransitHit[];
  from: Date;
  days: number;
}) {
  const span = days * 86400000;
  const months: { label: string; left: number }[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor.getTime() < from.getTime() + span) {
    const left = ((cursor.getTime() - from.getTime()) / span) * 100;
    if (left >= 0 && left <= 96) {
      months.push({
        label: cursor.toLocaleString("en", { month: "short" }).toUpperCase(),
        left,
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="mb-6">
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-3 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
        {/* Only the consequential ones — plotting all of them turns the strip
            into a solid smear. */}
        {hits
          .filter((h) => h.intensity >= 0.45)
          .map((hit) => {
            const left = ((hit.exact.getTime() - from.getTime()) / span) * 100;
            if (left < 0 || left > 100) return null;
            const size = 3 + hit.intensity * 4;
            return (
              <span
                key={hit.id}
                title={hit.title}
                className="absolute top-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold"
                style={{
                  left: `${left}%`,
                  width: size,
                  height: size,
                  boxShadow: `0 0 ${4 + hit.intensity * 8}px rgba(232,197,138,0.7)`,
                }}
              />
            );
          })}
        {months.map((m) => (
          <span
            key={m.label + m.left}
            className="smallcaps absolute top-6 -translate-x-1/2 text-[9px] text-faint"
            style={{ left: `${m.left}%` }}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
