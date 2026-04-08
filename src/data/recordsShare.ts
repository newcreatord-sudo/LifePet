import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { shouldUseDemoData } from "@/lib/runtimeMode";

export type RecordsShareItem = {
  kind: "health" | "log" | "doc" | "task";
  ts: number;
  title: string;
  subtitle?: string;
  note?: string;
};

export type RecordsShare = {
  id: string;
  ownerId: string;
  petId: string;
  createdAt: number;
  expiresAt: number;
  range: { fromMs: number; toMs: number };
  items: RecordsShareItem[];
};

function sharesCol() {
  const { db } = getFirebase();
  return collection(db, "recordShares");
}

export async function createRecordsShare(input: Omit<RecordsShare, "id">) {
  if (shouldUseDemoData()) throw new Error("Share non disponibile in modalità demo");
  const ref = await addDoc(sharesCol(), input);
  return ref.id;
}

export async function getRecordsShare(token: string) {
  if (shouldUseDemoData()) throw new Error("Share non disponibile in modalità demo");
  const { db } = getFirebase();
  const snap = await getDoc(doc(db, "recordShares", token));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<RecordsShare, "id">) } as RecordsShare;
}

