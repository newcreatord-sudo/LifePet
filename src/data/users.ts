import { doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoRead, demoSubscribe, demoWrite } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";

export type UserPlan = "free" | "pro";

export type UserProfile = {
  uid: string;
  email?: string | null;
  plan: UserPlan;
  createdAt: number;
  updatedAt: number;
};

const DEMO_KEY = "lifepet:demo:userProfile";

export async function ensureUserProfile(uid: string, email?: string | null) {
  const now = Date.now();
  if (shouldUseDemoData()) {
    const prev = demoRead<UserProfile | null>(DEMO_KEY, null);
    if (prev) return;
    demoWrite<UserProfile>(DEMO_KEY, { uid, email: email ?? null, plan: "pro", createdAt: now, updatedAt: now });
    return;
  }
  const { db } = getFirebase();
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { email: email ?? null, plan: "free", createdAt: now, updatedAt: now });
    return;
  }
  await updateDoc(ref, { email: email ?? null, updatedAt: now });
}

export function subscribeUserProfile(uid: string, onData: (profile: UserProfile | null) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<UserProfile | null>(DEMO_KEY, null, (p) => onData(p));
  }
  const { db } = getFirebase();
  const ref = doc(db, "users", uid);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return onData(null);
    const data = snap.data() as Omit<UserProfile, "uid">;
    onData({ uid, ...data });
  });
}
