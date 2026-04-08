import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";
import { getStorage, type FirebaseStorage } from "firebase/storage";

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

function validateEnv() {
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
  validateEnv();

  const firebaseConfig = getFirebaseWebConfig();

  const app = initializeApp(firebaseConfig);
  const region = (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION as string) || "us-central1";

  cached = {
    app,
    auth: getAuth(app),
    db: initializeFirestore(app, { ignoreUndefinedProperties: true }),
    storage: getStorage(app),
    functions: getFunctions(app, region),
  };

  return cached;
}

export function getFirebaseWebConfig(): FirebaseWebConfig {
  validateEnv();
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  };
}
