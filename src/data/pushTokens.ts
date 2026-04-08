import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { shouldUseDemoData } from "@/lib/runtimeMode";

export async function savePushToken(userId: string, token: string) {
  if (shouldUseDemoData()) return;
  const { db } = getFirebase();
  await setDoc(
    doc(db, "users", userId, "pushTokens", token),
    {
      token,
      createdAt: serverTimestamp(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    },
    { merge: true }
  );
}

export async function deletePushToken(userId: string, token: string) {
  if (shouldUseDemoData()) return;
  const { db } = getFirebase();
  await deleteDoc(doc(db, "users", userId, "pushTokens", token));
}

export function subscribePushTokens(userId: string, onTokens: (tokens: string[]) => void) {
  if (shouldUseDemoData()) {
    onTokens([]);
    return () => {};
  }
  const { db } = getFirebase();
  const col = collection(db, "users", userId, "pushTokens");
  return onSnapshot(col, (snap) => {
    onTokens(snap.docs.map((d) => d.id));
  });
}
