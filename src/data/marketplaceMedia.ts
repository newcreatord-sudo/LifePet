import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebase } from "@/lib/firebase";
import { shouldUseDemoData } from "@/lib/runtimeMode";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "file";
}

export async function uploadListingPhotos(listingId: string, files: File[]) {
  if (shouldUseDemoData()) return [] as string[];
  const { storage } = getFirebase();
  const out: string[] = [];
  const now = Date.now();
  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    const path = `marketplace/listings/${listingId}/${now}_${i}_${safeName(f.name)}`;
    const r = ref(storage, path);
    await uploadBytes(r, f, { contentType: f.type });
    out.push(path);
  }
  return out;
}

export async function getListingPhotoUrl(storagePath: string) {
  const { storage } = getFirebase();
  return getDownloadURL(ref(storage, storagePath));
}

