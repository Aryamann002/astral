/** Aspect detection between chart points. */

import {
  ASPECTS,
  ASPECT_MAP,
  type AspectId,
  type AspectInfo,
  type PointId,
} from "./constants";
import { angularSeparation } from "./math";

export interface Aspect {
  a: PointId;
  b: PointId;
  aspect: AspectId;
  info: AspectInfo;
  /** How far from exact, in degrees. */
  orb: number;
  /** 0..1, where 1 is exact. Drives line opacity and ranking. */
  strength: number;
  /** True when the faster body is closing on exactness. */
  applying: boolean;
  exactAngle: number;
}

/**
 * Orb allowance. Luminaries get a wider berth than points; minor aspects get a
 * tighter one. Values follow common modern practice rather than any single
 * school, and are deliberately generous for the Sun and Moon.
 */
const ORB_WEIGHT: Partial<Record<PointId, number>> = {
  sun: 1.25,
  moon: 1.25,
  asc: 1.1,
  mc: 1.1,
  mercury: 1,
  venus: 1,
  mars: 1,
  jupiter: 0.95,
  saturn: 0.95,
  uranus: 0.85,
  neptune: 0.85,
  pluto: 0.85,
  northNode: 0.6,
  southNode: 0.6,
  lilith: 0.5,
  fortune: 0.5,
  dsc: 0.8,
  ic: 0.8,
};

function orbFor(aspect: AspectInfo, a: PointId, b: PointId) {
  const weight = Math.max(ORB_WEIGHT[a] ?? 0.8, ORB_WEIGHT[b] ?? 0.8);
  return aspect.orb * weight;
}

export interface AspectPoint {
  id: PointId;
  longitude: number;
  speed: number;
}

export interface FindAspectsOptions {
  /** Skip quincunxes, semisextiles and the eighth-harmonic aspects. */
  majorOnly?: boolean;
  /** Pairs where both points are in this set are ignored (e.g. angle-to-angle). */
  ignorePairsWithin?: PointId[];
}

function bestAspect(
  separation: number,
  a: PointId,
  b: PointId,
  majorOnly: boolean,
) {
  let best: { info: AspectInfo; orb: number } | null = null;
  for (const info of ASPECTS) {
    if (majorOnly && !info.major) continue;
    const orb = Math.abs(separation - info.angle);
    if (orb > orbFor(info, a, b)) continue;
    if (!best || orb < best.orb) best = { info, orb };
  }
  return best;
}

/** All aspects within one set of points (a natal chart). */
export function findAspects(
  points: AspectPoint[],
  options: FindAspectsOptions = {},
): Aspect[] {
  const { majorOnly = false, ignorePairsWithin = [] } = options;
  const ignored = new Set(ignorePairsWithin);
  const out: Aspect[] = [];

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const p = points[i];
      const q = points[j];
      if (ignored.has(p.id) && ignored.has(q.id)) continue;
      // The nodes are always exactly opposite; that opposition says nothing.
      if (
        (p.id === "northNode" && q.id === "southNode") ||
        (p.id === "southNode" && q.id === "northNode")
      ) {
        continue;
      }
      const aspect = measure(p, q, majorOnly);
      if (aspect) out.push(aspect);
    }
  }

  return out.sort((x, y) => y.strength - x.strength);
}

/** Aspects between two different sets — synastry, or transits to natal. */
export function findCrossAspects(
  moving: AspectPoint[],
  fixed: AspectPoint[],
  options: FindAspectsOptions = {},
): Aspect[] {
  const { majorOnly = false } = options;
  const out: Aspect[] = [];
  for (const m of moving) {
    for (const f of fixed) {
      const aspect = measure(m, { ...f, speed: 0 }, majorOnly);
      if (aspect) out.push(aspect);
    }
  }
  return out.sort((x, y) => y.strength - x.strength);
}

function measure(
  p: AspectPoint,
  q: AspectPoint,
  majorOnly: boolean,
): Aspect | null {
  const separation = angularSeparation(p.longitude, q.longitude);
  const found = bestAspect(separation, p.id, q.id, majorOnly);
  if (!found) return null;

  const maxOrb = orbFor(found.info, p.id, q.id);
  const strength = 1 - found.orb / maxOrb;

  // Project both bodies forward a little and see whether the orb shrinks.
  const step = 0.02;
  const futureSeparation = angularSeparation(
    p.longitude + p.speed * step,
    q.longitude + q.speed * step,
  );
  const applying = Math.abs(futureSeparation - found.info.angle) < found.orb;

  return {
    a: p.id,
    b: q.id,
    aspect: found.info.id,
    info: found.info,
    orb: found.orb,
    strength,
    applying,
    exactAngle: found.info.angle,
  };
}

export function formatOrb(orb: number) {
  const degrees = Math.floor(orb);
  const minutes = Math.round((orb - degrees) * 60);
  if (minutes === 60) return `${degrees + 1}°00'`;
  return `${degrees}°${String(minutes).padStart(2, "0")}'`;
}

export function aspectGlyph(id: AspectId) {
  return ASPECT_MAP[id].glyph;
}
