import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, type UpdateData, updateDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import type { PetMedication } from "@/types";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { ensureTaskExists } from "@/data/tasks";

function medsCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "medications");
}

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:medications`;
}

function parseTimeToDayMs(time: string, base: Date) {
  const [hh, mm] = time.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const d = new Date(base);
  d.setHours(hh, mm, 0, 0);
  return d.getTime();
}

function occurrencesNextDays(med: Pick<PetMedication, "startAt" | "endAt" | "times">, daysAhead: number) {
  const startAt = med.startAt;
  const endAt = med.endAt;
  const times = med.times;
  const now = Date.now();
  const base = new Date(now);
  const out: number[] = [];
  for (let day = 0; day <= daysAhead; day++) {
    const d = new Date(base);
    d.setDate(base.getDate() + day);
    for (const t of times) {
      const ts = parseTimeToDayMs(t, d);
      if (!ts) continue;
      if (ts < now - 60 * 1000) continue;
      if (ts < startAt) continue;
      if (endAt && ts > endAt) continue;
      out.push(ts);
    }
  }
  return out.sort((a, b) => a - b);
}

export function subscribeMedications(petId: string, onData: (items: PetMedication[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<PetMedication[]>(demoKey(petId), [], (all) => {
      const items = all.slice().sort((a, b) => b.createdAt - a.createdAt);
      onData(items);
    });
  }
  const q = query(medsCol(petId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const items: PetMedication[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PetMedication, "id">) }));
    onData(items);
  });
}

export async function createMedication(petId: string, input: Omit<PetMedication, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next: PetMedication = { id, ...(input as Omit<PetMedication, "id">) };
    demoUpdate<PetMedication[]>(demoKey(petId), [], (prev) => [next, ...prev]);
    await seedMedicationTasks(petId, next);
    return id;
  }
  const ref = await addDoc(medsCol(petId), input);
  await seedMedicationTasks(petId, { id: ref.id, ...input });
  return ref.id;
}

export async function setMedicationEnabled(petId: string, medId: string, enabled: boolean) {
  if (shouldUseDemoData()) {
    demoUpdate<PetMedication[]>(demoKey(petId), [], (prev) => prev.map((m) => (m.id === medId ? { ...m, enabled } : m)));
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "medications", medId), { enabled });
}

export async function updateMedication(
  petId: string,
  medication: PetMedication,
  patch: UpdateData<Pick<PetMedication, "name" | "dose" | "unit" | "route" | "times" | "startAt" | "endAt" | "notes" | "enabled">>
) {
  const cleanedForMerge = Object.fromEntries(
    Object.entries(patch as Record<string, unknown>).map(([k, v]) => {
      if (v && typeof v === "object" && (v as { _methodName?: unknown })._methodName === "deleteField") return [k, undefined];
      return [k, v];
    })
  ) as Partial<Pick<PetMedication, "name" | "dose" | "unit" | "route" | "times" | "startAt" | "endAt" | "notes" | "enabled">>;

  const merged = { ...medication, ...cleanedForMerge } as PetMedication;
  if (shouldUseDemoData()) {
    demoUpdate<PetMedication[]>(demoKey(petId), [], (prev) => prev.map((m) => (m.id === medication.id ? { ...m, ...cleanedForMerge } : m)));
    await seedMedicationTasks(petId, merged);
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "medications", medication.id), patch);
  await seedMedicationTasks(petId, merged);
}

export async function deleteMedication(petId: string, medId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<PetMedication[]>(demoKey(petId), [], (prev) => prev.filter((m) => m.id !== medId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "medications", medId));
}

export async function seedMedicationTasks(petId: string, med: PetMedication) {
  if (!med.enabled) return;
  const occ = occurrencesNextDays(med, 7);
  const dose = [med.dose, med.unit].filter(Boolean).join(" ");
  const route = med.route ? ` · ${med.route}` : "";
  const titleBase = `Med: ${med.name}${dose ? ` (${dose}${route})` : route}`;

  for (const dueAt of occ.slice(0, 60)) {
    const taskId = `med_${med.id}_${dueAt}`;
    const input = {
      petId,
      title: titleBase,
      dueAt,
      status: "due" as const,
      createdAt: Date.now(),
      createdBy: med.createdBy,
      source: { kind: "medication" as const, refId: med.id, occurrenceAt: dueAt },
    };
    await ensureTaskExists(petId, taskId, input);
  }
}
