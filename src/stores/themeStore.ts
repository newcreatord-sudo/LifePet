import { create } from "zustand";

export type ThemePalette = "sky" | "violet" | "mint" | "sunset" | "mono";
export type ThemeBackground = "pastel" | "clean";
export type ThemeSheet = "white" | "soft" | "warm";

type ThemeState = {
  palette: ThemePalette;
  animated: boolean;
  background: ThemeBackground;
  sheet: ThemeSheet;
  setPalette: (palette: ThemePalette) => void;
  setAnimated: (animated: boolean) => void;
  setBackground: (background: ThemeBackground) => void;
  setSheet: (sheet: ThemeSheet) => void;
  reset: () => void;
};

const paletteTokens: Record<ThemePalette, { primary: string; primary700: string; accent1: string; accent2: string; bg1: string; bg2: string; bg3: string }> = {
  sky: {
    primary: "14 165 233",
    primary700: "3 105 161",
    accent1: "99 102 241",
    accent2: "34 197 94",
    bg1: "224 247 255",
    bg2: "255 255 255",
    bg3: "240 238 255",
  },
  violet: {
    primary: "139 92 246",
    primary700: "109 40 217",
    accent1: "56 189 248",
    accent2: "236 72 153",
    bg1: "245 238 255",
    bg2: "255 255 255",
    bg3: "232 244 255",
  },
  mint: {
    primary: "16 185 129",
    primary700: "4 120 87",
    accent1: "56 189 248",
    accent2: "99 102 241",
    bg1: "221 255 242",
    bg2: "255 255 255",
    bg3: "236 232 255",
  },
  sunset: {
    primary: "249 115 22",
    primary700: "194 65 12",
    accent1: "236 72 153",
    accent2: "99 102 241",
    bg1: "255 241 230",
    bg2: "255 255 255",
    bg3: "255 228 230",
  },
  mono: {
    primary: "14 165 233",
    primary700: "3 105 161",
    accent1: "56 189 248",
    accent2: "34 197 94",
    bg1: "241 245 249",
    bg2: "255 255 255",
    bg3: "226 232 240",
  },
};

const sheetTokens: Record<ThemeSheet, { sheet: string; sheetAlpha: string; panelAlpha: string }> = {
  white: { sheet: "255 255 255", sheetAlpha: "0.99", panelAlpha: "0.96" },
  soft: { sheet: "248 251 255", sheetAlpha: "0.98", panelAlpha: "0.95" },
  warm: { sheet: "255 250 244", sheetAlpha: "0.99", panelAlpha: "0.96" },
};

function rgba(triplet: string, a: number) {
  const [r, g, b] = triplet.split(" ");
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function computeAppBg(p: (typeof paletteTokens)[ThemePalette], bg: ThemeBackground) {
  if (bg === "clean") {
    return `linear-gradient(180deg, ${rgba(p.bg2, 1)} 0%, ${rgba(p.bg2, 1)} 100%)`;
  }
  return `radial-gradient(1200px 900px at 10% 10%, ${rgba(p.bg1, 0.96)} 0%, ${rgba(p.bg2, 0.98)} 45%, ${rgba(p.bg3, 0.96)} 100%)`;
}

function computeAnimatedBg(p: (typeof paletteTokens)[ThemePalette], bg: ThemeBackground) {
  const base = bg === "clean" ? 0.08 : 0.10;
  const a1 = base + 0.10;
  const a2 = base + 0.06;
  const a3 = base + 0.06;
  return `radial-gradient(1100px 800px at 10% 10%, ${rgba(p.bg1, 0.94)} 0%, ${rgba(p.bg2, 0.92)} 45%, ${rgba(p.bg3, 0.92)} 100%), radial-gradient(900px 700px at 90% 30%, ${rgba(p.accent1, a1)} 0%, rgba(0, 0, 0, 0) 60%), radial-gradient(900px 700px at 70% 90%, ${rgba(p.accent2, a2)} 0%, rgba(0, 0, 0, 0) 60%), radial-gradient(900px 700px at 20% 80%, ${rgba(p.primary, a3)} 0%, rgba(0, 0, 0, 0) 58%)`;
}

function applyTokenOverrides(s: Pick<ThemeState, "palette" | "background" | "sheet">) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const p = paletteTokens[s.palette];
  const sh = sheetTokens[s.sheet];
  root.style.setProperty("--lp-primary", p.primary);
  root.style.setProperty("--lp-primary-700", p.primary700);
  root.style.setProperty("--lp-accent-1", p.accent1);
  root.style.setProperty("--lp-accent-2", p.accent2);
  root.style.setProperty("--lp-bg-1", p.bg1);
  root.style.setProperty("--lp-bg-2", p.bg2);
  root.style.setProperty("--lp-bg-3", p.bg3);
  root.style.setProperty("--lp-app-bg", computeAppBg(p, s.background));
  root.style.setProperty("--lp-animated-bg", computeAnimatedBg(p, s.background));
  root.style.setProperty("--lp-sheet", sh.sheet);
  root.style.setProperty("--lp-sheet-alpha", sh.sheetAlpha);
  root.style.setProperty("--lp-panel-alpha", sh.panelAlpha);
}

