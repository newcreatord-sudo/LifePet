import { addDoc, collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { Expense } from "@/types";

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:expenses`;
}

export function expensesCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "expenses");
}

export function subscribeRecentExpenses(petId: string, limitCount: number, onData: (items: Expense[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<Expense[]>(demoKey(petId), [], (all) => {
      const items = all.slice().sort((a, b) => b.occurredAt - a.occurredAt).slice(0, limitCount);
      onData(items);
    });
  }
  const q = query(expensesCol(petId), orderBy("occurredAt", "desc"), limit(limitCount));
  return onSnapshot(q, (snap) => {
    const items: Expense[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Expense, "id">) }));
    onData(items);
  });
}

export function subscribeExpensesRange(petId: string, fromMs: number, toMs: number, onData: (items: Expense[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<Expense[]>(demoKey(petId), [], (all) => {
      const items = all
        .filter((e) => e.occurredAt >= fromMs && e.occurredAt <= toMs)
        .slice()
        .sort((a, b) => b.occurredAt - a.occurredAt);
      onData(items);
    });
  }
  const q = query(
    expensesCol(petId),
    where("occurredAt", ">=", fromMs),
    where("occurredAt", "<=", toMs),
    orderBy("occurredAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const items: Expense[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Expense, "id">) }));
    onData(items);
  });
}

export async function createExpense(petId: string, input: Omit<Expense, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<Expense, "id">) } as Expense;
    demoUpdate<Expense[]>(demoKey(petId), [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(expensesCol(petId), input);
  return ref.id;
}
