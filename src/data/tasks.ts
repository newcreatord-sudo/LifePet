import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { PetTask } from "@/types";
import { createHealthEvent } from "@/data/health";
import { createLog } from "@/data/logs";

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:tasks`;
}

export function tasksCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "tasks");
}

export function subscribeTasks(petId: string, onData: (tasks: PetTask[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<PetTask[]>(demoKey(petId), [], (all) => {
      const tasks = all.slice().sort((a, b) => b.createdAt - a.createdAt);
      onData(tasks);
    });
  }
  const q = query(tasksCol(petId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const tasks: PetTask[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PetTask, "id">) }));
    onData(tasks);
  });
}

export function subscribeDueTasks(petId: string, nowMs: number, onData: (tasks: PetTask[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<PetTask[]>(demoKey(petId), [], (all) => {
      const tasks = all
        .filter((t) => t.status === "due" && (t.dueAt ?? nowMs) <= nowMs)
        .slice()
        .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
      onData(tasks);
    });
  }
  const q = query(
    tasksCol(petId),
    where("status", "==", "due"),
    where("dueAt", "<=", nowMs),
    orderBy("dueAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    const tasks: PetTask[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PetTask, "id">) }));
    onData(tasks);
  });
}

export async function createTask(petId: string, input: Omit<PetTask, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<PetTask, "id">) } as PetTask;
    demoUpdate<PetTask[]>(demoKey(petId), [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(tasksCol(petId), input);
  return ref.id;
}

export async function updateTask(petId: string, taskId: string, patch: Partial<Omit<PetTask, "id" | "petId" | "createdAt" | "createdBy">>) {
  if (shouldUseDemoData()) {
    demoUpdate<PetTask[]>(demoKey(petId), [], (prev) =>
      prev.map((t) => (t.id === taskId ? ({ ...t, ...(patch as Partial<PetTask>) } as PetTask) : t))
    );
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "tasks", taskId), patch);
}

export async function deleteTask(petId: string, taskId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<PetTask[]>(demoKey(petId), [], (prev) => prev.filter((t) => t.id !== taskId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "tasks", taskId));
}

export async function upsertTask(petId: string, taskId: string, input: Omit<PetTask, "id">) {
  if (shouldUseDemoData()) {
    demoUpdate<PetTask[]>(demoKey(petId), [], (prev) => {
      const idx = prev.findIndex((t) => t.id === taskId);
      const next = { id: taskId, ...(input as Omit<PetTask, "id">) } as PetTask;
      if (idx === -1) return [next, ...prev];
      const copy = prev.slice();
      copy[idx] = next;
      return copy;
    });
    return taskId;
  }
  const { db } = getFirebase();
  await setDoc(doc(db, "pets", petId, "tasks", taskId), input, { merge: true });
  return taskId;
}

export async function ensureTaskExists(petId: string, taskId: string, input: Omit<PetTask, "id">) {
  if (shouldUseDemoData()) {
    let exists = false;
    demoUpdate<PetTask[]>(demoKey(petId), [], (prev) => {
      exists = prev.some((t) => t.id === taskId);
      if (exists) return prev;
      return [{ id: taskId, ...(input as Omit<PetTask, "id">) } as PetTask, ...prev];
    });
    return !exists;
  }
  const { db } = getFirebase();
  const ref = doc(db, "pets", petId, "tasks", taskId);
  const snap = await getDoc(ref);
  if (snap.exists()) return false;
  await setDoc(ref, input);
  return true;
}

export async function setTaskDone(petId: string, taskId: string, done: boolean, completedAt?: number) {
  if (shouldUseDemoData()) {
    let task: PetTask | null = null;
    demoUpdate<PetTask[]>(demoKey(petId), [], (prev) => {
      const next = prev.map((t) => {
        if (t.id !== taskId) return t;
        task = t;
        return {
          ...t,
          status: (done ? "done" : "due") as PetTask["status"],
          completedAt: done ? (completedAt ?? Date.now()) : undefined,
        };
      });
      return next;
    });
    if (done && task && task.status !== "done") {
      await maybeCreateCompletionRecords(petId, task, completedAt ?? Date.now());
    }
    return;
  }
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, "pets", petId, "tasks", taskId));
  const prev = snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<PetTask, "id">) } as PetTask) : null;
  await updateDoc(doc(db, "pets", petId, "tasks", taskId), {
    status: done ? "done" : "due",
    completedAt: done ? (completedAt ?? Date.now()) : null,
  });

  if (done && prev && prev.status !== "done") {
    await maybeCreateCompletionRecords(petId, prev, completedAt ?? Date.now());
  }
}

async function maybeCreateCompletionRecords(petId: string, task: PetTask, at: number) {
  if (task.source?.kind !== "medication") return;
  const medName = task.title.startsWith("Med:") ? task.title.replace(/^Med:\s*/, "") : task.title;

  await createLog(petId, {
    petId,
    type: "med",
    occurredAt: at,
    note: `Taken: ${medName}`,
    createdAt: Date.now(),
    createdBy: task.createdBy,
  });

  await createHealthEvent(petId, {
    petId,
    type: "med",
    occurredAt: at,
    title: "Medication taken",
    note: medName,
    severity: "low",
    createdAt: Date.now(),
    createdBy: task.createdBy,
  });
}
