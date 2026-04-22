import { collection, deleteDoc, deleteField, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable, type UploadTaskSnapshot } from "firebase/storage";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { reportFirestoreError } from "@/lib/firestoreFallback";
import { markOnboardingStep } from "@/lib/onboardingV2";
import type { PetDocument } from "@/types";

function requireUid() {
  const uid = getFirebase().auth.currentUser?.uid;
  if (!uid) throw new Error("Devi effettuare l'accesso");
  return uid;
}

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:documents`;
}

function sanitizeFileName(name: string) {
  const base = String(name || "documento")
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const safe = base.replace(/[^\w\-. ()[\]]+/g, "");
  const trimmed = safe.length > 120 ? safe.slice(0, 120).trim() : safe;
  return trimmed || "documento";
}

export type UploadPetDocumentMeta = {
  title?: string;
  docType?: PetDocument["docType"];
  documentAt?: number;
  tags?: string[];
  isFavorite?: boolean;
};

export type UploadProgress = {
  state: "running" | "paused";
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
};

function sha256Hex(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

async function computeFileSha256(file: File) {
  const data = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", data);
  return sha256Hex(hash);
}

function storagePathFor(petId: string, userId: string, docId: string, fileName: string) {
  const safeName = sanitizeFileName(fileName);
  return `users/${userId}/pets/${petId}/documents/${docId}/${safeName}`;
}

export function docsCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "documents");
}

export function subscribeDocuments(petId: string, onData: (docs: PetDocument[]) => void, onError?: (err: unknown) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<PetDocument[]>(demoKey(petId), [], (all) => {
      const docs = all.slice().sort((a, b) => b.createdAt - a.createdAt);
      onData(docs);
    });
  }
  const q = query(docsCol(petId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const docs: PetDocument[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PetDocument, "id">),
      }));
      onData(docs);
    },
    (err) => {
      reportFirestoreError(err, "documenti");
      onError?.(err);
    }
  );
}

export async function uploadPetDocument(
  petId: string,
  userId: string,
  file: File,
  meta?: UploadPetDocumentMeta,
  onProgress?: (p: UploadProgress) => void
): Promise<{ docId: string; storagePath: string; downloadUrl: string }>
{
  if (!shouldUseDemoData()) {
    const uid = requireUid();
    if (uid !== userId) throw new Error("userId non valido");
  }
  if (shouldUseDemoData()) {
    const docId = demoId();
    const downloadUrl = URL.createObjectURL(file);
    const title = String(meta?.title || "").trim();
    const docType = meta?.docType;
    const documentAt = typeof meta?.documentAt === "number" && Number.isFinite(meta.documentAt) ? meta.documentAt : undefined;
    const tags = Array.isArray(meta?.tags) ? meta?.tags : undefined;
    const isFavorite = typeof meta?.isFavorite === "boolean" ? meta.isFavorite : undefined;
    const docMeta: PetDocument = {
      id: docId,
      petId,
      name: file.name,
      title: title || undefined,
      docType,
      documentAt,
      tags,
      isFavorite,
      storagePath: `demo://${docId}/${file.name}`,
      contentType: file.type,
      size: file.size,
      createdAt: Date.now(),
      createdBy: userId,
      ownerId: userId,
      uploadStatus: "ready",
    };
    demoUpdate<PetDocument[]>(demoKey(petId), [], (prev) => [docMeta, ...prev]);
    markOnboardingStep("docOrVaccineAdded");
    return { docId, storagePath: docMeta.storagePath, downloadUrl };
  }
  const { storage } = getFirebase();
  const docRef = doc(docsCol(petId));
  const docId = docRef.id;
  const storagePath = storagePathFor(petId, userId, docId, file.name);
  const storageRef = ref(storage, storagePath);
  const title = String(meta?.title || "").trim();
  const docType = meta?.docType;
  const documentAt = typeof meta?.documentAt === "number" && Number.isFinite(meta.documentAt) ? meta.documentAt : undefined;
  const tags = Array.isArray(meta?.tags) ? meta?.tags : undefined;
  const isFavorite = typeof meta?.isFavorite === "boolean" ? meta.isFavorite : undefined;

  const createdAt = Date.now();
  const docMeta: Omit<PetDocument, "id"> = {
    petId,
    name: file.name,
    title: title || undefined,
    docType,
    documentAt,
    tags,
    isFavorite,
    storagePath,
    contentType: file.type,
    size: file.size,
    createdAt,
    createdBy: userId,
    ownerId: userId,
    uploadStatus: "uploading",
    updatedAt: createdAt,
  };

  await setDoc(docRef, docMeta);

  let sha256: string | undefined;
  try {
    sha256 = await computeFileSha256(file);
  } catch {
    sha256 = undefined;
  }

  try {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        petId,
        docId,
        ownerId: userId,
        sha256: sha256 || "",
      },
    });

    await new Promise<UploadTaskSnapshot>((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          const total = snap.totalBytes || file.size || 0;
          const pct = total > 0 ? Math.round((snap.bytesTransferred / total) * 100) : 0;
          onProgress?.({
            state: snap.state === "paused" ? "paused" : "running",
            bytesTransferred: snap.bytesTransferred,
            totalBytes: total,
            percent: pct,
          });
        },
        (err) => reject(err),
        () => resolve(task.snapshot)
      );
    });

    const downloadUrl = await getDownloadURL(storageRef);
    await updateDoc(docRef, {
      uploadStatus: "ready",
      uploadError: deleteField(),
      sha256: sha256 || deleteField(),
      updatedAt: Date.now(),
    });
    markOnboardingStep("docOrVaccineAdded");
    return { docId, storagePath, downloadUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload fallito";
    await updateDoc(docRef, { uploadStatus: "failed", uploadError: msg, updatedAt: Date.now() });
    try {
      await deleteObject(storageRef);
    } catch {
      // ignore
    }
    throw err;
  }
}

