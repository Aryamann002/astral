import { NextResponse } from "next/server";
import { searchFallback, type Place } from "@/lib/geo";

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

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2)
    return NextResponse.json({ places: [], source: "none" });

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
      return NextResponse.json({
        places: searchFallback(query),
        source: "fallback",
      });
    }
    return NextResponse.json({ places, source: "open-meteo" });
  } catch {
    return NextResponse.json({
      places: searchFallback(query),
      source: "fallback",
    });
  }
}
