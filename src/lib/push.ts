import type { MessagePayload } from "firebase/messaging";
import { getFirebase, getFirebaseWebConfig, getFirebaseConfigError } from "@/lib/firebase";

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.isSecureContext) &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function getVapidKey() {
  return (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined) || null;
}

export async function ensureMessagingServiceWorker() {
  const err = getFirebaseConfigError();
  if (err) throw new Error(err);
  const cfg = getFirebaseWebConfig();
  const url = `/firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(cfg))}`;
  return navigator.serviceWorker.register(url, { scope: "/firebase-messaging/" });
}

export async function enablePushNotifications() {
  if (!isPushSupported()) throw new Error("Notifiche push non supportate");
  const vapidKey = getVapidKey();
  if (!vapidKey) throw new Error("Manca VITE_FIREBASE_VAPID_KEY");
  const { isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("Notifiche push non supportate");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permesso notifiche negato");

  const registration = await ensureMessagingServiceWorker();
  const { app } = getFirebase();
  const { getMessaging, getToken } = await import("firebase/messaging");
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Impossibile ottenere il token FCM");
  return token;
}

export async function disablePushNotifications() {
  const err = getFirebaseConfigError();
  if (err) return;
  const { isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) return;
  const { app } = getFirebase();
  const { getMessaging, deleteToken } = await import("firebase/messaging");
  const messaging = getMessaging(app);
  await deleteToken(messaging);
}

export function subscribeForegroundMessages(onPayload: (payload: MessagePayload) => void) {
  const err = getFirebaseConfigError();
  if (err) return () => {};
  let disposed = false;
  let unsubscribe: (() => void) | null = null;

  void (async () => {
    try {
      if (!isPushSupported()) return;
      const { isSupported, getMessaging, onMessage } = await import("firebase/messaging");
      if (!(await isSupported())) return;
      if (disposed) return;
      const { app } = getFirebase();
      const messaging = getMessaging(app);
      unsubscribe = onMessage(messaging, onPayload);
    } catch {
      return;
    }
  })();

  return () => {
    disposed = true;
    try {
      unsubscribe?.();
    } catch {
      return;
    }
  };
}
