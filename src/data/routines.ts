import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import type { PetRoutine, RoutineKind } from "@/types";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { ensureTaskExists } from "@/data/tasks";

function routinesCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "routines");
}

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:routines`;
}

function parseTimeToTodayMs(time: string, base: Date) {
  const [hh, mm] = time.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const d = new Date(base);
  d.setHours(hh, mm, 0, 0);
  return d.getTime();
}

function computeOccurrences(routine: PetRoutine | Omit<PetRoutine, "id">, daysAhead: number) {
  const now = new Date();
  const occurrences: number[] = [];
  for (let day = 0; day <= daysAhead; day++) {
    const d = new Date(now);
    d.setDate(now.getDate() + day);
    if (routine.recurrence.type === "weekly") {
      const wd = d.getDay();
      if (!routine.recurrence.weekdays.includes(wd)) continue;
    }
    for (const t of routine.times) {
      const ms = parseTimeToTodayMs(t, d);
      if (!ms) continue;
      if (ms < Date.now() - 60 * 1000) continue;
      if (typeof routine.endAt === "number" && ms > routine.endAt) continue;
      occurrences.push(ms);
    }
  }
  return occurrences.sort((a, b) => a - b);
}

export function subscribeRoutines(petId: string, onData: (items: PetRoutine[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<PetRoutine[]>(demoKey(petId), [], (all) => {
      const items = all.slice().sort((a, b) => b.createdAt - a.createdAt);
      onData(items);
    });
  }
  const q = query(routinesCol(petId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const items: PetRoutine[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PetRoutine, "id">) }));
    onData(items);
  });
}

export async function createRoutine(petId: string, input: Omit<PetRoutine, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<PetRoutine, "id">) } as PetRoutine;
    demoUpdate<PetRoutine[]>(demoKey(petId), [], (prev) => [next, ...prev]);
    await seedUpcomingTasksFromRoutine(petId, next);
    return id;
  }
  const ref = await addDoc(routinesCol(petId), input);
  await seedUpcomingTasksFromRoutine(petId, { id: ref.id, ...input });
  return ref.id;
}

export async function setRoutineEnabled(petId: string, routineId: string, enabled: boolean) {
  if (shouldUseDemoData()) {
    let routine: PetRoutine | null = null;
    demoUpdate<PetRoutine[]>(demoKey(petId), [], (prev) =>
      prev.map((r) => {
        if (r.id !== routineId) return r;
        routine = { ...r, enabled };
        return routine;
      })
    );
    if (enabled && routine) await seedUpcomingTasksFromRoutine(petId, routine);
    return;
  }
  const { db } = getFirebase();
  const ref = doc(db, "pets", petId, "routines", routineId);
  await updateDoc(ref, { enabled });
  if (enabled) {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const routine = { id: snap.id, ...(snap.data() as Omit<PetRoutine, "id">) } as PetRoutine;
      await seedUpcomingTasksFromRoutine(petId, routine);
    }
  }
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function seedEnabledRoutinesOncePerDay(petId: string, routines: PetRoutine[], onlyKind?: RoutineKind) {
  const day = todayKey();
  const list = routines.filter((r) => r.enabled && (!onlyKind || r.kind === onlyKind));
  for (const r of list) {
    const key = `lifepet:routineSeed:${petId}:${r.id}:${day}`;
    try {
      if (localStorage.getItem(key)) continue;
      localStorage.setItem(key, "1");
    } catch {
      continue;
    }
    await seedUpcomingTasksFromRoutine(petId, r);
  }
}

export async function updateRoutine(petId: string, routineId: string, patch: Partial<Omit<PetRoutine, "id" | "petId" | "createdAt" | "createdBy">>) {
  if (shouldUseDemoData()) {
    let updated: PetRoutine | null = null;
    demoUpdate<PetRoutine[]>(demoKey(petId), [], (prev) =>
      prev.map((r) => {
        if (r.id !== routineId) return r;
        updated = { ...r, ...(patch as Partial<PetRoutine>) } as PetRoutine;
        return updated;
      })
    );
    if (updated) await seedUpcomingTasksFromRoutine(petId, updated);
    return;
  }
  const { db } = getFirebase();
  const ref = doc(db, "pets", petId, "routines", routineId);
  await updateDoc(ref, patch);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const routine = { id: snap.id, ...(snap.data() as Omit<PetRoutine, "id">) } as PetRoutine;
    await seedUpcomingTasksFromRoutine(petId, routine);
  }
}

export async function deleteRoutine(petId: string, routineId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<PetRoutine[]>(demoKey(petId), [], (prev) => prev.filter((r) => r.id !== routineId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "routines", routineId));
}

export async function seedUpcomingTasksFromRoutine(petId: string, routine: PetRoutine) {
  if (!routine.enabled) return;
  if (typeof routine.endAt === "number" && Date.now() > routine.endAt) return;
  const occurrences = computeOccurrences(routine, 7);
  const titleBase = routine.title.trim();
  for (const dueAt of occurrences.slice(0, 40)) {
    const taskId = `routine_${routine.id}_${dueAt}`;
    await ensureTaskExists(petId, taskId, {
      petId,
      title: titleBase,
      dueAt,
      status: "due",
      createdAt: Date.now(),
      createdBy: routine.createdBy,
      source: { kind: "routine", refId: routine.id, occurrenceAt: dueAt },
    });
  }
}
