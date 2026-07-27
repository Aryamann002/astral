"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  Pill,
  Screen,
  SectionLabel,
  TabBar,
} from "@/components/ui";
import { BirthForm } from "@/components/BirthForm";
import { useAstral } from "@/lib/store";
import { useHydrated } from "@/lib/useChart";
import { buildChart } from "@/lib/astro/chart";
import { formatBirthLine, cn } from "@/lib/utils";

export default function ProfilesPage() {
  const hydrated = useHydrated();
  const profiles = useAstral((s) => s.profiles);
  const activeId = useAstral((s) => s.activeId);
  const setActive = useAstral((s) => s.setActive);
  const removeProfile = useAstral((s) => s.removeProfile);
  const updateProfile = useAstral((s) => s.updateProfile);
  const [adding, setAdding] = useState(false);

  if (!hydrated) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <span className="animate-pulse text-2xl text-primary/60">✦</span>
      </main>
    );
  }

  return (
    <>
      <Screen>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-[30px]">Charts</h1>
          <Link
            href="/chart"
            className="text-xs text-muted transition-colors hover:text-ink"
          >
            ‹ Back
          </Link>
        </div>

        <div className="mb-6 space-y-2.5">
          {profiles.map((profile) => {
            let sunGlyph = "·";
            try {
              sunGlyph = buildChart(profile).byId.sun.sign.glyph;
            } catch {
              /* an unparseable profile still gets listed so it can be deleted */
            }
            const active = profile.id === activeId;

            return (
              <Card
                key={profile.id}
                className={cn(
                  "p-3.5",
                  active && "border-primary/35 bg-primary/[0.06]",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-xl text-gold">{sunGlyph}</span>
                  <button
                    onClick={() => setActive(profile.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="flex items-center gap-2 text-[15px] text-ink">
                      {profile.name}
                      {profile.primary && <Pill tone="gold">you</Pill>}
                    </p>
                    <p className="tabular mt-0.5 truncate text-[11px] text-muted">
                      {formatBirthLine(
                        profile.localDateTime,
                        profile.placeName,
                        profile.timeUnknown,
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] text-faint">
                      {profile.timezone}
                    </p>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {active && (
                      <span className="text-[10px] text-primary">viewing</span>
                    )}
                    {!profile.primary && (
                      <button
                        onClick={() => {
                          useAstral.setState((state) => ({
                            profiles: state.profiles.map((p) => ({
                              ...p,
                              primary: p.id === profile.id,
                            })),
                          }));
                          updateProfile(profile.id, { primary: true });
                        }}
                        className="text-[10px] text-faint transition-colors hover:text-gold"
                      >
                        make mine
                      </button>
                    )}
                    <button
                      onClick={() => removeProfile(profile.id)}
                      className="text-[10px] text-faint transition-colors hover:text-fire"
                    >
                      delete
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {adding ? (
          <>
            <SectionLabel className="mb-3">New chart</SectionLabel>
            <BirthForm
              submitLabel="Save chart"
              onDone={() => setAdding(false)}
            />
            <button
              onClick={() => setAdding(false)}
              className="mt-3 w-full text-center text-xs text-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setAdding(true)}
          >
            Add a chart
          </Button>
        )}
      </Screen>
      <TabBar />
    </>
  );
}
