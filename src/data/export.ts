import { httpsCallable } from "firebase/functions";
import { getFirebase } from "@/lib/firebase";
import { shouldUseDemoData } from "@/lib/runtimeMode";

export async function exportPetData(petId: string, range?: { fromMs: number; toMs: number }) {
  if (shouldUseDemoData()) {
    return {
      schemaVersion: 1,
      exportedAt: Date.now(),
      petId,
      demo: true,
      note: "Export completo non disponibile in modalità demo.",
    };
  }

  const fn = httpsCallable(getFirebase().functions, "exportPetDataPro");
  const res = await fn({ petId, range: range ?? null });
  return res.data as { url: string };
}

export async function exportAccountData(range?: { fromMs: number; toMs: number }) {
  if (shouldUseDemoData()) {
    return { url: "" } as { url: string };
  }
  const fn = httpsCallable(getFirebase().functions, "exportAccountDataPro");
  const res = await fn({ range: range ?? null });
  return res.data as { url: string };
}
