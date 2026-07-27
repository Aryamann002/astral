/**
 * The daily reading.
 *
 * Every number here is derived from the actual transits of the day rather than
 * randomised — the same chart on the same date always produces the same
 * reading, and a quiet sky produces a quiet reading.
 */

import {
  PLANET_MAP,
  pointName,
  type PlanetId,
  type PointId,
} from "./constants";
import { bodyPosition, moonPhase, type MoonPhase } from "./ephemeris";
import { houseOf } from "./houses";
import { splitLongitude } from "./math";
import { SIGNS } from "./constants";
import type { Chart } from "./chart";
import { currentTransits } from "./transits";
import type { Aspect } from "./aspects";

export type Domain = "love" | "career" | "energy" | "clarity";

export const DOMAIN_LABELS: Record<Domain, string> = {
  love: "Love",
  career: "Career",
  energy: "Energy",
  clarity: "Clarity",
};

/** Which transiting bodies bear on which area of life. */
const DOMAIN_RULERS: Record<Domain, PlanetId[]> = {
  love: ["venus", "moon", "mars"],
  career: ["sun", "saturn", "jupiter", "mars"],
  energy: ["mars", "sun", "moon"],
  clarity: ["mercury", "sun", "uranus"],
};

/** Natal points that count as "the area of life" for each domain. */
const DOMAIN_TARGETS: Record<Domain, PointId[]> = {
  love: ["venus", "moon", "sun", "asc"],
  career: ["mc", "sun", "saturn", "jupiter"],
  energy: ["mars", "sun", "asc"],
  clarity: ["mercury", "moon", "sun"],
};

export interface DomainScore {
  domain: Domain;
  label: string;
  /** 1..10. */
  score: number;
  note: string;
}

export interface DailyAspectLine {
  aspect: Aspect;
  title: string;
  orbLabel: string;
  meaning: string;
  applying: boolean;
}

export interface DailyReading {
  date: string;
  headline: string;
  body: string;
  moon: MoonPhase;
  moonSign: string;
  moonSignGlyph: string;
  /** Which of the querent's houses the transiting Moon is passing through. */
  moonHouse: number | null;
  scores: DomainScore[];
  aspects: DailyAspectLine[];
  advice: string;
  retrogrades: { name: string; glyph: string }[];
}

function orbLabel(orb: number) {
  const d = Math.floor(orb);
  const m = Math.round((orb - d) * 60);
  return m === 60 ? `${d + 1}°00'` : `${d}°${String(m).padStart(2, "0")}'`;
}

function scoreDomain(domain: Domain, transits: Aspect[]): number {
  const rulers = DOMAIN_RULERS[domain];
  const targets = DOMAIN_TARGETS[domain];

  let total = 0;
  let weightSum = 0;

  for (const t of transits) {
    const transiting = t.a as PlanetId;
    const natal = t.b;
    const rulerHit = rulers.includes(transiting);
    const targetHit = targets.includes(natal);
    if (!rulerHit && !targetHit) continue;

    const relevance = (rulerHit ? 1 : 0.5) * (targetHit ? 1 : 0.5);
    const polarity =
      t.info.nature === "harmonious"
        ? 1
        : t.info.nature === "challenging"
          ? -1
          : 0.35;
    const weight = relevance * t.strength;

    total += polarity * weight;
    weightSum += weight;
  }

  if (weightSum === 0) return 6;
  // A perfectly balanced sky lands on 6; strong support reaches 10.
  const normalised = 6 + (total / weightSum) * 4;
  return Math.round(Math.min(10, Math.max(1, normalised)));
}

const DOMAIN_NOTES: Record<Domain, [string, string, string]> = {
  love: [
    "Hold off on the difficult conversation if it can wait a day.",
    "Steady. Nothing demanding attention, which is its own kind of good.",
    "Unusually open. Say the thing you've been circling.",
  ],
  career: [
    "Push back on deadlines rather than absorbing them silently.",
    "Ordinary progress. Consistency beats brilliance today.",
    "Visible and well-supported. Ask for the thing.",
  ],
  energy: [
    "Lower the target. Rest is the productive choice.",
    "Enough in the tank for what's already scheduled.",
    "Physically strong. Spend it on something that matters.",
  ],
  clarity: [
    "Don't sign anything. Re-read what you send.",
    "Thinking is functional if unremarkable.",
    "Sharp. Good day for the decision you've been deferring.",
  ],
};

function noteFor(domain: Domain, score: number) {
  const notes = DOMAIN_NOTES[domain];
  if (score <= 4) return notes[0];
  if (score <= 7) return notes[1];
  return notes[2];
}

const HEADLINES: { min: number; max: number; text: string }[] = [
  { min: 0, max: 4.4, text: "A day to protect rather than push" },
  { min: 4.4, max: 5.6, text: "A day for quiet repair" },
  { min: 5.6, max: 6.6, text: "A day that will do what you tell it" },
  { min: 6.6, max: 7.6, text: "A day with some wind behind it" },
  { min: 7.6, max: 11, text: "A day worth spending on something real" },
];

