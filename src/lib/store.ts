"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BirthData } from "./astro/chart";
import type { HouseSystem } from "./astro/constants";

export interface Profile extends BirthData {
  id: string;
  /** The profile the app opens to. Exactly one is primary. */
  primary: boolean;
  createdAt: string;
}

interface AstralState {
  profiles: Profile[];
  activeId: string | null;
  houseSystem: HouseSystem;
  hydrated: boolean;
  addProfile: (birth: BirthData, makePrimary?: boolean) => Profile;
  updateProfile: (id: string, patch: Partial<Profile>) => void;
  removeProfile: (id: string) => void;
  setActive: (id: string) => void;
  setHouseSystem: (system: HouseSystem) => void;
  reset: () => void;
}

function makeId() {
  return `p_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export const useAstral = create<AstralState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeId: null,
      houseSystem: "placidus",
      hydrated: false,

      addProfile: (birth, makePrimary = false) => {
        const isFirst = get().profiles.length === 0;
        const profile: Profile = {
          ...birth,
          id: makeId(),
          primary: makePrimary || isFirst,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          profiles: profile.primary
            ? [
                ...state.profiles.map((p) => ({ ...p, primary: false })),
                profile,
              ]
            : [...state.profiles, profile],
          activeId:
            profile.primary || !state.activeId ? profile.id : state.activeId,
        }));
        return profile;
      },

      updateProfile: (id, patch) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        })),

      removeProfile: (id) =>
        set((state) => {
          const profiles = state.profiles.filter((p) => p.id !== id);
          const activeId =
            state.activeId === id ? (profiles[0]?.id ?? null) : state.activeId;
          // Never leave the list without a primary.
          if (profiles.length && !profiles.some((p) => p.primary))
            profiles[0].primary = true;
          return { profiles, activeId };
        }),

      setActive: (id) => set({ activeId: id }),
      setHouseSystem: (houseSystem) => set({ houseSystem }),
      reset: () => set({ profiles: [], activeId: null }),
    }),
    {
      name: "astral-store",
      version: 1,
      partialize: (state) => ({
        profiles: state.profiles,
        activeId: state.activeId,
        houseSystem: state.houseSystem,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

/** The profile the app is currently showing, or null before onboarding. */
export function useActiveProfile(): Profile | null {
  const profiles = useAstral((s) => s.profiles);
  const activeId = useAstral((s) => s.activeId);
  return (
    profiles.find((p) => p.id === activeId) ??
    profiles.find((p) => p.primary) ??
    profiles[0] ??
    null
  );
}

export function usePrimaryProfile(): Profile | null {
  const profiles = useAstral((s) => s.profiles);
  return profiles.find((p) => p.primary) ?? profiles[0] ?? null;
}
