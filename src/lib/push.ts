import { getMessaging, getToken, deleteToken, onMessage, type MessagePayload } from "firebase/messaging";
import { getFirebase, getFirebaseWebConfig, getFirebaseConfigError } from "@/lib/firebase";

export function isPushSupported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export function getVapidKey() {
  return (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined) || null;
}

export async function ensureMessagingServiceWorker() {
  const err = getFirebaseConfigError();
  if (err) throw new Error(err);
  const cfg = getFirebaseWebConfig();
  const url = `/firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(cfg))}`;
  return navigator.serviceWorker.register(url);
}

export async function enablePushNotifications() {
  if (!isPushSupported()) throw new Error("Notifiche push non supportate");
  const vapidKey = getVapidKey();
  if (!vapidKey) throw new Error("Manca VITE_FIREBASE_VAPID_KEY");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permesso notifiche negato");

  const registration = await ensureMessagingServiceWorker();
  const { app } = getFirebase();
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Impossibile ottenere il token FCM");
  return token;
}

export async function disablePushNotifications() {
  const err = getFirebaseConfigError();
  if (err) return;
  const { app } = getFirebase();
  const messaging = getMessaging(app);
  await deleteToken(messaging);
}

export function subscribeForegroundMessages(onPayload: (payload: MessagePayload) => void) {
  const err = getFirebaseConfigError();
  if (err) return () => {};
  const { app } = getFirebase();
  const messaging = getMessaging(app);
  return onMessage(messaging, onPayload);
}
