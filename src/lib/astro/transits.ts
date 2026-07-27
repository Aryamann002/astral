/**
 * Transits: where the sky is now relative to where it was at birth.
 *
 * Exactness dates are found by bisection on the signed orb, which handles
 * retrograde loops correctly — a slow planet can perfect the same aspect three
 * times, and each pass is found separately by scanning day by day for sign
 * changes in the orb function.
 */

import {
  PLANET_MAP,
  pointName,
  type AspectId,
  type PlanetId,
  type PointId,
} from "./constants";
import { bodyPosition } from "./ephemeris";
import { findCrossAspects, type Aspect, type AspectPoint } from "./aspects";
import { angularSeparation, norm180 } from "./math";
import type { Chart, Placement } from "./chart";
import { ASPECT_MAP } from "./constants";

/** Transiting bodies worth tracking. The Moon moves too fast to list as an event. */
const TRANSITING: PlanetId[] = [
  "sun",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
];

const SLOW: PlanetId[] = ["jupiter", "saturn", "uranus", "neptune", "pluto"];

export interface TransitHit {
  id: string;
  transiting: PlanetId;
  natal: PointId;
  aspect: AspectId;
  aspectName: string;
  aspectGlyph: string;
  nature: "harmonious" | "challenging" | "neutral";
  /** When the aspect first comes within orb. */
  start: Date;
  /** When it perfects. */
  exact: Date;
  /** When it leaves orb. */
  end: Date;
  /** Current orb in degrees, if the transit is live right now. */
  currentOrb: number | null;
  /** 0..1 weighting by how slow and how personal the pairing is. */
  intensity: number;
  slow: boolean;
  title: string;
  interpretation: string;
}

/** Natal points that transits are measured against. */
function natalTargets(chart: Chart): AspectPoint[] {
  const wanted: PointId[] = [
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
    "asc",
    "mc",
  ];
  return chart.placements
    .filter((p) => wanted.includes(p.id))
    .filter(
      (p) => !(chart.birth.timeUnknown && (p.id === "asc" || p.id === "mc")),
    )
    .map((p) => ({ id: p.id, longitude: p.longitude, speed: 0 }));
}

/** Live transits at a given instant, strongest first. */
export function currentTransits(
  chart: Chart,
  when: Date = new Date(),
): Aspect[] {
  const moving: AspectPoint[] = [...TRANSITING, "moon" as PlanetId].map(
    (id) => {
      const p = bodyPosition(id, when);
      return { id, longitude: p.longitude, speed: p.speed };
    },
  );
  return findCrossAspects(moving, natalTargets(chart), { majorOnly: true });
}

/** Signed orb: how far the transiting body is from exact, with sign preserved. */
function signedOrb(transitLon: number, natalLon: number, angle: number) {
  const separation = norm180(transitLon - natalLon);
  // Both +angle and -angle are valid perfections; pick the nearer one.
  const plus = norm180(separation - angle);
  const minus = norm180(separation + angle);
  return Math.abs(plus) <= Math.abs(minus) ? plus : minus;
}

function bisectExact(
  planet: PlanetId,
  natalLon: number,
  angle: number,
  lo: Date,
  hi: Date,
): Date {
  let a = lo.getTime();
  let b = hi.getTime();
  const f = (t: number) =>
    signedOrb(bodyPosition(planet, new Date(t)).longitude, natalLon, angle);
  let fa = f(a);

  for (let i = 0; i < 40; i += 1) {
    const mid = (a + b) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-6 || b - a < 60000) return new Date(mid);
    if (Math.sign(fm) === Math.sign(fa)) {
      a = mid;
      fa = fm;
    } else {
      b = mid;
    }
  }
  return new Date((a + b) / 2);
}

/** Orb allowance for a forecast transit — tighter than natal, to keep lists useful. */
function transitOrb(planet: PlanetId, aspect: AspectId) {
  const base = ASPECT_MAP[aspect].orb;
  const slowFactor = SLOW.includes(planet) ? 0.8 : 0.6;
  return base * slowFactor;
}