function transitMeaning(t: Aspect): string {
  const transiting = PLANET_MAP[t.a as PlanetId];
  const target =
    t.b === "asc"
      ? "how you're coming across"
      : t.b === "mc"
        ? "your work and public standing"
        : (PLANET_MAP[t.b as PlanetId]?.drive ?? pointName(t.b));

  if (!transiting) return "";

  const subject = transiting.keywords[0];
  const sentence = (() => {
    switch (t.info.nature) {
      case "harmonious":
        return `${subject} flows into ${target} without resistance today.`;
      case "challenging":
        return `${subject} presses on ${target}. Expect the sore spot to announce itself.`;
      default:
        return `${subject} merges with ${target} — a starting point rather than an event.`;
    }
  })();

  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

const ADVICE_BY_MOON_ELEMENT: Record<string, string> = {
  fire: "Move first, refine later. Waiting for certainty today just means waiting.",
  earth:
    "Do one concrete thing with your hands. The mood follows the body, not the other way round.",
  air: "Say it out loud to someone. What feels tangled is mostly unspoken.",
  water:
    "Give the feeling room before you interpret it. Not everything that surfaces needs a decision.",
};

export function dailyReading(
  chart: Chart,
  when: Date = new Date(),
): DailyReading {
  const transits = currentTransits(chart, when);
  const phase = moonPhase(when);

  const moonPos = bodyPosition("moon", when);
  const { signIndex } = splitLongitude(moonPos.longitude);
  const moonSign = SIGNS[signIndex];
  const moonHouse = chart.birth.timeUnknown
    ? null
    : houseOf(moonPos.longitude, chart.houses.cusps);

  const scores: DomainScore[] = (Object.keys(DOMAIN_LABELS) as Domain[]).map(
    (domain) => {
      const score = scoreDomain(domain, transits);
      return {
        domain,
        label: DOMAIN_LABELS[domain],
        score,
        note: noteFor(domain, score),
      };
    },
  );

  const average = scores.reduce((a, s) => a + s.score, 0) / scores.length;
  const headline = HEADLINES.find(
    (h) => average >= h.min && average < h.max,
  )!.text;

  const lines: DailyAspectLine[] = transits
    .filter((t) => t.strength > 0.35)
    .slice(0, 6)
    .map((t) => ({
      aspect: t,
      title: `Transiting ${pointName(t.a)} ${t.info.glyph} natal ${pointName(t.b)}`,
      orbLabel: orbLabel(t.orb),
      meaning: transitMeaning(t),
      applying: t.applying,
    }));

  const retrogrades = (
    [
      "mercury",
      "venus",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
      "pluto",
    ] as PlanetId[]
  )
    .map((id) => ({ id, pos: bodyPosition(id, when) }))
    .filter((p) => p.pos.retrograde)
    .map((p) => ({
      name: PLANET_MAP[p.id].name,
      glyph: PLANET_MAP[p.id].glyph,
    }));

  const moonLine = moonHouse
    ? `The Moon is crossing your ${moonHouse}th house, so ${houseMood(moonHouse)} is where your attention keeps landing.`
    : `The Moon is in ${moonSign.name}, colouring the day ${moonSign.keywords[0]}.`;

  const strongest = lines[0];
  const body = [
    moonLine,
    strongest
      ? `The dominant contact is ${strongest.title} — ${strongest.meaning}`
      : "No close contacts to your chart today; the sky is largely leaving you alone.",
    retrogrades.length
      ? `${retrogrades.map((r) => r.name).join(", ")} ${retrogrades.length === 1 ? "is" : "are"} retrograde, which slows anything that depends on ${retrogrades.length === 1 ? "it" : "them"}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    date: when.toISOString().slice(0, 10),
    headline,
    body,
    moon: phase,
    moonSign: moonSign.name,
    moonSignGlyph: moonSign.glyph,
    moonHouse,
    scores,
    aspects: lines,
    advice: ADVICE_BY_MOON_ELEMENT[moonSign.element],
    retrogrades,
  };
}

function houseMood(house: number): string {
  const moods: Record<number, string> = {
    1: "your own body and presentation",
    2: "money and what you actually value",
    3: "conversations and small errands",
    4: "home and family",
    5: "play, romance and whatever you make for its own sake",
    6: "work, routine and health",
    7: "one particular other person",
    8: "the things you don't discuss",
    9: "the bigger picture",
    10: "your standing and direction",
    11: "friends and the future",
    12: "solitude and what's operating out of sight",
  };
  return moods[house] ?? "the day's ordinary business";
}

/** A short sun-sign horoscope for people who haven't entered a birth time. */
export function sunSignReading(signIndex: number, when: Date = new Date()) {
  const sign = SIGNS[signIndex];
  const sunNow = bodyPosition("sun", when);
  const moonNow = bodyPosition("moon", when);
  const moonSign = SIGNS[splitLongitude(moonNow.longitude).signIndex];
  const distance = Math.round(
    ((moonNow.longitude - signIndex * 30 - 15 + 540) % 360) - 180,
  );

  return {
    sign,
    moonSign,
    text: `The Moon is in ${moonSign.name} today, ${Math.abs(distance)}° from the middle of your sign. ${
      moonSign.element === sign.element
        ? "It's running in your own element, so the day should feel legible."
        : "It's in a different element to yours, so expect the day to ask for something that isn't your default."
    }`,
    sunLongitude: sunNow.longitude,
  };
}
