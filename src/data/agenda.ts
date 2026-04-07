import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { AgendaEvent } from "@/types";

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:agendaEvents`;
}

export function agendaEventsCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "agendaEvents");
}

export function subscribeUpcomingAgenda(petId: string, fromMs: number, limitCount: number, onData: (events: AgendaEvent[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<AgendaEvent[]>(demoKey(petId), [], (all) => {
      const events = all
        .filter((e) => e.dueAt >= fromMs)
        .slice()
        .sort((a, b) => a.dueAt - b.dueAt)
        .slice(0, limitCount);
      onData(events);
    });
  }
  const q = query(
    agendaEventsCol(petId),
    where("dueAt", ">=", fromMs),
    orderBy("dueAt", "asc"),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    const events: AgendaEvent[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgendaEvent, "id">) }));
    onData(events);
  });
}

export function subscribeAgendaRange(petId: string, fromMs: number, toMs: number, onData: (events: AgendaEvent[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<AgendaEvent[]>(demoKey(petId), [], (all) => {
      const events = all
        .filter((e) => e.dueAt >= fromMs && e.dueAt <= toMs)
        .slice()
        .sort((a, b) => a.dueAt - b.dueAt);
      onData(events);
    });
  }
  const q = query(
    agendaEventsCol(petId),
    where("dueAt", ">=", fromMs),
    where("dueAt", "<=", toMs),
    orderBy("dueAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    const events: AgendaEvent[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgendaEvent, "id">) }));
    onData(events);
  });
}

export async function createAgendaEvent(petId: string, input: Omit<AgendaEvent, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<AgendaEvent, "id">) } as AgendaEvent;
    demoUpdate<AgendaEvent[]>(demoKey(petId), [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(agendaEventsCol(petId), input);
  return ref.id;
}

export async function updateAgendaEvent(petId: string, eventId: string, patch: Partial<Omit<AgendaEvent, "id" | "petId" | "createdAt" | "createdBy">>) {
  if (shouldUseDemoData()) {
    demoUpdate<AgendaEvent[]>(demoKey(petId), [], (prev) =>
      prev.map((e) => (e.id === eventId ? ({ ...e, ...(patch as Partial<AgendaEvent>) } as AgendaEvent) : e))
    );
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "agendaEvents", eventId), patch);
}

export async function deleteAgendaEvent(petId: string, eventId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<AgendaEvent[]>(demoKey(petId), [], (prev) => prev.filter((e) => e.id !== eventId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "agendaEvents", eventId));
}