function intensityOf(planet: PlanetId, natal: PointId, aspect: AspectId) {
  const slowWeight = SLOW.includes(planet) ? 1 : planet === "mars" ? 0.6 : 0.35;
  const targetWeight =
    natal === "sun" || natal === "moon" || natal === "asc" || natal === "mc"
      ? 1
      : natal === "mercury" || natal === "venus" || natal === "mars"
        ? 0.8
        : 0.55;
  const aspectWeight =
    aspect === "conjunction" || aspect === "opposition"
      ? 1
      : aspect === "square"
        ? 0.9
        : aspect === "trine"
          ? 0.7
          : 0.5;
  return Math.min(1, slowWeight * targetWeight * aspectWeight);
}

/**
 * What each transiting body tends to do, by aspect quality. Keeping these
 * per-planet is the difference between a forecast that reads and one where
 * every card says the same sentence.
 */
const PLANET_LINE: Record<
  PlanetId,
  Record<"harmonious" | "challenging" | "neutral", string>
> = {
  sun: {
    harmonious:
      "Brief and warming — a couple of days where this part of life is simply easier to see.",
    challenging:
      "A short, bright spotlight on the friction. Uncomfortable, but it shows you the shape of the problem.",
    neutral:
      "The annual reset for this part of the chart. Whatever you start now carries the year's tone.",
  },
  mercury: {
    harmonious:
      "Words come easily here. Good for the conversation you've been drafting in your head.",
    challenging:
      "Miscommunication and rushed decisions cluster here. Re-read before you send.",
    neutral:
      "Information arrives. Worth writing things down — this is where the useful detail surfaces.",
  },
  venus: {
    harmonious:
      "Things go smoothly and people are generous with you. Spend it on the relationship that matters.",
    challenging:
      "Money and affection both feel slightly out of joint. Avoid resolving it by buying something.",
    neutral:
      "A recalibration of what you actually want, as opposed to what you have been settling for.",
  },
  mars: {
    harmonious:
      "Energy is available and lands where you point it. Good for the thing requiring nerve.",
    challenging:
      "Short fuse, accidents of haste, arguments that were already there. Slow down deliberately.",
    neutral:
      "A fresh push. Start the effort now and it has momentum behind it.",
  },
  jupiter: {
    harmonious:
      "The most straightforwardly fortunate transit there is — doors open, but only if you walk through.",
    challenging:
      "Overreach. Excess of a good thing, promises larger than you can keep. Check the arithmetic.",
    neutral:
      "Expansion begins here. What you commit to now grows for a decade.",
  },
  saturn: {
    harmonious:
      "Slow, real consolidation. Unglamorous work that actually holds.",
    challenging:
      "The hard one. Limits enforced, effort unrewarded for a while. What survives it is genuinely yours.",
    neutral:
      "A structural reset. Commitments made now are binding in a way that lighter transits are not.",
  },
  uranus: {
    harmonious:
      "A break in the pattern that arrives as relief rather than rupture. Take the unusual option.",
    challenging:
      "Disruption you did not choose. The instinct to grab for stability is the thing to resist.",
    neutral:
      "The old arrangement stops fitting. Something in this area is about to become unrecognisable.",
  },
  neptune: {
    harmonious:
      "Boundaries soften usefully — good for imaginative work, poor for negotiation.",
    challenging:
      "Confusion, idealisation and slow disillusionment. Do not sign anything you have not had explained twice.",
    neutral:
      "A long dissolving. What this touches will not have clear edges again for years.",
  },
  pluto: {
    harmonious:
      "Deep change that you are, unusually, in charge of. Rare and worth using.",
    challenging:
      "Power struggles, compulsion, and something you cannot keep. It does not negotiate.",
    neutral:
      "Total rebuild. This area of life will not look the same on the other side.",
  },
  moon: {
    harmonious: "Passing and gentle — a few hours, not a season.",
    challenging: "A brief mood, not a verdict. Let it move through.",
    neutral: "A short emotional reset.",
  },
  northNode: {
    harmonious: "The unfamiliar direction becomes briefly easy to walk in.",
    challenging: "A pull away from what you know, felt as resistance.",
    neutral: "A directional marker. Notice what shows up.",
  },
  southNode: {
    harmonious: "An old competence comes back into use.",
    challenging: "The comfortable habit reasserts itself. Notice it.",
    neutral: "Something familiar returns to be let go of.",
  },
  lilith: {
    harmonious: "The refused part of you gets brief permission.",
    challenging: "Old exile and old anger surface here.",
    neutral: "Contact with what you have kept out of view.",
  },
};

