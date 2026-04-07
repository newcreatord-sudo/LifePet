import { httpsCallable } from "firebase/functions";
import { getFirebase } from "@/lib/firebase";
import { shouldUseDemoData } from "@/lib/runtimeMode";

export async function deleteAccountCascade() {
  if (shouldUseDemoData()) {
    throw new Error("Operazione non disponibile in modalità demo");
  }
  const { functions } = getFirebase();
  const fn = httpsCallable(functions, "deleteAccountCascade");
  await fn({});
}

