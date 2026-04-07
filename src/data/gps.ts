import { addDoc, collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { GpsPoint } from "@/types";

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:gpsPoints`;
}

export function gpsPointsCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "gpsPoints");
}

export function subscribeLatestGpsPoint(petId: string, onData: (p: GpsPoint | null) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<GpsPoint[]>(demoKey(petId), [], (all) => {
      const latest = all.slice().sort((a, b) => b.recordedAt - a.recordedAt)[0] ?? null;
      onData(latest);
    });
  }
  const q = query(gpsPointsCol(petId), orderBy("recordedAt", "desc"), limit(1));
  return onSnapshot(q, (snap) => {
    const d = snap.docs[0];
    if (!d) return onData(null);
    onData({ id: d.id, ...(d.data() as Omit<GpsPoint, "id">) });
  });
}

export function subscribeGpsHistory(petId: string, limitCount: number, onData: (points: GpsPoint[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<GpsPoint[]>(demoKey(petId), [], (all) => {
      const points = all.slice().sort((a, b) => b.recordedAt - a.recordedAt).slice(0, limitCount);
      onData(points);
    });
  }
  const q = query(gpsPointsCol(petId), orderBy("recordedAt", "desc"), limit(limitCount));
  return onSnapshot(q, (snap) => {
    const points: GpsPoint[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GpsPoint, "id">) }));
    onData(points);
  });
}

export async function createGpsPoint(petId: string, input: Omit<GpsPoint, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<GpsPoint, "id">) } as GpsPoint;
    demoUpdate<GpsPoint[]>(demoKey(petId), [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(gpsPointsCol(petId), input);
  return ref.id;
}
