/**
 * Core astrological vocabulary: signs, planets, aspects and their attributes.
 * Longitudes throughout the codebase are tropical ecliptic longitudes of date,
 * measured in degrees from 0° Aries.
 */

export type Element = "fire" | "earth" | "air" | "water";
export type Modality = "cardinal" | "fixed" | "mutable";
export type Polarity = "yang" | "yin";

export interface SignInfo {
  index: number;
  name: string;
  glyph: string;
  element: Element;
  modality: Modality;
  polarity: Polarity;
  ruler: PlanetId;
  /** Traditional ruler, where it differs from the modern one. */
  classicRuler: PlanetId;
  keywords: string[];
}

export const SIGNS: SignInfo[] = [
  {
    index: 0,
    name: "Aries",
    glyph: "♈︎",
    element: "fire",
    modality: "cardinal",
    polarity: "yang",
    ruler: "mars",
    classicRuler: "mars",
    keywords: ["initiating", "direct", "courageous", "impatient"],
  },
  {
    index: 1,
    name: "Taurus",
    glyph: "♉︎",
    element: "earth",
    modality: "fixed",
    polarity: "yin",
    ruler: "venus",
    classicRuler: "venus",
    keywords: ["steady", "sensual", "patient", "immovable"],
  },
  {
    index: 2,
    name: "Gemini",
    glyph: "♊︎",
    element: "air",
    modality: "mutable",
    polarity: "yang",
    ruler: "mercury",
    classicRuler: "mercury",
    keywords: ["curious", "verbal", "adaptable", "scattered"],
  },
  {
    index: 3,
    name: "Cancer",
    glyph: "♋︎",
    element: "water",
    modality: "cardinal",
    polarity: "yin",
    ruler: "moon",
    classicRuler: "moon",
    keywords: ["protective", "tidal", "remembering", "guarded"],
  },
  {
    index: 4,
    name: "Leo",
    glyph: "♌︎",
    element: "fire",
    modality: "fixed",
    polarity: "yang",
    ruler: "sun",
    classicRuler: "sun",
    keywords: ["radiant", "generous", "dramatic", "proud"],
  },
  {
    index: 5,
    name: "Virgo",
    glyph: "♍︎",
    element: "earth",
    modality: "mutable",
    polarity: "yin",
    ruler: "mercury",
    classicRuler: "mercury",
    keywords: ["precise", "useful", "discerning", "self-critical"],
  },
  {
    index: 6,
    name: "Libra",
    glyph: "♎︎",
    element: "air",
    modality: "cardinal",
    polarity: "yang",
    ruler: "venus",
    classicRuler: "venus",
    keywords: ["relational", "aesthetic", "fair", "hesitant"],
  },
  {
    index: 7,
    name: "Scorpio",
    glyph: "♏︎",
    element: "water",
    modality: "fixed",
    polarity: "yin",
    ruler: "pluto",
    classicRuler: "mars",
    keywords: ["penetrating", "loyal", "transformative", "withholding"],
  },
  {
    index: 8,
    name: "Sagittarius",
    glyph: "♐︎",
    element: "fire",
    modality: "mutable",
    polarity: "yang",
    ruler: "jupiter",
    classicRuler: "jupiter",
    keywords: ["expansive", "candid", "questing", "restless"],
  },
  {
    index: 9,
    name: "Capricorn",
    glyph: "♑︎",
    element: "earth",
    modality: "cardinal",
    polarity: "yin",
    ruler: "saturn",
    classicRuler: "saturn",
    keywords: ["strategic", "enduring", "responsible", "austere"],
  },
  {
    index: 10,
    name: "Aquarius",
    glyph: "♒︎",
    element: "air",
    modality: "fixed",
    polarity: "yang",
    ruler: "uranus",
    classicRuler: "saturn",
    keywords: ["inventive", "principled", "detached", "contrary"],
  },
  {
    index: 11,
    name: "Pisces",
    glyph: "♓︎",
    element: "water",
    modality: "mutable",
    polarity: "yin",
    ruler: "neptune",
    classicRuler: "jupiter",
    keywords: ["permeable", "imaginative", "compassionate", "diffuse"],
  },
];

export const ELEMENT_COLORS: Record<Element, string> = {
  fire: "#FF8A6B",
  earth: "#8FD69C",
  air: "#9FC7FF",
  water: "#6FD6E0",
};

export type PlanetId =
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto"
  | "northNode"
  | "southNode"
  | "lilith";

export type PointId = PlanetId | "asc" | "mc" | "dsc" | "ic" | "fortune";

export interface PlanetInfo {
  id: PlanetId;
  name: string;
  glyph: string;
  /** Personal planets move fast and describe individual temperament. */
  category: "luminary" | "personal" | "social" | "outer" | "point";
  /** Mean daily motion in degrees, used for orb weighting and pacing. */
  meanSpeed: number;
  keywords: string[];
  /** Short phrase used when composing house and aspect readings. */
  drive: string;
}

