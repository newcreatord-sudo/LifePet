import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, enableIndexedDbPersistence, getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

export type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  functions: Functions;
};

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

let cached: FirebaseServices | null = null;

function emulatorsEnabled() {
  return import.meta.env.DEV && (import.meta.env.VITE_FIREBASE_EMULATORS as string | undefined) === "1";
}

function emulatorHost() {
  return (import.meta.env.VITE_FIREBASE_EMULATORS_HOST as string | undefined) || "127.0.0.1";
}

function forceLongPolling() {
  if ((import.meta.env.VITE_FIREBASE_FORCE_LONG_POLLING as string | undefined) === "1") return true;
  try {
    return localStorage.getItem("lifepet:forceLongPolling") === "1";
  } catch {
    return false;
  }
}

function validateEnv() {
  if (emulatorsEnabled()) return;
  const required = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
  ] as const;

  const missing = required.filter((k) => !(import.meta.env[k] as string | undefined));
  if (missing.length) {
    throw new Error(`Firebase env not configured: ${missing.join(", ")}`);
  }
}

export function getFirebaseConfigError() {
  try {
    validateEnv();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Firebase env not configured";
  }
}

export function getFirebase(): FirebaseServices {
  if (cached) return cached;

  const firebaseConfig = getFirebaseWebConfig();

  const app = initializeApp(firebaseConfig);
  const region = (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string) || "us-central1";

  const force = forceLongPolling();
  const firestoreSettings: Parameters<typeof initializeFirestore>[1] = {
    ignoreUndefinedProperties: true,
    experimentalAutoDetectLongPolling: true,
    ...(force ? { experimentalForceLongPolling: true } : {}),
  };

  let db: Firestore;
  try {
    db = initializeFirestore(app, firestoreSettings);
  } catch {
    db = getFirestore(app);
  }

  cached = {
    app,
    auth: getAuth(app),
    db,
    storage: getStorage(app),
    functions: getFunctions(app, region),
  };

  if (emulatorsEnabled()) {
    const host = emulatorHost();
    connectAuthEmulator(cached.auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(cached.db, host, 8080);
    connectFunctionsEmulator(cached.functions, host, 5001);
    connectStorageEmulator(cached.storage, host, 9199);
  }

  void enableIndexedDbPersistence(cached.db).catch(() => Promise.resolve());

  return cached;
}

export function getFirebaseWebConfig(): FirebaseWebConfig {
  const emulator = emulatorsEnabled();
  if (!emulator) validateEnv();
  const projectId = emulator ? "demo-lifepet" : ((import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) || "demo-lifepet");
  return {
    apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) || "demo",
    authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) || `${projectId}.appspot.com`,
    messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) || "demo",
    appId: (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined) || "demo",
  };
}
