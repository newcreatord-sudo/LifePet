import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoSubscribe } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { HealthScore } from "@/types";

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:healthScores`;
}

export function healthScoresCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "healthScores");
}

export function subscribeHealthScoresRange(
  petId: string,
  fromMs: number,
  toMs: number,
  limitCount: number,
  onData: (items: HealthScore[]) => void
) {
  if (shouldUseDemoData()) {
    return demoSubscribe<Record<string, unknown>>(demoKey(petId), {}, (all) => {
      const items = Object.values(all)
        .map((x) => x as HealthScore)
        .filter((s) => (s.computedAt ?? 0) >= fromMs && (s.computedAt ?? 0) <= toMs)
        .sort((a, b) => (a.computedAt ?? 0) - (b.computedAt ?? 0))
        .slice(-limitCount);
      onData(items);
    });
  }

  const q = query(
    healthScoresCol(petId),
    where("computedAt", ">=", fromMs),
    where("computedAt", "<=", toMs),
    orderBy("computedAt", "asc"),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    const items: HealthScore[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HealthScore, "id">) }));
    onData(items);
  });
}

