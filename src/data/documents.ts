import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { PetDocument } from "@/types";

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:documents`;
}

export function docsCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "documents");
}

export function subscribeDocuments(petId: string, onData: (docs: PetDocument[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<PetDocument[]>(demoKey(petId), [], (all) => {
      const docs = all.slice().sort((a, b) => b.createdAt - a.createdAt);
      onData(docs);
    });
  }
  const q = query(docsCol(petId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const docs: PetDocument[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<PetDocument, "id">),
    }));
    onData(docs);
  });
}

export async function uploadPetDocument(
  petId: string,
  userId: string,
  file: File
): Promise<{ docId: string; storagePath: string; downloadUrl: string }>
{
  if (shouldUseDemoData()) {
    const docId = demoId();
    const downloadUrl = URL.createObjectURL(file);
    const meta: PetDocument = {
      id: docId,
      petId,
      name: file.name,
      storagePath: `demo://${docId}/${file.name}`,
      contentType: file.type,
      size: file.size,
      createdAt: Date.now(),
      createdBy: userId,
    };
    demoUpdate<PetDocument[]>(demoKey(petId), [], (prev) => [meta, ...prev]);
    return { docId, storagePath: meta.storagePath, downloadUrl };
  }
  const { storage } = getFirebase();
  const storagePath = `pets/${petId}/documents/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const downloadUrl = await getDownloadURL(storageRef);
  const meta: Omit<PetDocument, "id"> = {
    petId,
    name: file.name,
    storagePath,
    contentType: file.type,
    size: file.size,
    createdAt: Date.now(),
    createdBy: userId,
  };
  const refDoc = await addDoc(docsCol(petId), meta);
  return { docId: refDoc.id, storagePath, downloadUrl };
}

export async function getPetDocumentDownloadUrl(storagePath: string) {
  if (storagePath.startsWith("demo://")) {
    throw new Error("Demo documents can't be reopened after refresh");
  }
  const { storage } = getFirebase();
  return getDownloadURL(ref(storage, storagePath));
}

export async function deletePetDocument(petId: string, docId: string, storagePath: string) {
  if (shouldUseDemoData()) {
    demoUpdate<PetDocument[]>(demoKey(petId), [], (prev) => prev.filter((d) => d.id !== docId));
    return;
  }
  const { db, storage } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "documents", docId));
  await deleteObject(ref(storage, storagePath));
}
