import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { reportFirestoreError } from "@/lib/firestoreFallback";
import type { WalkPresence, WalkBadge } from "@/types";

function demoKey() {
  return "lifepet:demo:walkPresence";
}

export function walkPresenceCol() {
  const { db } = getFirebase();
  return collection(db, "walkPresence");
}

export async function upsertWalkPresence(input: WalkPresence) {
  if (shouldUseDemoData()) {
    demoUpdate<WalkPresence[]>(demoKey(), [], (prev) => {
      const copy = prev.slice();
      const idx = copy.findIndex((p) => p.petId === input.petId);
      if (idx >= 0) copy[idx] = input;
      else copy.unshift(input);
      return copy;
    });
    return;
  }
  const { db } = getFirebase();
  await setDoc(doc(db, "walkPresence", input.petId), input, { merge: true });
}

export async function removeWalkPresence(petId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<WalkPresence[]>(demoKey(), [], (prev) => prev.filter((p) => p.petId !== petId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "walkPresence", petId));
}

export function subscribeRecentWalkPresence(sinceMs: number, onData: (items: WalkPresence[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<WalkPresence[]>(demoKey(), [], (all) => {
      onData(all.filter((p) => p.updatedAt >= sinceMs).slice().sort((a, b) => b.updatedAt - a.updatedAt));
    });
  }
  const q = query(walkPresenceCol(), where("updatedAt", ">=", sinceMs), orderBy("updatedAt", "desc"), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as WalkPresence);
      onData(items);
    },
    (err) => {
      reportFirestoreError(err, "passeggiate");
      onData([]);
    }
  );
}

export function badgeLabel(b: WalkBadge) {
  if (b === "green") return "Verde";
  if (b === "yellow") return "Giallo";
  return "Rosso";
}
