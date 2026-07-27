"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartWheel } from "@/components/ChartWheel";
import {
  Card,
  Meter,
  Pill,
  Screen,
  SectionLabel,
  TabBar,
} from "@/components/ui";
import { RequireChart } from "@/components/RequireChart";
import { useActiveProfile, useAstral } from "@/lib/store";
import {
  placementsByHouse,
  type Chart,
  type Placement,
} from "@/lib/astro/chart";
import {
  ELEMENT_COLORS,
  HOUSE_SYSTEMS,
  HOUSE_SYSTEM_LABELS,
  type Element,
  type PlanetId,
  type PointId,
} from "@/lib/astro/constants";
import {
  aspectTitle,
  aspectText,
  chartHeadline,
  dignityText,
  ordinal,
  planetInHouse,
  planetInSign,
} from "@/lib/astro/interpretations";
import { formatOrb } from "@/lib/astro/aspects";
import { formatBirthLine, cn } from "@/lib/utils";

type Tab = "wheel" | "placements" | "houses" | "aspects";

export default function ChartPage() {
  return <RequireChart>{(chart) => <ChartView chart={chart} />}</RequireChart>;
}

function ChartView({ chart }: { chart: Chart }) {
  const [tab, setTab] = useState<Tab>("wheel");
  const [focused, setFocused] = useState<PointId | null>(null);
  const profile = useActiveProfile();
  const houseSystem = useAstral((s) => s.houseSystem);
  const setHouseSystem = useAstral((s) => s.setHouseSystem);

  const sun = chart.byId.sun;
  const moon = chart.byId.moon;
  const asc = chart.byId.asc;

  return (
    <>
      <Screen>
        <header className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>Natal chart</SectionLabel>
            <Link
              href="/profiles"
              className="text-xs text-muted transition-colors hover:text-ink"
            >
              Profiles ›
            </Link>
          </div>
          <h1 className="font-serif text-[30px] leading-tight">
            {profile?.name}
          </h1>
          <p className="mt-1 text-[13px] text-muted tabular">
            {formatBirthLine(
              chart.birth.localDateTime,
              chart.birth.placeName,
              chart.birth.timeUnknown,
            )}
          </p>
        </header>

        {chart.birth.timeUnknown && (
          <Card className="mb-5 border-fire/25 bg-fire/[0.06]">
            <p className="text-xs leading-relaxed text-fire/90">
              No birth time on file, so this chart is cast for noon. Planets in
              signs and the aspects between them are reliable; the Ascendant,
              Midheaven and all house placements are not.
            </p>
          </Card>
        )}

        <div className="mb-5">
          <ChartWheel
            chart={chart}
            onSelect={(id) => setFocused(id === focused ? null : id)}
          />
        </div>

        {focused && chart.byId[focused] && (
          <FocusCard
            placement={chart.byId[focused]}
            onClose={() => setFocused(null)}
          />
        )}

        <div className="mb-6 grid grid-cols-3 gap-2.5">
          <BigThree label="Sun" placement={sun} />
          <BigThree label="Moon" placement={moon} />
          <BigThree
            label="Rising"
            placement={asc}
            dimmed={chart.birth.timeUnknown}
          />
        </div>

        <Card className="mb-6">
          <p className="font-serif text-[17px] leading-relaxed text-ink/95">
            {chartHeadline(chart)}
          </p>
        </Card>

        <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
          {(["wheel", "placements", "houses", "aspects"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs capitalize transition-colors",
                tab === t
                  ? "border-primary/40 bg-primary/12 text-primary"
                  : "border-white/10 text-muted hover:text-ink",
              )}
            >
              {t === "wheel" ? "Balance" : t}
            </button>
          ))}
        </div>

        {tab === "wheel" && <BalancePanel chart={chart} />}
        {tab === "placements" && <PlacementsPanel chart={chart} />}
        {tab === "houses" && <HousesPanel chart={chart} />}
        {tab === "aspects" && <AspectsPanel chart={chart} />}

        <Card className="mt-6">
          <SectionLabel className="mb-3">House system</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {HOUSE_SYSTEMS.map((system) => (
              <button
                key={system}
                onClick={() => setHouseSystem(system)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  houseSystem === system
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-white/10 text-muted hover:text-ink",
                )}
              >
                {HOUSE_SYSTEM_LABELS[system]}
              </button>
            ))}
          </div>
          {chart.houses.fellBack && (
            <p className="mt-3 text-[11px] leading-relaxed text-fire/80">
              Placidus is undefined at this latitude — the semi-arcs it needs
              don&apos;t exist inside the polar circle. Showing Porphyry
              instead.
            </p>
          )}
        </Card>
      </Screen>
      <TabBar />
    </>
  );
}

