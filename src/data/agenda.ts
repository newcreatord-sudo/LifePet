import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { demoId, demoSubscribe, demoUpdate } from "@/lib/demoDb";
import { shouldUseDemoData } from "@/lib/runtimeMode";
import type { AgendaEvent, AgendaSeries } from "@/types";

function demoKey(petId: string) {
  return `lifepet:demo:pet:${petId}:agendaEvents`;
}

function demoSeriesKey(petId: string) {
  return `lifepet:demo:pet:${petId}:agendaSeries`;
}

export function agendaEventsCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "agendaEvents");
}

export function agendaSeriesCol(petId: string) {
  const { db } = getFirebase();
  return collection(db, "pets", petId, "agendaSeries");
}

export function subscribeAgendaSeries(petId: string, onData: (items: AgendaSeries[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<AgendaSeries[]>(demoSeriesKey(petId), [], (all) => {
      onData(all.slice().sort((a, b) => b.createdAt - a.createdAt));
    });
  }
  const q = query(agendaSeriesCol(petId), orderBy("createdAt", "desc"), limit(200));
  return onSnapshot(q, (snap) => {
    const items: AgendaSeries[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgendaSeries, "id">) }));
    onData(items);
  });
}

export function subscribeUpcomingAgenda(petId: string, fromMs: number, limitCount: number, onData: (events: AgendaEvent[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<AgendaEvent[]>(demoKey(petId), [], (all) => {
      const events = all
        .filter((e) => e.dueAt >= fromMs)
        .slice()
        .sort((a, b) => a.dueAt - b.dueAt)
        .slice(0, limitCount);
      onData(events);
    });
  }
  const q = query(
    agendaEventsCol(petId),
    where("dueAt", ">=", fromMs),
    orderBy("dueAt", "asc"),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    const events: AgendaEvent[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgendaEvent, "id">) }));
    onData(events);
  });
}

export function subscribeAgendaRange(petId: string, fromMs: number, toMs: number, onData: (events: AgendaEvent[]) => void) {
  if (shouldUseDemoData()) {
    return demoSubscribe<AgendaEvent[]>(demoKey(petId), [], (all) => {
      const events = all
        .filter((e) => e.dueAt >= fromMs && e.dueAt <= toMs)
        .slice()
        .sort((a, b) => a.dueAt - b.dueAt);
      onData(events);
    });
  }
  const q = query(
    agendaEventsCol(petId),
    where("dueAt", ">=", fromMs),
    where("dueAt", "<=", toMs),
    orderBy("dueAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    const events: AgendaEvent[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AgendaEvent, "id">) }));
    onData(events);
  });
}

