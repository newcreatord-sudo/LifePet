import { collection, limit, onSnapshot, orderBy, query, type Unsubscribe } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { demoRead } from "@/lib/demoDb";
import type { PetId, SafetyEvent } from "@/types";

export function subscribeSafetyEvents(petId: PetId, onData: (items: SafetyEvent[]) => void): Unsubscribe {
  if (!petId) {
    onData([]);
    return () => void 0;
  }

  if (shouldUseDemoData()) {
    const all = demoRead<SafetyEvent[]>("lifepet:demo:safetyEvents", []);
    const filtered = all.filter((e) => e.petId === petId).slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 25);
    onData(filtered);
    return () => void 0;
  }

  const { db } = getFirebase();
  const q = query(collection(db, "pets", petId, "safetyEvents"), orderBy("createdAt", "desc"), limit(25));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SafetyEvent, "id">) }));
    onData(items);
  });
}

