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
  type QueryConstraint,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { PetLog } from "@/types";

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:logs`;
}

export function logsCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "logs");
}

export function subscribeRecentLogs(petId: string, limitCount: number, onData: (logs: PetLog[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<PetLog[]>(demoKey(petId), [], (all) => {
      const logs = all.slice().sort((a, b) => b.occurredAt - a.occurredAt).slice(0, limitCount);
      onData(logs);
    });
  }
  const q = query(logsCol(petId), orderBy("occurredAt", "desc"), limit(limitCount));
  return onSnapshot(q, (snap) => {
    const logs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PetLog, "id">) }));
    onData(logs);
  });
}

export function subscribeLogsRange(
  petId: string,
  fromMs: number,
  toMs: number,
  onData: (logs: PetLog[]) => void
) {
  if (shouldUseDemoData()) {
    return demoSubscribe<PetLog[]>(demoKey(petId), [], (all) => {
      const logs = all
        .filter((l) => l.occurredAt >= fromMs && l.occurredAt <= toMs)
        .slice()
        .sort((a, b) => b.occurredAt - a.occurredAt);
      onData(logs);
    });
  }
  const constraints: QueryConstraint[] = [
    where("occurredAt", ">=", fromMs),
    where("occurredAt", "<=", toMs),
    orderBy("occurredAt", "desc"),
  ];
  const q = query(logsCol(petId), ...constraints);
  return onSnapshot(q, (snap) => {
    const logs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PetLog, "id">) }));
    onData(logs);
  });
}

export async function createLog(petId: string, input: Omit<PetLog, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<PetLog, "id">) } as PetLog;
    demoUpdate<PetLog[]>(demoKey(petId), [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(logsCol(petId), input);
  return ref.id;
}

export async function deleteLog(petId: string, logId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<PetLog[]>(demoKey(petId), [], (prev) => prev.filter((l) => l.id !== logId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "logs", logId));
}

export async function updateLog(
  petId: string,
  logId: string,
  patch: UpdateData<Omit<PetLog, "id" | "petId" | "createdAt" | "createdBy">>
) {
  if (shouldUseDemoData()) {
    const cleaned = Object.fromEntries(
      Object.entries(patch as Record<string, unknown>).map(([k, v]) => {
        if (v && typeof v === "object" && (v as { _methodName?: unknown })._methodName === "deleteField") return [k, undefined];
        return [k, v];
      })
    );
    demoUpdate<PetLog[]>(demoKey(petId), [], (prev) => prev.map((l) => (l.id === logId ? { ...l, ...cleaned } : l)));
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "logs", logId), patch);
}
