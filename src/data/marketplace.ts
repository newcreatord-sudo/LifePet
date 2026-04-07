import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { MarketplaceListing } from "@/types";

const DEMO_KEY = "lifepet:demo:listings";

export function listingsCol() {
  const { db } = getFirebase();
  return collection(db, "listings");
}

export function subscribeListings(limitCount: number, onData: (items: MarketplaceListing[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<MarketplaceListing[]>(DEMO_KEY, [], (all) => {
      const items = all
        .filter((i) => i.status === "active")
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limitCount);
      onData(items);
    });
  }
  const q = query(listingsCol(), where("status", "==", "active"), orderBy("createdAt", "desc"), limit(limitCount));
  return onSnapshot(q, (snap) => {
    const items: MarketplaceListing[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MarketplaceListing, "id">) }));
    onData(items);
  });
}

export async function createListing(input: Omit<MarketplaceListing, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<MarketplaceListing, "id">) } as MarketplaceListing;
    demoUpdate<MarketplaceListing[]>(DEMO_KEY, [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(listingsCol(), input);
  return ref.id;
}

export async function updateListing(listingId: string, patch: Partial<Omit<MarketplaceListing, "id" | "sellerId" | "createdAt">>) {
  if (shouldUseDemoData()) {
    demoUpdate<MarketplaceListing[]>(DEMO_KEY, [], (prev) => prev.map((l) => (l.id === listingId ? ({ ...l, ...patch } as MarketplaceListing) : l)));
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "listings", listingId), patch);
}

export async function deleteListing(listingId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<MarketplaceListing[]>(DEMO_KEY, [], (prev) => prev.filter((l) => l.id !== listingId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "listings", listingId));
}
