"use client";

import { useEffect, useRef, useState } from "react";
import { placeLabel, zoneOffsetLabel, type Place } from "@/lib/geo";
import { inputClass } from "./ui";
import { cn } from "@/lib/utils";

export function PlaceSearch({
  value,
  onSelect,
}: {
  value: Place | null;
  onSelect: (place: Place | null) => void;
}) {
  const [query, setQuery] = useState(value ? placeLabel(value) : "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced lookup; an AbortController keeps stale responses from landing
  // after a newer query has already returned.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      // Too short to be a place, or already showing the chosen one.
      if (query.trim().length < 2 || (value && query === placeLabel(value))) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(
          `/api/geocode?q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
          },
        );
        const data = (await response.json()) as { places: Place[] };
        setResults(data.places);
        setOpen(true);
      } catch {
        /* aborted or offline — leave the previous results in place */
      } finally {
        setLoading(false);
      }
    }, 260);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, value]);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">
          ⌕
        </span>
        <input
          className={cn(inputClass, "pl-9")}
          placeholder="Search for your birth city"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (value) onSelect(null);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {loading && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-faint">
            …
          </span>
        )}
      </div>

      {value && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-aqua/25 bg-aqua/10 px-2.5 py-0.5 text-aqua tabular">
            {value.timezone} {zoneOffsetLabel(value.timezone)}
          </span>
          <span className="text-faint tabular">
            {value.latitude.toFixed(3)}°, {value.longitude.toFixed(3)}°
          </span>
        </div>
      )}

      {open && results.length > 0 && (
        <ul className="glass absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-[10px] py-1">
          {results.map((place, index) => (
            <li key={`${place.name}-${place.latitude}-${index}`}>
              <button
                type="button"
                className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/5"
                onClick={() => {
                  onSelect(place);
                  setQuery(placeLabel(place));
                  setOpen(false);
                }}
              >
                <span className="mt-0.5 text-faint">◍</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {placeLabel(place)}
                  </span>
                  <span className="tabular text-[11px] text-faint">
                    {place.timezone} {zoneOffsetLabel(place.timezone)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
