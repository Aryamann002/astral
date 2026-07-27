/**
 * House cusps and chart angles.
 *
 * Placidus is the default because it is what most Western charts use, but it
 * is undefined inside the polar circles — beyond roughly 66° latitude the
 * required semi-arcs stop existing. We detect that and fall back to Porphyry
 * rather than emitting nonsense.
 */

import {
  asin,
  atan2,
  cos,
  julianCenturies,
  meanObliquity,
  norm360,
  sin,
  tan,
} from "./math";
import type { HouseSystem } from "./constants";
import { localSiderealTime } from "./ephemeris";

export interface Angles {
  asc: number;
  mc: number;
  dsc: number;
  ic: number;
  /** Right ascension of the midheaven, degrees. */
  ramc: number;
  obliquity: number;
}

export interface Houses {
  system: HouseSystem;
  /** Twelve cusp longitudes, index 0 = 1st house cusp. */
  cusps: number[];
  angles: Angles;
  /** True when the requested system was unavailable and we substituted. */
  fellBack: boolean;
}

/** Ecliptic longitude of the point on the ecliptic with the given RA. */
function longitudeFromRightAscension(ra: number, obliquity: number) {
  return norm360(atan2(sin(ra), cos(ra) * cos(obliquity)));
}

export function computeAngles(
  date: Date,
  latitude: number,
  longitudeEast: number,
): Angles {
  const obliquity = meanObliquity(julianCenturies(date));
  const ramc = localSiderealTime(date, longitudeEast);

  const mc = longitudeFromRightAscension(ramc, obliquity);
  const asc = norm360(
    atan2(
      cos(ramc),
      -(sin(ramc) * cos(obliquity) + tan(latitude) * sin(obliquity)),
    ),
  );

  return {
    asc,
    mc,
    dsc: norm360(asc + 180),
    ic: norm360(mc + 180),
    ramc,
    obliquity,
  };
}

/**
 * One Placidus intermediate cusp by fixed-point iteration.
 *
 * A cusp is the ecliptic point whose diurnal (or nocturnal) semi-arc, measured
 * from the meridian, has been divided in the ratio implied by the house. Since
 * the semi-arc depends on the declination of the point we are solving for, we
 * iterate: guess a right ascension, read off the declination, recompute.
 */
function placidusCusp(
  ramc: number,
  latitude: number,
  obliquity: number,
  house: 11 | 12 | 2 | 3,
): number | null {
  const initialOffset = { 11: 30, 12: 60, 2: 120, 3: 150 }[house];
  let ra = norm360(ramc + initialOffset);

  for (let i = 0; i < 60; i += 1) {
    const lon = longitudeFromRightAscension(ra, obliquity);
    const declination = asin(sin(obliquity) * sin(lon));
    const adSin = tan(latitude) * tan(declination);
    // |sin(AD)| > 1 means the point never rises or never sets here.
    if (Math.abs(adSin) >= 1) return null;
    const ad = asin(adSin);
    const diurnal = 90 + ad;
    const nocturnal = 90 - ad;

    let next: number;
    switch (house) {
      case 11:
        next = ramc + diurnal / 3;
        break;
      case 12:
        next = ramc + (2 * diurnal) / 3;
        break;
      case 2:
        next = ramc + 180 - (2 * nocturnal) / 3;
        break;
      case 3:
        next = ramc + 180 - nocturnal / 3;
        break;
    }
    next = norm360(next);

    const converged = Math.abs(norm360(next - ra + 180) - 180) < 1e-9;
    ra = next;
    if (converged) break;
  }

  return longitudeFromRightAscension(ra, obliquity);
}

function porphyryCusps(angles: Angles): number[] {
  const { asc, mc, dsc, ic } = angles;
  // Each quadrant between an angle pair is trisected along the ecliptic.
  const q1 = norm360(ic - asc) / 3; // asc -> ic  (houses 1,2,3)
  const q2 = norm360(dsc - ic) / 3; // ic  -> dsc (houses 4,5,6)
  const q3 = norm360(mc - dsc) / 3; // dsc -> mc  (houses 7,8,9)
  const q4 = norm360(asc - mc) / 3; // mc  -> asc (houses 10,11,12)
  return [
    asc,
    norm360(asc + q1),
    norm360(asc + 2 * q1),
    ic,
    norm360(ic + q2),
    norm360(ic + 2 * q2),
    dsc,
    norm360(dsc + q3),
    norm360(dsc + 2 * q3),
    mc,
    norm360(mc + q4),
    norm360(mc + 2 * q4),
  ];
}

export function computeHouses(
  date: Date,
  latitude: number,
  longitudeEast: number,
  system: HouseSystem = "placidus",
): Houses {
  const angles = computeAngles(date, latitude, longitudeEast);
  const { asc, mc, ic, dsc, ramc, obliquity } = angles;

  if (system === "wholeSign") {
    const start = Math.floor(asc / 30) * 30;
    return {
      system,
      cusps: Array.from({ length: 12 }, (_, i) => norm360(start + i * 30)),
      angles,
      fellBack: false,
    };
  }

  if (system === "equal") {
    return {
      system,
      cusps: Array.from({ length: 12 }, (_, i) => norm360(asc + i * 30)),
      angles,
      fellBack: false,
    };
  }

  if (system === "porphyry") {
    return { system, cusps: porphyryCusps(angles), angles, fellBack: false };
  }

  const c11 = placidusCusp(ramc, latitude, obliquity, 11);
  const c12 = placidusCusp(ramc, latitude, obliquity, 12);
  const c2 = placidusCusp(ramc, latitude, obliquity, 2);
  const c3 = placidusCusp(ramc, latitude, obliquity, 3);

  if (c11 === null || c12 === null || c2 === null || c3 === null) {
    return {
      system: "porphyry",
      cusps: porphyryCusps(angles),
      angles,
      fellBack: true,
    };
  }

  const cusps = [
    asc,
    c2,
    c3,
    ic,
    norm360(c11 + 180),
    norm360(c12 + 180),
    dsc,
    norm360(c2 + 180),
    norm360(c3 + 180),
    mc,
    c11,
    c12,
  ];

  return { system: "placidus", cusps, angles, fellBack: false };
}

/** Which house (1-12) a longitude falls in, given the cusps. */
export function houseOf(longitude: number, cusps: number[]): number {
  const lon = norm360(longitude);
  for (let i = 0; i < 12; i += 1) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    const span = norm360(end - start);
    const offset = norm360(lon - start);
    // A zero-width span would mean degenerate cusps; treat as a full circle.
    if (offset < (span === 0 ? 360 : span)) return i + 1;
  }
  return 12;
}