export async function retryPetDocumentUpload(
  petId: string,
  userId: string,
  docId: string,
  prevStoragePath: string | null,
  file: File,
  meta?: UploadPetDocumentMeta,
  onProgress?: (p: UploadProgress) => void
): Promise<{ docId: string; storagePath: string; downloadUrl: string }>
{
  if (!shouldUseDemoData()) {
    const uid = requireUid();
    if (uid !== userId) throw new Error("userId non valido");
  }
  if (shouldUseDemoData()) {
    demoUpdate<PetDocument[]>(demoKey(petId), [], (prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const next: PetDocument = {
          ...d,
          name: file.name,
          title: String(meta?.title || "").trim() || d.title,
          docType: meta?.docType ?? d.docType,
          documentAt: typeof meta?.documentAt === "number" ? meta.documentAt : d.documentAt,
          tags: Array.isArray(meta?.tags) ? meta.tags : d.tags,
          contentType: file.type,
          size: file.size,
          uploadStatus: "ready",
          uploadError: undefined,
          updatedAt: Date.now(),
        };
        return next;
      })
    );
    return { docId, storagePath: `demo://${docId}/${file.name}`, downloadUrl: `demo://download/${docId}/${file.name}` };
  }

  const { db, storage } = getFirebase();
  const docRef = doc(db, "pets", petId, "documents", docId);
  const nextStoragePath = storagePathFor(petId, userId, docId, file.name);

  if (prevStoragePath && prevStoragePath !== nextStoragePath) {
    try {
      await deleteObject(ref(storage, prevStoragePath));
    } catch {
      // ignore
    }
  }

  const title = String(meta?.title || "").trim();
  const docType = meta?.docType;
  const documentAt = typeof meta?.documentAt === "number" && Number.isFinite(meta.documentAt) ? meta.documentAt : undefined;
  const tags = Array.isArray(meta?.tags) ? meta.tags : undefined;
  const isFavorite = typeof meta?.isFavorite === "boolean" ? meta.isFavorite : undefined;

  const now = Date.now();
  await updateDoc(docRef, {
    name: file.name,
    title: title ? title : deleteField(),
    docType: docType ? docType : deleteField(),
    documentAt: typeof documentAt === "number" ? documentAt : deleteField(),
    tags: Array.isArray(tags) && tags.length ? tags : deleteField(),
    isFavorite: typeof isFavorite === "boolean" ? isFavorite : deleteField(),
    storagePath: nextStoragePath,
    contentType: file.type,
    size: file.size,
    ownerId: userId,
    uploadStatus: "uploading",
    uploadError: deleteField(),
    updatedAt: now,
  });

  let sha256: string | undefined;
  try {
    sha256 = await computeFileSha256(file);
  } catch {
    sha256 = undefined;
  }

  const storageRef = ref(storage, nextStoragePath);
  try {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        petId,
        docId,
        ownerId: userId,
        sha256: sha256 || "",
      },
    });

    await new Promise<UploadTaskSnapshot>((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          const total = snap.totalBytes || file.size || 0;
          const pct = total > 0 ? Math.round((snap.bytesTransferred / total) * 100) : 0;
          onProgress?.({
            state: snap.state === "paused" ? "paused" : "running",
            bytesTransferred: snap.bytesTransferred,
            totalBytes: total,
            percent: pct,
          });
        },
        (err) => reject(err),
        () => resolve(task.snapshot)
      );
    });

    const downloadUrl = await getDownloadURL(storageRef);
    await updateDoc(docRef, {
      uploadStatus: "ready",
      uploadError: deleteField(),
      sha256: sha256 || deleteField(),
      updatedAt: Date.now(),
    });
    return { docId, storagePath: nextStoragePath, downloadUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload fallito";
    await updateDoc(docRef, { uploadStatus: "failed", uploadError: msg, updatedAt: Date.now() });
    try {
      await deleteObject(storageRef);
    } catch {
      // ignore
    }
    throw err;
  }
}

