import { collection, doc, documentId, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoRead, demoSubscribe, demoWrite } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { reportFirestoreError } from "@/lib/firestoreFallback";

export type UserPlan = "free" | "pro";

export type PublicProfile = {
  uid: string;
  displayName: string;
  handle?: string;
  photoURL?: string;
  photoPath?: string;
  createdAt: number;
  updatedAt: number;
};

export type UserProfile = {
  uid: string;
  email?: string | null;
  plan: UserPlan;
  preferences?: {
    aiEnabled?: boolean;
    gpsEnabled?: boolean;
    communityEnabled?: boolean;
    providerConsoleProviderId?: string;
    telemetryEnabled?: boolean;
    pushEnabled?: boolean;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  };
  createdAt: number;
  updatedAt: number;
};

const DEMO_KEY = "lifepet:demo:userProfile";
const DEMO_PUBLIC_PREFIX = "lifepet:demo:publicProfile:";

function publicProfileKey(uid: string) {
  return `${DEMO_PUBLIC_PREFIX}${uid}`;
}

async function ensurePublicProfile(uid: string, email?: string | null) {
  const now = Date.now();
  const fallbackName = (email ?? "").split("@")[0] || `user-${uid.slice(0, 6)}`;

  if (shouldUseDemoData()) {
    const prev = demoRead<PublicProfile | null>(publicProfileKey(uid), null);
    if (prev) return;
    demoWrite<PublicProfile>(publicProfileKey(uid), {
      uid,
      displayName: fallbackName,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  const { db } = getFirebase();
  const ref = doc(db, "publicProfiles", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      displayName: fallbackName,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  const data = snap.data() as { displayName?: unknown };
  if (typeof data.displayName !== "string" || !data.displayName.trim()) {
    await updateDoc(ref, { displayName: fallbackName, updatedAt: now });
  }
}

export async function ensureUserProfile(uid: string, email?: string | null) {
  const now = Date.now();
  if (shouldUseDemoData()) {
    const prev = demoRead<UserProfile | null>(DEMO_KEY, null);
    if (prev) return;
    demoWrite<UserProfile>(DEMO_KEY, {
      uid,
      email: email ?? null,
      plan: "pro",
      preferences: {
        aiEnabled: true,
        gpsEnabled: true,
        communityEnabled: true,
        telemetryEnabled: false,
        pushEnabled: true,
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      },
      createdAt: now,
      updatedAt: now,
    });
    await ensurePublicProfile(uid, email);
    return;
  }
  const { db } = getFirebase();
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: email ?? null,
      plan: "free",
      preferences: {
        aiEnabled: true,
        gpsEnabled: true,
        communityEnabled: true,
        telemetryEnabled: false,
        pushEnabled: true,
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      },
      createdAt: now,
      updatedAt: now,
    });
    await ensurePublicProfile(uid, email);
    return;
  }
  await updateDoc(ref, { email: email ?? null, updatedAt: now });
  await ensurePublicProfile(uid, email);
}

export async function updateUserPreferences(uid: string, patch: NonNullable<UserProfile["preferences"]>) {
  const now = Date.now();
  if (shouldUseDemoData()) {
    const prev = demoRead<UserProfile | null>(DEMO_KEY, null);
    if (!prev) return;
    demoWrite<UserProfile>(DEMO_KEY, { ...prev, preferences: { ...(prev.preferences ?? {}), ...patch }, updatedAt: now });
    return;
  }
  const { db } = getFirebase();
  const ref = doc(db, "users", uid);
  const update: Record<string, unknown> = { updatedAt: now };
  if (patch.aiEnabled !== undefined) update["preferences.aiEnabled"] = patch.aiEnabled;
  if (patch.gpsEnabled !== undefined) update["preferences.gpsEnabled"] = patch.gpsEnabled;
  if (patch.communityEnabled !== undefined) update["preferences.communityEnabled"] = patch.communityEnabled;
  if (patch.providerConsoleProviderId !== undefined) update["preferences.providerConsoleProviderId"] = patch.providerConsoleProviderId;
  if (patch.telemetryEnabled !== undefined) update["preferences.telemetryEnabled"] = patch.telemetryEnabled;
  if (patch.pushEnabled !== undefined) update["preferences.pushEnabled"] = patch.pushEnabled;
  if (patch.quietHoursEnabled !== undefined) update["preferences.quietHoursEnabled"] = patch.quietHoursEnabled;
  if (patch.quietHoursStart !== undefined) update["preferences.quietHoursStart"] = patch.quietHoursStart;
  if (patch.quietHoursEnd !== undefined) update["preferences.quietHoursEnd"] = patch.quietHoursEnd;
  await updateDoc(ref, update);
}

export function subscribeUserProfile(uid: string, onData: (profile: UserProfile | null) => void) {
  if (!uid) {
    onData(null);
    return () => {};
  }
  if (shouldUseDemoData()) {
    return demoSubscribe<UserProfile | null>(DEMO_KEY, null, (p) => onData(p));
  }
  const { db } = getFirebase();
  const ref = doc(db, "users", uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return onData(null);
      const data = snap.data() as Omit<UserProfile, "uid">;
      onData({ uid, ...data });
    },
    (err) => {
      reportFirestoreError(err, "profilo-utente");
      onData(null);
    }
  );
}

