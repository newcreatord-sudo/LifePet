import { create } from "zustand";
import type { Pet } from "@/types";

const ACTIVE_KEY = "lifepet:activePetId";

function readActivePetId(): string | null {
  try {
    const v = localStorage.getItem(ACTIVE_KEY);
    return v ? v : null;
  } catch {
    return null;
  }
}

function writeActivePetId(petId: string | null) {
  try {
    if (!petId) localStorage.removeItem(ACTIVE_KEY);
    else localStorage.setItem(ACTIVE_KEY, petId);
  } catch {
    return;
  }
}

type PetState = {
  activePetId: string | null;
  pets: Pet[];
  setPets: (pets: Pet[]) => void;
  setActivePetId: (petId: string | null) => void;
};

export const usePetStore = create<PetState>((set) => ({
  activePetId: readActivePetId(),
  pets: [],
  setPets: (pets) =>
    set((s) => {
      if (pets.length === 0) {
        if (s.activePetId) return { pets: s.pets, activePetId: s.activePetId };
        writeActivePetId(null);
        return { pets: [], activePetId: null };
      }
      if (s.activePetId && pets.some((p) => p.id === s.activePetId)) {
        return { pets, activePetId: s.activePetId };
      }
      const next = pets[0]?.id ?? null;
      writeActivePetId(next);
      return { pets, activePetId: next };
    }),
  setActivePetId: (activePetId) => {
    writeActivePetId(activePetId);
    set({ activePetId });
  },
}));
