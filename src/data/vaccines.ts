import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, type UpdateData, updateDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import type { PetVaccine } from "@/types";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { createAgendaEvent } from "@/data/agenda";

function vaxCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "vaccines");
}

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:vaccines`;
}

function computeNextDue(lastAt: number | null, intervalDays: number) {
  const base = lastAt ?? Date.now();
  return base + intervalDays * 24 * 60 * 60 * 1000;
}

async function createOrUpdateAgenda(petId: string, createdBy: string, name: string, nextDueAt: number, reminderDaysBefore: number) {
  const reminderMinutesBefore = Math.max(0, reminderDaysBefore) * 24 * 60;
  await createAgendaEvent(petId, {
    petId,
    title: `Vaccine: ${name}`,
    dueAt: nextDueAt,
    kind: "vet",
    reminderMinutesBefore,
    createdAt: Date.now(),
    createdBy,
  });
}

export function subscribeVaccines(petId: string, onData: (items: PetVaccine[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<PetVaccine[]>(demoKey(petId), [], (all) => {
      const items = all.slice().sort((a, b) => a.nextDueAt - b.nextDueAt);
      onData(items);
    });
  }
  const q = query(vaxCol(petId), orderBy("nextDueAt", "asc"));
  return onSnapshot(q, (snap) => {
    const items: PetVaccine[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PetVaccine, "id">) }));
    onData(items);
  });
}

export async function createVaccine(petId: string, input: Omit<PetVaccine, "id" | "nextDueAt" | "updatedAt"> & { lastAt?: number | null }) {
  const now = Date.now();
  const nextDueAt = computeNextDue(input.lastAt ?? null, input.intervalDays);
  const payload: Omit<PetVaccine, "id"> = {
    petId,
    name: input.name,
    lastAt: input.lastAt ?? undefined,
    nextDueAt,
    intervalDays: input.intervalDays,
    reminderDaysBefore: input.reminderDaysBefore,
    notes: input.notes,
    createdAt: now,
    createdBy: input.createdBy,
    updatedAt: now,
  };

  if (shouldUseDemoData()) {
    const id = demoId();
    const next: PetVaccine = { id, ...payload };
    demoUpdate<PetVaccine[]>(demoKey(petId), [], (prev) => [next, ...prev]);
    await createOrUpdateAgenda(petId, payload.createdBy, payload.name, payload.nextDueAt, payload.reminderDaysBefore);
    return id;
  }

  const ref = await addDoc(vaxCol(petId), payload);
  await createOrUpdateAgenda(petId, payload.createdBy, payload.name, payload.nextDueAt, payload.reminderDaysBefore);
  return ref.id;
}

export async function markVaccineGiven(petId: string, vaccine: PetVaccine, lastAt: number) {
  const now = Date.now();
  const nextDueAt = computeNextDue(lastAt, vaccine.intervalDays);
  if (shouldUseDemoData()) {
    demoUpdate<PetVaccine[]>(demoKey(petId), [], (prev) =>
      prev.map((v) => (v.id === vaccine.id ? { ...v, lastAt, nextDueAt, updatedAt: now } : v))
    );
    await createOrUpdateAgenda(petId, vaccine.createdBy, vaccine.name, nextDueAt, vaccine.reminderDaysBefore);
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "vaccines", vaccine.id), { lastAt, nextDueAt, updatedAt: now });
  await createOrUpdateAgenda(petId, vaccine.createdBy, vaccine.name, nextDueAt, vaccine.reminderDaysBefore);
}

export async function updateVaccine(
  petId: string,
  vaccine: PetVaccine,
  patch: UpdateData<Pick<PetVaccine, "name" | "notes" | "intervalDays" | "reminderDaysBefore" | "lastAt">>
) {
  const now = Date.now();
  const cleanedForMerge = Object.fromEntries(
    Object.entries(patch as Record<string, unknown>).map(([k, v]) => {
      if (v && typeof v === "object" && (v as { _methodName?: unknown })._methodName === "deleteField") return [k, undefined];
      return [k, v];
    })
  ) as Partial<Pick<PetVaccine, "name" | "notes" | "intervalDays" | "reminderDaysBefore" | "lastAt">>;

  const merged = { ...vaccine, ...cleanedForMerge, updatedAt: now } as PetVaccine;
  const nextDueAt = computeNextDue(merged.lastAt ?? null, merged.intervalDays);
  const writePatch: UpdateData<Pick<PetVaccine, "name" | "notes" | "intervalDays" | "reminderDaysBefore" | "lastAt" | "nextDueAt" | "updatedAt">> = {
    ...(patch as Record<string, unknown>),
    nextDueAt,
    updatedAt: now,
  };

  if (shouldUseDemoData()) {
    const demoPatch = Object.fromEntries(
      Object.entries(writePatch as Record<string, unknown>).map(([k, v]) => {
        if (v && typeof v === "object" && (v as { _methodName?: unknown })._methodName === "deleteField") return [k, undefined];
        return [k, v];
      })
    );
    demoUpdate<PetVaccine[]>(demoKey(petId), [], (prev) => prev.map((v) => (v.id === vaccine.id ? { ...v, ...demoPatch } : v)));
    await createOrUpdateAgenda(petId, merged.createdBy, merged.name, nextDueAt, merged.reminderDaysBefore);
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "vaccines", vaccine.id), writePatch);
  await createOrUpdateAgenda(petId, merged.createdBy, merged.name, nextDueAt, merged.reminderDaysBefore);
}

export async function deleteVaccine(petId: string, vaccineId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<PetVaccine[]>(demoKey(petId), [], (prev) => prev.filter((v) => v.id !== vaccineId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "vaccines", vaccineId));
}
