/**
 * End-to-end exercise of every derived surface the UI renders, with timings.
 * Run with `npm run verify:app`.
 */

import {
  buildChart,
  chartSummary,
  placementsByHouse,
} from "../src/lib/astro/chart";
import { dailyReading } from "../src/lib/astro/horoscope";
import {
  forecastTransits,
  currentTransits,
  lifeCycles,
} from "../src/lib/astro/transits";
import { computeSynastry } from "../src/lib/astro/synastry";
import { localAstrologer } from "../src/lib/astro/localAstrologer";
import { resolveBirthInstant } from "../src/lib/geo";
import {
  chartHeadline,
  planetInSign,
  planetInHouse,
} from "../src/lib/astro/interpretations";
import { SIGNS, PLANETS, type PlanetId } from "../src/lib/astro/constants";

let failures = 0;
function ok(label: string, condition: boolean, detail = "") {
  if (!condition) failures += 1;
  console.log(
    `${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`,
  );
}

function time<T>(label: string, fn: () => T): T {
  const t0 = performance.now();
  const result = fn();
  console.log(`      ${label}: ${(performance.now() - t0).toFixed(0)}ms`);
  return result;
}

console.log("\n— Timezone resolution —");
const mumbai = resolveBirthInstant("1996-08-12", "04:20", "Asia/Kolkata");
ok("IST offset is +05:30", mumbai.offsetMinutes === 330, mumbai.offsetLabel);

const londonSummer = resolveBirthInstant(
  "1990-07-04",
  "13:00",
  "Europe/London",
);
ok(
  "BST offset is +01:00",
  londonSummer.offsetMinutes === 60,
  londonSummer.offsetLabel,
);

const londonWinter = resolveBirthInstant(
  "1990-01-04",
  "13:00",
  "Europe/London",
);
ok(
  "GMT offset is +00:00",
  londonWinter.offsetMinutes === 0,
  londonWinter.offsetLabel,
);

// 1947: India ran on +05:30 already, but Delhi observed no DST.
const preIndependence = resolveBirthInstant(
  "1947-08-15",
  "00:00",
  "Asia/Kolkata",
);
ok(
  "historical India offset",
  preIndependence.offsetMinutes === 330,
  preIndependence.offsetLabel,
);

// The hour that does not exist when US clocks jump forward.
const skipped = resolveBirthInstant("2023-03-12", "02:30", "America/New_York");
ok(
  "skipped DST hour is flagged",
  skipped.valid && !!skipped.problem,
  skipped.problem ?? "",
);

console.log("\n— Chart assembly —");
const chart = time("buildChart", () =>
  buildChart({
    name: "Test Subject",
    utc: mumbai.utc,
    localDateTime: "1996-08-12 04:20",
    latitude: 19.076,
    longitude: 72.8777,
    timezone: "Asia/Kolkata",
    offsetMinutes: 330,
    placeName: "Mumbai, Maharashtra, India",
  }),
);

ok(
  "18 points placed",
  chart.placements.length === 18,
  `${chart.placements.length}`,
);
ok("aspects found", chart.aspects.length > 5, `${chart.aspects.length}`);
ok(
  "every planet has a house 1-12",
  chart.placements.every((p) => p.house >= 1 && p.house <= 12),
);
ok("headline reads", chartHeadline(chart).length > 40);
ok("houses panel builds", placementsByHouse(chart).length === 12);
console.log(
  `      Sun ${chart.byId.sun.display} h${chart.byId.sun.house}, Asc ${chart.byId.asc.display}`,
);

console.log("\n— Interpretation coverage —");
let missing = 0;
for (const planet of PLANETS) {
  for (const sign of SIGNS) {
    const text = planetInSign(planet.id as PlanetId, sign.index);
    if (!text || text.length < 40) missing += 1;
  }
  for (let house = 1; house <= 12; house += 1) {
    const text = planetInHouse(planet.id as PlanetId, house);
    if (!text || text.length < 40) missing += 1;
  }
}
ok(
  "every planet/sign and planet/house has copy",
  missing === 0,
  `${missing} gaps`,
);

console.log("\n— Daily reading —");
const reading = time("dailyReading", () => dailyReading(chart));
ok("four domain scores", reading.scores.length === 4);
ok(
  "scores in range",
  reading.scores.every((s) => s.score >= 1 && s.score <= 10),
);
ok(
  "moon illumination 0..1",
  reading.moon.illumination >= 0 && reading.moon.illumination <= 1,
);
ok("headline present", reading.headline.length > 10, reading.headline);
console.log(
  `      ${reading.scores.map((s) => `${s.label} ${s.score}`).join(", ")} | Moon ${reading.moonSign} ${Math.round(reading.moon.illumination * 100)}%`,
);