function transitInterpretation(
  planet: PlanetId,
  natal: PointId,
  aspect: AspectId,
) {
  const p = PLANET_MAP[planet];
  const nature = ASPECT_MAP[aspect].nature;
  const target =
    natal === "asc"
      ? "how you present and what people meet first"
      : natal === "mc"
        ? "your public standing and direction of travel"
        : (PLANET_MAP[natal as PlanetId]?.drive ?? pointName(natal));
  return `Transiting ${p.name} ${ASPECT_MAP[aspect].verb} ${target}. ${PLANET_LINE[planet][nature]}`;
}

export interface ForecastOptions {
  from?: Date;
  days?: number;
  /** Only conjunction, opposition, square, trine, sextile. */
  majorOnly?: boolean;
  /** Restrict to Jupiter and beyond. */
  slowOnly?: boolean;
}

/**
 * Scan forward for transits that perfect inside the window.
 *
 * We step day by day and watch the signed orb for each planet/natal-point/aspect
 * triple. A sign flip means the aspect perfected between the two samples, and
 * bisection then pins the moment. Retrograde loops produce several flips and so
 * several separate hits, which is exactly what you want to see.
 */
export function forecastTransits(
  chart: Chart,
  options: ForecastOptions = {},
): TransitHit[] {
  const {
    from = new Date(),
    days = 90,
    majorOnly = true,
    slowOnly = false,
  } = options;
  const planets = slowOnly ? SLOW : TRANSITING;
  const targets = natalTargets(chart);
  const aspectIds: AspectId[] = majorOnly
    ? ["conjunction", "opposition", "trine", "square", "sextile"]
    : ["conjunction", "opposition", "trine", "square", "sextile", "quincunx"];

  const start = new Date(from);
  const stepMs = 86400000;
  const steps = days;

  // Pre-compute one longitude sample per planet per day.
  const samples = new Map<PlanetId, number[]>();
  for (const planet of planets) {
    const series: number[] = [];
    for (let i = 0; i <= steps; i += 1) {
      series.push(
        bodyPosition(planet, new Date(start.getTime() + i * stepMs)).longitude,
      );
    }
    samples.set(planet, series);
  }

  const hits: TransitHit[] = [];

  for (const planet of planets) {
    const series = samples.get(planet)!;
    for (const target of targets) {
      for (const aspect of aspectIds) {
        const angle = ASPECT_MAP[aspect].angle;
        const orbLimit = transitOrb(planet, aspect);
        let previous = signedOrb(series[0], target.longitude, angle);

        for (let i = 1; i <= steps; i += 1) {
          const current = signedOrb(series[i], target.longitude, angle);
          const crossed =
            Math.sign(current) !== Math.sign(previous) &&
            Math.abs(current - previous) < 90;

          if (crossed) {
            const lo = new Date(start.getTime() + (i - 1) * stepMs);
            const hi = new Date(start.getTime() + i * stepMs);
            const exact = bisectExact(planet, target.longitude, angle, lo, hi);
            const window = orbWindow(
              planet,
              target.longitude,
              angle,
              orbLimit,
              exact,
            );
            const info = ASPECT_MAP[aspect];
            const nowOrb = angularSeparation(
              bodyPosition(planet, from).longitude,
              target.longitude,
            );

            hits.push({
              id: `${planet}-${aspect}-${target.id}-${exact.toISOString().slice(0, 10)}`,
              transiting: planet,
              natal: target.id,
              aspect,
              aspectName: info.name,
              aspectGlyph: info.glyph,
              nature: info.nature,
              start: window.start,
              exact,
              end: window.end,
              currentOrb:
                Math.abs(nowOrb - angle) <= orbLimit
                  ? Math.abs(nowOrb - angle)
                  : null,
              intensity: intensityOf(planet, target.id, aspect),
              slow: SLOW.includes(planet),
              title: `${PLANET_MAP[planet].name} ${info.name.toLowerCase()} natal ${pointName(target.id)}`,
              interpretation: transitInterpretation(planet, target.id, aspect),
            });
          }
          previous = current;
        }
      }
    }
  }

  // De-duplicate perfections that bisection resolved to the same day.
  const seen = new Set<string>();
  return hits
    .filter((h) => {
      if (seen.has(h.id)) return false;
      seen.add(h.id);
      return true;
    })
    .sort((a, b) => a.exact.getTime() - b.exact.getTime());
}

