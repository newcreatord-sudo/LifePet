import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  type UpdateData,
  updateDoc,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoRead, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { Pet } from "@/types";

export function subscribeMyPets(userId: string, onData: (pets: Pet[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<Pet[]>("lifepet:demo:pets", [], (all) => {
      const pets = all
        .filter((p) => p.ownerId === userId)
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt);
      onData(pets);
    });
  }
  const { db } = getFirebase();
  const petsCol = collection(db, "pets");
  const q = query(petsCol, where("ownerId", "==", userId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const pets: Pet[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Pet, "id">) }));
    onData(pets);
  });
}

export async function createPet(input: Omit<Pet, "id">) {
  const name = input.name.trim();
  if (!name) throw new Error("Nome pet obbligatorio");
  if (name.length > 60) throw new Error("Nome troppo lungo (max 60 caratteri)");
  if (!input.ownerId) throw new Error("OwnerId mancante");
  const safe: Omit<Pet, "id"> = {
    ...input,
    name,
    createdAt: Number.isFinite(input.createdAt) ? input.createdAt : Date.now(),
  };
  if (shouldUseDemoData()) {
    const id = demoId();
    demoUpdate<Pet[]>("lifepet:demo:pets", [], (prev) => [{ id, ...safe }, ...prev]);
    return id;
  }
  const { db } = getFirebase();
  const petsCol = collection(db, "pets");
  const ref = await addDoc(petsCol, safe);
  return ref.id;
}

export async function updatePet(petId: string, patch: UpdateData<Omit<Pet, "id" | "ownerId" | "createdAt">>) {
  if (shouldUseDemoData()) {
    const cleaned = Object.fromEntries(
      Object.entries(patch as Record<string, unknown>).map(([k, v]) => {
        if (v && typeof v === "object" && (v as { _methodName?: unknown })._methodName === "deleteField") return [k, undefined];
        return [k, v];
      })
    );
    demoUpdate<Pet[]>("lifepet:demo:pets", [], (prev) => prev.map((p) => (p.id === petId ? { ...p, ...cleaned } : p)));
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId), patch);
}

export async function deletePet(petId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<Pet[]>("lifepet:demo:pets", [], (prev) => prev.filter((p) => p.id !== petId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId));
}

export async function deletePetCascade(petId: string) {
  if (shouldUseDemoData()) {
    await deletePet(petId);
    return;
  }
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "deletePetCascade");
  await fn({ petId });
}

export async function getPet(petId: string) {
  if (shouldUseDemoData()) {
    const all = demoRead<Pet[]>("lifepet:demo:pets", []);
    return all.find((p) => p.id === petId) ?? null;
  }
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, "pets", petId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Pet, "id">) } as Pet;
}
