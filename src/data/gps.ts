import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import { reportFirestoreError } from "@/lib/firestoreFallback";
import type { GpsDevice, GpsPoint } from "@/types";

function requireUid() {
  const uid = getFirebase().auth.currentUser?.uid;
  if (!uid) throw new Error("Devi effettuare l'accesso");
  return uid;
}

function normalizeGpsPointInput(petId: string, input: Omit<GpsPoint, "id">) {
  const uid = requireUid();
  const next: Omit<GpsPoint, "id"> = {
    ...input,
    petId,
    createdBy: input.createdBy || uid,
  };
  if (next.createdBy !== uid) throw new Error("createdBy non valido");
  return next;
}

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:gpsPoints`;
}

export function gpsPointsCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "gpsPoints");
}

function demoDevicesKey(petId: string) {
  return `lifepet:demo:pet:${petId}:gpsDevices`;
}

export function gpsDevicesCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "gpsDevices");
}

export function subscribeGpsDevices(petId: string, onData: (items: GpsDevice[]) => void, onError?: (err: unknown) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<GpsDevice[]>(demoDevicesKey(petId), [], (all) => {
      const items = all.slice().sort((a, b) => b.createdAt - a.createdAt);
      onData(items);
    });
  }
  const q = query(gpsDevicesCol(petId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const items: GpsDevice[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GpsDevice, "id">) }));
      onData(items);
    },
    (err) => {
      onError?.(err);
      reportFirestoreError(err, "gps:devices");
      onData([]);
    }
  );
}

export async function createGpsDevice(petId: string, input: Omit<GpsDevice, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<GpsDevice, "id">) } as GpsDevice;
    demoUpdate<GpsDevice[]>(demoDevicesKey(petId), [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(gpsDevicesCol(petId), input);
  return ref.id;
}

export async function updateGpsDevice(petId: string, deviceId: string, patch: Partial<Omit<GpsDevice, "id" | "petId" | "createdAt" | "createdBy">>) {
  if (shouldUseDemoData()) {
    demoUpdate<GpsDevice[]>(demoDevicesKey(petId), [], (prev) => prev.map((d) => (d.id === deviceId ? ({ ...d, ...patch } as GpsDevice) : d)));
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "gpsDevices", deviceId), patch as Record<string, unknown>);
}

export async function deleteGpsDevice(petId: string, deviceId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<GpsDevice[]>(demoDevicesKey(petId), [], (prev) => prev.filter((d) => d.id !== deviceId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "gpsDevices", deviceId));
}

export function subscribeLatestGpsPoint(petId: string, onData: (p: GpsPoint | null) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<GpsPoint[]>(demoKey(petId), [], (all) => {
      const latest = all.slice().sort((a, b) => b.recordedAt - a.recordedAt)[0] ?? null;
      onData(latest);
    });
  }
  const q = query(gpsPointsCol(petId), orderBy("recordedAt", "desc"), limit(1));
  return onSnapshot(
    q,
    (snap) => {
      const d = snap.docs[0];
      if (!d) return onData(null);
      onData({ id: d.id, ...(d.data() as Omit<GpsPoint, "id">) });
    },
    (err) => {
      reportFirestoreError(err, "gps:ultimo");
      onData(null);
    }
  );
}

export function subscribeGpsHistory(petId: string, limitCount: number, onData: (points: GpsPoint[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<GpsPoint[]>(demoKey(petId), [], (all) => {
      const points = all.slice().sort((a, b) => b.recordedAt - a.recordedAt).slice(0, limitCount);
      onData(points);
    });
  }
  const q = query(gpsPointsCol(petId), orderBy("recordedAt", "desc"), limit(limitCount));
  return onSnapshot(
    q,
    (snap) => {
      const points: GpsPoint[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GpsPoint, "id">) }));
      onData(points);
    },
    (err) => {
      reportFirestoreError(err, "gps:storico");
      onData([]);
    }
  );
}

export async function createGpsPoint(petId: string, input: Omit<GpsPoint, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<GpsPoint, "id">) } as GpsPoint;
    demoUpdate<GpsPoint[]>(demoKey(petId), [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(gpsPointsCol(petId), normalizeGpsPointInput(petId, input));
  return ref.id;
}

export async function deleteGpsPoint(petId: string, pointId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<GpsPoint[]>(demoKey(petId), [], (prev) => prev.filter((p) => p.id !== pointId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "gpsPoints", pointId));
}

export async function clearGpsHistory(petId: string, limitCount: number) {
  if (shouldUseDemoData()) {
    demoUpdate<GpsPoint[]>(demoKey(petId), [], (prev) => prev.slice(limitCount));
    return;
  }
  const { db } = getFirebase();
  const q = query(gpsPointsCol(petId), orderBy("recordedAt", "desc"), limit(limitCount));
  const pointsSnap = await getDocs(q);
  const batch = writeBatch(db);
  for (const d of pointsSnap.docs) batch.delete(d.ref);
  await batch.commit();
}
