/**
 * Interpretive text.
 *
 * Planet-in-sign for the personal planets is written out in full, because that
 * is the material people actually read. Outer-planet placements are composed
 * from element and modality, which is honest about the fact that they are
 * generational — everyone born within a few years shares them.
 */

import {
  HOUSES,
  PLANET_MAP,
  SIGNS,
  type AspectId,
  type Element,
  type Modality,
  type PlanetId,
  type PointId,
  pointName,
} from "./constants";
import type { Chart, Placement } from "./chart";
import type { Aspect } from "./aspects";

type SignTexts = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

const SUN: SignTexts = [
  "You arrive before you deliberate. Identity here is forged in motion — you find out who you are by starting things, and stalling costs you more than a wrong turn would.",
  "You build a self the way you'd build a house: slowly, in good materials, meant to outlast you. Comfort isn't indulgence for you, it's evidence that life is working.",
  "You become yourself through contact — conversations, tangents, the second question. A single fixed answer feels like a small death; you'd rather hold three.",
  "Your identity is bound up with belonging. You know who you are by who you protect, and your surest instrument is the one you can't explain: how a room feels.",
  "You are here to be seen, and there's no shame in it. Warmth is your actual competence — you make other people braver simply by taking up your own space first.",
  "You refine. Self-worth arrives through craft and usefulness, and your quiet pride is in the part nobody notices because you got it right.",
  "You come into focus in the presence of another. Fairness is not a manner for you but a nervous system — imbalance registers in your body before your mind names it.",
  "You are built for what other people flinch from. Intensity is not a mood but a way of knowing, and half-truths cost you more than hard ones.",
  "You need the horizon in view. Meaning is oxygen — take away the larger story and even a good life starts to feel like a waiting room.",
  "You are playing a longer game than the people around you. Authority sits naturally on you, though you'll spend years deciding whether you want it.",
  "You see the system from outside it. Belonging matters to you enormously, which is exactly why you refuse to buy it by agreeing to things you don't believe.",
  "Your edges are porous — you take on the weather of the room. This is your gift and your central problem, and learning where you end is your life's work.",
];

const MOON: SignTexts = [
  "You feel first and fast, and the feeling is usually over before others notice it began. You're soothed by action, not analysis.",
  "You need steadiness to feel safe — the same mug, the same walk, food that tastes like something. Sudden change registers as threat before it registers as change.",
  "You process emotion by naming it, out loud, several ways. Silence doesn't calm you; it lets the feeling grow teeth.",
  "You feel everything at tide-strength and remember all of it. Home is not a place for you but a permission to stop performing.",
  "You need to be delighted in, not merely tolerated. Withheld warmth reads to you as rejection even when nothing was meant by it.",
  "You settle yourself by fixing something small and concrete. Anxiety is your body asking for a task, and it's usually right.",
  "Your equilibrium depends on the emotional temperature around you. You'll manage other people's moods reflexively, then wonder why you're tired.",
  "You bond completely or not at all. You'd rather know the devastating thing than be comfortably managed.",
  "You need room and a reason. Confinement — physical, emotional, intellectual — makes you restless in a way that looks like indifference but isn't.",
  "You self-soothe through competence. Feelings get filed until there's time, and there is never time, so learning to feel on schedule is your work.",
  "You need distance to feel close. Space isn't withdrawal for you, it's the condition under which intimacy stops being suffocating.",
  "You absorb what's around you without a filter. Solitude isn't a preference, it's how you find out which feelings were ever yours.",
];

const MERCURY: SignTexts = [
  "You think in headlines and decide at speed. Being first matters more to you than being exhaustive, and you're often right — but you'll defend a position you formed in four seconds.",
  "You think slowly and then you're done. Ideas have to be handled, tested against something real; abstraction alone leaves you cold.",
  "Your mind runs several tabs and enjoys it. You're a natural translator between people who'd otherwise talk past each other.",
  "You think in impressions and remember tone rather than wording. Your logic is real, it just runs underneath the feeling.",
  "You speak with conviction and a certain amount of theatre. You think best when there's someone to think toward.",
  "You see the flaw immediately. Precision is your pleasure and your affliction — the same eye that catches the error turns on you at 3am.",
  "You think comparatively — everything gets weighed against its alternative. This makes you fair and makes decisions expensive.",
  "You don't accept the surface account. You want the motive under the statement, and you generally find it.",
  "You think in arcs and implications. Detail bores you, which occasionally costs you something you'd rather not have lost.",
  "You think structurally and say less than you know. If you're speaking, you've already decided.",
  "You think sideways. The obvious route irritates you, and your best ideas arrive looking like non-sequiturs.",
  "You think in images and associations. Linear argument is available to you but it isn't native, and forcing it flattens what you actually perceive.",
];

