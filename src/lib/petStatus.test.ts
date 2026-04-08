import { describe, expect, it } from "vitest";
import { computePetStatus } from "@/lib/petStatus";
import type { HealthEvent, Pet, PetLog, PetTask, PetVaccine } from "@/types";

function basePet(): Pet {
  return { id: "p1", ownerId: "u1", name: "Luna", species: "dog", createdAt: 1 };
}

describe("computePetStatus", () => {
  it("diventa rosso con sintomo severità alta recente", () => {
    const nowMs = Date.now();
    const healthEvents: HealthEvent[] = [
      { id: "e1", petId: "p1", type: "symptom", occurredAt: nowMs - 10 * 60 * 1000, title: "Allarme", severity: "high", createdAt: nowMs, createdBy: "u1" },
    ];
    const snap = computePetStatus({ pet: basePet(), logs30d: [], tasks: [], healthEvents, vaccines: [], nowMs });
    expect(snap.overall).toBe("red");
    expect(snap.health).toBe("red");
  });

  it("diventa verde con log regolari e nessun sintomo", () => {
    const nowMs = Date.now();
    const logs30d: PetLog[] = [
      { id: "l1", petId: "p1", type: "food", occurredAt: nowMs - 2 * 60 * 60 * 1000, createdAt: nowMs, createdBy: "u1" },
      { id: "l2", petId: "p1", type: "water", occurredAt: nowMs - 3 * 60 * 60 * 1000, createdAt: nowMs, createdBy: "u1" },
      { id: "l3", petId: "p1", type: "activity", occurredAt: nowMs - 6 * 60 * 60 * 1000, createdAt: nowMs, createdBy: "u1" },
      { id: "l4", petId: "p1", type: "activity", occurredAt: nowMs - 2 * 24 * 60 * 60 * 1000, createdAt: nowMs, createdBy: "u1" },
      { id: "l5", petId: "p1", type: "activity", occurredAt: nowMs - 3 * 24 * 60 * 60 * 1000, createdAt: nowMs, createdBy: "u1" },
    ];
    const tasks: PetTask[] = [
      { id: "t1", petId: "p1", title: "Pillola", dueAt: nowMs - 2 * 24 * 60 * 60 * 1000, status: "done", createdAt: nowMs, createdBy: "u1", completedAt: nowMs - 2 * 24 * 60 * 60 * 1000 },
    ];
    const vaccines: PetVaccine[] = [];
    const snap = computePetStatus({ pet: { ...basePet(), currentFood: { label: "Crocchette" } }, logs30d, tasks, healthEvents: [], vaccines, nowMs });
    expect(snap.overall).toBe("green");
    expect(snap.food).toBe("green");
    expect(snap.activity).toBeDefined();
  });

  it("segnala attenzione quando mancano log alimentazione 24h", () => {
    const nowMs = Date.now();
    const logs30d: PetLog[] = [
      { id: "l1", petId: "p1", type: "water", occurredAt: nowMs - 3 * 60 * 60 * 1000, createdAt: nowMs, createdBy: "u1" },
    ];
    const snap = computePetStatus({ pet: basePet(), logs30d, tasks: [], healthEvents: [], vaccines: [], nowMs });
    expect(snap.food).toBe("yellow");
    expect(["yellow", "red"]).toContain(snap.overall);
  });
});

