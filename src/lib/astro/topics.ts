/**
 * Question → the parts of a chart that actually govern it.
 *
 * One table, two readers. The offline astrologer uses it to decide which lines
 * of a chart to quote back; the prompt builder uses it to decide what to hand
 * another model. Keeping both on the same table means the answer you get in
 * the app and the answer you get from a pasted prompt are reading the same
 * chart, scoped the same way.
 */

import { pointName, type PointId } from "./constants";

export interface Topic {
  keys: RegExp;
  label: string;
  /** Bodies and angles that bear on this topic. */
  points: PointId[];
  /** Houses that bear on it; any planet sitting in one is relevant too. */
  houses: number[];
  /** One line of orientation, shown before the placements. */
  frame: string;
}

export const TOPICS: Topic[] = [
  {
    keys: /love|romance|relationship|partner|marriage|dating|attract/i,
    label: "love",
    points: ["venus", "moon", "mars", "dsc"],
    houses: [7],
    frame:
      "Relationship questions live with Venus (what you're drawn to), Mars (how you pursue it), the Moon (what makes you feel safe) and the seventh house.",
  },
  {
    keys: /career|work|job|money|business|ambition|success|professional/i,
    label: "work",
    points: ["mc", "saturn", "sun", "jupiter"],
    houses: [10, 6, 2],
    frame:
      "Work questions sit with the Midheaven and tenth house, Saturn (where mastery is earned), and the sixth house of daily labour.",
  },
  {
    keys: /think|mind|study|learn|communicat|speak|writ|restless/i,
    label: "mind",
    points: ["mercury"],
    houses: [3, 9],
    frame:
      "Mercury and the third house describe how you take in and give out information.",
  },
  {
    keys: /saturn return|turning thirty|30|29/i,
    label: "saturn return",
    points: ["saturn"],
    houses: [],
    frame:
      "The Saturn return is Saturn arriving back at its natal degree, roughly ages 28 to 31. What it tests is whatever your natal Saturn already governs.",
  },
  {
    keys: /purpose|direction|meaning|destiny|node|why am i/i,
    label: "direction",
    points: ["northNode", "southNode", "sun", "mc"],
    houses: [],
    frame:
      "The nodal axis is the standard place to look for direction — the South Node is what you already know, the North Node the unfamiliar edge.",
  },
  {
    keys: /feel|emotion|anxious|mood|sensitive|cry|overwhelm/i,
    label: "feeling",
    points: ["moon", "neptune"],
    houses: [4, 12],
    frame:
      "The Moon describes your emotional baseline and what actually settles you.",
  },
  {
    keys: /anger|fight|drive|energy|motivat|assert/i,
    label: "drive",
    points: ["mars", "sun"],
    houses: [],
    frame: "Mars carries drive, appetite and how you handle conflict.",
  },
];

export function matchTopic(question: string): Topic | null {
  return TOPICS.find((topic) => topic.keys.test(question)) ?? null;
}

/**
 * The topic's points and houses rendered as the substrings a summary line
 * would contain — for the reader that works on text rather than on a Chart.
 */
export function topicWants(topic: Topic): string[] {
  return [
    ...topic.points.map(pointName),
    ...topic.houses.map((house) => `house ${house}`),
  ];
}
