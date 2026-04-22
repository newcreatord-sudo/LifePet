import { describe, expect, it } from "vitest";
import { DEFAULT_ADOPTION_QUIZ, scoreAdoption } from "@/lib/adoptionMatch";
import type { AdoptionPost } from "@/types";

function p(overrides: Partial<AdoptionPost>): AdoptionPost {
  return {
    id: "a",
    createdAt: Date.now(),
    createdBy: "u",
    status: "active",
    species: "dog",
    description: "test",
    ...overrides,
  };
}

describe("adoptionMatch", () => {
  it("penalizza mismatch specie", () => {
    const q = { ...DEFAULT_ADOPTION_QUIZ, preference: "cat" as const };
    const r = scoreAdoption(p({ species: "dog", description: "cane" }), q);
    expect(r.score).toBeLessThan(1);
  });

  it("premia tag kids_ok quando kids presenti", () => {
    const q = { ...DEFAULT_ADOPTION_QUIZ, kids: "young" as const };
    const r = scoreAdoption(p({ temperamentTags: ["kids_ok"], description: "adatto ai bambini" }), q);
    expect(r.score).toBeGreaterThan(50);
    expect(r.reasons.join(" ")).toMatch(/bambini/i);
  });

  it("penalizza no_kids quando kids presenti", () => {
    const q = { ...DEFAULT_ADOPTION_QUIZ, kids: "young" as const };
    const r = scoreAdoption(p({ temperamentTags: ["no_kids"], description: "non adatto ai bambini" }), q);
    expect(r.score).toBeLessThan(20);
  });
});