const VENUS: SignTexts = [
  "You want directly and you want now. Pursuit excites you more than possession, which is worth knowing before you mistake the chase for love.",
  "You love with your senses and you love to stay. Loyalty is real here, and so is stubbornness about people who've stopped deserving it.",
  "You're drawn to whoever is interesting this week. Boredom, for you, is a genuine dealbreaker rather than a character flaw.",
  "You love protectively and take a while to open. Once you've let someone in, you don't really let them back out.",
  "You want to be adored, generously and out loud. You give the same way — extravagantly, and slightly on stage.",
  "You show love by noticing what's needed and handling it. You struggle to receive without immediately balancing the ledger.",
  "Partnership is your natural climate. The risk is that you'll shape yourself around someone else's preferences and call it harmony.",
  "You want depth or nothing. Casual affection feels like a waste of your time, and jealousy here is information, not just weather.",
  "You love company that expands you. Someone who narrows your world will lose you slowly and then all at once.",
  "You take love seriously and slowly. Your affection shows up as reliability, which some people need taught to them as romance.",
  "You need freedom inside intimacy. Unconventional arrangements suit you; being managed does not.",
  "You love in an unguarded, boundaryless way. Your challenge is telling compassion apart from the pull toward rescuing.",
];

const MARS: SignTexts = [
  "You act on impulse and it usually works. Your anger is hot, brief and honest — over before others have finished being upset.",
  "You're slow to move and impossible to stop. Provoke you long enough and the response is disproportionate because it's been accumulating.",
  "You fight with words and you're quick. Restlessness is your fuel; sustained effort at one thing is the discipline you're missing.",
  "You act indirectly, protectively, and your anger goes sideways rather than out. Say the direct thing — it costs less than the alternative.",
  "You want the effort to be witnessed. Pride drives you further than most people's ambition does.",
  "You work methodically toward the useful outcome. Irritation is your default anger, and it lands on yourself more than anyone.",
  "You avoid direct conflict and then resent that you did. Learning to fight cleanly, early, is your central work.",
  "You are relentless. Strategy comes naturally, so does the long grudge — you'll wait years for the right moment.",
  "You move toward whatever looks like an adventure. Follow-through is the cost you keep paying.",
  "You are ambitious and patient with it. You don't waste energy on fights that don't advance the position.",
  "You act on principle and resist being told. Your rebellion is real but it's cerebral — you argue rather than storm.",
  "Your drive comes and goes with the tide. You act powerfully when moved and can't manufacture it on demand, which the world will mistake for laziness.",
];

const PERSONAL_TEXTS: Partial<Record<PlanetId, SignTexts>> = {
  sun: SUN,
  moon: MOON,
  mercury: MERCURY,
  venus: VENUS,
  mars: MARS,
};

const ELEMENT_PHRASE: Record<Element, string> = {
  fire: "through conviction, risk and self-assertion",
  earth: "through the material world — bodies, money, institutions, results",
  air: "through ideas, language and the social fabric",
  water: "through feeling, memory and what stays unspoken",
};

const MODALITY_PHRASE: Record<Modality, string> = {
  cardinal: "It initiates: this energy starts things and forces the issue.",
  fixed: "It consolidates: this energy digs in and will not be hurried.",
  mutable: "It adapts: this energy shifts shape rather than holding ground.",
};

const GENERATIONAL_FRAME: Partial<Record<PlanetId, string>> = {
  jupiter: "Jupiter shows where you expand and what you consider a good bet.",
  saturn:
    "Saturn shows where reality has been strict with you, and where competence is earned rather than given.",
  uranus: "Uranus marks where your generation broke with what came before.",
  neptune:
    "Neptune marks what your generation idealised, and where it was most easily fooled.",
  pluto:
    "Pluto marks what your generation was forced to dismantle and rebuild.",
  northNode:
    "The North Node points at the unfamiliar direction that grows you.",
  southNode: "The South Node names the competence you over-rely on.",
  lilith:
    "Lilith marks where you refuse to be tamed, and where you've been punished for it.",
};