export const PLANETS: PlanetInfo[] = [
  {
    id: "sun",
    name: "Sun",
    glyph: "☉",
    category: "luminary",
    meanSpeed: 0.9856,
    keywords: ["identity", "vitality", "purpose"],
    drive: "your sense of who you are",
  },
  {
    id: "moon",
    name: "Moon",
    glyph: "☽",
    category: "luminary",
    meanSpeed: 13.176,
    keywords: ["feeling", "instinct", "belonging"],
    drive: "what makes you feel safe",
  },
  {
    id: "mercury",
    name: "Mercury",
    glyph: "☿",
    category: "personal",
    meanSpeed: 1.383,
    keywords: ["thought", "language", "exchange"],
    drive: "how you think and speak",
  },
  {
    id: "venus",
    name: "Venus",
    glyph: "♀",
    category: "personal",
    meanSpeed: 1.202,
    keywords: ["attraction", "value", "harmony"],
    drive: "what you love and how you love it",
  },
  {
    id: "mars",
    name: "Mars",
    glyph: "♂",
    category: "personal",
    meanSpeed: 0.524,
    keywords: ["drive", "assertion", "desire"],
    drive: "how you pursue what you want",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    glyph: "♃",
    category: "social",
    meanSpeed: 0.083,
    keywords: ["expansion", "meaning", "faith"],
    drive: "where you grow and take risks",
  },
  {
    id: "saturn",
    name: "Saturn",
    glyph: "♄",
    category: "social",
    meanSpeed: 0.0335,
    keywords: ["structure", "limit", "mastery"],
    drive: "where you are asked to grow up",
  },
  {
    id: "uranus",
    name: "Uranus",
    glyph: "♅",
    category: "outer",
    meanSpeed: 0.0117,
    keywords: ["disruption", "freedom", "insight"],
    drive: "where you break the pattern",
  },
  {
    id: "neptune",
    name: "Neptune",
    glyph: "♆",
    category: "outer",
    meanSpeed: 0.006,
    keywords: ["dissolution", "longing", "imagination"],
    drive: "where the edges blur",
  },
  {
    id: "pluto",
    name: "Pluto",
    glyph: "♇",
    category: "outer",
    meanSpeed: 0.004,
    keywords: ["power", "depth", "regeneration"],
    drive: "what you must die to and rebuild",
  },
  {
    id: "northNode",
    name: "North Node",
    glyph: "☊",
    category: "point",
    meanSpeed: -0.0529,
    keywords: ["direction", "growth edge", "unfamiliar"],
    drive: "the direction you are being pulled toward",
  },
  {
    id: "southNode",
    name: "South Node",
    glyph: "☋",
    category: "point",
    meanSpeed: -0.0529,
    keywords: ["inheritance", "comfort", "release"],
    drive: "what you already know too well",
  },
  {
    id: "lilith",
    name: "Black Moon Lilith",
    glyph: "⚸",
    category: "point",
    meanSpeed: 0.111,
    keywords: ["exile", "refusal", "raw instinct"],
    drive: "the part of you that will not be domesticated",
  },
];

export const PLANET_MAP: Record<PlanetId, PlanetInfo> = Object.fromEntries(
  PLANETS.map((p) => [p.id, p]),
) as Record<PlanetId, PlanetInfo>;

export const ANGLE_GLYPHS: Record<string, string> = {
  asc: "Asc",
  mc: "MC",
  dsc: "Dsc",
  ic: "IC",
  fortune: "⊗",
};

export function pointGlyph(id: PointId): string {
  if (id in ANGLE_GLYPHS) return ANGLE_GLYPHS[id];
  return PLANET_MAP[id as PlanetId]?.glyph ?? "?";
}

export function pointName(id: PointId): string {
  switch (id) {
    case "asc":
      return "Ascendant";
    case "mc":
      return "Midheaven";
    case "dsc":
      return "Descendant";
    case "ic":
      return "Imum Coeli";
    case "fortune":
      return "Part of Fortune";
    default:
      return PLANET_MAP[id as PlanetId]?.name ?? id;
  }
}

export type AspectId =
  | "conjunction"
  | "opposition"
  | "trine"
  | "square"
  | "sextile"
  | "quincunx"
  | "semisextile"
  | "semisquare"
  | "sesquiquadrate";

export interface AspectInfo {
  id: AspectId;
  name: string;
  glyph: string;
  angle: number;
  /** Base orb in degrees before per-body weighting. */
  orb: number;
  nature: "harmonious" | "challenging" | "neutral";
  major: boolean;
  /** Verb phrase used when composing interpretations. */
  verb: string;
}

