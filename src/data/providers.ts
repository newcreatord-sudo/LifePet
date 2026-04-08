import { addDoc, collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import type { Provider, ProviderKind } from "@/types";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";

const DEMO_KEY = "lifepet:demo:providers";

function providersCol() {
  const { db } = getFirebase();
  return collection(db, "providers");
}

export function subscribeProviders(onData: (items: Provider[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<Provider[]>(DEMO_KEY, [], (all) => {
      const items = all.slice().sort((a, b) => a.name.localeCompare(b.name));
      onData(items);
    });
  }
  const q = query(providersCol(), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const items: Provider[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Provider, "id">) }));
    onData(items);
  });
}

export async function createProvider(input: Omit<Provider, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<Provider, "id">) } as Provider;
    demoUpdate<Provider[]>(DEMO_KEY, [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(providersCol(), input);
  return ref.id;
}

export function seedDefaultProviders() {
  if (!shouldUseDemoData()) return;
  demoUpdate<Provider[]>(DEMO_KEY, [], (prev) => {
    if (prev.length) return prev;
    const now = Date.now();
    const mk = (kind: ProviderKind, name: string, city: string, phone: string, description: string): Provider => ({
      id: demoId(),
      kind,
      name,
      city,
      phone,
      description,
      createdAt: now,
    });
    return [
      mk("vet", "Centro Veterinario Milano", "Milano", "+39 02 0000 0000", "Visite, vaccini, emergenze"),
      mk("nutritionist", "Nutrizionista Pet Online", "Online", "+39 02 2222 2222", "Dieta personalizzata e piani nutrizionali"),
      mk("groomer", "Toelettatura GreenPaw", "Milano", "+39 02 1111 1111", "Bagno, taglio, unghie"),
      mk("sitter", "Pet Sitter Clara", "Milano", "+39 333 222 1111", "Passeggiate e visite a domicilio"),
    ];
  });
}
