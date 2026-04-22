import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  type SetOptions,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebase } from "@/lib/firebase";
import { demoRead, demoUpdate, demoId } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { FinderReport, FinderReportType, Pet, PetCard, PetId } from "@/types";

function randomPublicId(length = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function buildPublicPetUrl(publicId: string) {
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  return `${origin}/p/${encodeURIComponent(publicId)}`;
}

export async function getPetCard(publicId: string): Promise<PetCard | null> {
  const pid = String(publicId || "").trim();
  if (!pid) return null;

  if (shouldUseDemoData()) {
    const cards = demoRead<Record<string, PetCard>>("lifepet:demo:petCards", {});
    return cards[pid] ?? null;
  }

  const { db } = getFirebase();
  const snap = await getDoc(doc(db, "petCards", pid));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<PetCard, "publicId">;
  return { publicId: pid, ...(data as Omit<PetCard, "publicId">) };
}

export async function enablePetProtection(pet: Pet) {
  const publicId = randomPublicId(10);
  const now = Date.now();
  const protection = { enabled: true, publicId, activatedAt: now };
  const card: PetCard = {
    publicId,
    petId: pet.id,
    ownerId: pet.ownerId,
    petName: pet.name,
    species: pet.species,
    photoPath: pet.photoPath,
    publicNote: undefined,
    isLost: false,
    activatedAt: now,
    updatedAt: now,
  };

  if (shouldUseDemoData()) {
    demoUpdate<Pet[]>("lifepet:demo:pets", [], (prev) => prev.map((p) => (p.id === pet.id ? { ...p, petProtection: protection } : p)));
    demoUpdate<Record<string, PetCard>>("lifepet:demo:petCards", {}, (prev) => ({ ...prev, [publicId]: card }));
    return protection;
  }

  const { db } = getFirebase();
  await setDoc(doc(db, "pets", pet.id), { petProtection: protection, updatedAt: now } as Partial<Pet>, { merge: true } as SetOptions);
  const docData: Omit<PetCard, "publicId"> = {
    petId: card.petId,
    ownerId: card.ownerId,
    petName: card.petName,
    species: card.species,
    photoPath: card.photoPath,
    publicNote: card.publicNote,
    isLost: card.isLost,
    activatedAt: card.activatedAt,
    updatedAt: card.updatedAt,
  };
  await setDoc(doc(db, "petCards", publicId), docData, { merge: true } as SetOptions);
  return protection;
}

export async function disablePetProtection(pet: Pet) {
  const publicId = pet.petProtection?.publicId;
  if (!publicId) return;
  const now = Date.now();

  if (shouldUseDemoData()) {
    demoUpdate<Pet[]>("lifepet:demo:pets", [], (prev) => prev.map((p) => (p.id === pet.id ? { ...p, petProtection: undefined } : p)));
    demoUpdate<Record<string, PetCard>>("lifepet:demo:petCards", {}, (prev) => {
      const next = { ...prev };
      delete next[publicId];
      return next;
    });
    return;
  }

  const { db } = getFirebase();
  await setDoc(doc(db, "pets", pet.id), { petProtection: null, updatedAt: now } as unknown as Partial<Pet>, { merge: true } as SetOptions);
  await deleteDoc(doc(db, "petCards", publicId));
}

export async function syncPetCardFromPet(pet: Pet) {
  const publicId = pet.petProtection?.enabled ? pet.petProtection.publicId : null;
  if (!publicId) return;
  const now = Date.now();

  const patch: Partial<PetCard> = {
    petId: pet.id,
    ownerId: pet.ownerId,
    petName: pet.name,
    species: pet.species,
    photoPath: pet.photoPath,
    updatedAt: now,
  };

  if (shouldUseDemoData()) {
    demoUpdate<Record<string, PetCard>>("lifepet:demo:petCards", {}, (prev) => {
      const cur = prev[publicId];
      if (!cur) return prev;
      return { ...prev, [publicId]: { ...cur, ...patch, publicId } };
    });
    return;
  }

  const { db } = getFirebase();
  await setDoc(doc(db, "petCards", publicId), patch as Omit<PetCard, "publicId">, { merge: true } as SetOptions);
}

export async function updatePetCard(publicId: string, patch: Partial<Pick<PetCard, "publicNote" | "isLost" | "petName" | "species" | "photoPath" | "updatedAt">>) {
  const pid = String(publicId || "").trim();
  if (!pid) return;
  const now = Date.now();
  const nextPatch: Partial<PetCard> = { ...patch, updatedAt: now };

  if (shouldUseDemoData()) {
    demoUpdate<Record<string, PetCard>>("lifepet:demo:petCards", {}, (prev) => {
      const cur = prev[pid];
      if (!cur) return prev;
      return { ...prev, [pid]: { ...cur, ...nextPatch, publicId: pid } };
    });
    return;
  }

  const { db } = getFirebase();
  await setDoc(doc(db, "petCards", pid), nextPatch as Omit<PetCard, "publicId">, { merge: true } as SetOptions);
}

export async function setPetLostMode(pet: Pet, isLost: boolean, publicNote?: string) {
  const publicId = pet.petProtection?.enabled ? pet.petProtection.publicId : null;
  if (!publicId) throw new Error("Protezione non attiva");
  const note = publicNote?.trim() ? publicNote.trim().slice(0, 240) : undefined;
  await updatePetCard(publicId, { isLost, publicNote: note });
}

export async function createFinderReport(input: {
  petId: PetId;
  publicId: string;
  reportType: FinderReportType;
  reporterContactOptional?: string;
  locationTextOptional?: string;
  noteOptional?: string;
  hpOptional?: string;
}) {
  const now = Date.now();
  const payload: Omit<FinderReport, "id"> = {
    petId: input.petId,
    publicId: input.publicId,
    reportType: input.reportType,
    reporterContactOptional: input.reporterContactOptional?.trim() ? input.reporterContactOptional.trim() : undefined,
    locationTextOptional: input.locationTextOptional?.trim() ? input.locationTextOptional.trim() : undefined,
    noteOptional: input.noteOptional?.trim() ? input.noteOptional.trim() : undefined,
    createdAt: now,
  };

  if (shouldUseDemoData()) {
    const id = demoId();
    demoUpdate<FinderReport[]>("lifepet:demo:finderReports", [], (prev) => [{ id, ...payload }, ...prev]);
    return id;
  }

  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "submitFinderReportPublic");
  try {
    const res = await fn({
      petId: input.petId,
      publicId: input.publicId,
      reportType: input.reportType,
      reporterContactOptional: payload.reporterContactOptional ?? "",
      locationTextOptional: payload.locationTextOptional ?? "",
      noteOptional: payload.noteOptional ?? "",
      hp: String(input.hpOptional || ""),
    });
    const id = String((res.data as { reportId?: unknown } | null)?.reportId ?? "");
    if (!id) throw new Error("Segnalazione non inviata");
    return id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Segnalazione non inviata";
    if (/too many requests/i.test(msg) || /resource-exhausted/i.test(msg)) {
      throw new Error("Troppi invii. Riprova tra qualche minuto.");
    }
    throw new Error("Segnalazione non inviata. Riprova.");
  }
}
