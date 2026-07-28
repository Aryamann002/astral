import { NextResponse } from "next/server";
import { searchFallback, type Place } from "@/lib/geo";
import { rateLimit, rateLimitHeaders, tooManyRequests } from "@/lib/rateLimit";

/**
 * Place search. Proxies Open-Meteo's geocoding service, which returns an IANA
 * timezone alongside the coordinates — we need all three to build a chart.
 *
 * If the service is unreachable we fall back to a small bundled list rather
 * than failing the form outright.
 */

interface OpenMeteoResult {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  population?: number;
}

/** Longer than any real place name, and short enough not to be a payload. */
const MAX_QUERY = 100;

// Generous next to the 260ms-debounced typing the search box produces, tight
// enough that this route cannot be used to hammer Open-Meteo from our address.
const RATE_LIMIT = { name: "geocode", limit: 60, windowMs: 60_000 };

/**
 * Results are cacheable, but they are also a record of where someone is about
 * to say they were born, so keep them out of shared caches. `private` confines
 * the copy to the one browser that asked for it.
 */
const CACHE = "private, max-age=300";

/**
 * Control characters have no place in a place name and no business in an
 * outbound request line. Written as a code check rather than a regex to keep
 * literal control bytes out of this file.
 */
function stripControl(value: string) {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f ? " " : char;
  }
  return out;
}

export async function GET(request: Request) {
  const limit = rateLimit(request, RATE_LIMIT);
  if (!limit.ok) return tooManyRequests(limit);

  const headers = { ...rateLimitHeaders(limit), "Cache-Control": CACHE };

  const raw = new URL(request.url).searchParams.get("q") ?? "";
  const query = stripControl(raw.slice(0, MAX_QUERY)).trim();

  if (query.length < 2)
    return NextResponse.json({ places: [], source: "none" }, { headers });

  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", query);
    url.searchParams.set("count", "8");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error(`geocoder responded ${response.status}`);

    const data = (await response.json()) as { results?: OpenMeteoResult[] };
    const places: Place[] = (data.results ?? [])
      .filter((r) => r.timezone)
      .map((r) => ({
        name: r.name,
        admin: r.admin1 ?? null,
        country: r.country ?? "",
        countryCode: r.country_code ?? "",
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone,
        population: r.population,
      }));

    if (places.length === 0) {
      return NextResponse.json(
        { places: searchFallback(query), source: "fallback" },
        { headers },
      );
    }
    return NextResponse.json({ places, source: "open-meteo" }, { headers });
  } catch {
    return NextResponse.json(
      { places: searchFallback(query), source: "fallback" },
      { headers },
    );
  }
}
