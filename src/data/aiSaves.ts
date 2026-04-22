import { collection, doc, limit, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { reportFirestoreError } from "@/lib/firestoreFallback";
import type { AiSave } from "@/types";

function requireUid() {
  const uid = getFirebase().auth.currentUser?.uid;
  if (!uid) throw new Error("Devi effettuare l'accesso");
  return uid;
}

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:aiSaves`;
}

export function aiSavesCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "aiSaves");
}

export function subscribeAiSaves(petId: string, limitCount: number, onData: (items: AiSave[]) => void, onError?: (err: unknown) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<AiSave[]>(demoKey(petId), [], (all) => {
      onData(all.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, limitCount));
    });
  }
  const q = query(aiSavesCol(petId), orderBy("createdAt", "desc"), limit(limitCount));
  return onSnapshot(
    q,
    (snap) => {
      const items: AiSave[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiSave, "id">) }));
      onData(items);
    },
    (err) => {
      reportFirestoreError(err, "salvataggi-ai");
      onError?.(err);
      onData([]);
    }
  );
}

export async function upsertAiSave(petId: string, saveId: string, input: Omit<AiSave, "id" | "petId" | "createdBy"> & { createdBy?: string }) {
  const uid = shouldUseDemoData() ? "demo" : requireUid();
  const createdBy = input.createdBy || uid;
  if (!shouldUseDemoData() && createdBy !== uid) throw new Error("createdBy non valido");

  const next: Omit<AiSave, "id"> = {
    ...input,
    petId,
    createdBy,
  };

  if (shouldUseDemoData()) {
    const id = saveId || demoId();
    const item: AiSave = { id, ...(next as Omit<AiSave, "id">) };
    demoUpdate<AiSave[]>(demoKey(petId), [], (prev) => {
      const without = prev.filter((x) => x.id !== id);
      return [item, ...without];
    });
    return id;
  }

  const { db } = getFirebase();
  await setDoc(doc(db, "pets", petId, "aiSaves", saveId), next, { merge: true });
  return saveId;
}

export async function updateAiSave(
  petId: string,
  saveId: string,
  patch: Partial<Omit<AiSave, "id" | "petId" | "createdAt" | "createdBy">>
) {
  if (shouldUseDemoData()) {
    demoUpdate<AiSave[]>(demoKey(petId), [], (prev) => prev.map((s) => (s.id === saveId ? ({ ...s, ...patch } as AiSave) : s)));
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "aiSaves", saveId), patch);
}
