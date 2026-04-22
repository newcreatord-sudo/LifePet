import { describe, expect, it } from "vitest";
import { agendaEventDedupeKey, agendaSeriesDedupeKey } from "@/lib/agendaDedupe";

describe("agendaDedupe", () => {
  it("genera chiave stabile per evento", () => {
    const k1 = agendaEventDedupeKey("  Chiamare   Vet ", "vet", 1700000000123);
    const k2 = agendaEventDedupeKey("chiamare vet", "vet", 1700000000999);
    expect(k1).toBe(k2);
  });

  it("genera chiave stabile per serie giornaliera", () => {
    const k1 = agendaSeriesDedupeKey({ title: "Farmaco", kind: "other", timeOfDay: "09:00", recurrence: { type: "daily" } });
    const k2 = agendaSeriesDedupeKey({ title: "  farmaco ", kind: "other", timeOfDay: "09:00", recurrence: { type: "daily" } });
    expect(k1).toBe(k2);
  });

  it("normalizza weekday della serie settimanale", () => {
    const k1 = agendaSeriesDedupeKey({
      title: "Training",
      kind: "training",
      timeOfDay: "18:30",
      recurrence: { type: "weekly", weekdays: [1, 3, 5] },
    });
    const k2 = agendaSeriesDedupeKey({
      title: "training",
      kind: "training",
      timeOfDay: "18:30",
      recurrence: { type: "weekly", weekdays: [5, 3, 1, 3] },
    });
    expect(k1).toBe(k2);
  });
});

