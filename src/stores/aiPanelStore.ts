import { create } from "zustand";

type AiPanelState = {
  open: boolean;
  draft: string;
  bump: number;
  openPanel: () => void;
  closePanel: () => void;
  openWithDraft: (draft: string) => void;
  consumeDraft: () => void;
};

export const useAiPanelStore = create<AiPanelState>((set) => ({
  open: false,
  draft: "",
  bump: 0,
  openPanel: () => set({ open: true }),
  closePanel: () => set({ open: false, draft: "" }),
  openWithDraft: (draft) => set((s) => ({ open: true, draft, bump: s.bump + 1 })),
  consumeDraft: () => set({ draft: "" }),
}));