export const ASPECTS: AspectInfo[] = [
  {
    id: "conjunction",
    name: "Conjunction",
    glyph: "☌",
    angle: 0,
    orb: 8,
    nature: "neutral",
    major: true,
    verb: "fuses with",
  },
  {
    id: "opposition",
    name: "Opposition",
    glyph: "☍",
    angle: 180,
    orb: 8,
    nature: "challenging",
    major: true,
    verb: "pulls against",
  },
  {
    id: "trine",
    name: "Trine",
    glyph: "△",
    angle: 120,
    orb: 7,
    nature: "harmonious",
    major: true,
    verb: "flows with",
  },
  {
    id: "square",
    name: "Square",
    glyph: "□",
    angle: 90,
    orb: 7,
    nature: "challenging",
    major: true,
    verb: "grinds against",
  },
  {
    id: "sextile",
    name: "Sextile",
    glyph: "⚹",
    angle: 60,
    orb: 5,
    nature: "harmonious",
    major: true,
    verb: "opens a door for",
  },
  {
    id: "quincunx",
    name: "Quincunx",
    glyph: "⚻",
    angle: 150,
    orb: 3,
    nature: "challenging",
    major: false,
    verb: "refuses to reconcile with",
  },
  {
    id: "semisextile",
    name: "Semisextile",
    glyph: "⚺",
    angle: 30,
    orb: 2,
    nature: "neutral",
    major: false,
    verb: "brushes past",
  },
  {
    id: "semisquare",
    name: "Semisquare",
    glyph: "∠",
    angle: 45,
    orb: 2,
    nature: "challenging",
    major: false,
    verb: "chafes at",
  },
  {
    id: "sesquiquadrate",
    name: "Sesquiquadrate",
    glyph: "⚼",
    angle: 135,
    orb: 2,
    nature: "challenging",
    major: false,
    verb: "agitates",
  },
];

export const ASPECT_MAP: Record<AspectId, AspectInfo> = Object.fromEntries(
  ASPECTS.map((a) => [a.id, a]),
) as Record<AspectId, AspectInfo>;

export interface HouseInfo {
  number: number;
  name: string;
  domain: string;
  /** Short label used in compact UI. */
  short: string;
}

export const HOUSES: HouseInfo[] = [
  {
    number: 1,
    name: "First House",
    short: "Self",
    domain: "your body, your entrance, the face you lead with",
  },
  {
    number: 2,
    name: "Second House",
    short: "Resources",
    domain: "money, possessions and what you consider yours to keep",
  },
  {
    number: 3,
    name: "Third House",
    short: "Mind",
    domain: "siblings, short journeys, and the daily traffic of information",
  },
  {
    number: 4,
    name: "Fourth House",
    short: "Roots",
    domain: "home, family line, and the private ground you stand on",
  },
  {
    number: 5,
    name: "Fifth House",
    short: "Play",
    domain:
      "creativity, romance, children and everything made for its own sake",
  },
  {
    number: 6,
    name: "Sixth House",
    short: "Work",
    domain: "daily work, health, service and the maintenance of ordinary life",
  },
  {
    number: 7,
    name: "Seventh House",
    short: "Others",
    domain: "partnership, marriage, open enemies — the committed other",
  },
  {
    number: 8,
    name: "Eighth House",
    short: "Depths",
    domain: "shared resources, intimacy, death and what transforms you",
  },
  {
    number: 9,
    name: "Ninth House",
    short: "Horizon",
    domain: "belief, long journeys, higher study and the search for meaning",
  },
  {
    number: 10,
    name: "Tenth House",
    short: "Calling",
    domain: "career, reputation and the public shape of your life",
  },
  {
    number: 11,
    name: "Eleventh House",
    short: "Community",
    domain: "friendship, networks, and the future you hope for",
  },
  {
    number: 12,
    name: "Twelfth House",
    short: "Unseen",
    domain: "solitude, the unconscious, and what operates behind your back",
  },
];

export const HOUSE_SYSTEMS = [
  "placidus",
  "wholeSign",
  "equal",
  "porphyry",
] as const;
export type HouseSystem = (typeof HOUSE_SYSTEMS)[number];

export const HOUSE_SYSTEM_LABELS: Record<HouseSystem, string> = {
  placidus: "Placidus",
  wholeSign: "Whole Sign",
  equal: "Equal",
  porphyry: "Porphyry",
};

/** Dignity tables — sign index keyed by planet. */
export const RULERSHIPS: Partial<Record<PlanetId, number[]>> = {
  sun: [4],
  moon: [3],
  mercury: [2, 5],
  venus: [1, 6],
  mars: [0, 7],
  jupiter: [8, 11],
  saturn: [9, 10],
  uranus: [10],
  neptune: [11],
  pluto: [7],
};

export const EXALTATIONS: Partial<Record<PlanetId, number>> = {
  sun: 0,
  moon: 1,
  mercury: 5,
  venus: 11,
  mars: 9,
  jupiter: 3,
  saturn: 6,
};

export const FALLS: Partial<Record<PlanetId, number>> = {
  sun: 6,
  moon: 7,
  mercury: 11,
  venus: 5,
  mars: 3,
  jupiter: 9,
  saturn: 0,
};
