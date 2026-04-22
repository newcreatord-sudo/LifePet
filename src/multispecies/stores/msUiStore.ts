import { create } from "zustand";

export type MultiSpeciesMode = "pet" | "farm";

type MsUiState = {
  mode: MultiSpeciesMode;
  selectedSubjectId: string | null;
  selectedDeviceId: string | null;
  simRunning: boolean;
  simIntensity: number;
  setMode: (mode: MultiSpeciesMode) => void;
  setSelectedSubjectId: (id: string | null) => void;
  setSelectedDeviceId: (id: string | null) => void;
  setSimRunning: (running: boolean) => void;
  setSimIntensity: (v: number) => void;
};

function readMode(): MultiSpeciesMode {
  try {
    const v = String(localStorage.getItem("lifepet:ms:mode") || "").trim();
    if (v === "pet" || v === "farm") return v;
    return "pet";
  } catch {
    return "pet";
  }
}

function readSimRunning(): boolean {
  try {
    return localStorage.getItem("lifepet:ms:simRunning") === "1";
  } catch {
    return false;
  }
}

function readSimIntensity(): number {
  try {
    const v = Number(localStorage.getItem("lifepet:ms:simIntensity") || "");
    if (!Number.isFinite(v)) return 0.35;
    return Math.max(0.05, Math.min(1, v));
  } catch {
    return 0.35;
  }
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export const useMsUiStore = create<MsUiState>((set) => ({
  mode: readMode(),
  selectedSubjectId: null,
  selectedDeviceId: null,
  simRunning: readSimRunning(),
  simIntensity: readSimIntensity(),
  setMode: (mode) => {
    persist("lifepet:ms:mode", mode);
    set({ mode });
  },
  setSelectedSubjectId: (id) => set({ selectedSubjectId: id }),
  setSelectedDeviceId: (id) => set({ selectedDeviceId: id }),
  setSimRunning: (running) => {
    persist("lifepet:ms:simRunning", running ? "1" : "0");
    set({ simRunning: running });
  },
  setSimIntensity: (v) => {
    const next = Math.max(0.05, Math.min(1, v));
    persist("lifepet:ms:simIntensity", String(next));
    set({ simIntensity: next });
  },
}));