function readPalette(): ThemePalette {
  const v = String(localStorage.getItem("lifepet:theme:palette") || "").trim();
  if (v === "sky" || v === "violet" || v === "mint" || v === "sunset" || v === "mono") return v;
  return "sky";
}

function readAnimated(): boolean {
  const v = String(localStorage.getItem("lifepet:theme:animated") || "").trim();
  if (v === "1") return true;
  if (v === "0") return false;
  return false;
}

function readBackground(): ThemeBackground {
  const v = String(localStorage.getItem("lifepet:theme:bg") || "").trim();
  if (v === "clean" || v === "pastel") return v;
  return "pastel";
}

function readSheet(): ThemeSheet {
  const v = String(localStorage.getItem("lifepet:theme:sheet") || "").trim();
  if (v === "white" || v === "soft" || v === "warm") return v;
  return "white";
}

function applyTheme(s: Pick<ThemeState, "palette" | "animated" | "background" | "sheet">) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark");
  root.classList.add("light");
  root.dataset.lpPalette = s.palette;
  root.dataset.lpAnimated = s.animated ? "1" : "0";
  root.dataset.lpBg = s.background;
  root.dataset.lpSheet = s.sheet;
  root.removeAttribute("data-lp-force-light");
  applyTokenOverrides(s);

  try {
    localStorage.setItem("lifepet:theme:mode", "light");
    localStorage.setItem("lifepet:theme:palette", s.palette);
    localStorage.setItem("lifepet:theme:animated", s.animated ? "1" : "0");
    localStorage.setItem("lifepet:theme:bg", s.background);
    localStorage.setItem("lifepet:theme:sheet", s.sheet);
  } catch {
    return;
  }
}

const initial = {
  palette: readPalette(),
  animated: readAnimated(),
  background: readBackground(),
  sheet: readSheet(),
};

try {
  localStorage.setItem("lifepet:theme:mode", "light");
} catch {
  // ignore
}

applyTheme(initial);

export const useThemeStore = create<ThemeState>((set, get) => {
  return {
    ...initial,
    setPalette: (palette) => {
      set({ palette });
      applyTheme({ ...get(), palette });
    },
    setAnimated: (animated) => {
      set({ animated });
      applyTheme({ ...get(), animated });
    },
    setBackground: (background) => {
      set({ background });
      applyTheme({ ...get(), background });
    },
    setSheet: (sheet) => {
      set({ sheet });
      applyTheme({ ...get(), sheet });
    },
    reset: () => {
      const next = { palette: "sky" as const, animated: false, background: "pastel" as const, sheet: "white" as const };
      set(next);
      applyTheme(next);
    },
  };
});
