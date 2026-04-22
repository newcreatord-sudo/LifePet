const COMMUNITY_DEMO_KEY = "lifepet:communityDemoMode";

export function isCommunityDemoEnabled() {
  try {
    return localStorage.getItem(COMMUNITY_DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

export function setCommunityDemoEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(COMMUNITY_DEMO_KEY, "1");
    else localStorage.removeItem(COMMUNITY_DEMO_KEY);
  } catch {
    return;
  }
}

export function shouldUseCommunityDemoData() {
  return isCommunityDemoEnabled();
}

