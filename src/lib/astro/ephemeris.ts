/**
 * Planetary positions from the VSOP87/DE-derived series bundled with
 * `astronomy-engine`, converted to apparent geocentric ecliptic longitude
 * of date — the frame tropical astrology works in.
 */

import * as Astronomy from "astronomy-engine";
import type { PlanetId } from "./constants";
import { atan2, julianCenturies, norm360, norm180 } from "./math";

export interface BodyPosition {
  id: PlanetId;
  /** Apparent geocentric ecliptic longitude of date, degrees. */
  longitude: number;
  /** Ecliptic latitude, degrees. */
  latitude: number;
  /** Distance from Earth in AU. Zero for computed points. */
  distance: number;
  /** Longitude change in degrees per day. Negative means retrograde. */
  speed: number;
  retrograde: boolean;
}

const ENGINE_BODY: Partial<Record<PlanetId, Astronomy.Body>> = {
  sun: Astronomy.Body.Sun,
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
  pluto: Astronomy.Body.Pluto,
};

/** Bodies we ask the ephemeris for directly, in display order. */
export const EPHEMERIS_BODIES: PlanetId[] = [
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
];

function eclipticOf(body: PlanetId, date: Date) {
  if (body === "moon") {
    // GeoMoon returns an EQJ vector; Ecliptic() rotates it into the true
    // ecliptic of date, which is what we want for chart longitudes.
    return Astronomy.Ecliptic(Astronomy.GeoMoon(date));
  }
  const engineBody = ENGINE_BODY[body];
  if (!engineBody) throw new Error(`No ephemeris body for ${body}`);
  // aberration = true gives the apparent position as seen from Earth.
  return Astronomy.Ecliptic(Astronomy.GeoVector(engineBody, date, true));
}

function shift(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000);
}

/** Longitude, latitude and true daily motion for one body. */
export function bodyPosition(id: PlanetId, date: Date): BodyPosition {
  if (id === "northNode" || id === "southNode") return nodePosition(id, date);
  if (id === "lilith") return lilithPosition(date);

  const here = eclipticOf(id, date);
  const dt = id === "moon" ? 0.02 : 0.5;
  const before = eclipticOf(id, shift(date, -dt));
  const after = eclipticOf(id, shift(date, dt));
  const speed = norm180(after.elon - before.elon) / (2 * dt);

  return {
    id,
    longitude: norm360(here.elon),
    latitude: here.elat,
    distance: Math.hypot(here.vec.x, here.vec.y, here.vec.z),
    speed,
    retrograde: speed < 0,
  };
}

/**
 * True (osculating) lunar node: the ascending intersection of the Moon's
 * instantaneous orbital plane with the ecliptic. Derived from the Moon's
 * position and numerically differentiated velocity, so it tracks the real
 * wobble rather than the smoothed mean node.
 */
function nodePosition(id: "northNode" | "southNode", date: Date): BodyPosition {
  const node = (t: Date) => {
    const dt = 0.05;
    const p0 = Astronomy.Ecliptic(Astronomy.GeoMoon(shift(t, -dt))).vec;
    const p1 = Astronomy.Ecliptic(Astronomy.GeoMoon(shift(t, dt))).vec;
    const r = {
      x: (p0.x + p1.x) / 2,
      y: (p0.y + p1.y) / 2,
      z: (p0.z + p1.z) / 2,
    };
    const v = {
      x: (p1.x - p0.x) / (2 * dt),
      y: (p1.y - p0.y) / (2 * dt),
      z: (p1.z - p0.z) / (2 * dt),
    };
    // h = r × v is the orbital angular momentum; ẑ × h points at the
    // ascending node.
    const h = {
      x: r.y * v.z - r.z * v.y,
      y: r.z * v.x - r.x * v.z,
      z: r.x * v.y - r.y * v.x,
    };
    return norm360(atan2(h.x, -h.y));
  };

  const ascending = node(date);
  const before = node(shift(date, -1));
  const after = node(shift(date, 1));
  const speed = norm180(after - before) / 2;
  const longitude = id === "northNode" ? ascending : norm360(ascending + 180);

  return {
    id,
    longitude,
    latitude: 0,
    distance: 0,
    speed,
    retrograde: speed < 0,
  };
}

/**
 * Mean Black Moon Lilith — the mean lunar apogee, i.e. the empty focus of the
 * Moon's orbit. Meeus mean elements: apogee = L' - M' + 180°.
 */
function lilithLongitude(date: Date) {
  const t = julianCenturies(date);
  const meanLongitude =
    218.3164477 +
    481267.88123421 * t -
    0.0015786 * t * t +
    (t * t * t) / 538841 -
    (t * t * t * t) / 65194000;
  const meanAnomaly =
    134.9633964 +
    477198.8675055 * t +
    0.0087414 * t * t +
    (t * t * t) / 69699 -
    (t * t * t * t) / 14712000;
  return norm360(meanLongitude - meanAnomaly + 180);
}

function lilithPosition(date: Date): BodyPosition {
  const longitude = lilithLongitude(date);
  const speed =
    norm180(
      lilithLongitude(shift(date, 1)) - lilithLongitude(shift(date, -1)),
    ) / 2;
  return {
    id: "lilith",
    longitude,
    latitude: 0,
    distance: 0,
    speed,
    retrograde: speed < 0,
  };
}

/** Every body Astral plots, for a single instant. */
export function allPositions(date: Date): Record<PlanetId, BodyPosition> {
  const out = {} as Record<PlanetId, BodyPosition>;
  for (const id of EPHEMERIS_BODIES) out[id] = bodyPosition(id, date);
  out.northNode = bodyPosition("northNode", date);
  out.southNode = bodyPosition("southNode", date);
  out.lilith = bodyPosition("lilith", date);
  return out;
}

export interface MoonPhase {
  /** 0 = new, 90 = first quarter, 180 = full, 270 = last quarter. */
  angle: number;
  /** Illuminated fraction, 0..1. */
  illumination: number;
  name: string;
  glyph: string;
  waxing: boolean;
}

const PHASE_NAMES: { max: number; name: string; glyph: string }[] = [
  { max: 22.5, name: "New Moon", glyph: "●" },
  { max: 67.5, name: "Waxing Crescent", glyph: "🌒" },
  { max: 112.5, name: "First Quarter", glyph: "🌓" },
  { max: 157.5, name: "Waxing Gibbous", glyph: "🌔" },
  { max: 202.5, name: "Full Moon", glyph: "○" },
  { max: 247.5, name: "Waning Gibbous", glyph: "🌖" },
  { max: 292.5, name: "Last Quarter", glyph: "🌗" },
  { max: 337.5, name: "Waning Crescent", glyph: "🌘" },
  { max: 360.1, name: "New Moon", glyph: "●" },
];

export function moonPhase(date: Date): MoonPhase {
  const angle = norm360(Astronomy.MoonPhase(date));
  const illumination = (1 - Math.cos(angle * (Math.PI / 180))) / 2;
  const entry = PHASE_NAMES.find((p) => angle < p.max)!;
  return {
    angle,
    illumination,
    name: entry.name,
    glyph: entry.glyph,
    waxing: angle < 180,
  };
}

/** Local apparent sidereal time in degrees — the RAMC used for house cusps. */
export function localSiderealTime(date: Date, longitudeEast: number) {
  const gast = Astronomy.SiderealTime(date); // sidereal hours at Greenwich
  return norm360(gast * 15 + longitudeEast);
}
