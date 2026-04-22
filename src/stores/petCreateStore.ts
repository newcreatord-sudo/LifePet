import { create } from "zustand";

type PetCreateState = {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
};

export const usePetCreateStore = create<PetCreateState>((set) => ({
  open: false,
  openDialog: () => set({ open: true }),
  closeDialog: () => set({ open: false }),
}));