export function planetInSign(planetId: PlanetId, signIndex: number): string {
  const written = PERSONAL_TEXTS[planetId];
  if (written) return written[signIndex];

  const sign = SIGNS[signIndex];
  const frame = GENERATIONAL_FRAME[planetId] ?? "";
  const planet = PLANET_MAP[planetId];
  return `${frame} In ${sign.name} it operates ${ELEMENT_PHRASE[sign.element]}. ${MODALITY_PHRASE[sign.modality]} Expect ${planet.keywords[0]} to show up looking ${sign.keywords[0]} and ${sign.keywords[1]}.`;
}

export function planetInHouse(planetId: PlanetId, house: number): string {
  const info = HOUSES[house - 1];
  const planet = PLANET_MAP[planetId];
  return `${planet.name} in the ${ordinal(house)} house puts ${planet.drive} into the territory of ${info.domain}. This is where ${planet.keywords[0]} becomes visible in your life, and where it costs you something.`;
}

const ASPECT_FRAME: Record<AspectId, (a: string, b: string) => string> = {
  conjunction: (a, b) =>
    `${a} and ${b} operate as one motion here — you cannot exercise either without the other coming along. Strength and blind spot in the same gesture.`,
  opposition: (a, b) =>
    `${a} and ${b} sit at opposite ends of a see-saw. You'll tend to identify with one and meet the other in other people until you can hold both.`,
  trine: (a, b) =>
    `${a} and ${b} cooperate without being asked. It works so easily you may not develop it — talent left on the shelf is still the risk.`,
  square: (a, b) =>
    `${a} and ${b} are at cross purposes, and the friction is productive. This is the tension that makes you build something.`,
  sextile: (a, b) =>
    `${a} and ${b} offer each other an opening. Nothing here is automatic; it rewards you only if you reach for it.`,
  quincunx: (a, b) =>
    `${a} and ${b} have no common language. You'll keep adjusting between them and never quite resolve it — the adjustment itself is the point.`,
  semisextile: (a, b) =>
    `${a} and ${b} sit adjacent and slightly irritate each other. Minor, but persistent.`,
  semisquare: (a, b) =>
    `${a} and ${b} generate low-grade friction — the sort you notice as recurring annoyance rather than crisis.`,
  sesquiquadrate: (a, b) =>
    `${a} and ${b} agitate one another at an awkward angle, usually surfacing under pressure.`,
};

export function aspectText(aspect: Aspect): string {
  const a = pointName(aspect.a);
  const b = pointName(aspect.b);
  return ASPECT_FRAME[aspect.aspect](a, b);
}

export function aspectTitle(aspect: Aspect): string {
  return `${pointName(aspect.a)} ${aspect.info.name.toLowerCase()} ${pointName(aspect.b)}`;
}

const DIGNITY_TEXT: Record<string, string> = {
  domicile: "at home in its own sign — this function works at full strength",
  exaltation:
    "exalted — this function is amplified and unusually well expressed",
  detriment: "in detriment — this function has to work against the grain here",
  fall: "in fall — this function is quieter and takes conscious effort to access",
};

export function dignityText(placement: Placement): string | null {
  return placement.dignity ? DIGNITY_TEXT[placement.dignity] : null;
}

/** The two-or-three sentence headline shown at the top of the chart. */
export function chartHeadline(chart: Chart): string {
  const sun = chart.byId.sun;
  const moon = chart.byId.moon;
  const asc = chart.byId.asc;
  const dominant = dominantElement(chart);

  const base = `A ${sun.sign.name} Sun with a ${moon.sign.name} Moon${
    chart.birth.timeUnknown ? "" : `, rising in ${asc.sign.name}`
  }.`;

  const elementLine = `Your chart leans ${dominant} — you meet the world ${ELEMENT_PHRASE[dominant]}.`;

  const stellium = chart.stelliums.length
    ? ` A concentration of planets in ${chart.stelliums[0].sign.name} weights the whole chart toward ${chart.stelliums[0].sign.keywords[0]} expression.`
    : "";

  return `${base} ${elementLine}${stellium}`;
}

export function dominantElement(chart: Chart): Element {
  const entries = Object.entries(chart.elements) as [Element, number][];
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

export function dominantModality(chart: Chart): Modality {
  const entries = Object.entries(chart.modalities) as [Modality, number][];
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

export function ordinal(n: number): string {
  const teens = n % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** Short label for a point, used in dense UI. */
export function shortLabel(id: PointId): string {
  return pointName(id).replace("Black Moon ", "").replace(" Node", " Node");
}