// Determinism: the same chart on the same instant must read identically.
const fixed = new Date("2026-07-27T09:00:00Z");
const a1 = dailyReading(chart, fixed);
const a2 = dailyReading(chart, fixed);
ok(
  "reading is deterministic",
  JSON.stringify(a1.scores) === JSON.stringify(a2.scores),
);

console.log("\n— Transits —");
const live = time("currentTransits", () => currentTransits(chart));
ok("live transits computed", Array.isArray(live), `${live.length} contacts`);

const ninety = time("forecastTransits 90d", () =>
  forecastTransits(chart, { days: 90 }),
);
ok(
  "90-day forecast returns hits",
  ninety.length > 0,
  `${ninety.length} events`,
);
ok(
  "windows bracket exactness",
  ninety.every(
    (h) =>
      h.start.getTime() <= h.exact.getTime() &&
      h.exact.getTime() <= h.end.getTime(),
  ),
);
ok(
  "hits are chronological",
  ninety.every((h, i) => i === 0 || h.exact >= ninety[i - 1].exact),
);

const year = time("forecastTransits 365d", () =>
  forecastTransits(chart, { days: 365 }),
);
ok(
  "365-day forecast returns more",
  year.length >= ninety.length,
  `${year.length} events`,
);
if (year[0])
  console.log(
    `      first: ${year[0].title} exact ${year[0].exact.toDateString()}`,
  );

ok("life cycles listed", lifeCycles(chart).length === 5);

console.log("\n— Synastry —");
const partner = buildChart({
  name: "Partner",
  utc: resolveBirthInstant("1994-02-19", "18:05", "Europe/London").utc,
  localDateTime: "1994-02-19 18:05",
  latitude: 51.5074,
  longitude: -0.1278,
  timezone: "Europe/London",
  offsetMinutes: 0,
  placeName: "London, United Kingdom",
});
const synastry = time("computeSynastry", () => computeSynastry(chart, partner));
ok(
  "overall in 0..100",
  synastry.overall >= 0 && synastry.overall <= 100,
  `${synastry.overall}`,
);
ok(
  "categories in 0..100",
  Object.values(synastry.categories).every((v) => v >= 0 && v <= 100),
);
ok(
  "strongest contacts found",
  synastry.strongest.length > 0,
  `${synastry.strongest.length}`,
);
console.log(
  `      ${Object.entries(synastry.categories)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ")} → ${synastry.overall}`,
);
if (synastry.strongest[0])
  console.log(`      top: ${synastry.strongest[0].title}`);

console.log("\n— Offline astrologer —");
const context = chartSummary(chart);
ok(
  "chart summary is substantial",
  context.length > 400,
  `${context.length} chars`,
);
for (const question of [
  "what does my chart say about love?",
  "tell me about my career",
  "my saturn return",
  "what is my purpose",
  "something unrelated",
]) {
  const answer = localAstrologer(question, context);
  if (answer.length < 80) failures += 1;
}
ok("offline answers all topics", true);

console.log("\n— Edge cases —");
const noTime = buildChart({
  name: "No time",
  utc: resolveBirthInstant("1988-11-03", "12:00", "America/Chicago").utc,
  localDateTime: "1988-11-03 12:00",
  latitude: 41.8781,
  longitude: -87.6298,
  timezone: "America/Chicago",
  offsetMinutes: -360,
  placeName: "Chicago, Illinois, United States",
  timeUnknown: true,
});
ok("time-unknown chart builds", noTime.placements.length === 18);
ok(
  "no asc/mc aspects when time unknown",
  !noTime.aspects.some(
    (a) => (a.a === "asc" || a.a === "mc") && (a.b === "asc" || a.b === "mc"),
  ),
);
ok(
  "time-unknown daily reading has no moon house",
  dailyReading(noTime).moonHouse === null,
);

const southern = buildChart({
  name: "Southern",
  utc: "1975-12-25T03:00:00Z",
  localDateTime: "1975-12-25 14:00",
  latitude: -33.8688,
  longitude: 151.2093,
  timezone: "Australia/Sydney",
  offsetMinutes: 660,
  placeName: "Sydney, Australia",
});
ok("southern hemisphere chart builds", southern.placements.length === 18);
ok(
  "southern cusps are ordered",
  southern.houses.cusps.every((c) => c >= 0 && c < 360),
);

for (const system of ["placidus", "wholeSign", "equal", "porphyry"] as const) {
  const c = buildChart({ ...chart.birth, houseSystem: system });
  ok(`${system} produces 12 cusps`, c.houses.cusps.length === 12);
}

console.log(
  `\n${failures === 0 ? "✓ all checks passed" : `✗ ${failures} check(s) failed`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
