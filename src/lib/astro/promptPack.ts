/**
 * Builds a self-contained prompt the user can paste into any model.
 *
 * This is the app's answer to needing an API key: rather than calling a
 * provider on the user's behalf, it hands them the exact text to give a model
 * they already have. Birth data never leaves the device unless they choose to
 * paste it, and the app costs nothing to run.
 *
 * Signs are spelled out rather than drawn as glyphs. A model reads "9° Cancer
 * 39'" more reliably than "9° ♋︎ 39'", and the glyph costs nine characters
 * once URL-encoded, which matters for the handoff links below.
 */

import type { Chart, Placement } from "./chart";
import type { Aspect } from "./aspects";
import { pointName, type PointId } from "./constants";
import { matchTopic, type Topic } from "./topics";

export type PromptScope = "relevant" | "full";

export interface PromptPack {
  /** The finished prompt, ready to paste. */
  text: string;
  scope: PromptScope;
  /** The topic the question matched, or null if nothing did. */
  topic: Topic | null;
  /** Points included, so the UI can say what is being shared. */
  included: PointId[];
  chars: number;
}

/**
 * Always included when scoping to a question. The luminaries and the rising
 * sign are context for everything — a reading that omits them is not a reading
 * of this chart, it is a reading of one placement.
 */
const CORE: PointId[] = ["sun", "moon", "asc"];

/** Aspects carried in scoped mode, strongest first. */
const SCOPED_ASPECT_LIMIT = 12;
/** Aspects carried in full mode. */
const FULL_ASPECT_LIMIT = 20;

const INSTRUCTIONS = `You are an astrologer reading a natal chart.

Everything under THE CHART was computed from real ephemeris data — apparent geocentric ecliptic longitude of date, from the VSOP87/DE series. Treat it as ground truth. Do not invent or infer any placement, degree, house or aspect that is not written there. If answering properly needs something that isn't listed, say so rather than filling the gap.

How to answer:
- Write like someone who knows the craft, not a horoscope column. No "dear seeker", no cosmic filler, no exclamation marks.
- Ground every claim in a specific placement or aspect, and name it: "your Moon in the 12th", "Saturn square your Sun". The specificity is the whole value.
- Two or three short paragraphs is usually right. Answer the question that was actually asked.
- Astrology describes tendencies, not outcomes. Say "this tends to" rather than "this will". Do not make predictions about health, death, pregnancy, legal outcomes or finances; if asked, redirect to what the chart does describe — temperament and timing.
- You are allowed to disagree. If the question assumes something the chart does not support, say what the chart shows instead.`;

/** "Venus 24° Taurus 24' (house 5, retrograde, detriment)" */
function placementLine(placement: Placement): string {
  const position = `${placement.degree}° ${placement.sign.name} ${String(
    placement.minute,
  ).padStart(2, "0")}'`;

  const notes: string[] = [];
  if (!placement.isAngle) notes.push(`house ${placement.house}`);
  if (placement.retrograde) notes.push("retrograde");
  if (placement.dignity) notes.push(placement.dignity);

  return notes.length
    ? `${placement.name} ${position} (${notes.join(", ")})`
    : `${placement.name} ${position}`;
}

function aspectLine(aspect: Aspect): string {
  const applying = aspect.applying ? ", applying" : "";
  return `${pointName(aspect.a)} ${aspect.info.name.toLowerCase()} ${pointName(
    aspect.b,
  )} (orb ${aspect.orb.toFixed(1)}°${applying})`;
}

/** Which points a scoped prompt should carry, in the chart's own order. */
function scopedPoints(chart: Chart, topic: Topic | null): PointId[] {
  const wanted = new Set<PointId>(CORE);

  if (topic) {
    for (const id of topic.points) wanted.add(id);
    // A planet sitting in one of the topic's houses is relevant even when the
    // topic never named it.
    for (const placement of chart.placements) {
      if (!placement.isAngle && topic.houses.includes(placement.house)) {
        wanted.add(placement.id);
      }
    }
  } else {
    // Nothing matched, so there is nothing to narrow towards. Carry the core
    // plus the chart's own signature; the UI offers the full chart instead.
    wanted.add("mc");
  }

  if (chart.chartRuler) wanted.add(chart.chartRuler.id);

  return chart.placements
    .filter((placement) => wanted.has(placement.id))
    .map((placement) => placement.id);
}

