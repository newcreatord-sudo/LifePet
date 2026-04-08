import { addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { Expense, ExpenseSeries } from "@/types";

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:expenses`;
}

function demoSeriesKey(petId: string) {
  return `lifepet:demo:pet:${petId}:expenseSeries`;
}

export function expensesCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "expenses");
}

export function expenseSeriesCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "expenseSeries");
}

export function subscribeExpenseSeries(petId: string, onData: (items: ExpenseSeries[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<ExpenseSeries[]>(demoSeriesKey(petId), [], (all) => {
      const items = all.slice().sort((a, b) => b.createdAt - a.createdAt);
      onData(items);
    });
  }
  const q = query(expenseSeriesCol(petId), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(q, (snap) => {
    const items: ExpenseSeries[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExpenseSeries, "id">) }));
    onData(items);
  });
}

export async function createExpenseSeries(petId: string, input: Omit<ExpenseSeries, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<ExpenseSeries, "id">) } as ExpenseSeries;
    demoUpdate<ExpenseSeries[]>(demoSeriesKey(petId), [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(expenseSeriesCol(petId), input);
  return ref.id;
}

export async function setExpenseSeriesEnabled(petId: string, seriesId: string, enabled: boolean) {
  if (shouldUseDemoData()) {
    demoUpdate<ExpenseSeries[]>(demoSeriesKey(petId), [], (prev) => prev.map((s) => (s.id === seriesId ? ({ ...s, enabled } as ExpenseSeries) : s)));
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "expenseSeries", seriesId), { enabled });
}

export async function deleteExpenseSeries(petId: string, seriesId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<ExpenseSeries[]>(demoSeriesKey(petId), [], (prev) => prev.filter((s) => s.id !== seriesId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "expenseSeries", seriesId));
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

async function ensureExpenseExists(petId: string, expenseId: string, input: Omit<Expense, "id">) {
  if (shouldUseDemoData()) {
    demoUpdate<Expense[]>(demoKey(petId), [], (prev) => {
      if (prev.some((e) => e.id === expenseId)) return prev;
      return [{ id: expenseId, ...(input as Omit<Expense, "id">) } as Expense, ...prev];
    });
    return;
  }
  const { db } = getFirebase();
  const ref = doc(db, "pets", petId, "expenses", expenseId);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, input);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function seedExpenseSeriesOncePerDay(petId: string, userId: string, series: ExpenseSeries[]) {
  const day = todayKey();
  const now = Date.now();
  for (const s of series) {
    if (!s.enabled) continue;
    if (typeof s.endAt === "number" && now > s.endAt) continue;
    const key = `lifepet:expenseSeriesSeed:${petId}:${s.id}:${day}`;
    try {
      if (localStorage.getItem(key)) continue;
      localStorage.setItem(key, "1");
    } catch {
      continue;
    }

    const start = new Date(s.startAt);
    const startY = start.getFullYear();
    const startM = start.getMonth();
    const cur = new Date(now);
    const curY = cur.getFullYear();
    const curM = cur.getMonth();

    const months = (curY - startY) * 12 + (curM - startM);
    const maxMonths = Math.min(24, Math.max(0, months));
    for (let i = 0; i <= maxMonths; i += 1) {
      const d0 = new Date(startY, startM + i, 1, 12, 0, 0, 0);
      const y = d0.getFullYear();
      const m = d0.getMonth();
      const lastDay = new Date(y, m + 1, 0).getDate();
      const dayOfMonth = Math.min(Math.max(1, s.recurrence.dayOfMonth), lastDay);
      const occurredAt = new Date(y, m, dayOfMonth, 12, 0, 0, 0).getTime();
      if (occurredAt < s.startAt) continue;
      if (occurredAt > now) continue;
      if (typeof s.endAt === "number" && occurredAt > s.endAt) continue;

      const occurrenceKey = `${y}${String(m + 1).padStart(2, "0")}`;
      const expenseId = `series_${s.id}_${occurrenceKey}`;
      await ensureExpenseExists(petId, expenseId, {
        petId,
        amount: s.amount,
        currency: s.currency,
        category: s.category,
        occurredAt,
        note: s.note,
        seriesId: s.id,
        createdAt: now,
        createdBy: userId,
      });
    }
  }
}

export async function deleteExpense(petId: string, expenseId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<Expense[]>(demoKey(petId), [], (prev) => prev.filter((e) => e.id !== expenseId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "expenses", expenseId));
}

export async function updateExpense(petId: string, expenseId: string, patch: Partial<Omit<Expense, "id" | "petId" | "createdAt" | "createdBy">>) {
  if (shouldUseDemoData()) {
    demoUpdate<Expense[]>(demoKey(petId), [], (prev) => prev.map((e) => (e.id === expenseId ? ({ ...e, ...patch } as Expense) : e)));
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "expenses", expenseId), patch);
}
