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

  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("lifepet:demoMode"));
    }
  } catch {
    return;
  }
}

export function canUseFirebase() {
  return !getFirebaseConfigError();
}

export function shouldUseDemoData() {
  return isDemoModeEnabled() || !canUseFirebase();
}
