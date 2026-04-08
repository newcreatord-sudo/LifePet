import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { deleteField } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { updatePet } from "@/data/pets";

export async function uploadPetPhoto(petId: string, file: File) {
  if (shouldUseDemoData()) {
    const photoPath = `demo://petPhoto/${demoId()}/${file.name}`;
    const url = URL.createObjectURL(file);
    await updatePet(petId, { photoPath });
    return { photoPath, url };
  }

  const { storage } = getFirebase();
  const ext = file.name.split(".").pop() || "jpg";
  const photoPath = `pets/${petId}/profile/avatar_${Date.now()}.${ext}`;
  const r = ref(storage, photoPath);
  await uploadBytes(r, file, { contentType: file.type || "image/jpeg" });
  const url = await getDownloadURL(r);
  await updatePet(petId, { photoPath });
  return { photoPath, url };
}

export async function getPhotoUrl(photoPath: string) {
  if (photoPath.startsWith("demo://")) {
    throw new Error("Demo photo can't be reopened after refresh");
  }
  const { storage } = getFirebase();
  return getDownloadURL(ref(storage, photoPath));
}

export async function deletePetPhoto(petId: string, photoPath: string) {
  if (shouldUseDemoData()) {
    await updatePet(petId, { photoPath: deleteField() });
    return;
  }
  const { storage } = getFirebase();
  await deleteObject(ref(storage, photoPath));
  await updatePet(petId, { photoPath: deleteField() });
}
