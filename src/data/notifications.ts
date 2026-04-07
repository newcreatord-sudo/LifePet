import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { PetNotification } from "@/types";

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:notifications`;
}

export function notificationsCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "notifications");
}

export function subscribeUnreadNotifications(petId: string, limitCount: number, onData: (items: PetNotification[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<PetNotification[]>(demoKey(petId), [], (all) => {
      const items = all
        .filter((n) => !n.read)
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limitCount);
      onData(items);
    });
  }
  const q = query(notificationsCol(petId), where("read", "==", false), orderBy("createdAt", "desc"), limit(limitCount));
  return onSnapshot(q, (snap) => {
    const items: PetNotification[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PetNotification, "id">) }));
    onData(items);
  });
}

export async function markNotificationRead(petId: string, notificationId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<PetNotification[]>(demoKey(petId), [], (prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "notifications", notificationId), { read: true });
}
