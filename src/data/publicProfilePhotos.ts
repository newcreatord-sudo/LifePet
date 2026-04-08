import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebase } from "@/lib/firebase";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { subscribePublicProfile, updatePublicProfile } from "@/data/users";

export async function uploadPublicProfilePhoto(uid: string, file: File, previousPhotoPath?: string) {
  if (shouldUseDemoData()) throw new Error("Foto profilo non disponibile in modalità demo");
  const { storage } = getFirebase();
  const ext = file.name.split(".").pop() || "jpg";
  const photoPath = `publicProfiles/${uid}/profile/avatar_${Date.now()}.${ext}`;

  const r = ref(storage, photoPath);
  await uploadBytes(r, file, { contentType: file.type || "image/jpeg" });
  const url = await getDownloadURL(r);

  await updatePublicProfile(uid, { photoURL: url, photoPath });

  if (previousPhotoPath && previousPhotoPath !== photoPath) {
    await deleteObject(ref(storage, previousPhotoPath)).catch(() => undefined);
  }
  return { photoPath, url };
}

export async function deletePublicProfilePhoto(uid: string, photoPath: string) {
  if (shouldUseDemoData()) return;
  const { storage } = getFirebase();
  await deleteObject(ref(storage, photoPath));
  await updatePublicProfile(uid, { photoURL: "", photoPath: "" });
}

export function subscribeMyPublicProfile(uid: string, onData: (p: { photoURL?: string; photoPath?: string } | null) => void) {
  return subscribePublicProfile(uid, (p) => onData(p ? { photoURL: p.photoURL, photoPath: p.photoPath } : null));
}
