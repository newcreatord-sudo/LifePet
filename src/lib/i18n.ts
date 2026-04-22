export type AppLang = "it" | "en";

const LANG_KEY = "lifepet:lang";

export function getAppLang(): AppLang {
  try {
    const v = String(localStorage.getItem(LANG_KEY) || "").trim().toLowerCase();
    if (v === "en") return "en";
    return "it";
  } catch {
    return "it";
  }
}

export function setAppLang(lang: AppLang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    return;
  }
}

export function tr<T>(lang: AppLang, it: T, en: T) {
  return lang === "en" ? en : it;
}

