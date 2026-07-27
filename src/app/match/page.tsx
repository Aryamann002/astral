"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Pill,
  Screen,
  SectionLabel,
  TabBar,
} from "@/components/ui";
import { RequireChart } from "@/components/RequireChart";
import { BirthForm } from "@/components/BirthForm";
import { useAstral, usePrimaryProfile } from "@/lib/store";
import { buildChart, type Chart } from "@/lib/astro/chart";
import {
  CATEGORY_LABELS,
  computeSynastry,
  type Category,
  type SynastryAspect,
} from "@/lib/astro/synastry";
import { formatOrb } from "@/lib/astro/aspects";
import { cn } from "@/lib/utils";

export default function MatchPage() {
  return (
    <RequireChart>{(chart) => <MatchView selfChart={chart} />}</RequireChart>
  );
}

function MatchView({ selfChart }: { selfChart: Chart }) {
  const profiles = useAstral((s) => s.profiles);
  const houseSystem = useAstral((s) => s.houseSystem);
  const primary = usePrimaryProfile();
  const others = profiles.filter((p) => p.id !== primary?.id);

  const [partnerId, setPartnerId] = useState<string | null>(
    others[0]?.id ?? null,
  );
  const [adding, setAdding] = useState(false);

  const partnerChart = useMemo(() => {
    const partner = profiles.find((p) => p.id === partnerId);
    if (!partner) return null;
    try {
      return buildChart({ ...partner, houseSystem });
    } catch {
      return null;
    }
  }, [profiles, partnerId, houseSystem]);

  const synastry = useMemo(
    () => (partnerChart ? computeSynastry(selfChart, partnerChart) : null),
    [selfChart, partnerChart],
  );

  return (
    <>
      <Screen>
        <h1 className="mb-5 text-center font-serif text-[30px]">Match</h1>

        {others.length > 1 && (
          <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
            {others.map((p) => (
              <button
                key={p.id}
                onClick={() => setPartnerId(p.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                  partnerId === p.id
                    ? "border-primary/40 bg-primary/12 text-primary"
                    : "border-white/10 text-muted hover:text-ink",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {!partnerChart && !adding && (
          <Card className="text-center">
            <p className="font-serif text-xl">Compare two charts</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
              Add someone&apos;s birth details and Astral will read the contacts
              between your two charts.
            </p>
            <div className="mt-5">
              <Button onClick={() => setAdding(true)}>
                Add another person
              </Button>
            </div>
          </Card>
        )}

        {adding && (
          <div className="mb-5">
            <SectionLabel className="mb-3">Their birth details</SectionLabel>
            <BirthForm
              submitLabel="Compare charts"
              onDone={(id) => {
                setPartnerId(id);
                setAdding(false);
              }}
            />
            <button
              onClick={() => setAdding(false)}
              className="mt-3 w-full text-center text-xs text-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </div>
        )}

        {synastry && partnerChart && !adding && (
          <>
            <div className="mb-6 flex items-center justify-center gap-5">
              <Avatar
                name={selfChart.birth.name}
                glyph={selfChart.byId.sun.sign.glyph}
                sign={selfChart.byId.sun.sign.name}
              />
              <ScoreGauge value={synastry.overall} />
              <Avatar
                name={partnerChart.birth.name}
                glyph={partnerChart.byId.sun.sign.glyph}
                sign={partnerChart.byId.sun.sign.name}
              />
            </div>

            <Card className="mb-5">
              <p className="font-serif text-[17px] leading-relaxed text-ink/95">
                {synastry.headline}
              </p>
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted">
                {synastry.elementNote}
              </p>
            </Card>

            <div className="mb-6 space-y-3">
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((category) => (
                <Card key={category} className="flex items-center gap-3 p-3.5">
                  <span className="w-28 text-[13px] text-ink">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-gold transition-[width] duration-700"
                      style={{ width: `${synastry.categories[category]}%` }}
                    />
                  </div>
                  <span className="tabular w-10 text-right text-[13px] text-gold">
                    {synastry.categories[category]}%
                  </span>
                </Card>
              ))}
            </div>

            <AspectSection
              label="Strongest connections"
              aspects={synastry.strongest}
              tone="aqua"
              charts={[selfChart, partnerChart]}
            />

            {synastry.friction.length > 0 && (
              <AspectSection
                label="Friction points"
                aspects={synastry.friction}
                tone="fire"
                charts={[selfChart, partnerChart]}
              />
            )}

            <div className="mt-6">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setAdding(true)}
              >
                Add another person
              </Button>
            </div>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-faint">
              The score is a weighted reading of inter-chart aspects, not a
              measurement. The breakdown below it is where the information
              actually is.
            </p>
          </>
        )}
      </Screen>
      <TabBar />
    </>
  );
}

function Avatar({
  name,
  glyph,
  sign,
}: {
  name: string;
  glyph: string;
  sign: string;
}) {
  return (
    <div className="text-center">
      <div className="glass mx-auto grid h-16 w-16 place-items-center rounded-full border-gold/25">
        <span className="text-2xl text-gold">{glyph}</span>
      </div>
      <p className="mt-2 max-w-20 truncate text-[13px] text-ink">
        {name.split(" ")[0]}
      </p>
      <p className="text-[10px] text-faint">{sign}</p>
    </div>
  );
}

function ScoreGauge({ value }: { value: number }) {
  const size = 104;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (value / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a99bff" />
            <stop offset="100%" stopColor="#e8c58a" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-[stroke-dasharray] duration-1000"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="font-serif text-[30px] leading-none tabular">{value}</p>
          <p className="smallcaps mt-1 text-[9px] text-faint">Harmony</p>
        </div>
      </div>
    </div>
  );
}

function AspectSection({
  label,
  aspects,
  tone,
  charts,
}: {
  label: string;
  aspects: SynastryAspect[];
  tone: "aqua" | "fire";
  charts: [Chart, Chart];
}) {
  return (
    <div className="mb-6">
      <SectionLabel className={cn("mb-3", tone === "fire" && "text-fire/80")}>
        {label}
      </SectionLabel>
      <div className="space-y-2.5">
        {aspects.map((aspect, i) => (
          <Card key={`${aspect.a}-${aspect.b}-${i}`} className="p-3.5">
            <div className="mb-1.5 flex items-center gap-2.5">
              <span className="text-primary">
                {charts[0].byId[aspect.a]?.glyph}
              </span>
              <span
                className={cn(
                  "text-[15px]",
                  tone === "fire" ? "text-fire" : "text-aqua",
                )}
              >
                {aspect.info.glyph}
              </span>
              <span className="text-gold">
                {charts[1].byId[aspect.b]?.glyph}
              </span>
              <span className="flex-1 text-[13px] text-ink">
                {aspect.title}
              </span>
              <Pill tone={tone === "fire" ? "warm" : "aqua"}>
                {formatOrb(aspect.orb)}
              </Pill>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">
              {aspect.interpretation}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