export function subscribePublicProfile(uid: string, onData: (profile: PublicProfile | null) => void) {
  if (!uid) {
    onData(null);
    return () => {};
  }
  if (shouldUseDemoData()) {
    return demoSubscribe<PublicProfile | null>(publicProfileKey(uid), null, (p) => onData(p));
  }
  const { db } = getFirebase();
  const ref = doc(db, "publicProfiles", uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return onData(null);
      onData(snap.data() as PublicProfile);
    },
    (err) => {
      reportFirestoreError(err, "profilo-pubblico");
      onData(null);
    }
  );
}

export async function fetchPublicProfiles(uids: string[]) {
  const uniq = Array.from(new Set(uids.filter(Boolean)));
  if (uniq.length === 0) return {} as Record<string, PublicProfile | null>;

  if (shouldUseDemoData()) {
    const out: Record<string, PublicProfile | null> = {};
    for (const uid of uniq) out[uid] = demoRead<PublicProfile | null>(publicProfileKey(uid), null);
    return out;
  }

  const { db } = getFirebase();
  const colRef = collection(db, "publicProfiles");
  const out: Record<string, PublicProfile | null> = {};

  for (let i = 0; i < uniq.length; i += 10) {
    const chunk = uniq.slice(i, i + 10);
    const snap = await getDocs(query(colRef, where(documentId(), "in", chunk)));
    for (const uid of chunk) out[uid] = null;
    for (const d of snap.docs) {
      const uid = d.id;
      out[uid] = d.data() as PublicProfile;
    }
  }

  return out;
}

export async function updatePublicProfile(uid: string, patch: Partial<Omit<PublicProfile, "uid" | "createdAt" | "updatedAt">>) {
  const now = Date.now();
  const nextPatch: Partial<PublicProfile> = { updatedAt: now };
  if (patch.displayName !== undefined) {
    const v = String(patch.displayName).trim().slice(0, 40);
    nextPatch.displayName = v || `user-${uid.slice(0, 6)}`;
  }
  if (patch.handle !== undefined) {
    const raw = String(patch.handle).trim().replace(/^@+/, "");
    const norm = raw.toLowerCase();
    const ok = norm.length >= 2 && norm.length <= 24 && /^[a-z0-9_.]+$/.test(norm);
    (nextPatch as Record<string, unknown>).handle = raw ? (ok ? norm : null) : null;
  }
  if (patch.photoURL !== undefined) {
    const v = String(patch.photoURL).trim().slice(0, 800);
    (nextPatch as Record<string, unknown>).photoURL = v ? v : null;
  }
  if (patch.photoPath !== undefined) {
    const v = String(patch.photoPath).trim().slice(0, 200);
    (nextPatch as Record<string, unknown>).photoPath = v ? v : null;
  }

  if (shouldUseDemoData()) {
    const prev = demoRead<PublicProfile | null>(publicProfileKey(uid), null);
    if (!prev) return;
    demoWrite<PublicProfile>(publicProfileKey(uid), { ...prev, ...nextPatch });
    return;
  }

  const { db } = getFirebase();
  await updateDoc(doc(db, "publicProfiles", uid), nextPatch as Record<string, unknown>);
}
