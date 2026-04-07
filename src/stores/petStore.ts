import { create } from "zustand";
import type { Pet } from "@/types";

type PetState = {
  activePetId: string | null;
  pets: Pet[];
  setPets: (pets: Pet[]) => void;
  setActivePetId: (petId: string | null) => void;
};

export const usePetStore = create<PetState>((set) => ({
  activePetId: null,
  pets: [],
  setPets: (pets) =>
    set((s) => ({
      pets,
      activePetId: s.activePetId ?? (pets[0]?.id ?? null),
    })),
  setActivePetId: (activePetId) => set({ activePetId }),
}));

