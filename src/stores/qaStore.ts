import { create } from "zustand";

export type QaEventType = "nav" | "error" | "warn" | "info";

export type QaEvent = {
  id: string;
  type: QaEventType;
  at: number;
  message: string;
};

function newId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type QaState = {
  events: QaEvent[];
  push: (type: QaEventType, message: string) => void;
  clear: () => void;
};

export const useQaStore = create<QaState>((set) => ({
  events: [],
  push: (type, message) => {
    const evt: QaEvent = {
      id: newId(),
      type,
      at: Date.now(),
      message: String(message || "").slice(0, 800),
    };
    set((s) => ({ events: [evt, ...s.events].slice(0, 60) }));
  },
  clear: () => set({ events: [] }),
}));

export function pushQa(type: QaEventType, message: string) {
  useQaStore.getState().push(type, message);
}

