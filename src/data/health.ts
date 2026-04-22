import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  limit,
  type UpdateData,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { reportFirestoreError } from "@/lib/firestoreFallback";
import type { HealthEvent } from "@/types";

function requireUid() {
  const uid = getFirebase().auth.currentUser?.uid;
  if (!uid) throw new Error("Devi effettuare l'accesso");
  return uid;
}

function normalizeHealthEventInput(petId: string, input: Omit<HealthEvent, "id">) {
  const uid = requireUid();
  const next: Omit<HealthEvent, "id"> = {
    ...input,
    petId,
    createdBy: input.createdBy || uid,
  };
  if (next.createdBy !== uid) throw new Error("createdBy non valido");
  return next;
}

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:healthEvents`;
}

export function healthEventsCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "healthEvents");
}

export function subscribeRecentHealthEvents(petId: string, userId: string, limitCount: number, onData: (events: HealthEvent[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<HealthEvent[]>(demoKey(petId), [], (all) => {
      const events = all.slice().sort((a, b) => b.occurredAt - a.occurredAt).slice(0, limitCount);
      onData(events);
    });
  }
  const q = query(
    healthEventsCol(petId),
    where("petId", "==", petId),
    where("createdBy", "==", userId),
    orderBy("occurredAt", "desc"),
    limit(limitCount)
  );
  return onSnapshot(
    q,
    (snap) => {
      const events: HealthEvent[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<HealthEvent, "id">),
      }));
      onData(events);
    },
    (err) => {
      reportFirestoreError(err, "salute:recenti");
      onData([]);
    }
  );
}

export function subscribeHealthEventsRange(
  petId: string,
  userId: string,
  fromMs: number,
  toMs: number,
  limitCount: number,
  onData: (events: HealthEvent[]) => void,
  onError?: (err: unknown) => void
) {
  if (shouldUseDemoData()) {
    return demoSubscribe<HealthEvent[]>(demoKey(petId), [], (all) => {
      const events = all
        .filter((e) => e.occurredAt >= fromMs && e.occurredAt <= toMs)
        .slice()
        .sort((a, b) => b.occurredAt - a.occurredAt)
        .slice(0, limitCount);
      onData(events);
    });
  }
  const q = query(
    healthEventsCol(petId),
    where("petId", "==", petId),
    where("createdBy", "==", userId),
    where("occurredAt", ">=", fromMs),
    where("occurredAt", "<=", toMs),
    orderBy("occurredAt", "desc"),
    limit(limitCount)
  );
  return onSnapshot(
    q,
    (snap) => {
      const events: HealthEvent[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HealthEvent, "id">) }));
      onData(events);
    },
    (err) => {
      reportFirestoreError(err, "salute:intervallo");
      onError?.(err);
    }
  );
}

export async function createHealthEvent(petId: string, input: Omit<HealthEvent, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<HealthEvent, "id">) } as HealthEvent;
    demoUpdate<HealthEvent[]>(demoKey(petId), [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(healthEventsCol(petId), normalizeHealthEventInput(petId, input));
  return ref.id;
}

export async function updateHealthEvent(
  petId: string,
  eventId: string,
  patch: UpdateData<Omit<HealthEvent, "id" | "petId" | "createdAt" | "createdBy">>
) {
  if (shouldUseDemoData()) {
    const cleaned = Object.fromEntries(
      Object.entries(patch as Record<string, unknown>).map(([k, v]) => {
        if (v && typeof v === "object" && (v as { _methodName?: unknown })._methodName === "deleteField") return [k, undefined];
        return [k, v];
      })
    );
    demoUpdate<HealthEvent[]>(demoKey(petId), [], (prev) => prev.map((e) => (e.id === eventId ? { ...e, ...cleaned } : e)));
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "healthEvents", eventId), patch);
}

export async function deleteHealthEvent(petId: string, eventId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<HealthEvent[]>(demoKey(petId), [], (prev) => prev.filter((e) => e.id !== eventId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "healthEvents", eventId));
}