function BigThree({
  label,
  placement,
  dimmed,
}: {
  label: string;
  placement: Placement;
  dimmed?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass lumen rounded-[12px] px-3 py-4 text-center",
        dimmed && "opacity-45",
      )}
    >
      <p className="smallcaps mb-2 text-faint">{label}</p>
      <p className="text-[26px] leading-none text-gold">
        {placement.sign.glyph}
      </p>
      <p className="mt-2 text-[13px] text-ink">{placement.sign.name}</p>
      <p className="tabular text-[11px] text-faint">
        {placement.degree}°{String(placement.minute).padStart(2, "0")}&apos;
      </p>
    </div>
  );
}

function FocusCard({
  placement,
  onClose,
}: {
  placement: Placement;
  onClose: () => void;
}) {
  const dignity = dignityText(placement);
  const isPlanet = !placement.isAngle;
  return (
    <Card className="mb-6 border-primary/25">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-serif text-lg">
            <span className="mr-2 text-primary">{placement.glyph}</span>
            {placement.name} in {placement.sign.name}
          </p>
          <p className="tabular mt-0.5 text-xs text-muted">
            {placement.display} · {ordinal(placement.house)} house
            {placement.retrograde ? " · retrograde" : ""}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-muted transition-colors hover:text-ink"
        >
          ✕
        </button>
      </div>
      {dignity && (
        <div className="mb-3">
          <Pill tone="gold">{dignity}</Pill>
        </div>
      )}
      {isPlanet && (
        <>
          <p className="text-sm leading-relaxed text-ink/85">
            {planetInSign(placement.id as PlanetId, placement.sign.index)}
          </p>
          <p className="mt-3 border-t border-white/8 pt-3 text-sm leading-relaxed text-muted">
            {planetInHouse(placement.id as PlanetId, placement.house)}
          </p>
        </>
      )}
    </Card>
  );
}

