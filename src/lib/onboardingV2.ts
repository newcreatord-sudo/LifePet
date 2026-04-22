export type OnboardingSteps = {
  petCreated: boolean;
  docOrVaccineAdded: boolean;
  reminderCreated: boolean;
};

export type OnboardingMeta = {
  startedAt: number | null;
  goal: "protection" | "documents" | "routine" | null;
  petCreatedAt: number | null;
  docOrVaccineAddedAt: number | null;
  reminderCreatedAt: number | null;
  protectionSeenAt: number | null;
};

const COMPLETED_KEY = "lifepet:onboardingCompleted";
const STEPS_KEY = "lifepet:onboardingSteps:v2";
const META_KEY = "lifepet:onboardingMeta:v2";
const EVT = "lifepet:onboarding";

function readSteps(): OnboardingSteps {
  try {
    const raw = localStorage.getItem(STEPS_KEY);
    if (!raw) return { petCreated: false, docOrVaccineAdded: false, reminderCreated: false };
    const j = JSON.parse(raw) as Partial<OnboardingSteps>;
    return {
      petCreated: Boolean(j.petCreated),
      docOrVaccineAdded: Boolean(j.docOrVaccineAdded),
      reminderCreated: Boolean(j.reminderCreated),
    };
  } catch {
    return { petCreated: false, docOrVaccineAdded: false, reminderCreated: false };
  }
}

function writeSteps(next: OnboardingSteps) {
  try {
    localStorage.setItem(STEPS_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  try {
    window.dispatchEvent(new Event(EVT));
  } catch {
    return;
  }
}

function readMeta(): OnboardingMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) {
      return {
        startedAt: null,
        goal: null,
        petCreatedAt: null,
        docOrVaccineAddedAt: null,
        reminderCreatedAt: null,
        protectionSeenAt: null,
      };
    }
    const j = JSON.parse(raw) as Partial<OnboardingMeta>;
    const goal = j.goal === "protection" || j.goal === "documents" || j.goal === "routine" ? j.goal : null;
    return {
      startedAt: typeof j.startedAt === "number" ? j.startedAt : null,
      goal,
      petCreatedAt: typeof j.petCreatedAt === "number" ? j.petCreatedAt : null,
      docOrVaccineAddedAt: typeof j.docOrVaccineAddedAt === "number" ? j.docOrVaccineAddedAt : null,
      reminderCreatedAt: typeof j.reminderCreatedAt === "number" ? j.reminderCreatedAt : null,
      protectionSeenAt: typeof j.protectionSeenAt === "number" ? j.protectionSeenAt : null,
    };
  } catch {
    return {
      startedAt: null,
      goal: null,
      petCreatedAt: null,
      docOrVaccineAddedAt: null,
      reminderCreatedAt: null,
      protectionSeenAt: null,
    };
  }
}

function writeMeta(next: OnboardingMeta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  try {
    window.dispatchEvent(new Event(EVT));
  } catch {
    return;
  }
}

export function isOnboardingCompleted() {
  try {
    return localStorage.getItem(COMPLETED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOnboardingCompleted() {
  try {
    localStorage.setItem(COMPLETED_KEY, "1");
  } catch {
    return;
  }
  try {
    window.dispatchEvent(new Event(EVT));
  } catch {
    return;
  }
}

export function getOnboardingSteps(): OnboardingSteps {
  return typeof window === "undefined" ? { petCreated: false, docOrVaccineAdded: false, reminderCreated: false } : readSteps();
}

export function getOnboardingMeta(): OnboardingMeta {
  return typeof window === "undefined"
    ? { startedAt: null, goal: null, petCreatedAt: null, docOrVaccineAddedAt: null, reminderCreatedAt: null, protectionSeenAt: null }
    : readMeta();
}

export function markOnboardingStarted() {
  if (typeof window === "undefined") return;
  const cur = readMeta();
  if (typeof cur.startedAt === "number" && Number.isFinite(cur.startedAt)) return;
  writeMeta({ ...cur, startedAt: Date.now() });
}

export function setOnboardingGoal(goal: OnboardingMeta["goal"]) {
  if (typeof window === "undefined") return;
  const cur = readMeta();
  writeMeta({ ...cur, goal });
}

export function markProtectionSeen() {
  if (typeof window === "undefined") return;
  const cur = readMeta();
  if (typeof cur.protectionSeenAt === "number" && Number.isFinite(cur.protectionSeenAt)) return;
  writeMeta({ ...cur, protectionSeenAt: Date.now() });
}

export function getOnboardingProgressPercent(steps?: OnboardingSteps) {
  const s = steps ?? getOnboardingSteps();
  const done = [s.petCreated, s.docOrVaccineAdded, s.reminderCreated].filter(Boolean).length;
  return Math.round((done / 3) * 100);
}

export function markOnboardingStep(step: keyof OnboardingSteps) {
  if (typeof window === "undefined") return;
  const cur = readSteps();
  const next = { ...cur, [step]: true } as OnboardingSteps;
  writeSteps(next);

  const meta = readMeta();
  const now = Date.now();
  const nextMeta: OnboardingMeta = {
    ...meta,
    petCreatedAt: step === "petCreated" ? meta.petCreatedAt ?? now : meta.petCreatedAt,
    docOrVaccineAddedAt: step === "docOrVaccineAdded" ? meta.docOrVaccineAddedAt ?? now : meta.docOrVaccineAddedAt,
    reminderCreatedAt: step === "reminderCreated" ? meta.reminderCreatedAt ?? now : meta.reminderCreatedAt,
  };
  writeMeta(nextMeta);

  const complete = next.petCreated && next.docOrVaccineAdded && next.reminderCreated;
  if (complete) setOnboardingCompleted();
}

export function resetOnboardingV2() {
  try {
    localStorage.removeItem(STEPS_KEY);
    localStorage.removeItem(META_KEY);
  } catch {
    return;
  }
  try {
    window.dispatchEvent(new Event(EVT));
  } catch {
    return;
  }
}
