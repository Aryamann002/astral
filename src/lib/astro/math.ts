/** Angle helpers. Every longitude in this codebase lives in [0, 360). */

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export const sin = (deg: number) => Math.sin(deg * DEG);
export const cos = (deg: number) => Math.cos(deg * DEG);
export const tan = (deg: number) => Math.tan(deg * DEG);
export const asin = (x: number) => Math.asin(clamp(x, -1, 1)) * RAD;
export const atan2 = (y: number, x: number) => Math.atan2(y, x) * RAD;

export function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

/** Normalise to [0, 360). */
export function norm360(deg: number) {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/** Normalise to (-180, 180]. */
export function norm180(deg: number) {
  const d = norm360(deg);
  return d > 180 ? d - 360 : d;
}

/** Shortest angular separation, always 0..180. */
export function angularSeparation(a: number, b: number) {
  return Math.abs(norm180(a - b));
}

/** Signed difference a - b in (-180, 180]. */
export function angularDelta(a: number, b: number) {
  return norm180(a - b);
}

/** Distance travelled going counter-clockwise (increasing longitude) from a to b. */
export function forwardArc(from: number, to: number) {
  return norm360(to - from);
}

/** Mean obliquity of the ecliptic (IAU 2006 polynomial), degrees. */
export function meanObliquity(julianCenturiesTT: number) {
  const t = julianCenturiesTT;
  const seconds =
    84381.406 -
    46.836769 * t -
    0.0001831 * t * t +
    0.0020034 * t * t * t -
    0.000000576 * t * t * t * t -
    0.0000000434 * t * t * t * t * t;
  return seconds / 3600;
}

/** Julian day number for a JS Date (treated as UTC). */
export function julianDay(date: Date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Julian centuries since J2000.0. */
export function julianCenturies(date: Date) {
  return (julianDay(date) - 2451545.0) / 36525;
}

/** Split a longitude into sign index, degrees, arcminutes and arcseconds. */
export function splitLongitude(lon: number) {
  const l = norm360(lon);
  const signIndex = Math.floor(l / 30);
  const within = l - signIndex * 30;
  const degree = Math.floor(within);
  const minutesFloat = (within - degree) * 60;
  const minute = Math.floor(minutesFloat);
  const second = Math.round((minutesFloat - minute) * 60);
  if (second === 60)
    return { signIndex, degree, minute: minute + 1, second: 0 };
  return { signIndex, degree, minute, second };
}

export function roundTo(value: number, places: number) {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
