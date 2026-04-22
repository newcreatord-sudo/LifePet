import { collection, onSnapshot, orderBy, query, limit, type Unsubscribe } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { demoRead } from "@/lib/demoDb";
import type { FinderReport, PetId } from "@/types";

export function subscribeFinderReports(petId: PetId, onData: (items: FinderReport[]) => void): Unsubscribe {
  if (!petId) {
    onData([]);
    return () => void 0;
  }

  if (shouldUseDemoData()) {
    const all = demoRead<FinderReport[]>("lifepet:demo:finderReports", []);
    const filtered = all.filter((r) => r.petId === petId).slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
    onData(filtered);
    return () => void 0;
  }

  const { db } = getFirebase();
  const q = query(collection(db, "pets", petId, "finderReports"), orderBy("createdAt", "desc"), limit(30));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FinderReport, "id">) }));
    onData(items);
  });
}

