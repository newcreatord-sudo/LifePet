import { describe, expect, it, beforeEach, vi } from "vitest";
import { deleteField } from "firebase/firestore";

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
  it("pets CRUD", async () => {
    const { subscribeMyPets, createPet, updatePet, deletePet } = await import("@/data/pets");
    const userId = "u";
    let latest: Array<{ id: string; name: string; breed?: string; microchipId?: string }> = [];
    const unsub = subscribeMyPets(userId, (items) => {
      latest = items.map((p) => ({ id: p.id, name: p.name, breed: p.breed, microchipId: p.microchipId }));
    });

    const id = await createPet({
      ownerId: userId,
      name: "Luna",
      species: "dog",
      breed: "Meticcio",
      dob: "2020-01-02",
      sex: "female",
      neutered: true,
      weightKg: 12.5,
      activityLevel: "medium",
      temperamentTags: ["socievole"],
      microchipId: "1234567890",
      currentFood: { label: "Kibble", kcalPerG: 3.6 },
      healthProfile: { allergies: ["pollo"], conditions: [], medications: [] },
      vetContact: { clinicName: "Vet", phone: "123", emergencyPhone: "999" },
      createdAt: Date.now(),
    });

    expect(latest.find((p) => p.id === id)?.breed).toBe("Meticcio");
    expect(latest.find((p) => p.id === id)?.microchipId).toBe("1234567890");

    await updatePet(id, { name: "Luna 2" });
    expect(latest.find((p) => p.id === id)?.name).toBe("Luna 2");

    await deletePet(id);
    expect(latest.find((p) => p.id === id)).toBeUndefined();
    unsub();
  });

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
    let latest: Array<{ id: string; title: string; note?: string }> = [];
    const unsub = subscribeHealthEventsRange(petId, 0, Date.now() + 365 * 24 * 60 * 60 * 1000, 50, (items) => {
      latest = items.map((e) => ({ id: e.id, title: e.title, note: e.note }));
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

    await updateHealthEvent(petId, id, { note: deleteField() });
    expect(latest.find((e) => e.id === id)?.note).toBeUndefined();

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

  it("vaccines CRUD", async () => {
    const { subscribeVaccines, createVaccine, updateVaccine, deleteVaccine, markVaccineGiven } = await import("@/data/vaccines");
    const petId = "pet_demo_vaccines";
    let latest: Array<{ id: string; name: string; intervalDays: number }> = [];
    const unsub = subscribeVaccines(petId, (items) => {
      latest = items.map((v) => ({ id: v.id, name: v.name, intervalDays: v.intervalDays }));
    });

    const id = await createVaccine(petId, {
      petId,
      name: "Rabbia",
      intervalDays: 365,
      reminderDaysBefore: 7,
      createdAt: Date.now(),
      createdBy: "u",
    });

    const v = latest.find((x) => x.id === id);
    expect(v?.name).toBe("Rabbia");

    const base = {
      id,
      petId,
      name: "Rabbia",
      intervalDays: 365,
      reminderDaysBefore: 7,
      nextDueAt: Date.now(),
      createdAt: Date.now(),
      createdBy: "u",
      updatedAt: Date.now(),
    };

    await updateVaccine(petId, base, { intervalDays: 180 });
    expect(latest.find((x) => x.id === id)?.intervalDays).toBe(180);

    await markVaccineGiven(
      petId,
      { ...base, intervalDays: 180 },
      Date.now()
    );

    await deleteVaccine(petId, id);
    expect(latest.find((x) => x.id === id)).toBeUndefined();
    unsub();
  });

  it("medications CRUD", async () => {
    const { subscribeMedications, createMedication, updateMedication, deleteMedication, setMedicationEnabled } = await import("@/data/medications");
    const petId = "pet_demo_meds";
    let latest: Array<{ id: string; name: string; enabled: boolean }> = [];
    const unsub = subscribeMedications(petId, (items) => {
      latest = items.map((m) => ({ id: m.id, name: m.name, enabled: m.enabled }));
    });

    const id = await createMedication(petId, {
      petId,
      name: "Antibiotico",
      times: ["08:00"],
      startAt: Date.now(),
      enabled: true,
      createdAt: Date.now(),
      createdBy: "u",
    });
    expect(latest.find((m) => m.id === id)?.name).toBe("Antibiotico");

    await setMedicationEnabled(petId, id, false);
    expect(latest.find((m) => m.id === id)?.enabled).toBe(false);

    await updateMedication(
      petId,
      { id, petId, name: "Antibiotico", times: ["08:00"], startAt: Date.now(), enabled: false, createdAt: Date.now(), createdBy: "u" },
      { name: "Antibiotico 2" }
    );
    expect(latest.find((m) => m.id === id)?.name).toBe("Antibiotico 2");

    await deleteMedication(petId, id);
    expect(latest.find((m) => m.id === id)).toBeUndefined();
    unsub();
  });

  it("gps CRUD", async () => {
    const { subscribeGpsHistory, createGpsPoint, deleteGpsPoint, clearGpsHistory } = await import("@/data/gps");
    const petId = "pet_demo_gps";
    let latest: Array<{ id: string; recordedAt: number }> = [];
    const unsub = subscribeGpsHistory(petId, 50, (points) => {
      latest = points.map((p) => ({ id: p.id, recordedAt: p.recordedAt }));
    });

    const id = await createGpsPoint(petId, {
      petId,
      lat: 45,
      lng: 9,
      accuracyM: 10,
      recordedAt: Date.now(),
      createdAt: Date.now(),
      createdBy: "u",
    });
    expect(latest.find((p) => p.id === id)).toBeTruthy();

    await deleteGpsPoint(petId, id);
    expect(latest.find((p) => p.id === id)).toBeUndefined();

    const id2 = await createGpsPoint(petId, {
      petId,
      lat: 45,
      lng: 9,
      accuracyM: 10,
      recordedAt: Date.now(),
      createdAt: Date.now(),
      createdBy: "u",
    });
    expect(latest.find((p) => p.id === id2)).toBeTruthy();
    await clearGpsHistory(petId, 50);
    unsub();
  });
});
