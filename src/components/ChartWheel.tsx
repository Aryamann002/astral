"use client";

/**
 * The natal wheel.
 *
 * Orientation follows the standard Western convention: the Ascendant sits at
 * the nine o'clock position and longitude increases counter-clockwise, so the
 * chart reads the way the sky actually turned overhead.
 */

import { useMemo, useState } from "react";
import { SIGNS, type PointId } from "@/lib/astro/constants";
import type { Chart, Placement } from "@/lib/astro/chart";
import { norm360 } from "@/lib/astro/math";
import { cn } from "@/lib/utils";

const SIZE = 400;
const C = SIZE / 2;

const R_OUTER = 196;
const R_ZODIAC_IN = 168;
const R_HOUSE_IN = 146;
const R_PLANET = 126;
const R_ASPECT = 108;

/** Points that get a glyph on the wheel. */
const PLOTTED: PointId[] = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "northNode",
  "lilith",
];

const ASPECT_COLOR: Record<string, string> = {
  conjunction: "#e8c58a",
  opposition: "#ff8a6b",
  square: "#ff8a6b",
  trine: "#6fd6e0",
  sextile: "#9fc7ff",
  quincunx: "#8f8caa",
  semisextile: "#5d5a78",
  semisquare: "#5d5a78",
  sesquiquadrate: "#5d5a78",
};

interface Props {
  chart: Chart;
  /** Optional outer ring of transiting positions. */
  transits?: { id: PointId; longitude: number; glyph: string }[];
  className?: string;
  onSelect?: (id: PointId) => void;
}

