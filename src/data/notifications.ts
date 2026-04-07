import { collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { NotificationSeverity, PetNotification } from "@/types";

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

export function subscribeNotifications(
  petId: string,
  opts: { limitCount: number; onlyUnread?: boolean; severities?: NotificationSeverity[] },
  onData: (items: PetNotification[]) => void
) {
  const { limitCount, onlyUnread, severities } = opts;
  if (shouldUseDemoData()) {
    return demoSubscribe<PetNotification[]>(demoKey(petId), [], (all) => {
      const items = all
        .filter((n) => (onlyUnread ? !n.read : true))
        .filter((n) => (severities && severities.length ? severities.includes(n.severity) : true))
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limitCount);
      onData(items);
    });
  }

  const q = onlyUnread
    ? query(notificationsCol(petId), where("read", "==", false), orderBy("createdAt", "desc"), limit(limitCount))
    : query(notificationsCol(petId), orderBy("createdAt", "desc"), limit(limitCount));
  return onSnapshot(q, (snap) => {
    const raw: PetNotification[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PetNotification, "id">) }));
    const items = severities && severities.length ? raw.filter((n) => severities.includes(n.severity)) : raw;
    onData(items);
  });
}

export async function markAllNotificationsRead(petId: string, notificationIds: string[]) {
  if (notificationIds.length === 0) return;
  if (shouldUseDemoData()) {
    demoUpdate<PetNotification[]>(demoKey(petId), [], (prev) => prev.map((n) => (notificationIds.includes(n.id) ? { ...n, read: true } : n)));
    return;
  }
  const { db } = getFirebase();
  const batch = writeBatch(db);
  for (const id of notificationIds) {
    batch.update(doc(db, "pets", petId, "notifications", id), { read: true });
  }
  await batch.commit();
}
