/**
 * The in-app reading engine.
 *
 * It works on the plain-text chart summary, pulling out the lines relevant to
 * whatever was asked. Deterministic and entirely local: no model, no network,
 * no key. The answers are narrower than a model's, but they are drawn from the
 * real chart rather than composed, and they are always available.
 *
 * For a fuller reading the app builds a pasteable prompt instead — see
 * `promptPack.ts`, which scopes the chart using the same topic table.
 */

import { matchTopic, topicWants } from "./topics";

function extractLines(context: string, wants: string[]) {
  const placements =
    context
      .split("\n")
      .find((line) => line.startsWith("Placements:"))
      ?.replace("Placements:", "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  const angles =
    context
      .split("\n")
      .find((line) => line.startsWith("Angles:"))
      ?.replace("Angles:", "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  const all = [...placements, ...angles];
  return all.filter((line) =>
    wants.some((want) => line.toLowerCase().includes(want.toLowerCase())),
  );
}

function relevantAspects(context: string, wants: string[]) {
  return (
    context
      .split("\n")
      .find((line) => line.startsWith("Major aspects:"))
      ?.replace("Major aspects:", "")
      .split(";")
      .map((s) => s.trim())
      .filter((line) =>
        wants.some((want) => line.toLowerCase().includes(want.toLowerCase())),
      )
      .slice(0, 3) ?? []
  );
}

export function localAstrologer(question: string, context: string): string {
  if (!context.trim()) {
    return "I don't have a chart to read yet. Add your birth date, time and place on the onboarding screen and ask me again.";
  }

  const topic = matchTopic(question);

  if (!topic) {
    const big = extractLines(context, ["Sun", "Moon"]);
    const asc = extractLines(context, ["Ascendant"]);
    return [
      "Here's what your chart says, working from the strongest signals:",
      big.length ? `\n${big.map((l) => `· ${l}`).join("\n")}` : "",
      asc.length ? `· ${asc[0]}` : "",
      "\nAsk me something more specific — love, work, how you think, your Saturn return, what you're moving toward — and I'll go to the placements that actually govern it.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const wants = topicWants(topic);
  const lines = extractLines(context, wants);
  const aspects = relevantAspects(context, wants);
  const timeUnknown = context.includes("birth time is unknown");

  return [
    topic.frame,
    lines.length
      ? `\nIn your chart:\n${lines.map((l) => `· ${l}`).join("\n")}`
      : "\nYour chart has nothing unusual flagged in that area.",
    aspects.length
      ? `\nThe aspects bearing on it:\n${aspects.map((a) => `· ${a}`).join("\n")}`
      : "",
    timeUnknown
      ? "\nYour birth time isn't on file, so I've left houses and the Ascendant out of this — they'd be guesswork."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
