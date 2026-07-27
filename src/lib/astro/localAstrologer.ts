/**
 * A fallback reading engine used when no model provider is configured.
 *
 * It works on the same plain-text chart summary the model receives, pulling
 * out the lines relevant to whatever was asked. The answers are narrower than
 * a model's, but they are drawn from the real chart rather than invented, and
 * they keep the app usable with no API key.
 */

const TOPICS: {
  keys: RegExp;
  label: string;
  wants: string[];
  frame: string;
}[] = [
  {
    keys: /love|romance|relationship|partner|marriage|dating|attract/i,
    label: "love",
    wants: ["Venus", "Moon", "Mars", "Descendant", "house 7"],
    frame:
      "Relationship questions live with Venus (what you're drawn to), Mars (how you pursue it), the Moon (what makes you feel safe) and the seventh house.",
  },
  {
    keys: /career|work|job|money|business|ambition|success|professional/i,
    label: "work",
    wants: [
      "Midheaven",
      "Saturn",
      "Sun",
      "Jupiter",
      "house 10",
      "house 6",
      "house 2",
    ],
    frame:
      "Work questions sit with the Midheaven and tenth house, Saturn (where mastery is earned), and the sixth house of daily labour.",
  },
  {
    keys: /think|mind|study|learn|communicat|speak|writ|restless/i,
    label: "mind",
    wants: ["Mercury", "house 3", "house 9"],
    frame:
      "Mercury and the third house describe how you take in and give out information.",
  },
  {
    keys: /saturn return|turning thirty|30|29/i,
    label: "saturn return",
    wants: ["Saturn"],
    frame:
      "The Saturn return is Saturn arriving back at its natal degree, roughly ages 28 to 31. What it tests is whatever your natal Saturn already governs.",
  },
  {
    keys: /purpose|direction|meaning|destiny|node|why am i/i,
    label: "direction",
    wants: ["North Node", "South Node", "Sun", "Midheaven"],
    frame:
      "The nodal axis is the standard place to look for direction — the South Node is what you already know, the North Node the unfamiliar edge.",
  },
  {
    keys: /feel|emotion|anxious|mood|sensitive|cry|overwhelm/i,
    label: "feeling",
    wants: ["Moon", "Neptune", "house 4", "house 12"],
    frame:
      "The Moon describes your emotional baseline and what actually settles you.",
  },
  {
    keys: /anger|fight|drive|energy|motivat|assert/i,
    label: "drive",
    wants: ["Mars", "Sun"],
    frame: "Mars carries drive, appetite and how you handle conflict.",
  },
];

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

  const topic = TOPICS.find((t) => t.keys.test(question));

  if (!topic) {
    const big = extractLines(context, ["Sun", "Moon"]);
    const asc = extractLines(context, ["Ascendant"]);
    return [
      "Here's what your chart says, working from the strongest signals:",
      big.length ? `\n${big.map((l) => `· ${l}`).join("\n")}` : "",
      asc.length ? `· ${asc[0]}` : "",
      "\nAsk me something more specific — love, work, how you think, your Saturn return, what you're moving toward — and I'll go to the placements that actually govern it.",
      "\n(No model provider is reachable right now, so I am reading straight from your chart data rather than composing. Add GROQ_API_KEYS to .env.local for a fuller conversation.)",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const lines = extractLines(context, topic.wants);
  const aspects = relevantAspects(context, topic.wants);
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
    "\n(No model provider is reachable right now, so I am reading straight from your chart data rather than composing. Add GROQ_API_KEYS to .env.local for a fuller conversation.)",
  ]
    .filter(Boolean)
    .join("\n");
}
