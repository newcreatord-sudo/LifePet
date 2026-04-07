import { getFirebaseConfigError } from "@/lib/firebase";

const DEMO_FLAG_KEY = "lifepet:demoMode";

export function isDemoModeEnabled() {
  try {
    return localStorage.getItem(DEMO_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDemoModeEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(DEMO_FLAG_KEY, "1");
    else localStorage.removeItem(DEMO_FLAG_KEY);
  } catch {
    return;
  }
}

export function canUseFirebase() {
  return !getFirebaseConfigError();
}

export function shouldUseDemoData() {
  const configError = getFirebaseConfigError();
  if (!configError) return false;
  return isDemoModeEnabled();
}

