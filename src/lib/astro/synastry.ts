/**
 * Synastry — comparing two charts.
 *
 * The score is a weighted sum over inter-chart aspects. It is a heuristic, not
 * a measurement, and the UI says so; the value is in the breakdown rather than
 * the single number.
 */

import {
  PLANET_MAP,
  pointName,
  type AspectId,
  type PointId,
} from "./constants";
import { findCrossAspects, type Aspect, type AspectPoint } from "./aspects";
import type { Chart } from "./chart";
import { angularSeparation } from "./math";

const COMPARED: PointId[] = [
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

export type Category = "romance" | "communication" | "trust" | "longevity";

export const CATEGORY_LABELS: Record<Category, string> = {
  romance: "Romance",
  communication: "Communication",
  trust: "Trust",
  longevity: "Longevity",
};

/** Which planet pairings speak to which dimension of a relationship. */
const CATEGORY_PAIRS: Record<Category, [PointId, PointId][]> = {
  romance: [
    ["venus", "mars"],
    ["sun", "venus"],
    ["moon", "venus"],
    ["venus", "venus"],
    ["mars", "mars"],
    ["venus", "asc"],
    ["sun", "moon"],
  ],
  communication: [
    ["mercury", "mercury"],
    ["mercury", "moon"],
    ["mercury", "venus"],
    ["mercury", "mars"],
    ["mercury", "jupiter"],
    ["mercury", "asc"],
  ],
  trust: [
    ["moon", "moon"],
    ["moon", "saturn"],
    ["sun", "saturn"],
    ["moon", "pluto"],
    ["venus", "saturn"],
    ["sun", "sun"],
  ],
  longevity: [
    ["saturn", "sun"],
    ["saturn", "moon"],
    ["saturn", "venus"],
    ["sun", "mc"],
    ["moon", "asc"],
    ["jupiter", "sun"],
    ["saturn", "saturn"],
  ],
};

const ASPECT_SCORE: Record<AspectId, number> = {
  conjunction: 1.0,
  trine: 0.9,
  sextile: 0.6,
  opposition: -0.15,
  square: -0.55,
  quincunx: -0.3,
  semisextile: 0.1,
  semisquare: -0.2,
  sesquiquadrate: -0.2,
};

/** Conjunctions to Saturn or Pluto are binding but not comfortable. */
const HEAVY: PointId[] = ["saturn", "pluto"];

export interface SynastryAspect extends Aspect {
  /** Which chart the first point belongs to. */
  from: "a" | "b";
  title: string;
  interpretation: string;
  score: number;
}

export interface Synastry {
  aspects: SynastryAspect[];
  strongest: SynastryAspect[];
  friction: SynastryAspect[];
  categories: Record<Category, number>;
  overall: number;
  headline: string;
  /** Sun-sign element comparison, the crude but familiar layer. */
  elementNote: string;
}

function pointsOf(chart: Chart): AspectPoint[] {
  return chart.placements
    .filter((p) => COMPARED.includes(p.id))
    .filter(
      (p) => !(chart.birth.timeUnknown && (p.id === "asc" || p.id === "mc")),
    )
    .map((p) => ({ id: p.id, longitude: p.longitude, speed: p.speed }));
}

function pairMatches(aspect: Aspect, pair: [PointId, PointId]) {
  const [x, y] = pair;
  return (
    (aspect.a === x && aspect.b === y) || (aspect.a === y && aspect.b === x)
  );
}

/** What each point contributes to a relationship, in the second person. */
const CONTRIBUTION: Partial<Record<PointId, string>> = {
  sun: "who they are trying to be",
  moon: "what they need in order to feel safe",
  mercury: "how they think and put things into words",
  venus: "what they find beautiful and how they show affection",
  mars: "what they want and how hard they go after it",
  jupiter: "where they are generous and where they overreach",
  saturn: "where they are serious, and where they withhold",
  uranus: "their need to be unpredictable",
  neptune: "what they idealise, and what they refuse to see clearly",
  pluto: "their appetite for control and depth",
  asc: "the way they come across before anyone knows them",
  mc: "their ambition and public direction",
};

function contribution(id: PointId) {
  return CONTRIBUTION[id] ?? pointName(id);
}

function describe(aspect: Aspect, nameA: string, nameB: string) {
  const a = pointName(aspect.a);
  const b = pointName(aspect.b);
  const whatA = contribution(aspect.a);
  const whatB = contribution(aspect.b);
  const heavy = HEAVY.includes(aspect.b) || HEAVY.includes(aspect.a);

  switch (aspect.aspect) {
    case "trine":
      return `${nameA}'s ${a} and ${nameB}'s ${b} run in the same direction: ${whatA} sits comfortably alongside ${whatB}. It costs neither of you any effort, which also means you may never think to use it.`;

    case "sextile":
      return `${nameB}'s ${b} gives ${nameA}'s ${a} an opening — ${whatB} makes room for ${whatA}. Available rather than automatic; it works when one of you reaches.`;

    case "conjunction":
      return heavy
        ? `${nameA}'s ${a} lands squarely on ${nameB}'s ${b}. ${capitalise(whatA)} fuses with ${whatB}, and there is no diluting it. Binding and consequential rather than easy.`
        : `${nameA}'s ${a} sits directly on ${nameB}'s ${b} — ${whatA} and ${whatB} become one motion. Immediate recognition; neither of you gets to be neutral about it.`;

    case "opposition":
      return `${nameA}'s ${a} faces ${nameB}'s ${b} across the chart. ${capitalise(whatA)} keeps meeting ${whatB} at the far end of the same axis — real attraction, and each of you carrying something the other has disowned.`;

    case "square":
      return `${nameA}'s ${a} cuts across ${nameB}'s ${b}: ${whatA} keeps colliding with ${whatB}. The argument will always be about the same thing, and it is workable exactly to the degree that you can name it.`;

    case "quincunx":
      return `${nameA}'s ${a} and ${nameB}'s ${b} have no shared language — ${whatA} and ${whatB} never quite translate. You will keep adjusting rather than resolving.`;

    default:
      return `${nameA}'s ${a} and ${nameB}'s ${b} rub against each other in a minor key: ${whatA} slightly irritates ${whatB}. Low-grade, persistent, rarely the main event.`;
  }
}

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function computeSynastry(a: Chart, b: Chart): Synastry {
  const nameA = a.birth.name?.split(" ")[0] || "Person A";
  const nameB = b.birth.name?.split(" ")[0] || "Person B";

  const raw = findCrossAspects(pointsOf(a), pointsOf(b), { majorOnly: false });

  const aspects: SynastryAspect[] = raw.map((aspect) => ({
    ...aspect,
    from: "a",
    title: `${nameA}'s ${pointName(aspect.a)} ${aspect.info.name.toLowerCase()} ${nameB}'s ${pointName(aspect.b)}`,
    interpretation: describe(aspect, nameA, nameB),
    score:
      ASPECT_SCORE[aspect.aspect] *
      aspect.strength *
      weightOf(aspect.a, aspect.b),
  }));

  const categories = {} as Record<Category, number>;
  for (const category of Object.keys(CATEGORY_PAIRS) as Category[]) {
    const pairs = CATEGORY_PAIRS[category];
    const relevant = aspects.filter((asp) =>
      pairs.some((p) => pairMatches(asp, p)),
    );
    if (relevant.length === 0) {
      categories[category] = 50;
      continue;
    }
    const sum = relevant.reduce((acc, asp) => acc + asp.score, 0);
    const maxPossible = relevant.length * 1.2;
    // Map roughly -max..+max onto 15..95 so a blank comparison sits mid-scale.
    const normalised = 55 + (sum / Math.max(maxPossible, 1)) * 90;
    categories[category] = Math.round(Math.min(96, Math.max(14, normalised)));
  }

  const overall = Math.round(
    categories.romance * 0.3 +
      categories.communication * 0.25 +
      categories.trust * 0.25 +
      categories.longevity * 0.2,
  );

  const strongest = aspects
    .filter((asp) => asp.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 5);

  const friction = aspects
    .filter((asp) => asp.score < 0)
    .sort((x, y) => x.score - y.score)
    .slice(0, 4);

  const sunA = a.byId.sun.sign;
  const sunB = b.byId.sun.sign;
  const elementNote =
    sunA.element === sunB.element
      ? `Two ${sunA.element} Suns — you recognise each other's pace immediately, which is comfortable and occasionally means nobody is steering.`
      : compatibleElements(sunA.element, sunB.element)
        ? `${capitalise(sunA.element)} and ${sunB.element} Suns get along by temperament; you tend to amplify rather than dampen each other.`
        : `${capitalise(sunA.element)} and ${sunB.element} Suns run at different speeds. Not a problem, but it does mean neither of you should assume the other's silence means the same thing yours does.`;

  const headline =
    overall >= 78
      ? "Unusually well-matched, with enough friction to stay interesting."
      : overall >= 62
        ? "A workable, warm connection that rewards effort where it's rough."
        : overall >= 46
          ? "Real attraction and real work. The difficult contacts here are load-bearing."
          : "Demanding. The pull is genuine but very little of this will run on autopilot.";

  return {
    aspects,
    strongest,
    friction,
    categories,
    overall,
    headline,
    elementNote,
  };
}

function weightOf(a: PointId, b: PointId) {
  const personal: PointId[] = ["sun", "moon", "venus", "mars", "asc"];
  const both = personal.includes(a) && personal.includes(b);
  const either = personal.includes(a) || personal.includes(b);
  return both ? 1.2 : either ? 0.9 : 0.5;
}

function compatibleElements(x: string, y: string) {
  const warm = new Set(["fire", "air"]);
  const cool = new Set(["earth", "water"]);
  return (warm.has(x) && warm.has(y)) || (cool.has(x) && cool.has(y));
}

/**
 * Composite chart by the midpoint method: each pair of planets is replaced by
 * the nearer midpoint of their two longitudes.
 */
export function compositeMidpoints(a: Chart, b: Chart) {
  return COMPARED.map((id) => {
    const pa = a.byId[id];
    const pb = b.byId[id];
    if (!pa || !pb) return null;
    const separation = angularSeparation(pa.longitude, pb.longitude);
    let mid = (pa.longitude + pb.longitude) / 2;
    // If the two are more than 180° apart the naive mean lands opposite.
    if (Math.abs(pa.longitude - pb.longitude) > 180) mid = (mid + 180) % 360;
    return {
      id,
      name: PLANET_MAP[id as keyof typeof PLANET_MAP]?.name ?? pointName(id),
      longitude: (mid + 360) % 360,
      separation,
    };
  }).filter(Boolean);
}
