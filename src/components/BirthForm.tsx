"use client";

import { useMemo, useRef, useState } from "react";
import { PlaceSearch } from "./PlaceSearch";
import { Button, Card, Field, inputClass } from "./ui";
import { placeLabel, resolveBirthInstant, type Place } from "@/lib/geo";
import { useAstral } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Props {
  submitLabel: string;
  onDone: (profileId: string) => void;
  makePrimary?: boolean;
  initialName?: string;
}

/**
 * Birth-data entry.
 *
 * Date is split into three fields rather than a native date input because a
 * birth year is often decades back and native pickers make that tedious.
 */
export function BirthForm({
  submitLabel,
  onDone,
  makePrimary = false,
  initialName = "",
}: Props) {
  const addProfile = useAstral((s) => s.addProfile);

  const [name, setName] = useState(initialName);
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [time, setTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const dateValid = useMemo(() => {
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (!d || !m || !y || year.length !== 4) return false;
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    if (y < 1600 || y > 2200) return false;
    // Reject the 31st of a 30-day month and so on.
    const probe = new Date(Date.UTC(y, m - 1, d));
    return probe.getUTCDate() === d && probe.getUTCMonth() === m - 1;
  }, [day, month, year]);

  const timeValid = timeUnknown || /^\d{2}:\d{2}$/.test(time);
  const ready = dateValid && timeValid && place !== null;

  const submit = () => {
    setError(null);
    if (!place)
      return setError("Choose a birth city so we can work out the timezone.");
    if (!dateValid) return setError("That date doesn't look right.");

    // With no known birth time, noon minimises the average error on the Moon
    // while making it obvious the angles are not to be trusted.
    const effectiveTime = timeUnknown ? "12:00" : time;
    const isoDate = `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    const resolved = resolveBirthInstant(
      isoDate,
      effectiveTime,
      place.timezone,
    );

    if (!resolved.valid)
      return setError(resolved.problem ?? "Could not resolve that moment.");

    const profile = addProfile(
      {
        name: name.trim() || "Untitled chart",
        utc: resolved.utc,
        localDateTime: `${isoDate} ${effectiveTime}`,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone,
        offsetMinutes: resolved.offsetMinutes,
        placeName: placeLabel(place),
        timeUnknown,
      },
      makePrimary,
    );

    onDone(profile.id);
  };

  const segment = (
    value: string,
    setValue: (v: string) => void,
    placeholder: string,
    maxLength: number,
    ref?: React.RefObject<HTMLInputElement | null>,
    nextRef?: React.RefObject<HTMLInputElement | null>,
  ) => (
    <input
      ref={ref}
      inputMode="numeric"
      placeholder={placeholder}
      value={value}
      maxLength={maxLength}
      onChange={(event) => {
        const digits = event.target.value
          .replace(/\D/g, "")
          .slice(0, maxLength);
        setValue(digits);
        if (digits.length === maxLength) nextRef?.current?.focus();
      }}
      className={cn(inputClass, "tabular text-center")}
    />
  );

  return (
    <Card className="p-5">
      <div className="space-y-5">
        <Field label="Name">
          <input
            className={inputClass}
            placeholder="Who is this chart for?"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field label="Date of birth">
          <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
            {segment(day, setDay, "DD", 2, undefined, monthRef)}
            {segment(month, setMonth, "MM", 2, monthRef, yearRef)}
            {segment(year, setYear, "YYYY", 4, yearRef)}
          </div>
        </Field>

        <Field
          label="Time of birth"
          hint={
            timeUnknown
              ? "Without a time the Ascendant and houses can't be trusted — planets in signs still hold."
              : "24-hour local time at the place of birth."
          }
        >
          <input
            type="time"
            className={cn(inputClass, "tabular", timeUnknown && "opacity-40")}
            value={time}
            disabled={timeUnknown}
            onChange={(event) => setTime(event.target.value)}
          />
          <button
            type="button"
            onClick={() => setTimeUnknown((v) => !v)}
            className="mt-2.5 flex items-center gap-2 text-xs text-muted transition-colors hover:text-ink"
          >
            <span
              className={cn(
                "grid h-4 w-4 place-items-center rounded border text-[9px]",
                timeUnknown
                  ? "border-primary bg-primary text-void"
                  : "border-white/20",
              )}
            >
              {timeUnknown ? "✓" : ""}
            </span>
            I don&apos;t know my exact time
          </button>
        </Field>

        <Field label="Birth city">
          <PlaceSearch value={place} onSelect={setPlace} />
        </Field>

        {error && <p className="text-xs text-fire">{error}</p>}

        <Button onClick={submit} disabled={!ready} className="w-full">
          {submitLabel}
        </Button>
      </div>
    </Card>
  );
}
