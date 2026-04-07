import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { HealthEvent } from "@/types";

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:healthEvents`;
}

export function healthEventsCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "healthEvents");
}

export function subscribeRecentHealthEvents(petId: string, limitCount: number, onData: (events: HealthEvent[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<HealthEvent[]>(demoKey(petId), [], (all) => {
      const events = all.slice().sort((a, b) => b.occurredAt - a.occurredAt).slice(0, limitCount);
      onData(events);
    });
  }
  const q = query(healthEventsCol(petId), orderBy("occurredAt", "desc"), limit(limitCount));
  return onSnapshot(q, (snap) => {
    const events: HealthEvent[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<HealthEvent, "id">),
    }));
    onData(events);
  });
}

export async function createHealthEvent(petId: string, input: Omit<HealthEvent, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<HealthEvent, "id">) } as HealthEvent;
    demoUpdate<HealthEvent[]>(demoKey(petId), [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(healthEventsCol(petId), input);
  return ref.id;
}
