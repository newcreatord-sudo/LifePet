import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/runtimeMode", () => ({
  shouldUseDemoData: () => true,
}));

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

beforeEach(() => {
  const storage = new MemoryStorage();
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = storage;
  storage.setItem("lifepet:demoMode", "1");

  const url = globalThis.URL as unknown as { createObjectURL?: (b: unknown) => string; revokeObjectURL?: (u: string) => void };
  if (!url.createObjectURL) {
    url.createObjectURL = () => "blob:demo";
  }
  if (!url.revokeObjectURL) {
    url.revokeObjectURL = () => undefined;
  }
});

describe("demo mode CRUD", () => {
  it("agenda CRUD", async () => {
    const { subscribeAgendaRange, createAgendaEvent, updateAgendaEvent, deleteAgendaEvent } = await import("@/data/agenda");
    const petId = "pet_demo_agenda";
    let latest: Array<{ id: string; title: string }> = [];
    const unsub = subscribeAgendaRange(petId, 0, Date.now() + 365 * 24 * 60 * 60 * 1000, (events) => {
      latest = events.map((e) => ({ id: e.id, title: e.title }));
    });

    const id = await createAgendaEvent(petId, {
      petId,
      title: "Visita",
      dueAt: Date.now() + 10_000,
      kind: "vet",
      reminderMinutesBefore: 60,
      createdAt: Date.now(),
      createdBy: "u",
    });

    expect(latest.find((e) => e.id === id)?.title).toBe("Visita");

    await updateAgendaEvent(petId, id, { title: "Visita aggiornata" });
    expect(latest.find((e) => e.id === id)?.title).toBe("Visita aggiornata");

    await deleteAgendaEvent(petId, id);
    expect(latest.find((e) => e.id === id)).toBeUndefined();
    unsub();
  });

  it("tasks CRUD", async () => {
    const { subscribeTasks, createTask, updateTask, setTaskDone, deleteTask } = await import("@/data/tasks");
    const petId = "pet_demo_tasks";
    let latest: Array<{ id: string; title: string; status: string }> = [];
    const unsub = subscribeTasks(petId, (items) => {
      latest = items.map((t) => ({ id: t.id, title: t.title, status: t.status }));
    });

    const id = await createTask(petId, {
      petId,
      title: "Task",
      dueAt: Date.now() + 10_000,
      status: "due",
      createdAt: Date.now(),
      createdBy: "u",
    });

    expect(latest.find((t) => t.id === id)?.title).toBe("Task");

    await updateTask(petId, id, { title: "Task 2" });
    expect(latest.find((t) => t.id === id)?.title).toBe("Task 2");

    await setTaskDone(petId, id, true, Date.now());
    expect(latest.find((t) => t.id === id)?.status).toBe("done");

    await deleteTask(petId, id);
    expect(latest.find((t) => t.id === id)).toBeUndefined();
    unsub();
  });

  it("expenses CRUD", async () => {
    const { subscribeRecentExpenses, createExpense, deleteExpense, subscribeExpenseSeries, createExpenseSeries, deleteExpenseSeries, setExpenseSeriesEnabled } = await import("@/data/expenses");
    const petId = "pet_demo_expenses";
    let latest: Array<{ id: string; amount: number }> = [];
    const unsub = subscribeRecentExpenses(petId, 10, (items) => {
      latest = items.map((e) => ({ id: e.id, amount: e.amount }));
    });

    const id = await createExpense(petId, {
      petId,
      amount: 12.5,
      currency: "EUR",
      category: "food",
      occurredAt: Date.now(),
      createdAt: Date.now(),
      createdBy: "u",
    });
    expect(latest.find((e) => e.id === id)?.amount).toBe(12.5);

    await deleteExpense(petId, id);
    expect(latest.find((e) => e.id === id)).toBeUndefined();
    unsub();

    let latestSeries: Array<{ id: string; enabled: boolean }> = [];
    const unsubSeries = subscribeExpenseSeries(petId, (s) => {
      latestSeries = s.map((x) => ({ id: x.id, enabled: x.enabled }));
    });

    const sId = await createExpenseSeries(petId, {
      petId,
      title: "Abbonamento",
      enabled: true,
      amount: 9.99,
      currency: "EUR",
      category: "other",
      startAt: Date.now(),
      recurrence: { type: "monthly", dayOfMonth: 1 },
      createdAt: Date.now(),
      createdBy: "u",
    });

    expect(latestSeries.find((s) => s.id === sId)?.enabled).toBe(true);
    await setExpenseSeriesEnabled(petId, sId, false);
    expect(latestSeries.find((s) => s.id === sId)?.enabled).toBe(false);
    await deleteExpenseSeries(petId, sId);
    expect(latestSeries.find((s) => s.id === sId)).toBeUndefined();
    unsubSeries();
  });

  it("health CRUD", async () => {
    const { subscribeHealthEventsRange, createHealthEvent, updateHealthEvent, deleteHealthEvent } = await import("@/data/health");
    const petId = "pet_demo_health";
    let latest: Array<{ id: string; title: string }> = [];
    const unsub = subscribeHealthEventsRange(petId, 0, Date.now() + 365 * 24 * 60 * 60 * 1000, 50, (items) => {
      latest = items.map((e) => ({ id: e.id, title: e.title }));
    });

    const id = await createHealthEvent(petId, {
      petId,
      type: "note",
      title: "Nota",
      occurredAt: Date.now(),
      createdAt: Date.now(),
      createdBy: "u",
    });
    expect(latest.find((e) => e.id === id)?.title).toBe("Nota");

    await updateHealthEvent(petId, id, { title: "Nota 2" });
    expect(latest.find((e) => e.id === id)?.title).toBe("Nota 2");

    await deleteHealthEvent(petId, id);
    expect(latest.find((e) => e.id === id)).toBeUndefined();
    unsub();
  });

  it("documents CRUD", async () => {
    const { subscribeDocuments, uploadPetDocument, deletePetDocument } = await import("@/data/documents");
    const petId = "pet_demo_docs";
    let latest: Array<{ id: string; name: string; storagePath: string }> = [];
    const unsub = subscribeDocuments(petId, (docs) => {
      latest = docs.map((d) => ({ id: d.id, name: d.name, storagePath: d.storagePath }));
    });

    const file = new Blob(["referto"], { type: "application/pdf" }) as unknown as File;
    (file as unknown as { name: string }).name = "referto.pdf";
    const { docId, storagePath } = await uploadPetDocument(petId, "u", file);
    expect(latest.find((d) => d.id === docId)?.name).toBe("referto.pdf");

    await deletePetDocument(petId, docId, storagePath);
    expect(latest.find((d) => d.id === docId)).toBeUndefined();
    unsub();
  });
});
