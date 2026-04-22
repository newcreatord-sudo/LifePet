import { create } from "zustand";
import type { AppLang } from "@/lib/i18n";
import { getAppLang, setAppLang } from "@/lib/i18n";

type I18nState = {
  lang: AppLang;
  setLang: (lang: AppLang) => void;
};

function applyLangToDocument(lang: AppLang) {
  try {
    document.documentElement.lang = lang;
  } catch {
    return;
  }
}

export const useI18nStore = create<I18nState>((set) => {
  const initial = typeof window !== "undefined" ? getAppLang() : "it";
  if (typeof document !== "undefined") applyLangToDocument(initial);

  return {
    lang: initial,
    setLang: (lang) => {
      setAppLang(lang);
      applyLangToDocument(lang);
      set({ lang });
    },
  };
});

