/** Assembles a complete natal chart from birth data. */

import {
  EXALTATIONS,
  FALLS,
  HOUSES,
  PLANET_MAP,
  RULERSHIPS,
  SIGNS,
  type Element,
  type HouseSystem,
  type Modality,
  type PlanetId,
  type PointId,
  type SignInfo,
  pointGlyph,
  pointName,
} from "./constants";
import { allPositions, moonPhase, type MoonPhase } from "./ephemeris";
import { computeHouses, houseOf, type Houses } from "./houses";
import { findAspects, type Aspect, type AspectPoint } from "./aspects";
import { norm360, splitLongitude } from "./math";

export interface BirthData {
  name: string;
  /** ISO instant of birth in UTC. */
  utc: string;
  /** Local wall-clock date/time as entered, for display. */
  localDateTime: string;
  latitude: number;
  /** East-positive. */
  longitude: number;
  timezone: string;
  /** UTC offset in minutes at the moment of birth. */
  offsetMinutes: number;
  placeName: string;
  /** Set when the user did not know their birth time; angles become unreliable. */
  timeUnknown?: boolean;
  houseSystem?: HouseSystem;
}

export type Dignity = "domicile" | "exaltation" | "detriment" | "fall" | null;

export interface Placement {
  id: PointId;
  name: string;
  glyph: string;
  longitude: number;
  latitude: number;
  speed: number;
  retrograde: boolean;
  sign: SignInfo;
  /** Degree within the sign, 0..29. */
  degree: number;
  minute: number;
  /** Formatted as `14° ♌ 27'`. */
  display: string;
  house: number;
  dignity: Dignity;
  isAngle: boolean;
}

export interface ElementBalance {
  fire: number;
  earth: number;
  air: number;
  water: number;
}

export interface ModalityBalance {
  cardinal: number;
  fixed: number;
  mutable: number;
}

export interface Chart {
  birth: BirthData;
  houses: Houses;
  placements: Placement[];
  byId: Record<string, Placement>;
  aspects: Aspect[];
  moon: MoonPhase;
  elements: ElementBalance;
  modalities: ModalityBalance;
  /** Sect: a day chart has the Sun above the horizon. */
  isDayChart: boolean;
  dominantSign: SignInfo;
  chartRuler: Placement | null;
  stelliums: { sign: SignInfo; planets: PointId[] }[];
}

/** Bodies drawn on the wheel, in the order they appear in listings. */
const CHART_BODIES: PlanetId[] = [
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
  "southNode",
  "lilith",
];

function dignityOf(id: PointId, signIndex: number): Dignity {
  const planet = id as PlanetId;
  if (RULERSHIPS[planet]?.includes(signIndex)) return "domicile";
  if (EXALTATIONS[planet] === signIndex) return "exaltation";
  if (FALLS[planet] === signIndex) return "fall";
  const opposite = (signIndex + 6) % 12;
  if (RULERSHIPS[planet]?.includes(opposite)) return "detriment";
  return null;
}

function makePlacement(
  id: PointId,
  longitude: number,
  opts: { latitude?: number; speed?: number; house: number; isAngle?: boolean },
): Placement {
  const { signIndex, degree, minute } = splitLongitude(longitude);
  const sign = SIGNS[signIndex];
  const speed = opts.speed ?? 0;
  return {
    id,
    name: pointName(id),
    glyph: pointGlyph(id),
    longitude: norm360(longitude),
    latitude: opts.latitude ?? 0,
    speed,
    retrograde: speed < 0,
    sign,
    degree,
    minute,
    display: `${degree}° ${sign.glyph} ${String(minute).padStart(2, "0")}'`,
    house: opts.house,
    dignity: opts.isAngle ? null : dignityOf(id, signIndex),
    isAngle: opts.isAngle ?? false,
  };
}

/**
 * Part of Fortune. The sect-sensitive formula is used: by day the Moon is
 * measured from the Sun, by night the reverse, which keeps the point on the
 * same side of the horizon as the Ascendant's ruler.
 */
function partOfFortune(asc: number, sun: number, moon: number, isDay: boolean) {
  return norm360(isDay ? asc + moon - sun : asc + sun - moon);
}

