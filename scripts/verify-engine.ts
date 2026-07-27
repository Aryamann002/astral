/**
 * Sanity checks for the astrology engine, run with `npm run verify`.
 * Reference values are taken from published, AA-rated chart data.
 */

import { buildChart } from "../src/lib/astro/chart";
import { allPositions } from "../src/lib/astro/ephemeris";
import { computeAngles } from "../src/lib/astro/houses";
import { splitLongitude } from "../src/lib/astro/math";
import { SIGNS } from "../src/lib/astro/constants";

let failures = 0;

function fmt(lon: number) {
  const { signIndex, degree, minute } = splitLongitude(lon);
  return `${degree}° ${SIGNS[signIndex].name} ${String(minute).padStart(2, "0")}'`;
}

function check(
  label: string,
  actual: number,
  expected: number,
  toleranceDeg: number,
) {
  let diff = Math.abs(actual - expected) % 360;
  if (diff > 180) diff = 360 - diff;
  const ok = diff <= toleranceDeg;
  if (!ok) failures += 1;
  const arcmin = (diff * 60).toFixed(1);
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label.padEnd(34)} got ${fmt(actual).padEnd(22)} expected ${fmt(expected).padEnd(22)} Δ ${arcmin}'`,
  );
}

console.log("\n— J2000 epoch —");
// Mean longitude at J2000 is 280°27'.9; apparent longitude is that minus the
// equation of centre (-4'57" at M = 357°.53), aberration (-20".5) and nutation.
const j2000 = allPositions(new Date("2000-01-01T12:00:00Z"));
check("Sun at J2000 (apparent)", j2000.sun.longitude, 280.373, 0.02);

console.log(
  "\n— Albert Einstein, 14 Mar 1879, 11:30 LMT, Ulm (48°24'N 10°00'E) —",
);
// Ulm ran on local mean time in 1879: 10°E is 40 minutes ahead of UTC.
const einstein = buildChart({
  name: "Albert Einstein",
  utc: "1879-03-14T10:50:00Z",
  localDateTime: "1879-03-14 11:30",
  latitude: 48.4,
  longitude: 10.0,
  timezone: "LMT+00:40",
  offsetMinutes: 40,
  placeName: "Ulm, Germany",
  houseSystem: "placidus",
});

const e = einstein.byId;
check("Sun", e.sun.longitude, 353.5, 0.2); // 23°30' Pisces
check("Moon", e.moon.longitude, 254.5, 0.4); // 14°30' Sagittarius
check("Mercury", e.mercury.longitude, 3.15, 0.2); // 3°09' Aries
check("Venus", e.venus.longitude, 16.97, 0.2); // 16°58' Aries
check("Mars", e.mars.longitude, 296.92, 0.2); // 26°55' Capricorn
check("Jupiter", e.jupiter.longitude, 327.49, 0.2); // 27°30' Aquarius
check("Saturn", e.saturn.longitude, 4.23, 0.2); // 4°14' Aries
check("Uranus", e.uranus.longitude, 151.28, 0.2); // 1°17' Virgo
check("Neptune", e.neptune.longitude, 37.88, 0.2); // 7°53' Taurus
check("Pluto", e.pluto.longitude, 54.75, 0.2); // 24°45' Taurus
check("Ascendant", e.asc.longitude, 101.65, 0.4); // 11°39' Cancer
check("Midheaven", e.mc.longitude, 342.84, 0.4); // 12°50' Pisces

// A planet turns retrograde around its opposition to the Sun. Uranus at 1°
// Virgo opposes the Sun in late February, so mid-March is inside its
// retrograde window; Pluto at 24° Taurus opposes in November, so it is direct.
console.log(`\nUranus retrograde: ${e.uranus.retrograde} (expected true)`);
if (!e.uranus.retrograde) failures += 1;
console.log(`Pluto retrograde:  ${e.pluto.retrograde} (expected false)`);
if (e.pluto.retrograde) failures += 1;

console.log(
  "\n— Diana, Princess of Wales, 1 Jul 1961, 19:45 BST, Sandringham —",
);
// Independent AA-rated chart, and a modern date with a known DST offset.
const diana = buildChart({
  name: "Diana",
  utc: "1961-07-01T18:45:00Z",
  localDateTime: "1961-07-01 19:45",
  latitude: 52.83,
  longitude: 0.5,
  timezone: "Europe/London",
  offsetMinutes: 60,
  placeName: "Sandringham, England",
  houseSystem: "placidus",
});
const d = diana.byId;
check("Sun", d.sun.longitude, 99.67, 0.2); // 9°40' Cancer
check("Moon", d.moon.longitude, 325.03, 0.4); // 25°02' Aquarius
check("Mercury", d.mercury.longitude, 93.2, 0.2); // 3°12' Cancer
check("Venus", d.venus.longitude, 54.4, 0.2); // 24°24' Taurus
check("Mars", d.mars.longitude, 151.67, 0.2); // 1°40' Virgo
check("Jupiter", d.jupiter.longitude, 305.1, 0.2); // 5°06' Aquarius
check("Saturn", d.saturn.longitude, 297.82, 0.2); // 27°49' Capricorn
check("Uranus", d.uranus.longitude, 143.35, 0.2); // 23°21' Leo
check("Neptune", d.neptune.longitude, 218.63, 0.2); // 8°38' Scorpio
check("Pluto", d.pluto.longitude, 156.03, 0.2); // 6°02' Virgo
check("Ascendant", d.asc.longitude, 258.4, 0.4); // 18°24' Sagittarius
check("Midheaven", d.mc.longitude, 203.05, 0.4); // 23°03' Libra

console.log("\n— House cusp integrity —");
const cusps = einstein.houses.cusps;
console.log(`System: ${einstein.houses.system}`);
cusps.forEach((c, i) => {
  const next = cusps[(i + 1) % 12];
  const span = (((next - c) % 360) + 360) % 360;
  if (span <= 0 || span >= 180) {
    failures += 1;
    console.log(
      `FAIL  house ${i + 1} span ${span.toFixed(2)}° is out of range`,
    );
  }
});
console.log(`Cusps: ${cusps.map((c) => fmt(c)).join(" | ")}`);

console.log("\n— Opposing angles —");
const ascDsc = Math.abs(
  ((e.dsc.longitude - e.asc.longitude + 360) % 360) - 180,
);
if (ascDsc > 1e-6) failures += 1;
console.log(`${ascDsc < 1e-6 ? "PASS" : "FAIL"}  Asc/Dsc exactly opposed`);

console.log("\n— Polar fallback (Tromsø, 69.65°N) —");
const polar = computeAngles(new Date("1990-06-21T12:00:00Z"), 69.65, 18.96);
console.log(`Asc ${fmt(polar.asc)}, MC ${fmt(polar.mc)}`);
const polarChart = buildChart({
  name: "Polar",
  utc: "1990-06-21T12:00:00Z",
  localDateTime: "1990-06-21 14:00",
  latitude: 69.65,
  longitude: 18.96,
  timezone: "Europe/Oslo",
  offsetMinutes: 120,
  placeName: "Tromsø, Norway",
  houseSystem: "placidus",
});
console.log(
  `${polarChart.houses.fellBack ? "PASS" : "note"}  fell back to ${polarChart.houses.system}`,
);

console.log(
  `\n${failures === 0 ? "✓ all checks passed" : `✗ ${failures} check(s) failed`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
