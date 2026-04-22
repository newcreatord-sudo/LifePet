import { createTask } from "@/data/tasks";
import { createLog } from "@/data/logs";
import { createHealthEvent } from "@/data/health";
import { createVaccine } from "@/data/vaccines";
import { createMedication } from "@/data/medications";
import { createNotification } from "@/data/notifications";

export type StarterKitResult = "applied" | "already";

function keyForPet(petId: string) {
  return `lifepet:starterKit:${petId}`;
}

export async function seedStarterKit(petId: string, userId: string): Promise<StarterKitResult> {
  try {
    if (localStorage.getItem(keyForPet(petId)) === "1") return "already";
  } catch {
    // ignore
  }

  const now = Date.now();

  await createLog(petId, {
    petId,
    type: "weight",
    occurredAt: now - 2 * 24 * 60 * 60 * 1000,
    value: { amount: 12.4, unit: "kg" },
    note: "Pesata iniziale",
    createdAt: now,
    createdBy: userId,
  });
  await createLog(petId, {
    petId,
    type: "water",
    occurredAt: now - 6 * 60 * 60 * 1000,
    value: { amount: 250, unit: "ml", tags: ["bowl"] },
    note: "Acqua (ciotola)",
    createdAt: now,
    createdBy: userId,
  });
  await createLog(petId, {
    petId,
    type: "activity",
    occurredAt: now - 5 * 60 * 60 * 1000,
    value: { amount: 20, unit: "min" },
    note: "Passeggiata breve",
    createdAt: now,
    createdBy: userId,
  });

  await createHealthEvent(petId, {
    petId,
    type: "note",
    title: "Check iniziale",
    note: "Aggiungi qui visite, vaccini e note importanti.",
    occurredAt: now,
    createdAt: now,
    createdBy: userId,
  });

  await createTask(petId, {
    petId,
    title: "Controlla acqua (oggi)",
    dueAt: now + 60 * 60 * 1000,
    status: "due",
    createdAt: now,
    createdBy: userId,
  });
  await createTask(petId, {
    petId,
    title: "Aggiorna contatti veterinario",
    dueAt: now + 24 * 60 * 60 * 1000,
    status: "due",
    createdAt: now,
    createdBy: userId,
  });

  await createVaccine(petId, {
    petId,
    name: "Rabbia",
    intervalDays: 365,
    reminderDaysBefore: 14,
    notes: "Esempio: aggiorna con indicazioni del veterinario.",
    createdAt: now,
    createdBy: userId,
    lastAt: null,
  });

  await createMedication(petId, {
    petId,
    name: "Antiparassitario (esempio)",
    dose: "1",
    unit: "dose",
    route: "orale",
    times: ["09:00"],
    startAt: now,
    endAt: now + 6 * 24 * 60 * 60 * 1000,
    enabled: true,
    notes: "Esempio: sostituisci con la terapia reale.",
    createdAt: now,
    createdBy: userId,
  });

  await createNotification(petId, {
    petId,
    createdBy: userId,
    type: "welcome",
    title: "Benvenuto in PetLyon",
    body: "Suggerimento: usa Planner e Agenda per promemoria, e Documenti per referti e ricette (backup cloud).",
    severity: "info",
    createdAt: now,
    read: false,
  });
  await createNotification(petId, {
    petId,
    createdBy: userId,
    type: "task_due_starter",
    title: "Primo passo: contatti veterinario",
    body: "Apri Pets → Veterinario e inserisci telefono + emergenze. Ti servirà in Vet SOS.",
    severity: "warning",
    createdAt: now + 1000,
    read: false,
  });

  try {
    localStorage.setItem(keyForPet(petId), "1");
  } catch {
    // ignore
  }

  return "applied";
}