/**
 * Walk outward from exactness to find where the orb opens and closes.
 *
 * A coarse stride locates the crossing first, then a short bisection refines
 * it. Stepping a day at a time would be simpler but Pluto stays within orb for
 * over a year, and the naive version costs hundreds of ephemeris evaluations
 * per transit.
 */
function orbWindow(
  planet: PlanetId,
  natalLon: number,
  angle: number,
  orbLimit: number,
  exact: Date,
) {
  const maxDays = SLOW.includes(planet) ? 500 : 60;
  const stride = Math.max(1, Math.round(maxDays / 30));
  const dayMs = 86400000;

  const orbAt = (days: number) =>
    Math.abs(
      signedOrb(
        bodyPosition(planet, new Date(exact.getTime() + days * dayMs))
          .longitude,
        natalLon,
        angle,
      ),
    );

  const edge = (direction: 1 | -1) => {
    let inside = 0;
    let outside: number | null = null;

    for (let d = stride; d <= maxDays; d += stride) {
      if (orbAt(direction * d) > orbLimit) {
        outside = d;
        break;
      }
      inside = d;
    }
    if (outside === null)
      return new Date(exact.getTime() + direction * maxDays * dayMs);

    // Narrow to within a day.
    let lo = inside;
    let hi = outside;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (orbAt(direction * mid) > orbLimit) hi = mid;
      else lo = mid;
    }
    return new Date(exact.getTime() + direction * lo * dayMs);
  };

  return { start: edge(-1), end: edge(1) };
}

/** Saturn return, Jupiter return and the other age-linked milestones. */
export interface LifeCycle {
  name: string;
  window: string;
  description: string;
  active: boolean;
}

export function lifeCycles(chart: Chart, now: Date = new Date()): LifeCycle[] {
  const birth = new Date(chart.birth.utc);
  const ageYears = (now.getTime() - birth.getTime()) / (365.2425 * 86400000);
  const inRange = (lo: number, hi: number) => ageYears >= lo && ageYears <= hi;

  return [
    {
      name: "First Saturn Return",
      window: "ages 28–31",
      description:
        "Saturn comes back to where it began. Commitments made without conviction tend to come apart, and what survives is genuinely yours.",
      active: inRange(28, 31),
    },
    {
      name: "Uranus Opposition",
      window: "ages 40–44",
      description:
        "Uranus reaches the far side of your chart. The classic midlife pressure to break a structure you built and no longer fit.",
      active: inRange(40, 44),
    },
    {
      name: "Second Saturn Return",
      window: "ages 57–60",
      description:
        "A second accounting. Authority becomes something you either accept or hand on.",
      active: inRange(57, 60),
    },
    {
      name: "Nodal Return",
      window: "every 18.6 years",
      description:
        "The lunar nodes return to their birth position — a recalibration of direction rather than circumstance.",
      active:
        Math.abs((ageYears % 18.6) - 0) < 0.5 ||
        Math.abs((ageYears % 18.6) - 18.6) < 0.5,
    },
    {
      name: "Jupiter Return",
      window: "every 12 years",
      description:
        "Jupiter comes home. A widening of scope, and usually an opportunity that requires you to be bigger than you were.",
      active:
        Math.abs((ageYears % 11.86) - 0) < 0.4 ||
        Math.abs((ageYears % 11.86) - 11.86) < 0.4,
    },
  ];
}

export function retrogradesNow(when: Date = new Date()) {
  return TRANSITING.filter((id) => id !== "sun")
    .map((id) => bodyPosition(id, when))
    .filter((p) => p.retrograde);
}

export type { Placement };
