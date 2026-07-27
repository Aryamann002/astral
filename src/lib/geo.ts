/**
 * Place lookup and the local-time → UTC conversion.
 *
 * Getting the offset right matters more than almost anything else in a natal
 * chart: four minutes of error moves the Ascendant by a degree. We resolve the
 * IANA zone for the birthplace and let the tz database supply the offset that
 * was actually in force on that date, including historical DST rules.
 */

import { DateTime } from "luxon";

export interface Place {
  name: string;
  admin: string | null;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  population?: number;
}

export function placeLabel(place: Place) {
  return [place.name, place.admin, place.country].filter(Boolean).join(", ");
}

export interface ResolvedBirthInstant {
  utc: string;
  offsetMinutes: number;
  offsetLabel: string;
  zoneAbbreviation: string;
  valid: boolean;
  problem?: string;
}

/**
 * Convert wall-clock birth details in a place to a UTC instant.
 *
 * Two edge cases the tz database forces us to handle: a time that never
 * existed (the hour skipped when DST begins) and a time that happened twice
 * (the hour repeated when DST ends). Luxon flags both; for the ambiguous case
 * we take the earlier occurrence, which is the usual convention.
 */
export function resolveBirthInstant(
  date: string,
  time: string,
  timezone: string,
): ResolvedBirthInstant {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  const dt = DateTime.fromObject(
    { year, month, day, hour, minute },
    { zone: timezone },
  );

  if (!dt.isValid) {
    return {
      utc: "",
      offsetMinutes: 0,
      offsetLabel: "",
      zoneAbbreviation: "",
      valid: false,
      problem: dt.invalidExplanation ?? "Could not resolve that date and time",
    };
  }

  // Luxon normalises a skipped local time forward; detect it so we can say so.
  const skipped = dt.hour !== hour || dt.minute !== minute;

  return {
    utc: dt.toUTC().toISO() ?? "",
    offsetMinutes: dt.offset,
    offsetLabel: formatOffset(dt.offset),
    zoneAbbreviation: dt.offsetNameShort ?? "",
    valid: true,
    problem: skipped
      ? "That local time did not exist — the clocks jumped forward. Adjusted to the nearest valid moment."
      : undefined,
  };
}