export async function getPetDocumentDownloadUrl(storagePath: string) {
  if (storagePath.startsWith("demo://")) {
    throw new Error("In modalità demo i documenti non vengono salvati in modo permanente.");
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
  try {
    await deleteObject(ref(storage, storagePath));
  } catch {
    // ignore missing/blocked object
  }
  await deleteDoc(doc(db, "pets", petId, "documents", docId));
}

export async function updatePetDocumentMeta(
  petId: string,
  docId: string,
  patch: Partial<Pick<PetDocument, "title" | "docType" | "documentAt" | "tags" | "isFavorite">>
) {
  if (shouldUseDemoData()) {
    demoUpdate<PetDocument[]>(demoKey(petId), [], (prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const next: PetDocument = { ...d };
        if ("title" in patch) {
          if (patch.title === undefined) delete next.title;
          else next.title = patch.title;
        }
        if ("docType" in patch) {
          if (patch.docType === undefined) delete next.docType;
          else next.docType = patch.docType;
        }
        if ("documentAt" in patch) {
          if (patch.documentAt === undefined) delete next.documentAt;
          else next.documentAt = patch.documentAt;
        }
        if ("tags" in patch) {
          if (patch.tags === undefined) delete next.tags;
          else next.tags = patch.tags;
        }
        if ("isFavorite" in patch) {
          if (patch.isFavorite === undefined) delete next.isFavorite;
          else next.isFavorite = patch.isFavorite;
        }
        return next;
      })
    );
    return;
  }
  const { db } = getFirebase();
  const payload: Record<string, unknown> = {};
  if (patch.title === undefined) payload.title = deleteField();
  else payload.title = patch.title;
  if (patch.docType === undefined) payload.docType = deleteField();
  else payload.docType = patch.docType;
  if (patch.documentAt === undefined) payload.documentAt = deleteField();
  else payload.documentAt = patch.documentAt;
  if (patch.tags === undefined) payload.tags = deleteField();
  else payload.tags = patch.tags;
  if (patch.isFavorite === undefined) payload.isFavorite = deleteField();
  else payload.isFavorite = patch.isFavorite;

  await updateDoc(doc(db, "pets", petId, "documents", docId), payload);
}
