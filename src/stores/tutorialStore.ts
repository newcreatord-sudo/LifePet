import { create } from "zustand";

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  cta?: { label: string; href: string };
};

type TutorialState = {
  enabled: boolean;
  open: boolean;
  routeKey: string;
  stepIndex: number;
  autoOpened: boolean;
  completedRouteKeys: Record<string, boolean>;
  setAutoOpened: (v: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;
  openForRoute: (routeKey: string) => void;
  close: () => void;
  next: (stepCount: number) => void;
  prev: () => void;
  markRouteDone: (routeKey: string) => void;
  resetProgress: () => void;
};

const LS_KEY = "lifepet:tutorial:v1";

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as {
      enabled?: unknown;
      completedRouteKeys?: unknown;
    };
    const enabled = typeof j.enabled === "boolean" ? j.enabled : true;
    const completedRouteKeys = (j.completedRouteKeys && typeof j.completedRouteKeys === "object" ? (j.completedRouteKeys as Record<string, boolean>) : {}) ?? {};
    return { enabled, completedRouteKeys };
  } catch {
    return null;
  }
}

function save(enabled: boolean, completedRouteKeys: Record<string, boolean>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ enabled, completedRouteKeys }));
  } catch {
    return;
  }
}

const initial = typeof window === "undefined" ? null : load();

export const useTutorialStore = create<TutorialState>((set, get) => ({
  enabled: initial?.enabled ?? true,
  open: false,
  routeKey: "",
  stepIndex: 0,
  autoOpened: false,
  completedRouteKeys: initial?.completedRouteKeys ?? {},
  setAutoOpened: (v) => set({ autoOpened: v }),
  setEnabled: (enabled) => {
    const completedRouteKeys = get().completedRouteKeys;
    set({ enabled });
    save(enabled, completedRouteKeys);
  },
  toggleEnabled: () => {
    const enabled = !get().enabled;
    const completedRouteKeys = get().completedRouteKeys;
    set({ enabled });
    save(enabled, completedRouteKeys);
  },
  openForRoute: (routeKey) => {
    set({ open: true, routeKey, stepIndex: 0 });
  },
  close: () => {
    set({ open: false, stepIndex: 0 });
  },
  next: (stepCount) => {
    const idx = get().stepIndex;
    const next = Math.min(stepCount - 1, idx + 1);
    set({ stepIndex: next });
  },
  prev: () => {
    const idx = get().stepIndex;
    const prev = Math.max(0, idx - 1);
    set({ stepIndex: prev });
  },
  markRouteDone: (routeKey) => {
    const completedRouteKeys = { ...get().completedRouteKeys, [routeKey]: true };
    const enabled = get().enabled;
    set({ completedRouteKeys });
    save(enabled, completedRouteKeys);
  },
  resetProgress: () => {
    const enabled = get().enabled;
    set({ completedRouteKeys: {} });
    save(enabled, {});
  },
}));
