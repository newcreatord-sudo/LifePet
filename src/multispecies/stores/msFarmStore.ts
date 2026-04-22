import { create } from "zustand";

type FarmState = {
  activeFarmId: string;
  setActiveFarmId: (id: string) => void;
};

function readActiveFarmId() {
  try {
    return String(localStorage.getItem("lifepet:farm:activeFarmId") || "");
  } catch {
    return "";
  }
}

function persist(id: string) {
  try {
    localStorage.setItem("lifepet:farm:activeFarmId", id);
  } catch {
    return;
  }
}

export const useMsFarmStore = create<FarmState>((set) => ({
  activeFarmId: readActiveFarmId(),
  setActiveFarmId: (id) => {
    persist(id);
    set({ activeFarmId: id });
  },
}));