export function ChartWheel({ chart, transits, className, onSelect }: Props) {
  const [hovered, setHovered] = useState<PointId | null>(null);
  const asc = chart.houses.angles.asc;

  /** Longitude → SVG angle in degrees, measured counter-clockwise from east. */
  const angleOf = useMemo(
    () => (lon: number) => 180 + norm360(lon - asc),
    [asc],
  );

  const point = (lon: number, r: number) => {
    const a = angleOf(lon) * (Math.PI / 180);
    return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
  };

  const plotted = chart.placements.filter((p) => PLOTTED.includes(p.id));

  // Nudge overlapping glyphs apart along the ring so none are hidden.
  const spread = useMemo(
    () => spreadGlyphs(plotted, angleOf),
    [plotted, angleOf],
  );

  const aspects = chart.aspects.filter(
    (a) => a.info.major && PLOTTED.includes(a.a) && PLOTTED.includes(a.b),
  );

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={cn("h-auto w-full select-none", className)}
      role="img"
      aria-label="Natal chart wheel"
    >
      <defs>
        <radialGradient id="wheelCore" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#181630" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0a0a14" stopOpacity="0.2" />
        </radialGradient>
      </defs>

      <circle cx={C} cy={C} r={R_ASPECT} fill="url(#wheelCore)" />

      {/* Rings */}
      {[R_OUTER, R_ZODIAC_IN, R_HOUSE_IN, R_ASPECT].map((r) => (
        <circle
          key={r}
          cx={C}
          cy={C}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={1}
        />
      ))}

      {/* Zodiac sectors: a boundary every 30° from 0° Aries */}
      {SIGNS.map((sign) => {
        const start = sign.index * 30;
        const a = point(start, R_ZODIAC_IN);
        const b = point(start, R_OUTER);
        const mid = point(start + 15, (R_ZODIAC_IN + R_OUTER) / 2);
        return (
          <g key={sign.name}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={1}
            />
            <text
              x={mid.x}
              y={mid.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-gold"
              style={{ fontSize: 15, opacity: 0.85 }}
            >
              {sign.glyph}
            </text>
          </g>
        );
      })}

      {/* Single-degree ticks around the zodiac band */}
      {Array.from({ length: 360 }, (_, deg) => {
        const long = deg % 5 === 0;
        const inner = point(deg, R_ZODIAC_IN);
        const outer = point(deg, R_ZODIAC_IN + (long ? 7 : 3.5));
        return (
          <line
            key={deg}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={long ? 0.8 : 0.4}
          />
        );
      })}

      {/* House cusps */}
      {chart.houses.cusps.map((cusp, i) => {
        const isAngle = i === 0 || i === 3 || i === 6 || i === 9;
        const a = point(cusp, R_ASPECT);
        const b = point(cusp, R_ZODIAC_IN);
        const label = point(
          cusp + houseSpanMid(chart.houses.cusps, i),
          R_HOUSE_IN + 11,
        );
        return (
          <g key={`cusp-${i}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={
                isAngle ? "rgba(169,155,255,0.55)" : "rgba(255,255,255,0.12)"
              }
              strokeWidth={isAngle ? 1.3 : 0.8}
            />
            <text
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-faint tabular"
              style={{ fontSize: 9 }}
            >
              {i + 1}
            </text>
          </g>
        );
      })}

      {/* Aspect lines across the centre */}
      <g>
        {aspects.map((aspect, i) => {
          const pa = chart.byId[aspect.a];
          const pb = chart.byId[aspect.b];
          if (!pa || !pb) return null;
          const from = point(pa.longitude, R_ASPECT);
          const to = point(pb.longitude, R_ASPECT);
          const dim =
            hovered !== null && hovered !== aspect.a && hovered !== aspect.b;
          return (
            <line
              key={`${aspect.a}-${aspect.b}-${i}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={ASPECT_COLOR[aspect.aspect] ?? "#5d5a78"}
              strokeWidth={aspect.info.major ? 0.9 : 0.5}
              opacity={dim ? 0.06 : 0.18 + aspect.strength * 0.5}
              strokeDasharray={
                aspect.info.nature === "challenging" ? undefined : "none"
              }
            />
          );
        })}
      </g>

      {/* Angle markers */}
      {(["asc", "mc", "dsc", "ic"] as PointId[]).map((id) => {
        const p = chart.byId[id];
        if (!p) return null;
        const tick = point(p.longitude, R_HOUSE_IN);
        const outer = point(p.longitude, R_OUTER + 1);
        const label = point(p.longitude, R_OUTER + 10);
        const major = id === "asc" || id === "mc";
        return (
          <g key={id}>
            <line
              x1={tick.x}
              y1={tick.y}
              x2={outer.x}
              y2={outer.y}
              stroke={major ? "rgba(232,197,138,0.6)" : "rgba(255,255,255,0.2)"}
              strokeWidth={major ? 1.2 : 0.7}
            />
            {major && (
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-gold smallcaps"
                style={{ fontSize: 8, letterSpacing: "0.1em" }}
              >
                {id.toUpperCase()}
              </text>
            )}
          </g>
        );
      })}

      {/* Transiting ring, when supplied */}
      {transits?.map((t) => {
        const p = point(t.longitude, R_OUTER - 8);
        return (
          <text
            key={`transit-${t.id}`}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-aqua"
            style={{ fontSize: 10, opacity: 0.9 }}
          >
            {t.glyph}
          </text>
        );
      })}

      {/* Planets */}
      {spread.map(({ placement, drawAngle }) => {
        const rad = drawAngle * (Math.PI / 180);
        const gx = C + R_PLANET * Math.cos(rad);
        const gy = C - R_PLANET * Math.sin(rad);
        const trueAngle = angleOf(placement.longitude) * (Math.PI / 180);
        const tickIn = {
          x: C + (R_HOUSE_IN - 2) * Math.cos(trueAngle),
          y: C - (R_HOUSE_IN - 2) * Math.sin(trueAngle),
        };
        const tickOut = {
          x: C + R_HOUSE_IN * Math.cos(trueAngle),
          y: C - R_HOUSE_IN * Math.sin(trueAngle),
        };
        const degreeAt = {
          x: C + (R_PLANET - 15) * Math.cos(rad),
          y: C - (R_PLANET - 15) * Math.sin(rad),
        };
        const active = hovered === placement.id;

        return (
          <g
            key={placement.id}
            onMouseEnter={() => setHovered(placement.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect?.(placement.id)}
            style={{ cursor: onSelect ? "pointer" : "default" }}
          >
            {/* Leader line back to the exact degree */}
            <line
              x1={tickIn.x}
              y1={tickIn.y}
              x2={tickOut.x}
              y2={tickOut.y}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth={1}
            />
            <circle
              cx={gx}
              cy={gy}
              r={12}
              fill={active ? "rgba(169,155,255,0.18)" : "transparent"}
            />
            <text
              x={gx}
              y={gy}
              textAnchor="middle"
              dominantBaseline="central"
              className={active ? "fill-primary" : "fill-ink"}
              style={{ fontSize: 15 }}
            >
              {placement.glyph}
            </text>
            <text
              x={degreeAt.x}
              y={degreeAt.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted tabular"
              style={{ fontSize: 7.5 }}
            >
              {placement.degree}°{placement.retrograde ? "℞" : ""}
            </text>
          </g>
        );
      })}

      <circle cx={C} cy={C} r={2} fill="rgba(232,197,138,0.5)" />
    </svg>
  );
}

/** Midpoint offset of house i, for placing the house number. */
function houseSpanMid(cusps: number[], i: number) {
  const span = norm360(cusps[(i + 1) % 12] - cusps[i]);
  return span / 2;
}

/**
 * Push apart glyphs that would otherwise overlap.
 *
 * Planets are sorted by their drawing angle and swept once forward; anything
 * closer than the minimum separation is nudged along the ring. A second
 * backward pass keeps the cluster centred on where it actually belongs rather
 * than letting it drift in one direction.
 */
function spreadGlyphs(
  placements: Placement[],
  angleOf: (lon: number) => number,
) {
  const MIN_GAP = 9;
  const items = placements
    .map((placement) => ({
      placement,
      drawAngle: angleOf(placement.longitude),
    }))
    .sort((a, b) => a.drawAngle - b.drawAngle);

  for (let pass = 0; pass < 3; pass += 1) {
    for (let i = 1; i < items.length; i += 1) {
      const gap = items[i].drawAngle - items[i - 1].drawAngle;
      if (gap < MIN_GAP) {
        const push = (MIN_GAP - gap) / 2;
        items[i - 1].drawAngle -= push;
        items[i].drawAngle += push;
      }
    }
    // Wrap-around pair.
    if (items.length > 1) {
      const wrapGap =
        items[0].drawAngle + 360 - items[items.length - 1].drawAngle;
      if (wrapGap < MIN_GAP) {
        const push = (MIN_GAP - wrapGap) / 2;
        items[items.length - 1].drawAngle -= push;
        items[0].drawAngle += push;
      }
    }
  }

  return items;
}
