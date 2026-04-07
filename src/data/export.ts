import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { Pet } from "@/types";

async function fetchSubcollection(petId: string, name: string, limitCount: number) {
  const { db } = getFirebase();
  const col = collection(db, "pets", petId, name);
  const q = query(col, orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchSubcollectionByTs(petId: string, name: string, tsField: string, fromMs: number, toMs: number, limitCount: number) {
  const { db } = getFirebase();
  const col = collection(db, "pets", petId, name);
  const q = query(col, where(tsField, ">=", fromMs), where(tsField, "<=", toMs), orderBy(tsField, "desc"), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function exportPetData(petId: string, range?: { fromMs: number; toMs: number }) {
  if (shouldUseDemoData()) {
    return {
      schemaVersion: 1,
      exportedAt: Date.now(),
      petId,
      demo: true,
      note: "Export completo non disponibile in modalità demo.",
    };
  }

  const { db } = getFirebase();
  const petSnap = await getDoc(doc(db, "pets", petId));
  const pet = petSnap.exists() ? ({ id: petSnap.id, ...(petSnap.data() as Omit<Pet, "id">) } satisfies Pet) : null;

  const fromMs = range?.fromMs ?? Date.now() - 365 * 24 * 60 * 60 * 1000;
  const toMs = range?.toMs ?? Date.now();

  const [
    logs,
    healthEvents,
    gpsPoints,
    agendaEvents,
    tasks,
    routines,
    documents,
    expenses,
    notifications,
    vaccines,
    medications,
    bookings,
  ] = await Promise.all([
    fetchSubcollectionByTs(petId, "logs", "occurredAt", fromMs, toMs, 3000),
    fetchSubcollectionByTs(petId, "healthEvents", "occurredAt", fromMs, toMs, 1500),
    fetchSubcollectionByTs(petId, "gpsPoints", "recordedAt", fromMs, toMs, 3000),
    fetchSubcollectionByTs(petId, "agendaEvents", "dueAt", fromMs, toMs, 1500),
    fetchSubcollection(petId, "tasks", 3000),
    fetchSubcollection(petId, "routines", 500),
    fetchSubcollection(petId, "documents", 1000),
    fetchSubcollection(petId, "expenses", 2000),
    fetchSubcollectionByTs(petId, "notifications", "createdAt", fromMs, toMs, 2000),
    fetchSubcollection(petId, "vaccines", 500),
    fetchSubcollection(petId, "medications", 500),
    fetchSubcollection(petId, "bookings", 500),
  ]);

  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    range: { fromMs, toMs },
    pet,
    collections: {
      logs,
      healthEvents,
      gpsPoints,
      agendaEvents,
      tasks,
      routines,
      documents,
      expenses,
      notifications,
      vaccines,
      medications,
      bookings,
    },
  };
}

