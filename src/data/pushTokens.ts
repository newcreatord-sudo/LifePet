import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
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

