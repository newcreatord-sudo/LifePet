import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  setDoc,
  onSnapshot,
  orderBy,
  query,
  type QueryConstraint,
  updateDoc,
  where,
  limit,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoRead, demoSubscribe, demoUpdate, demoWrite } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { shouldUseCommunityDemoData } from "@/lib/communityMode";
import type { AdoptionPost } from "@/types";

const DEMO_KEY = "lifepet:demo:adoptions";

function col() {
  const { db } = getFirebase();
  return collection(db, "adoptions");
}

export function subscribeAdoptions(
  maxCount: number,
  filters: { status?: AdoptionPost["status"]; species?: string } = {},
  onData: (items: AdoptionPost[]) => void,
  onError?: (err: unknown) => void
) {
  const lim = Math.min(200, Math.max(10, Math.floor(maxCount || 50)));

  if (shouldUseDemoData()) {
    return demoSubscribe<AdoptionPost[]>(DEMO_KEY, [], (all) => {
      const items = all
        .filter((p) => (filters.status ? p.status === filters.status : true))
        .filter((p) => (filters.species ? p.species === filters.species : true))
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, lim);
      onData(items);
    });
  }

  if (shouldUseCommunityDemoData()) {
    return demoSubscribe<AdoptionPost[]>(DEMO_KEY, [], (all) => {
      const items = all
        .filter((p) => (filters.status ? p.status === filters.status : true))
        .filter((p) => (filters.species ? p.species === filters.species : true))
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, lim);
      onData(items);
    });
  }

  const w: QueryConstraint[] = [];
  if (filters.status) w.push(where("status", "==", filters.status));
  if (filters.species) w.push(where("species", "==", filters.species));
  w.push(orderBy("createdAt", "desc"));
  w.push(limit(lim));
  const q = query(col(), ...w);
  return onSnapshot(
    q,
    (snap) => {
      const items: AdoptionPost[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdoptionPost, "id">) }));
      onData(items);
    },
    (err) => {
      onError?.(err);
      onData([]);
    }
  );
}

export async function createAdoption(input: Omit<AdoptionPost, "id">) {
  if (shouldUseDemoData() || shouldUseCommunityDemoData()) {
    const id = demoId();
    const next: AdoptionPost = { id, ...(input as Omit<AdoptionPost, "id">) };
    demoUpdate<AdoptionPost[]>(DEMO_KEY, [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(col(), input);
  return ref.id;
}

export async function updateAdoption(adoptionId: string, patch: Partial<Omit<AdoptionPost, "id">>) {
  if (shouldUseDemoData() || shouldUseCommunityDemoData()) {
    demoUpdate<AdoptionPost[]>(DEMO_KEY, [], (prev) => prev.map((p) => (p.id === adoptionId ? ({ ...p, ...patch } as AdoptionPost) : p)));
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "adoptions", adoptionId), patch);
}

export async function deleteAdoption(adoptionId: string) {
  if (shouldUseDemoData() || shouldUseCommunityDemoData()) {
    demoUpdate<AdoptionPost[]>(DEMO_KEY, [], (prev) => prev.filter((p) => p.id !== adoptionId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "adoptions", adoptionId));
}

export function subscribeMyAdoptions(
  uid: string,
  maxCount: number,
  filters: { status?: AdoptionPost["status"] } = {},
  onData: (items: AdoptionPost[]) => void,
  onError?: (err: unknown) => void
) {
  const lim = Math.min(200, Math.max(10, Math.floor(maxCount || 50)));
  if (shouldUseDemoData() || shouldUseCommunityDemoData()) {
    return demoSubscribe<AdoptionPost[]>(DEMO_KEY, [], (all) => {
      const items = all
        .filter((p) => p.createdBy === uid)
        .filter((p) => (filters.status ? p.status === filters.status : true))
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, lim);
      onData(items);
    });
  }
  const q = query(col(), where("createdBy", "==", uid), ...(filters.status ? [where("status", "==", filters.status)] : []), orderBy("createdAt", "desc"), limit(lim));
  return onSnapshot(
    q,
    (snap) => {
      const items: AdoptionPost[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdoptionPost, "id">) }));
      onData(items);
    },
    (err) => {
      onError?.(err);
      onData([]);
    }
  );
}

export async function reportAdoption(adoptionId: string, reporterId: string, reason: string) {
  if (shouldUseDemoData() || shouldUseCommunityDemoData()) {
    demoUpdate<AdoptionPost[]>(DEMO_KEY, [], (prev) => prev.map((p) => (p.id === adoptionId ? { ...p, reportCount: (p.reportCount ?? 0) + 1 } : p)));
    return;
  }
  const { db } = getFirebase();
  await setDoc(
    doc(db, "adoptions", adoptionId, "reports", reporterId),
    { reporterId, reason: reason.trim().slice(0, 500), createdAt: Date.now() },
    { merge: true }
  );
}

export function seedDemoAdoptions() {
  if (!(shouldUseDemoData() || shouldUseCommunityDemoData())) return;
  const existing = demoRead<AdoptionPost[]>(DEMO_KEY, []);
  if (existing.length) return;
  const now = Date.now();
  demoWrite<AdoptionPost[]>(DEMO_KEY, [
    {
      id: demoId(),
      createdAt: now - 1000 * 60 * 40,
      createdBy: "demo",
      status: "active",
      species: "dog",
      name: "Luna",
      ageLabel: "2 anni",
      size: "medium",
      temperamentTags: ["dolce", "socievole"],
      description: "Cerca una famiglia paziente. Abituata al guinzaglio.",
      locationLabel: "Roma",
      reportCount: 0,
      updatedAt: now - 1000 * 60 * 40,
    },
    {
      id: demoId(),
      createdAt: now - 1000 * 60 * 120,
      createdBy: "demo",
      status: "active",
      species: "cat",
      name: "Milo",
      ageLabel: "8 mesi",
      size: "small",
      temperamentTags: ["timido", "curioso"],
      description: "Trovatello recuperato, si ambienta con calma.",
      locationLabel: "Milano",
      reportCount: 0,
      updatedAt: now - 1000 * 60 * 120,
    },
  ]);
}