function BalancePanel({ chart }: { chart: Chart }) {
  const elements = Object.entries(chart.elements) as [Element, number][];
  const elementTotal = elements.reduce((a, [, v]) => a + v, 0) || 1;
  const modalities = Object.entries(chart.modalities);
  const modalityTotal = modalities.reduce((a, [, v]) => a + v, 0) || 1;

  return (
    <div className="space-y-4">
      <Card>
        <SectionLabel className="mb-4">Elemental balance</SectionLabel>
        <div className="space-y-3">
          {elements.map(([element, value]) => (
            <div key={element} className="flex items-center gap-3">
              <span className="w-14 text-xs capitalize text-muted">
                {element}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${(value / elementTotal) * 100}%`,
                    background: ELEMENT_COLORS[element],
                  }}
                />
              </div>
              <span className="tabular w-9 text-right text-xs text-faint">
                {Math.round((value / elementTotal) * 100)}%
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-faint">
          Weighted by significance: the luminaries and Ascendant count for
          three, personal planets two, the outer planets one.
        </p>
      </Card>

      <Card>
        <SectionLabel className="mb-4">Modality</SectionLabel>
        <div className="space-y-3">
          {modalities.map(([modality, value]) => (
            <div key={modality} className="flex items-center gap-3">
              <span className="w-16 text-xs capitalize text-muted">
                {modality}
              </span>
              <Meter value={(value / modalityTotal) * 100} />
              <span className="tabular w-9 text-right text-xs text-faint">
                {Math.round((value / modalityTotal) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      {chart.stelliums.length > 0 && (
        <Card>
          <SectionLabel className="mb-3">Stelliums</SectionLabel>
          {chart.stelliums.map((s) => (
            <p key={s.sign.name} className="text-sm text-ink/85">
              <span className="mr-2 text-gold">{s.sign.glyph}</span>
              {s.planets.length} bodies in {s.sign.name} — this sign dominates
              the chart.
            </p>
          ))}
        </Card>
      )}

      <Card>
        <SectionLabel className="mb-3">Chart ruler</SectionLabel>
        {chart.chartRuler ? (
          <p className="text-sm leading-relaxed text-ink/85">
            Your Ascendant is in {chart.byId.asc.sign.name}, ruled by{" "}
            <span className="text-primary">{chart.chartRuler.name}</span>, which
            sits in {chart.chartRuler.sign.name} in the{" "}
            {ordinal(chart.chartRuler.house)} house. That placement colours the
            whole chart.
          </p>
        ) : (
          <p className="text-sm text-muted">Needs a birth time.</p>
        )}
      </Card>
    </div>
  );
}

function PlacementsPanel({ chart }: { chart: Chart }) {
  return (
    <div className="space-y-1.5">
      {chart.placements
        .filter((p) => p.id !== "dsc" && p.id !== "ic")
        .map((p) => (
          <div
            key={p.id}
            className="glass flex items-center gap-3 rounded-[10px] px-3.5 py-3"
          >
            <span
              className={cn(
                "w-6 text-center text-lg",
                p.isAngle ? "text-gold" : "text-primary",
              )}
            >
              {p.glyph}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{p.name}</span>
              {p.dignity && (
                <span className="text-[10px] text-gold/80">{p.dignity}</span>
              )}
            </span>
            <span className="tabular text-right text-[13px] text-muted">
              {p.degree}° <span className="text-gold">{p.sign.glyph}</span>{" "}
              {String(p.minute).padStart(2, "0")}&apos;
            </span>
            <span className="tabular w-8 text-right text-[11px] text-faint">
              {p.retrograde ? "℞" : ""}{" "}
              {p.isAngle && p.id !== "fortune" ? "" : p.house}
            </span>
          </div>
        ))}
    </div>
  );
}

function HousesPanel({ chart }: { chart: Chart }) {
  const rows = placementsByHouse(chart);
  return (
    <div className="space-y-2.5">
      {rows.map(({ house, cuspSign, cusp, planets }) => (
        <Card key={house.number} className="p-3.5">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <p className="text-sm text-ink">
              <span className="tabular mr-2 text-faint">{house.number}</span>
              {house.short}
            </p>
            <p className="tabular text-[11px] text-muted">
              {Math.floor(cusp % 30)}°{" "}
              <span className="text-gold">{cuspSign.glyph}</span>
            </p>
          </div>
          <p className="text-[12px] leading-relaxed text-faint">
            {house.domain}
          </p>
          {planets.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {planets.map((p) => (
                <Pill key={p.id} tone="primary">
                  {p.glyph} {p.sign.glyph} {p.degree}°{p.retrograde ? " ℞" : ""}
                </Pill>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function AspectsPanel({ chart }: { chart: Chart }) {
  const [showMinor, setShowMinor] = useState(false);
  const list = chart.aspects.filter((a) => showMinor || a.info.major);

  return (
    <div className="space-y-2.5">
      <button
        onClick={() => setShowMinor((v) => !v)}
        className="mb-1 text-xs text-muted transition-colors hover:text-ink"
      >
        {showMinor
          ? "Hide minor aspects"
          : `Show minor aspects (${chart.aspects.length - chart.aspects.filter((a) => a.info.major).length})`}
      </button>

      {list.map((aspect, i) => {
        const tone =
          aspect.info.nature === "harmonious"
            ? "text-aqua"
            : aspect.info.nature === "challenging"
              ? "text-fire"
              : "text-gold";
        return (
          <Card key={`${aspect.a}-${aspect.b}-${i}`} className="p-3.5">
            <div className="mb-1.5 flex items-center gap-2.5">
              <span className="text-primary">
                {chart.byId[aspect.a]?.glyph}
              </span>
              <span className={cn("text-[15px]", tone)}>
                {aspect.info.glyph}
              </span>
              <span className="text-primary">
                {chart.byId[aspect.b]?.glyph}
              </span>
              <span className="flex-1 text-[13px] text-ink">
                {aspectTitle(aspect)}
              </span>
              <Pill>{formatOrb(aspect.orb)}</Pill>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">
              {aspectText(aspect)}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