export function buildPromptPack(
  chart: Chart,
  question: string,
  scope: PromptScope,
): PromptPack {
  const topic = matchTopic(question);
  const full = scope === "full";

  const seeds = new Set<PointId>(
    full
      ? chart.placements
          .filter((p) => p.id !== "ic" && p.id !== "dsc")
          .map((p) => p.id)
      : scopedPoints(chart, topic),
  );

  const aspects = chart.aspects
    .filter((aspect) => full || seeds.has(aspect.a) || seeds.has(aspect.b))
    .slice(0, full ? FULL_ASPECT_LIMIT : SCOPED_ASPECT_LIMIT);

  // An aspect names two bodies. Listing "Sun trine Neptune" while giving no
  // position for Neptune asks the model to reason about a placement it was
  // never given — which is the exact invention the instructions forbid. So any
  // body an aspect mentions gets its placement carried too.
  const includedSet = new Set(seeds);
  for (const aspect of aspects) {
    includedSet.add(aspect.a);
    includedSet.add(aspect.b);
  }

  const placements = chart.placements.filter((p) => includedSet.has(p.id));
  const included = placements.map((p) => p.id);

  const bodies = placements.filter((p) => !p.isAngle);
  const angles = placements.filter((p) => p.isAngle);

  const chartBlock = [
    `Born ${chart.birth.localDateTime} (${chart.birth.timezone}) at ${chart.birth.placeName}.`,
    `House system: ${chart.houses.system}. ${chart.isDayChart ? "Day" : "Night"} chart.`,
    angles.length
      ? `Angles:\n${angles.map((p) => `  ${placementLine(p)}`).join("\n")}`
      : "",
    bodies.length
      ? `Placements:\n${bodies.map((p) => `  ${placementLine(p)}`).join("\n")}`
      : "",
    aspects.length
      ? `Aspects:\n${aspects.map((a) => `  ${aspectLine(a)}`).join("\n")}`
      : "",
    full
      ? `Elements — fire ${chart.elements.fire}, earth ${chart.elements.earth}, air ${chart.elements.air}, water ${chart.elements.water}. Modalities — cardinal ${chart.modalities.cardinal}, fixed ${chart.modalities.fixed}, mutable ${chart.modalities.mutable}.`
      : "",
    full && chart.stelliums.length
      ? `Stellium in ${chart.stelliums.map((s) => s.sign.name).join(", ")}.`
      : "",
    chart.chartRuler
      ? `Chart ruler: ${chart.chartRuler.name} in ${chart.chartRuler.sign.name}, house ${chart.chartRuler.house}.`
      : "",
    chart.birth.timeUnknown
      ? "NOTE: the birth time is unknown, so the houses and Ascendant above are approximate. Do not lean on them, and say why."
      : "",
    !full
      ? "NOTE: this is the part of the chart that bears on the question, not the whole chart. If something decisive is missing, say what you would need."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const text = [
    INSTRUCTIONS,
    `--- THE CHART ---\n${chartBlock}`,
    `--- THE QUESTION ---\n${question.trim() || "Read this chart for me."}`,
  ].join("\n\n");

  return { text, scope, topic, included, chars: text.length };
}

export interface HandoffTarget {
  id: string;
  name: string;
  /**
   * Where to send the user. Returns the bare site when the prompt is too long
   * to survive a query string, or when the service has no prefill parameter at
   * all — the prompt is on the clipboard by then either way.
   */
  href: (prompt: string) => string;
  /** True when the prompt genuinely arrives pre-filled. */
  prefills: boolean;
}

/**
 * Query strings are a courtesy, not the mechanism. Long prompts get truncated
 * or rejected somewhere between the browser, the CDN and the app, and the
 * failure is silent — so past this length we open the bare site and let the
 * clipboard do the work.
 */
const MAX_URL_PROMPT = 6000;

function prefill(base: string, bare: string, prompt: string): string {
  const encoded = encodeURIComponent(prompt);
  return encoded.length > MAX_URL_PROMPT ? bare : `${base}${encoded}`;
}

export const HANDOFFS: HandoffTarget[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    href: (p) => prefill("https://chatgpt.com/?q=", "https://chatgpt.com/", p),
    prefills: true,
  },
  {
    id: "claude",
    name: "Claude",
    href: (p) =>
      prefill("https://claude.ai/new?q=", "https://claude.ai/new", p),
    prefills: true,
  },
  {
    // Gemini has no supported prefill parameter, so this is a paste target.
    id: "gemini",
    name: "Gemini",
    href: () => "https://gemini.google.com/app",
    prefills: false,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    href: (p) =>
      prefill(
        "https://www.perplexity.ai/search?q=",
        "https://www.perplexity.ai/",
        p,
      ),
    prefills: true,
  },
];