export function formatOffset(minutes: number) {
  const sign = minutes < 0 ? "−" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Current offset for a zone, used to label search results. */
export function zoneOffsetLabel(timezone: string, at: Date = new Date()) {
  const dt = DateTime.fromJSDate(at, { zone: timezone });
  return dt.isValid ? formatOffset(dt.offset) : "";
}

/**
 * Fallback place list, used when the geocoding service is unreachable so that
 * the app still works offline. Deliberately small — one anchor per major
 * region plus the largest cities.
 */
export const FALLBACK_PLACES: Place[] = [
  {
    name: "Mumbai",
    admin: "Maharashtra",
    country: "India",
    countryCode: "IN",
    latitude: 19.076,
    longitude: 72.8777,
    timezone: "Asia/Kolkata",
  },
  {
    name: "Delhi",
    admin: "Delhi",
    country: "India",
    countryCode: "IN",
    latitude: 28.6139,
    longitude: 77.209,
    timezone: "Asia/Kolkata",
  },
  {
    name: "Bengaluru",
    admin: "Karnataka",
    country: "India",
    countryCode: "IN",
    latitude: 12.9716,
    longitude: 77.5946,
    timezone: "Asia/Kolkata",
  },
  {
    name: "Kolkata",
    admin: "West Bengal",
    country: "India",
    countryCode: "IN",
    latitude: 22.5726,
    longitude: 88.3639,
    timezone: "Asia/Kolkata",
  },
  {
    name: "Chennai",
    admin: "Tamil Nadu",
    country: "India",
    countryCode: "IN",
    latitude: 13.0827,
    longitude: 80.2707,
    timezone: "Asia/Kolkata",
  },
  {
    name: "Hyderabad",
    admin: "Telangana",
    country: "India",
    countryCode: "IN",
    latitude: 17.385,
    longitude: 78.4867,
    timezone: "Asia/Kolkata",
  },
  {
    name: "Pune",
    admin: "Maharashtra",
    country: "India",
    countryCode: "IN",
    latitude: 18.5204,
    longitude: 73.8567,
    timezone: "Asia/Kolkata",
  },
  {
    name: "Ahmedabad",
    admin: "Gujarat",
    country: "India",
    countryCode: "IN",
    latitude: 23.0225,
    longitude: 72.5714,
    timezone: "Asia/Kolkata",
  },
  {
    name: "Jaipur",
    admin: "Rajasthan",
    country: "India",
    countryCode: "IN",
    latitude: 26.9124,
    longitude: 75.7873,
    timezone: "Asia/Kolkata",
  },
  {
    name: "Lucknow",
    admin: "Uttar Pradesh",
    country: "India",
    countryCode: "IN",
    latitude: 26.8467,
    longitude: 80.9462,
    timezone: "Asia/Kolkata",
  },
  {
    name: "London",
    admin: "England",
    country: "United Kingdom",
    countryCode: "GB",
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: "Europe/London",
  },
  {
    name: "New York",
    admin: "New York",
    country: "United States",
    countryCode: "US",
    latitude: 40.7128,
    longitude: -74.006,
    timezone: "America/New_York",
  },
  {
    name: "Los Angeles",
    admin: "California",
    country: "United States",
    countryCode: "US",
    latitude: 34.0522,
    longitude: -118.2437,
    timezone: "America/Los_Angeles",
  },
  {
    name: "Chicago",
    admin: "Illinois",
    country: "United States",
    countryCode: "US",
    latitude: 41.8781,
    longitude: -87.6298,
    timezone: "America/Chicago",
  },
  {
    name: "Toronto",
    admin: "Ontario",
    country: "Canada",
    countryCode: "CA",
    latitude: 43.6532,
    longitude: -79.3832,
    timezone: "America/Toronto",
  },
  {
    name: "Paris",
    admin: "Île-de-France",
    country: "France",
    countryCode: "FR",
    latitude: 48.8566,
    longitude: 2.3522,
    timezone: "Europe/Paris",
  },
  {
    name: "Berlin",
    admin: "Berlin",
    country: "Germany",
    countryCode: "DE",
    latitude: 52.52,
    longitude: 13.405,
    timezone: "Europe/Berlin",
  },
  {
    name: "Madrid",
    admin: "Madrid",
    country: "Spain",
    countryCode: "ES",
    latitude: 40.4168,
    longitude: -3.7038,
    timezone: "Europe/Madrid",
  },
  {
    name: "Rome",
    admin: "Lazio",
    country: "Italy",
    countryCode: "IT",
    latitude: 41.9028,
    longitude: 12.4964,
    timezone: "Europe/Rome",
  },
  {
    name: "Moscow",
    admin: "Moscow",
    country: "Russia",
    countryCode: "RU",
    latitude: 55.7558,
    longitude: 37.6173,
    timezone: "Europe/Moscow",
  },
  {
    name: "Dubai",
    admin: "Dubai",
    country: "United Arab Emirates",
    countryCode: "AE",
    latitude: 25.2048,
    longitude: 55.2708,
    timezone: "Asia/Dubai",
  },
  {
    name: "Singapore",
    admin: null,
    country: "Singapore",
    countryCode: "SG",
    latitude: 1.3521,
    longitude: 103.8198,
    timezone: "Asia/Singapore",
  },
  {
    name: "Tokyo",
    admin: "Tokyo",
    country: "Japan",
    countryCode: "JP",
    latitude: 35.6762,
    longitude: 139.6503,
    timezone: "Asia/Tokyo",
  },
  {
    name: "Shanghai",
    admin: "Shanghai",
    country: "China",
    countryCode: "CN",
    latitude: 31.2304,
    longitude: 121.4737,
    timezone: "Asia/Shanghai",
  },
  {
    name: "Hong Kong",
    admin: null,
    country: "Hong Kong",
    countryCode: "HK",
    latitude: 22.3193,
    longitude: 114.1694,
    timezone: "Asia/Hong_Kong",
  },
  {
    name: "Seoul",
    admin: "Seoul",
    country: "South Korea",
    countryCode: "KR",
    latitude: 37.5665,
    longitude: 126.978,
    timezone: "Asia/Seoul",
  },
  {
    name: "Sydney",
    admin: "New South Wales",
    country: "Australia",
    countryCode: "AU",
    latitude: -33.8688,
    longitude: 151.2093,
    timezone: "Australia/Sydney",
  },
  {
    name: "Melbourne",
    admin: "Victoria",
    country: "Australia",
    countryCode: "AU",
    latitude: -37.8136,
    longitude: 144.9631,
    timezone: "Australia/Melbourne",
  },
  {
    name: "Auckland",
    admin: "Auckland",
    country: "New Zealand",
    countryCode: "NZ",
    latitude: -36.8485,
    longitude: 174.7633,
    timezone: "Pacific/Auckland",
  },
  {
    name: "São Paulo",
    admin: "São Paulo",
    country: "Brazil",
    countryCode: "BR",
    latitude: -23.5505,
    longitude: -46.6333,
    timezone: "America/Sao_Paulo",
  },
  {
    name: "Buenos Aires",
    admin: null,
    country: "Argentina",
    countryCode: "AR",
    latitude: -34.6037,
    longitude: -58.3816,
    timezone: "America/Argentina/Buenos_Aires",
  },
  {
    name: "Mexico City",
    admin: null,
    country: "Mexico",
    countryCode: "MX",
    latitude: 19.4326,
    longitude: -99.1332,
    timezone: "America/Mexico_City",
  },
  {
    name: "Lagos",
    admin: "Lagos",
    country: "Nigeria",
    countryCode: "NG",
    latitude: 6.5244,
    longitude: 3.3792,
    timezone: "Africa/Lagos",
  },
  {
    name: "Cairo",
    admin: "Cairo",
    country: "Egypt",
    countryCode: "EG",
    latitude: 30.0444,
    longitude: 31.2357,
    timezone: "Africa/Cairo",
  },
  {
    name: "Nairobi",
    admin: "Nairobi",
    country: "Kenya",
    countryCode: "KE",
    latitude: -1.2921,
    longitude: 36.8219,
    timezone: "Africa/Nairobi",
  },
  {
    name: "Johannesburg",
    admin: "Gauteng",
    country: "South Africa",
    countryCode: "ZA",
    latitude: -26.2041,
    longitude: 28.0473,
    timezone: "Africa/Johannesburg",
  },
  {
    name: "Istanbul",
    admin: "Istanbul",
    country: "Turkey",
    countryCode: "TR",
    latitude: 41.0082,
    longitude: 28.9784,
    timezone: "Europe/Istanbul",
  },
  {
    name: "Karachi",
    admin: "Sindh",
    country: "Pakistan",
    countryCode: "PK",
    latitude: 24.8607,
    longitude: 67.0011,
    timezone: "Asia/Karachi",
  },
  {
    name: "Dhaka",
    admin: "Dhaka",
    country: "Bangladesh",
    countryCode: "BD",
    latitude: 23.8103,
    longitude: 90.4125,
    timezone: "Asia/Dhaka",
  },
  {
    name: "Jakarta",
    admin: "Jakarta",
    country: "Indonesia",
    countryCode: "ID",
    latitude: -6.2088,
    longitude: 106.8456,
    timezone: "Asia/Jakarta",
  },
  {
    name: "Bangkok",
    admin: "Bangkok",
    country: "Thailand",
    countryCode: "TH",
    latitude: 13.7563,
    longitude: 100.5018,
    timezone: "Asia/Bangkok",
  },
  {
    name: "Kathmandu",
    admin: "Bagmati",
    country: "Nepal",
    countryCode: "NP",
    latitude: 27.7172,
    longitude: 85.324,
    timezone: "Asia/Kathmandu",
  },
  {
    name: "Colombo",
    admin: "Western",
    country: "Sri Lanka",
    countryCode: "LK",
    latitude: 6.9271,
    longitude: 79.8612,
    timezone: "Asia/Colombo",
  },
];

export function searchFallback(query: string): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return FALLBACK_PLACES.filter(
    (p) =>
      p.name.toLowerCase().startsWith(q) ||
      p.name.toLowerCase().includes(q) ||
      p.country.toLowerCase().startsWith(q),
  ).slice(0, 8);
}