export function buildChart(birth: BirthData): Chart {
  const date = new Date(birth.utc);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid birth instant");

  const system: HouseSystem = birth.houseSystem ?? "placidus";
  const houses = computeHouses(date, birth.latitude, birth.longitude, system);
  const positions = allPositions(date);
  const cusps = houses.cusps;

  const placements: Placement[] = CHART_BODIES.map((id) => {
    const p = positions[id];
    return makePlacement(id, p.longitude, {
      latitude: p.latitude,
      speed: p.speed,
      house: houseOf(p.longitude, cusps),
    });
  });

  const sunLon = positions.sun.longitude;
  const moonLon = positions.moon.longitude;
  const sunHouse = houseOf(sunLon, cusps);
  // Houses 7-12 sit above the horizon.
  const isDayChart = sunHouse >= 7;

  const angles: [PointId, number][] = [
    ["asc", houses.angles.asc],
    ["mc", houses.angles.mc],
    ["dsc", houses.angles.dsc],
    ["ic", houses.angles.ic],
  ];
  for (const [id, longitude] of angles) {
    placements.push(
      makePlacement(id, longitude, {
        house: id === "asc" ? 1 : id === "ic" ? 4 : id === "dsc" ? 7 : 10,
        isAngle: true,
      }),
    );
  }

  const fortune = partOfFortune(houses.angles.asc, sunLon, moonLon, isDayChart);
  placements.push(
    makePlacement("fortune", fortune, {
      house: houseOf(fortune, cusps),
      isAngle: true,
    }),
  );

  const byId: Record<string, Placement> = Object.fromEntries(
    placements.map((p) => [p.id, p]),
  );

  const aspectPoints: AspectPoint[] = placements
    .filter((p) => p.id !== "dsc" && p.id !== "ic" && p.id !== "fortune")
    .map((p) => ({ id: p.id, longitude: p.longitude, speed: p.speed }));

  const aspects = findAspects(aspectPoints, {
    ignorePairsWithin: birth.timeUnknown ? ["asc", "mc"] : [],
  });

  const elements: ElementBalance = { fire: 0, earth: 0, air: 0, water: 0 };
  const modalities: ModalityBalance = { cardinal: 0, fixed: 0, mutable: 0 };
  const signTally = new Map<number, PointId[]>();

  // Weighted so the luminaries and the Ascendant actually count for something.
  const weight = (id: PointId): number => {
    if (id === "sun" || id === "moon") return 3;
    if (id === "asc") return 3;
    if (id === "mercury" || id === "venus" || id === "mars") return 2;
    if (id === "mc") return 2;
    if (id === "jupiter" || id === "saturn") return 1.5;
    if (id === "uranus" || id === "neptune" || id === "pluto") return 1;
    return 0;
  };

  for (const p of placements) {
    const w = weight(p.id);
    if (w > 0) {
      elements[p.sign.element as Element] += w;
      modalities[p.sign.modality as Modality] += w;
    }
    if (!p.isAngle && p.id !== "southNode" && p.id !== "lilith") {
      const list = signTally.get(p.sign.index) ?? [];
      list.push(p.id);
      signTally.set(p.sign.index, list);
    }
  }

  const stelliums = [...signTally.entries()]
    .filter(([, list]) => list.length >= 3)
    .map(([index, list]) => ({ sign: SIGNS[index], planets: list }));

  const dominantSign = [...signTally.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )[0];

  const ascSignIndex = byId.asc ? byId.asc.sign.index : 0;
  const rulerId = SIGNS[ascSignIndex].ruler;
  const chartRuler = byId[rulerId] ?? null;

  return {
    birth,
    houses,
    placements,
    byId,
    aspects,
    moon: moonPhase(date),
    elements,
    modalities,
    isDayChart,
    dominantSign: SIGNS[dominantSign?.[0] ?? byId.sun.sign.index],
    chartRuler,
    stelliums,
  };
}

/** Planets grouped by the house they occupy, for the house-by-house readout. */
export function placementsByHouse(chart: Chart) {
  return HOUSES.map((house) => ({
    house,
    cusp: chart.houses.cusps[house.number - 1],
    cuspSign: SIGNS[Math.floor(chart.houses.cusps[house.number - 1] / 30)],
    planets: chart.placements.filter(
      (p) => !p.isAngle && p.house === house.number && p.id !== "southNode",
    ),
  }));
}

/** A one-line factual summary handed to the AI astrologer as context. */
export function chartSummary(chart: Chart): string {
  const line = (p: Placement) =>
    `${p.name} ${p.display.replace(/\s+/g, " ")} (house ${p.house}${p.retrograde ? ", retrograde" : ""})`;

  const bodies = chart.placements
    .filter((p) => !p.isAngle)
    .map(line)
    .join("; ");

  const angleLine = ["asc", "mc"]
    .map((id) => chart.byId[id])
    .filter(Boolean)
    .map((p) => `${p.name} ${p.display}`)
    .join("; ");

  const topAspects = chart.aspects
    .slice(0, 14)
    .map(
      (a) =>
        `${pointName(a.a)} ${a.info.name.toLowerCase()} ${pointName(a.b)} (orb ${a.orb.toFixed(1)}°)`,
    )
    .join("; ");

  const balance = `Elements — fire ${chart.elements.fire}, earth ${chart.elements.earth}, air ${chart.elements.air}, water ${chart.elements.water}. Modalities — cardinal ${chart.modalities.cardinal}, fixed ${chart.modalities.fixed}, mutable ${chart.modalities.mutable}.`;

  return [
    `Name: ${chart.birth.name || "the querent"}.`,
    `Born ${chart.birth.localDateTime} (${chart.birth.timezone}) at ${chart.birth.placeName}.`,
    `House system: ${chart.houses.system}. ${chart.isDayChart ? "Day" : "Night"} chart.`,
    `Angles: ${angleLine}.`,
    `Placements: ${bodies}.`,
    `Major aspects: ${topAspects}.`,
    balance,
    chart.stelliums.length
      ? `Stellium in ${chart.stelliums.map((s) => s.sign.name).join(", ")}.`
      : "",
    chart.chartRuler
      ? `Chart ruler ${chart.chartRuler.name} in ${chart.chartRuler.sign.name}, house ${chart.chartRuler.house}.`
      : "",
    chart.birth.timeUnknown
      ? "NOTE: birth time is unknown, so houses and the Ascendant are approximate and should not be leaned on."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export { PLANET_MAP, SIGNS, HOUSES };