export async function createAgendaEvent(petId: string, input: Omit<AgendaEvent, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<AgendaEvent, "id">) } as AgendaEvent;
    demoUpdate<AgendaEvent[]>(demoKey(petId), [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(agendaEventsCol(petId), input);
  return ref.id;
}

function parseTimeOfDay(v: string | undefined) {
  const s = String(v ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(s)) return null;
  const [hh, mm] = s.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function ymdKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeSeriesOccurrences(series: AgendaSeries, fromMs: number, toMs: number) {
  const out: number[] = [];
  const start = Math.max(series.startAt, fromMs);
  const t = parseTimeOfDay(series.timeOfDay);
  const base = new Date(start);
  const end = new Date(toMs);
  const cur = new Date(base);
  cur.setSeconds(0, 0);
  if (t) cur.setHours(t.hh, t.mm, 0, 0);
  if (cur.getTime() < start) cur.setTime(cur.getTime() + 24 * 60 * 60 * 1000);

  while (cur <= end) {
    if (series.recurrence.type === "daily") {
      out.push(cur.getTime());
      cur.setDate(cur.getDate() + 1);
      continue;
    }
    const wd = cur.getDay();
    if (series.recurrence.weekdays.includes(wd)) out.push(cur.getTime());
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export async function createAgendaSeries(petId: string, input: Omit<AgendaSeries, "id">) {
  if (shouldUseDemoData()) {
    const id = demoId();
    const next = { id, ...(input as Omit<AgendaSeries, "id">) } as AgendaSeries;
    demoUpdate<AgendaSeries[]>(demoSeriesKey(petId), [], (prev) => [next, ...prev]);
    return id;
  }
  const ref = await addDoc(agendaSeriesCol(petId), input);
  return ref.id;
}

export async function updateAgendaSeries(petId: string, seriesId: string, patch: Partial<Omit<AgendaSeries, "id" | "petId" | "createdAt" | "createdBy">>) {
  if (shouldUseDemoData()) {
    demoUpdate<AgendaSeries[]>(demoSeriesKey(petId), [], (prev) =>
      prev.map((s) => (s.id === seriesId ? ({ ...s, ...(patch as Partial<AgendaSeries>) } as AgendaSeries) : s))
    );
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "agendaSeries", seriesId), patch);
}

export async function deleteAgendaSeries(petId: string, seriesId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<AgendaSeries[]>(demoSeriesKey(petId), [], (prev) => prev.filter((s) => s.id !== seriesId));
    demoUpdate<AgendaEvent[]>(demoKey(petId), [], (prev) => prev.filter((e) => e.seriesId !== seriesId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "agendaSeries", seriesId));
}

export async function seedUpcomingAgendaFromSeries(petId: string, series: AgendaSeries, horizonDays: number) {
  const now = Date.now();
  const toMs = now + horizonDays * 24 * 60 * 60 * 1000;
  const dueAts = computeSeriesOccurrences(series, now, toMs);

  if (shouldUseDemoData()) {
    demoUpdate<AgendaEvent[]>(demoKey(petId), [], (prev) => {
      const existing = new Set(prev.filter((e) => e.seriesId === series.id).map((e) => `${e.seriesId}:${e.dueAt}`));
      const createdBy = series.createdBy;
      const toAdd: AgendaEvent[] = [];
      for (const dueAt of dueAts) {
        const k = `${series.id}:${dueAt}`;
        if (existing.has(k)) continue;
        toAdd.push({
          id: demoId(),
          petId: series.petId,
          title: series.title,
          dueAt,
          kind: series.kind,
          reminderMinutesBefore: series.reminderMinutesBefore,
          seriesId: series.id,
          createdAt: Date.now(),
          createdBy,
        });
      }
      return [...toAdd, ...prev];
    });
    return;
  }

  const { db } = getFirebase();
  const q = query(agendaEventsCol(petId), where("seriesId", "==", series.id), where("dueAt", ">=", now), orderBy("dueAt", "asc"), limit(2000));
  const existingSnap = await getDocs(q);
  const existing = new Set(existingSnap.docs.map((d) => `${series.id}:${(d.data() as { dueAt?: number }).dueAt ?? 0}`));

  const batch = writeBatch(db);
  for (const dueAt of dueAts) {
    const k = `${series.id}:${dueAt}`;
    if (existing.has(k)) continue;
    const eventId = `${series.id}_${ymdKey(new Date(dueAt))}_${String(dueAt)}`;
    batch.set(doc(db, "pets", petId, "agendaEvents", eventId), {
      petId,
      title: series.title,
      dueAt,
      kind: series.kind,
      reminderMinutesBefore: series.reminderMinutesBefore ?? 0,
      seriesId: series.id,
      createdAt: Date.now(),
      createdBy: series.createdBy,
    });
  }
  await batch.commit();
}

export async function updateAgendaEvent(petId: string, eventId: string, patch: Partial<Omit<AgendaEvent, "id" | "petId" | "createdAt" | "createdBy">>) {
  if (shouldUseDemoData()) {
    demoUpdate<AgendaEvent[]>(demoKey(petId), [], (prev) =>
      prev.map((e) => (e.id === eventId ? ({ ...e, ...(patch as Partial<AgendaEvent>) } as AgendaEvent) : e))
    );
    return;
  }
  const { db } = getFirebase();
  await updateDoc(doc(db, "pets", petId, "agendaEvents", eventId), patch);
}

export async function deleteAgendaEvent(petId: string, eventId: string) {
  if (shouldUseDemoData()) {
    demoUpdate<AgendaEvent[]>(demoKey(petId), [], (prev) => prev.filter((e) => e.id !== eventId));
    return;
  }
  const { db } = getFirebase();
  await deleteDoc(doc(db, "pets", petId, "agendaEvents", eventId));
}
